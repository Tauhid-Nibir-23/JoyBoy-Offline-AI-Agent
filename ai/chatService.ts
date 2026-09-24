import { AIProvider, ChatMessage, GenerateOptions, GenerationMetrics } from './provider';
import { MockAIProvider } from './mockProvider';
import { LlamaCppProvider } from './llamaCppProvider';
import {
  getAllConversations,
  createConversationInDB,
  updateConversationTitleInDB,
  deleteConversationFromDB,
  getMessagesByConversationId,
  insertMessageInDB,
  getSetting,
  setSetting,
  DBConversation
} from '../database/db';

export interface SendMessageOptions {
  onToken?: (token: string, accumulated: string) => void;
  signal?: AbortSignal;
  temperature?: number;
  maxTokens?: number;
}

export class ChatService {
  private customProvider: AIProvider | null = null;
  private mockProvider: MockAIProvider;
  private llamaProvider: LlamaCppProvider;
  private lastResolvedProvider: AIProvider;

  constructor(provider?: AIProvider) {
    this.mockProvider = new MockAIProvider();
    this.llamaProvider = new LlamaCppProvider();
    this.customProvider = provider || null;
    this.lastResolvedProvider = this.customProvider || this.mockProvider;
  }

  public setProvider(provider: AIProvider): void {
    this.customProvider = provider;
    this.lastResolvedProvider = provider;
  }

  public getProviderType(): 'mock' | 'llamacpp' | 'auto' {
    const saved = getSetting('ai_provider');
    if (saved === 'mock' || saved === 'llamacpp') {
      return saved;
    }
    return 'auto';
  }

  public setProviderType(type: 'mock' | 'llamacpp' | 'auto'): void {
    setSetting('ai_provider', type);
  }

  public async resolveProvider(): Promise<AIProvider> {
    if (this.customProvider) {
      this.lastResolvedProvider = this.customProvider;
      return this.customProvider;
    }

    const type = this.getProviderType();

    if (type === 'mock') {
      this.lastResolvedProvider = this.mockProvider;
      return this.mockProvider;
    }

    if (type === 'llamacpp') {
      const isReady = await this.llamaProvider.isAvailable();
      if (isReady) {
        this.lastResolvedProvider = this.llamaProvider;
        return this.llamaProvider;
      }
      // If user selected llama.cpp but local inference is unavailable, fall back safely to Mock
      this.lastResolvedProvider = this.mockProvider;
      return this.mockProvider;
    }

    // 'auto' mode: Use local llama.cpp if ready, otherwise fallback to mock
    const isReady = await this.llamaProvider.isAvailable();
    if (isReady) {
      this.lastResolvedProvider = this.llamaProvider;
      return this.llamaProvider;
    }
    this.lastResolvedProvider = this.mockProvider;
    return this.mockProvider;
  }

  public getActiveProviderSync(): { id: string; name: string; isLocalAI: boolean } {
    const provider = this.lastResolvedProvider;
    return {
      id: provider.id,
      name: provider.name,
      isLocalAI: provider.id === 'llamacpp'
    };
  }

  public async getProviderName(): Promise<string> {
    const provider = await this.resolveProvider();
    return provider.name;
  }

  public getConversations(): DBConversation[] {
    return getAllConversations();
  }

  public createConversation(initialTitle: string = 'New Conversation'): DBConversation {
    const id = 'conv_' + Date.now() + '_' + Math.random().toString(36).substring(2, 7);
    return createConversationInDB(id, initialTitle);
  }

  public deleteConversation(id: string): void {
    deleteConversationFromDB(id);
  }

  public renameConversation(id: string, newTitle: string): void {
    if (!newTitle.trim()) return;
    updateConversationTitleInDB(id, newTitle.trim());
  }

  public getMessages(conversationId: string): ChatMessage[] {
    const dbMsgs = getMessagesByConversationId(conversationId);
    return dbMsgs.map((m) => ({
      id: m.id,
      conversationId: m.conversation_id,
      role: m.role,
      content: m.content,
      createdAt: m.created_at
    }));
  }

  public async sendMessage(
    conversationId: string,
    userText: string,
    options?: SendMessageOptions
  ): Promise<{ userMessage: ChatMessage; assistantMessage: ChatMessage }> {
    const trimmed = userText.trim();
    if (!trimmed) {
      throw new Error('Cannot send empty message');
    }

    const now = new Date().toISOString();
    const userMsgId = 'msg_u_' + Date.now() + '_' + Math.random().toString(36).substring(2, 7);
    const userMsg: ChatMessage = {
      id: userMsgId,
      conversationId,
      role: 'user',
      content: trimmed,
      createdAt: now
    };

    // Save user message to SQLite
    insertMessageInDB({
      id: userMsg.id,
      conversation_id: userMsg.conversationId,
      role: userMsg.role,
      content: userMsg.content,
      created_at: userMsg.createdAt
    });

    // Auto-update conversation title if it's the first user message
    const currentMsgs = this.getMessages(conversationId);
    if (currentMsgs.length <= 1) {
      const generatedTitle = trimmed.length > 30 ? trimmed.substring(0, 30) + '...' : trimmed;
      this.renameConversation(conversationId, generatedTitle);
    }

    // Resolve active AI provider (LlamaCpp if model is present and valid, otherwise Mock fallback)
    const provider = await this.resolveProvider();

    let accumulatedText = '';
    let recordedMetrics: GenerationMetrics | undefined;

    const generateOptions: GenerateOptions = {
      temperature: options?.temperature,
      maxTokens: options?.maxTokens,
      signal: options?.signal,
      callbacks: {
        onToken: (chunk: string) => {
          accumulatedText += chunk;
          options?.onToken?.(chunk, accumulatedText);
        },
        onComplete: (_text: string, metrics?: GenerationMetrics) => {
          recordedMetrics = metrics;
        }
      }
    };

    let assistantText = '';
    let wasCancelled = false;

    try {
      assistantText = await provider.generateResponse(currentMsgs, generateOptions);
    } catch (err: any) {
      if (err.message?.includes('cancelled') || options?.signal?.aborted) {
        wasCancelled = true;
        assistantText = accumulatedText
          ? `${accumulatedText}\n\n*[Generation stopped by user]*`
          : '*[Generation stopped by user]*';
      } else {
        // Clear, human-understandable error handling without cloud fallback
        const friendlyError = err.message || 'An unexpected error occurred during local inference.';
        assistantText = `⚠️ **Local AI Error:** ${friendlyError}`;
      }
    }

    // Append performance footer metadata if metrics exist and generation wasn't stopped with an error
    let finalContent = assistantText;
    if (recordedMetrics && !wasCancelled && !assistantText.startsWith('⚠️ **Local AI Error:**')) {
      const tag = recordedMetrics.providerId === 'llamacpp'
        ? `*Local AI · ${recordedMetrics.modelName || 'GGUF'} · ${recordedMetrics.tokensPerSecond || 0} tok/s*`
        : `*Mock Assistant · Offline Fallback*`;
      finalContent = `${assistantText}\n\n${tag}`;
    }

    const assistantMsgId = 'msg_a_' + Date.now() + '_' + Math.random().toString(36).substring(2, 7);
    const assistantMsg: ChatMessage = {
      id: assistantMsgId,
      conversationId,
      role: 'assistant',
      content: finalContent,
      createdAt: new Date().toISOString(),
      providerId: provider.id,
      metrics: recordedMetrics
    };

    // Save assistant message to SQLite
    insertMessageInDB({
      id: assistantMsg.id,
      conversation_id: assistantMsg.conversationId,
      role: assistantMsg.role,
      content: assistantMsg.content,
      created_at: assistantMsg.createdAt
    });

    return { userMessage: userMsg, assistantMessage: assistantMsg };
  }
}

export const chatService = new ChatService();

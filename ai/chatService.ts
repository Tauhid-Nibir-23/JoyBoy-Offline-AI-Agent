import { AIProvider, ChatMessage, GenerateOptions, GenerationMetrics, ChatMessageSource } from './provider';
import { MockAIProvider } from './mockProvider';
import { LlamaCppProvider } from './llamaCppProvider';
import { ragService } from '../rag';
import { resolveResponseLanguage, buildLanguageSystemPrompt } from './languageDetector';
import { conversationMemory } from './conversationMemory';
import { queryRewriter } from './queryRewriter';
import { conversationContextManager } from './contextManager';
import { validateResponse } from './responseValidator';
import { inferenceDiagnostics } from './inferenceDiagnostics';
import { modelManager } from '../models/manager';
import {
  getAllConversations,
  createConversationInDB,
  updateConversationTitleInDB,
  deleteConversationFromDB,
  getMessagesByConversationId,
  insertMessageInDB,
  deleteMessageFromDB,
  clearMessagesByConversationId,
  getSetting,
  setSetting,
  attachDocumentToConversation,
  detachDocumentFromConversation,
  getDocumentIdsForConversation,
  getAllAttachedDocumentIds,
  getDocumentsForConversation,
  DBConversation,
  DBDocument,
  isDatabaseReady,
  initDatabase
} from '../database/db';

export interface SendMessageOptions {
  onToken?: (token: string, accumulated: string) => void;
  signal?: AbortSignal;
  temperature?: number;
  maxTokens?: number;
  useStudyMaterials?: boolean;
}

export class ChatService {
  private customProvider: AIProvider | null = null;
  private mockProvider: MockAIProvider;
  private llamaProvider: LlamaCppProvider;
  private lastResolvedProvider: AIProvider;
  private lastRecordedSpeedTokPerSec: number | null = null;

  constructor(provider?: AIProvider) {
    this.mockProvider = new MockAIProvider();
    this.llamaProvider = new LlamaCppProvider();
    this.customProvider = provider || null;
    this.lastResolvedProvider = this.customProvider || this.mockProvider;
  }

  public async ensureDatabaseReady(): Promise<boolean> {
    if (isDatabaseReady()) return true;
    return await initDatabase();
  }

  public setProvider(provider: AIProvider): void {
    this.customProvider = provider;
    this.lastResolvedProvider = provider;
  }

  public getProviderType(): 'mock' | 'llamacpp' | 'auto' {
    if (!isDatabaseReady()) return 'auto';
    const saved = getSetting('ai_provider');
    if (saved === 'mock' || saved === 'llamacpp') {
      return saved;
    }
    return 'auto';
  }

  public setProviderType(type: 'mock' | 'llamacpp' | 'auto'): void {
    if (!isDatabaseReady()) return;
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

  /**
   * Phase 11 Section 15: Model Health Check
   * Explicitly verifies that the local model exists, can load, and engine is ready
   * without masking errors behind MockProvider.
   */
  public async verifyModelHealth(): Promise<{ ready: boolean; error?: string; modelName?: string }> {
    const type = this.getProviderType();
    if (type === 'mock') {
      return { ready: true, modelName: 'Mock Provider' };
    }
    const isReady = await this.llamaProvider.isAvailable();
    if (!isReady) {
      return {
        ready: false,
        error: 'Local llama.cpp inference engine is not ready or the active model GGUF file is missing. Please verify your model in Settings → AI Models.'
      };
    }
    return { ready: true, modelName: this.llamaProvider.name };
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
    if (!isDatabaseReady()) return [];
    return getAllConversations();
  }

  public createConversation(initialTitle: string = 'New Conversation'): DBConversation {
    if (!isDatabaseReady()) {
      throw new Error('Database not initialized');
    }
    const id = 'conv_' + Date.now() + '_' + Math.random().toString(36).substring(2, 7);
    return createConversationInDB(id, initialTitle);
  }

  public deleteConversation(id: string): void {
    if (!isDatabaseReady()) return;
    deleteConversationFromDB(id);
  }

  public clearConversation(id: string): void {
    if (!isDatabaseReady()) return;
    clearMessagesByConversationId(id);
  }

  public deleteMessage(messageId: string): void {
    if (!isDatabaseReady()) return;
    deleteMessageFromDB(messageId);
  }

  public getLastSpeed(): number | null {
    return this.lastRecordedSpeedTokPerSec;
  }

  public renameConversation(id: string, newTitle: string): void {
    if (!isDatabaseReady() || !newTitle.trim()) return;
    updateConversationTitleInDB(id, newTitle.trim());
  }

  public isStudyMaterialsEnabled(): boolean {
    if (!isDatabaseReady()) return true;
    const val = getSetting('use_study_materials');
    return val !== 'false';
  }

  public setStudyMaterialsEnabled(enabled: boolean): void {
    if (!isDatabaseReady()) return;
    setSetting('use_study_materials', enabled ? 'true' : 'false');
  }

  // Phase 8: Chat-Scoped Document Methods
  public getAttachedDocuments(conversationId: string): DBDocument[] {
    if (!isDatabaseReady()) return [];
    return getDocumentsForConversation(conversationId);
  }

  public getAttachedDocumentIds(conversationId: string): string[] {
    if (!isDatabaseReady()) return [];
    return getDocumentIdsForConversation(conversationId);
  }

  public attachDocument(conversationId: string, documentId: string): void {
    if (!isDatabaseReady()) return;
    attachDocumentToConversation(conversationId, documentId);
  }

  public detachDocument(conversationId: string, documentId: string): void {
    if (!isDatabaseReady()) return;
    detachDocumentFromConversation(conversationId, documentId);
  }

  public getMessages(conversationId: string): ChatMessage[] {
    if (!isDatabaseReady()) return [];
    const dbMsgs = getMessagesByConversationId(conversationId);
    return dbMsgs.map((m) => {
      let sources: ChatMessageSource[] | undefined = undefined;
      if (m.sources_json) {
        try {
          sources = JSON.parse(m.sources_json);
        } catch {
          sources = undefined;
        }
      }
      return {
        id: m.id,
        conversationId: m.conversation_id,
        role: m.role,
        content: m.content,
        createdAt: m.created_at,
        sources
      };
    });
  }

  public async sendMessage(
    conversationId: string,
    userText: string,
    options?: SendMessageOptions
  ): Promise<{ userMessage: ChatMessage; assistantMessage: ChatMessage }> {
    const ready = await this.ensureDatabaseReady();
    if (!ready || !isDatabaseReady()) {
      throw new Error('Database not initialized');
    }

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

    const assistantMsg = await this.executeInferenceAndSave(conversationId, currentMsgs, trimmed, options);
    return { userMessage: userMsg, assistantMessage: assistantMsg };
  }

  public async regenerateLastAnswer(
    conversationId: string,
    options?: SendMessageOptions
  ): Promise<ChatMessage | null> {
    const ready = await this.ensureDatabaseReady();
    if (!ready || !isDatabaseReady()) {
      throw new Error('Database not initialized');
    }

    const messages = this.getMessages(conversationId);
    if (messages.length === 0) return null;

    // If last message is assistant, delete it from DB and state
    let promptMsgs = [...messages];
    const lastMsg = promptMsgs[promptMsgs.length - 1];
    if (lastMsg.role === 'assistant') {
      deleteMessageFromDB(lastMsg.id);
      promptMsgs.pop();
    }

    // Find the latest user message
    const lastUserMsg = [...promptMsgs].reverse().find((m) => m.role === 'user');
    if (!lastUserMsg) {
      throw new Error('No user prompt found in conversation to regenerate.');
    }

    // Generate new assistant response without duplicating user message
    return await this.executeInferenceAndSave(conversationId, promptMsgs, lastUserMsg.content, options);
  }

  public async retryFailedGeneration(
    conversationId: string,
    options?: SendMessageOptions
  ): Promise<ChatMessage | null> {
    return await this.regenerateLastAnswer(conversationId, options);
  }

  private async executeInferenceAndSave(
    conversationId: string,
    messageHistory: ChatMessage[],
    userQueryText: string,
    options?: SendMessageOptions
  ): Promise<ChatMessage> {
    // Determine whether to use local study materials (RAG)
    const useRAG = options?.useStudyMaterials !== undefined
      ? options.useStudyMaterials
      : this.isStudyMaterialsEnabled();

    let usedSources: ChatMessageSource[] = [];
    let promptMsgs = [...messageHistory];
    let ragSystemPrompt: string | undefined;

    // Phase 8 & 9: Chat-Scoped Document Filtering & Language Policy
    const attachedDocs = getDocumentsForConversation(conversationId);
    const attachedDocIds = attachedDocs.map((d) => d.id);
    const pref = getSetting('response_language') || 'auto';
    const targetLang = resolveResponseLanguage(userQueryText, pref);
    const langPolicy = buildLanguageSystemPrompt(targetLang);

    // Phase 9 Part 2: Update conversation memory from current state
    conversationMemory.updateMemory(conversationId, messageHistory, attachedDocs);

    // Document Isolation Rule:
    // If conversation has attached documents: retrieve ONLY from those documents.
    // If conversation has NO attached documents, but other conversations have attached materials:
    // do NOT retrieve other conversations' documents (strict chat isolation).
    // If no conversations have any attached documents (legacy/test fallback): allow unassigned retrieval.
    let eligibleDocFilter: string[] | undefined = undefined;
    let shouldRunRAG = useRAG;

    if (attachedDocIds.length > 0) {
      eligibleDocFilter = attachedDocIds;
    } else {
      const allAttached = getAllAttachedDocumentIds();
      if (allAttached.length > 0) {
        shouldRunRAG = false;
      }
    }

    let rewrittenQueryInfo = queryRewriter.rewriteQuery(conversationId, userQueryText, messageHistory);
    let resolvedUserPrompt = userQueryText;

    if (rewrittenQueryInfo.wasRewritten) {
      const memory = conversationMemory.getMemory(conversationId);
      memory.lastUserIntent = rewrittenQueryInfo.targetAction || rewrittenQueryInfo.intent;
    }

    if (shouldRunRAG) {
      try {
        const searchQuery = rewrittenQueryInfo.resolvedQuery;

        const ragContext = await ragService.buildContext(searchQuery, {
          filterDocumentIds: eligibleDocFilter,
          hasAttachedDocuments: attachedDocs.length > 0
        });

        if (ragContext.usedKnowledge && ragContext.sources.length > 0) {
          usedSources = ragContext.sources;
          ragSystemPrompt = ragContext.systemInstruction;
        } else if (ragContext.systemInstruction) {
          // No relevant document chunks found in this conversation's attached materials
          ragSystemPrompt = ragContext.systemInstruction;
        }
      } catch (ragErr) {
        console.warn('RAG context retrieval failed, proceeding with normal chat:', ragErr);
      }
    }

    if (!ragSystemPrompt) {
      ragSystemPrompt = 
`You are JoyBoy, a private offline study assistant.
Your job is to answer the student's actual question directly and accurately.

Rules:
1. Follow the latest user question.
2. Use conversation context when the user refers to previous messages.
3. Use attached study materials when relevant.
4. Do not invent information from documents. Never fabricate citations.
5. If information is missing, say so honestly.
6. Do not repeat the same sentence or phrase unnecessarily.
7. Be concise unless the user asks for detail.
8. Explain difficult concepts using simple examples when appropriate.
9. Never answer a previous question instead of the current question.

${langPolicy}`;
    }

    // Phase 10 & 11: Token-budget-aware context window assembly with resolved context
    const assembledContext = conversationContextManager.assembleContext({
      conversationId,
      history: promptMsgs,
      attachedDocs,
      systemInstruction: ragSystemPrompt,
      currentUserMessageText: userQueryText,
      resolvedContext: rewrittenQueryInfo.resolvedContext,
      resolvedQuery: rewrittenQueryInfo.resolvedQuery,
      intent: rewrittenQueryInfo.intent
    });
    promptMsgs = assembledContext.messages;

    // Resolve active AI provider (LlamaCpp if model is present and valid, otherwise Mock fallback)
    const provider = await this.resolveProvider();

    // Record inference diagnostics for safe developer observability
    const activeModel = modelManager.getActiveModel();
    const memoryState = conversationMemory.getMemory(conversationId);
    inferenceDiagnostics.record({
      timestamp: new Date().toISOString(),
      modelName: activeModel?.name || (provider.id === 'llamacpp' ? 'Local GGUF' : 'Mock Provider'),
      modelPath: activeModel?.path,
      providerId: provider.id,
      contextSize: assembledContext.contextTokensEstimate,
      maxTokens: options?.maxTokens || 512,
      temperature: options?.temperature || 0.4,
      historyTurnsCount: assembledContext.messages.filter((m) => m.role !== 'system').length,
      tokenEstimate: assembledContext.contextTokensEstimate,
      activeTopic: memoryState.activeTopic || null,
      activeSubtopic: memoryState.activeSubtopic || null,
      activeChapter: memoryState.activeChapter || null,
      originalUserPrompt: userQueryText,
      resolvedQuery: rewrittenQueryInfo.resolvedQuery,
      resolvedContext: rewrittenQueryInfo.resolvedContext,
      intent: rewrittenQueryInfo.intent,
      retrievedChunkCount: usedSources.length,
      documentNames: attachedDocs.map((d) => d.filename),
      systemPromptPreview: ragSystemPrompt.slice(0, 160) + '...',
      isFallback: activeModel?.isFallback || activeModel?.id === 'qwen2.5-0.5b-instruct-q4_k_m',
      fallbackReason: activeModel?.id === 'qwen2.5-0.5b-instruct-q4_k_m' ? '3B model is not installed or unavailable on disk' : null
    });

    let accumulatedText = '';
    let recordedMetrics: GenerationMetrics | undefined;

    const generateOptions: GenerateOptions = {
      temperature: options?.temperature,
      maxTokens: options?.maxTokens,
      systemPrompt: ragSystemPrompt,
      signal: options?.signal,
      callbacks: {
        onToken: (chunk: string) => {
          accumulatedText += chunk;
          options?.onToken?.(chunk, accumulatedText);
        },
        onComplete: (_text: string, metrics?: GenerationMetrics) => {
          recordedMetrics = metrics;
          if (metrics?.tokensPerSecond) {
            this.lastRecordedSpeedTokPerSec = metrics.tokensPerSecond;
          }
        }
      }
    };

    let assistantText = '';
    let wasCancelled = false;

    try {
      assistantText = await provider.generateResponse(promptMsgs, generateOptions);

      // Phase 10 Section 18: Lightweight response self-check layer with single retry
      const memoryState = conversationMemory.getMemory(conversationId);
      const validation = validateResponse({
        userQuery: userQueryText,
        assistantResponse: assistantText,
        activeTopic: memoryState.activeTopic,
        previousQuestion: memoryState.lastUserQuery,
        previousAssistantSnippet: memoryState.lastAssistantAnswerSnippet,
        hasAttachedDocs: attachedDocs.length > 0,
        expectedLanguage: targetLang === 'banglish' ? 'bn' : (targetLang as 'bn' | 'en')
      });

      if (validation.retryNeeded && validation.correctedInstruction && !options?.signal?.aborted) {
        // Retry ONCE with corrected compact instruction
        const retrySystemPrompt = `${ragSystemPrompt}\n\n[SELF-CHECK CORRECTION]:\n${validation.correctedInstruction}`;
        const retryOptions = { ...generateOptions, systemPrompt: retrySystemPrompt };
        try {
          const retriedText = await provider.generateResponse(promptMsgs, retryOptions);
          if (retriedText && retriedText.length >= 10) {
            assistantText = retriedText;
          }
        } catch {
          // If retry fails, keep original assistantText
        }
      }
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

    // Clean message content without noisy trailing footers polluting future context
    const finalContent = assistantText;

    if (recordedMetrics) {
      const currentDiag = inferenceDiagnostics.getLatest();
      if (currentDiag) {
        inferenceDiagnostics.record({
          ...currentDiag,
          generationSpeedTokPerSec: recordedMetrics.tokensPerSecond,
          firstTokenLatencyMs: recordedMetrics.firstTokenLatencyMs
        });
      }
    }

    const assistantMsgId = 'msg_a_' + Date.now() + '_' + Math.random().toString(36).substring(2, 7);
    const assistantMsg: ChatMessage = {
      id: assistantMsgId,
      conversationId,
      role: 'assistant',
      content: finalContent,
      createdAt: new Date().toISOString(),
      providerId: provider.id,
      metrics: recordedMetrics,
      sources: usedSources.length > 0 ? usedSources : undefined
    };

    // Save assistant message to SQLite with persisted source citations
    insertMessageInDB({
      id: assistantMsg.id,
      conversation_id: assistantMsg.conversationId,
      role: assistantMsg.role,
      content: assistantMsg.content,
      sources_json: assistantMsg.sources ? JSON.stringify(assistantMsg.sources) : null,
      created_at: assistantMsg.createdAt
    });

    // Phase 9: Update conversation memory with completed turn
    conversationMemory.updateMemory(conversationId, [...messageHistory, assistantMsg], attachedDocs);

    return assistantMsg;
  }
}

export const chatService = new ChatService();


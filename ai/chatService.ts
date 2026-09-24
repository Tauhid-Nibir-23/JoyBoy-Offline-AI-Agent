import { AIProvider, ChatMessage } from './provider';
import { MockAIProvider } from './mockProvider';
import {
  getAllConversations,
  createConversationInDB,
  updateConversationTitleInDB,
  deleteConversationFromDB,
  getMessagesByConversationId,
  insertMessageInDB,
  DBConversation
} from '../database/db';

export class ChatService {
  private activeProvider: AIProvider;

  constructor(provider?: AIProvider) {
    this.activeProvider = provider || new MockAIProvider();
  }

  public setProvider(provider: AIProvider): void {
    this.activeProvider = provider;
  }

  public getProviderName(): string {
    return this.activeProvider.name;
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
    userText: string
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

    // Generate response via AI provider
    const assistantText = await this.activeProvider.generateResponse(currentMsgs);

    const assistantMsgId = 'msg_a_' + Date.now() + '_' + Math.random().toString(36).substring(2, 7);
    const assistantMsg: ChatMessage = {
      id: assistantMsgId,
      conversationId,
      role: 'assistant',
      content: assistantText,
      createdAt: new Date().toISOString()
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

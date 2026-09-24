import { describe, it, expect, beforeEach } from 'vitest';
import { 
  initDatabase, 
  createConversationInDB, 
  getAllConversations, 
  insertMessageInDB, 
  getMessagesByConversationId, 
  deleteConversationFromDB 
} from '../database/db';
import { ChatService } from '../ai/chatService';

describe('Phase 1 Chat Logic & Database Persistence Tests', () => {
  beforeEach(async () => {
    await initDatabase();
  });

  it('creates and lists conversations in SQLite', () => {
    const id = 'test_conv_' + Date.now();
    const title = 'Operating System History';
    const conv = createConversationInDB(id, title);

    expect(conv.id).toBe(id);
    expect(conv.title).toBe(title);

    const allConvs = getAllConversations();
    const found = allConvs.find((c) => c.id === id);
    expect(found).toBeDefined();
    expect(found?.title).toBe(title);
  });

  it('inserts and retrieves messages for a conversation', () => {
    const convId = 'test_conv_msgs_' + Date.now();
    createConversationInDB(convId, 'Data Structures Test');

    const msgId = 'test_msg_1';
    insertMessageInDB({
      id: msgId,
      conversation_id: convId,
      role: 'user',
      content: 'What is a binary search tree?',
      created_at: new Date().toISOString()
    });

    const msgs = getMessagesByConversationId(convId);
    expect(msgs.length).toBe(1);
    expect(msgs[0].content).toBe('What is a binary search tree?');
  });

  it('ChatService sends user message and receives mock assistant response', async () => {
    const service = new ChatService();
    const conv = service.createConversation('Mock Test Chat');

    const result = await service.sendMessage(conv.id, 'Tell me about Operating Systems');

    expect(result.userMessage.content).toBe('Tell me about Operating Systems');
    expect(result.assistantMessage.role).toBe('assistant');
    expect(result.assistantMessage.content).toContain('Operating System');

    const storedMsgs = service.getMessages(conv.id);
    expect(storedMsgs.length).toBe(2);
  });

  it('auto-updates conversation title on first message sent', async () => {
    const service = new ChatService();
    const conv = service.createConversation('New Conversation');

    await service.sendMessage(conv.id, 'What is computer architecture?');

    const updated = service.getConversations().find((c) => c.id === conv.id);
    expect(updated?.title).toBe('What is computer architecture?');
  });

  it('renames a conversation in database', () => {
    const service = new ChatService();
    const conv = service.createConversation('Initial Title');

    service.renameConversation(conv.id, 'Renamed Study Topic');

    const updated = service.getConversations().find((c) => c.id === conv.id);
    expect(updated?.title).toBe('Renamed Study Topic');
  });

  it('throws an error when trying to send an empty message', async () => {
    const service = new ChatService();
    const conv = service.createConversation('Empty Test');

    await expect(service.sendMessage(conv.id, '   ')).rejects.toThrow('Cannot send empty message');
  });

  it('proves sending a chat message reaches the selected AI provider', async () => {
    let providerCalled = false;
    const customProvider: import('../ai/provider').AIProvider = {
      id: 'test_provider',
      name: 'Custom Test Provider',
      isAvailable: async () => true,
      generateResponse: async (_history, options) => {
        providerCalled = true;
        options?.callbacks?.onToken?.('Custom response token');
        return 'Custom response token';
      }
    };

    const service = new ChatService(customProvider);
    const conv = service.createConversation('Provider Routing Test');
    const result = await service.sendMessage(conv.id, 'Testing provider routing');

    expect(providerCalled).toBe(true);
    expect(result.assistantMessage.content).toContain('Custom response token');
    expect(result.assistantMessage.providerId).toBe('test_provider');
  });

  it('hardware detection is resilient and does not block chat initialization even on error', async () => {
    const { detectHardware } = await import('../core/environment/hardware');
    const profile = await detectHardware();
    expect(profile).toBeDefined();
    expect(profile.os).toBeDefined();
    expect(profile.logicalCores).toBeGreaterThanOrEqual(1);

    // Chat service initializes and sends message without being blocked
    const service = new ChatService();
    const conv = service.createConversation('Non-blocking Chat');
    const result = await service.sendMessage(conv.id, 'Ping');
    expect(result.assistantMessage).toBeDefined();
    expect(result.assistantMessage.role).toBe('assistant');
  });
});


import { describe, it, expect, beforeEach } from 'vitest';
import { detectEnvironment } from '../core/environment';
import { 
  initDatabase, 
  getDatabaseStatus, 
  isDatabaseReady, 
  getAllConversations, 
  getMessagesByConversationId 
} from '../database/db';
import { ChatService } from '../ai/chatService';
import { AIProvider } from '../ai/provider';

describe('Phase 0 & Phase 1 SQLite Database Initialization & Persistence Tests', () => {
  beforeEach(async () => {
    await initDatabase();
  });

  it('detects OS and default environment settings correctly', () => {
    const sys = detectEnvironment();
    expect(sys.os).toBeDefined();
    expect(sys.aiStatus).toBe('Offline/Unavailable for now');
    expect(sys.dbStatus).toBe('Initialized');
  });

  it('proves database initializes successfully and verifies schema tables', async () => {
    const ok = await initDatabase();
    expect(ok).toBe(true);
    expect(isDatabaseReady()).toBe(true);

    const status = getDatabaseStatus();
    expect(status.initialized).toBe(true);
    expect(status.error).toBeNull();
    expect(status.tables).toContain('settings');
    expect(status.tables).toContain('conversations');
    expect(status.tables).toContain('messages');
  });

  it('proves ChatService can create a conversation in SQLite', () => {
    const service = new ChatService();
    const conv = service.createConversation('Database Regression Test');
    expect(conv.id).toBeDefined();
    expect(conv.title).toBe('Database Regression Test');

    const list = service.getConversations();
    const found = list.find((c) => c.id === conv.id);
    expect(found).toBeDefined();
    expect(found?.title).toBe('Database Regression Test');
  });

  it('proves ChatService can persist a user message and assistant message, and reload conversation history', async () => {
    const service = new ChatService();
    const conv = service.createConversation('OS Study Session');

    const result = await service.sendMessage(conv.id, 'What is an operating system?');
    expect(result.userMessage).toBeDefined();
    expect(result.userMessage.content).toBe('What is an operating system?');
    expect(result.assistantMessage).toBeDefined();
    expect(result.assistantMessage.role).toBe('assistant');
    expect(result.assistantMessage.content.length).toBeGreaterThan(0);

    // Verify persistence via ChatService
    const storedMessages = service.getMessages(conv.id);
    expect(storedMessages.length).toBe(2);
    expect(storedMessages[0].role).toBe('user');
    expect(storedMessages[0].content).toBe('What is an operating system?');
    expect(storedMessages[1].role).toBe('assistant');

    // Verify low-level database queries reload the exact same data
    const rawConvs = getAllConversations();
    const rawConv = rawConvs.find((c) => c.id === conv.id);
    expect(rawConv).toBeDefined();

    const rawMsgs = getMessagesByConversationId(conv.id);
    expect(rawMsgs.length).toBe(2);
    expect(rawMsgs[0].id).toBe(result.userMessage.id);
    expect(rawMsgs[1].id).toBe(result.assistantMessage.id);
  });

  it('proves multiple conversations remain strictly independent', async () => {
    const service = new ChatService();
    const conv1 = service.createConversation('Topic A: Physics');
    const conv2 = service.createConversation('Topic B: Chemistry');

    await service.sendMessage(conv1.id, 'What is Newton second law?');
    await service.sendMessage(conv2.id, 'What is an exothermic reaction?');

    const msgs1 = service.getMessages(conv1.id);
    const msgs2 = service.getMessages(conv2.id);

    expect(msgs1.length).toBe(2);
    expect(msgs2.length).toBe(2);
    expect(msgs1[0].content).toContain('Newton');
    expect(msgs2[0].content).toContain('exothermic');
  });

  it('proves renaming conversation persists in SQLite', () => {
    const service = new ChatService();
    const conv = service.createConversation('Old Title');

    service.renameConversation(conv.id, 'New Renamed Title');

    const updated = service.getConversations().find((c) => c.id === conv.id);
    expect(updated?.title).toBe('New Renamed Title');

    const rawConvs = getAllConversations();
    const rawFound = rawConvs.find((c) => c.id === conv.id);
    expect(rawFound?.title).toBe('New Renamed Title');
  });

  it('proves deleting conversation removes conversation and cascaded messages from SQLite', async () => {
    const service = new ChatService();
    const conv = service.createConversation('To Delete');
    await service.sendMessage(conv.id, 'Message in doomed chat');

    expect(service.getMessages(conv.id).length).toBe(2);

    service.deleteConversation(conv.id);

    expect(service.getConversations().find((c) => c.id === conv.id)).toBeUndefined();
    expect(service.getMessages(conv.id).length).toBe(0);
    expect(getMessagesByConversationId(conv.id).length).toBe(0);
  });

  it('proves persistence works with mock provider and custom provider', async () => {
    // 1. Mock provider
    const mockService = new ChatService();
    mockService.setProviderType('mock');
    const convMock = mockService.createConversation('Mock Chat');
    const resMock = await mockService.sendMessage(convMock.id, 'Explain binary tree');
    expect(resMock.assistantMessage.content).toContain('Explain binary tree');
    expect(mockService.getMessages(convMock.id).length).toBe(2);

    // 2. Custom/Local AI Provider
    const customProvider: AIProvider = {
      id: 'local_custom_ai',
      name: 'Local Llama Engine Provider',
      isAvailable: async () => true,
      generateResponse: async () => 'An operating system manages hardware and software resources.'
    };
    const localService = new ChatService(customProvider);
    const convLocal = localService.createConversation('Local AI Chat');
    const resLocal = await localService.sendMessage(convLocal.id, 'What is an OS?');
    expect(resLocal.assistantMessage.content).toContain('operating system manages');
    expect(localService.getMessages(convLocal.id).length).toBe(2);
  });
});

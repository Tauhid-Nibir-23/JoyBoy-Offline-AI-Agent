import { describe, it, expect, beforeEach } from 'vitest';
import { initDatabase, createConversationInDB, getAllConversations, insertMessageInDB, getMessagesByConversationId, deleteConversationFromDB } from '../database/db';
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

  it('deletes conversation and associated messages', () => {
    const service = new ChatService();
    const conv = service.createConversation('To Delete');
    deleteConversationFromDB(conv.id);

    const all = service.getConversations();
    expect(all.find((c) => c.id === conv.id)).toBeUndefined();
  });
});

import { describe, it, expect, beforeEach } from 'vitest';
import { MockAIProvider } from '../ai/mockProvider';
import { LlamaCppProvider } from '../ai/llamaCppProvider';
import { LocalAIEngine } from '../ai/localEngine';
import { ChatService } from '../ai/chatService';
import { initDatabase, setSetting } from '../database/db';

describe('Phase 2A AI Provider Selection & Fallback Tests', () => {
  beforeEach(async () => {
    await initDatabase();
  });

  it('MockAIProvider is always available and responds correctly', async () => {
    const mock = new MockAIProvider();
    const available = await mock.isAvailable();
    expect(available).toBe(true);

    const history = [
      {
        id: 'msg_1',
        conversationId: 'test_conv',
        role: 'user' as const,
        content: 'Explain binary search',
        createdAt: new Date().toISOString()
      }
    ];

    const response = await mock.generateResponse(history);
    expect(response).toContain('Binary Search Algorithm');
  });

  it('LlamaCppProvider reports unavailable when no valid model is installed', async () => {
    const engine = new LocalAIEngine();
    await engine.initialize();
    const llamaProvider = new LlamaCppProvider(engine);

    const available = await llamaProvider.isAvailable();
    expect(available).toBe(false);
  });

  it('LlamaCppProvider rejects generation gracefully when engine is unavailable', async () => {
    const engine = new LocalAIEngine();
    await engine.initialize();
    const llamaProvider = new LlamaCppProvider(engine);

    await expect(
      llamaProvider.generateResponse([
        {
          id: '1',
          conversationId: 'c1',
          role: 'user',
          content: 'Hello',
          createdAt: new Date().toISOString()
        }
      ])
    ).rejects.toThrow(/The local model could not be loaded/);
  });

  it('ChatService defaults to MockAIProvider when local model is not installed', async () => {
    const chatService = new ChatService();
    setSetting('ai_provider', 'auto');

    const provider = await chatService.resolveProvider();
    expect(provider.id).toBe('mock');

    const providerName = await chatService.getProviderName();
    expect(providerName).toBe('Mock Study Assistant');
  });

  it('ChatService falls back to MockAIProvider if user selects llamacpp but model is missing', async () => {
    const chatService = new ChatService();
    chatService.setProviderType('llamacpp');

    // Should not crash, should fall back to mock
    const provider = await chatService.resolveProvider();
    expect(provider.id).toBe('mock');

    // Chat sending still works
    const conv = chatService.createConversation('Fallback Chat');
    const result = await chatService.sendMessage(conv.id, 'Tell me about Operating Systems');
    expect(result.assistantMessage.content).toContain('Operating System');
  });

  it('ChatService provider selection can be set to mock explicitly', async () => {
    const chatService = new ChatService();
    chatService.setProviderType('mock');
    expect(chatService.getProviderType()).toBe('mock');

    const provider = await chatService.resolveProvider();
    expect(provider.id).toBe('mock');
  });
});

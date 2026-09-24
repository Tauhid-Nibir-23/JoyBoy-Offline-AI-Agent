import { describe, it, expect, beforeEach } from 'vitest';
import { ChatService } from '../ai/chatService';
import { LocalAIEngine } from '../ai/localEngine';
import { LlamaCppProvider } from '../ai/llamaCppProvider';
import { initDatabase, getSetting } from '../database/db';

describe('Phase 2B Real Local AI Integration Tests', () => {
  let chatService: ChatService;

  beforeEach(async () => {
    await initDatabase();
    chatService = new ChatService();
  });

  it('keeps conversation histories strictly isolated across multiple conversations', async () => {
    // Conversation A
    const convA = chatService.createConversation('Study Session A');
    await chatService.sendMessage(convA.id, 'My subject is Operating Systems.');
    await chatService.sendMessage(convA.id, 'Explain CPU scheduling.');

    // Conversation B
    const convB = chatService.createConversation('Study Session B');
    await chatService.sendMessage(convB.id, 'My subject is Data Structures.');
    await chatService.sendMessage(convB.id, 'Explain Binary Search.');

    const msgsA = chatService.getMessages(convA.id);
    const msgsB = chatService.getMessages(convB.id);

    // Verify Conversation A contains only Operating Systems
    expect(msgsA.some((m) => m.content.includes('Operating Systems'))).toBe(true);
    expect(msgsA.some((m) => m.content.includes('Data Structures'))).toBe(false);

    // Verify Conversation B contains only Data Structures
    expect(msgsB.some((m) => m.content.includes('Data Structures'))).toBe(true);
    expect(msgsB.some((m) => m.content.includes('Operating Systems'))).toBe(false);
  });

  it('supports token streaming callbacks during message generation', async () => {
    const conv = chatService.createConversation('Streaming Test');
    const streamedChunks: string[] = [];

    await chatService.sendMessage(conv.id, 'What is an operating system?', {
      onToken: (chunk) => {
        streamedChunks.push(chunk);
      }
    });

    expect(streamedChunks.length).toBeGreaterThan(0);
    const fullStreamed = streamedChunks.join('');
    expect(fullStreamed).toContain('Operating System');
  });

  it('handles user cancellation gracefully and saves stopped state to SQLite', async () => {
    const conv = chatService.createConversation('Cancel Test');
    const abortCtrl = new AbortController();

    // Abort after small delay
    setTimeout(() => {
      abortCtrl.abort();
    }, 10);

    const result = await chatService.sendMessage(conv.id, 'Explain binary search in detail', {
      signal: abortCtrl.signal,
      onToken: () => {}
    });

    expect(result.assistantMessage).toBeDefined();
    expect(result.assistantMessage.content).toContain('stopped by user');

    // Verify persisted in SQLite
    const persisted = chatService.getMessages(conv.id);
    const lastMsg = persisted[persisted.length - 1];
    expect(lastMsg.role).toBe('assistant');
    expect(lastMsg.content).toContain('stopped by user');
  });

  it('stores and updates local AI engine generation configuration', () => {
    const engine = new LocalAIEngine();
    engine.setConfig({
      temperature: 0.4,
      maxTokens: 1024,
      contextLength: 8192,
      systemPrompt: 'You are a CSE tutor.'
    });

    const config = engine.getConfig();
    expect(config.temperature).toBe(0.4);
    expect(config.maxTokens).toBe(1024);
    expect(config.contextLength).toBe(8192);
    expect(config.systemPrompt).toBe('You are a CSE tutor.');

    // Persisted in SQLite settings
    expect(getSetting('temperature')).toBe('0.4');
    expect(getSetting('max_tokens')).toBe('1024');
    expect(getSetting('context_length')).toBe('8192');
    expect(getSetting('system_prompt')).toBe('You are a CSE tutor.');
  });

  it('clearly identifies active provider without falsely claiming local GGUF when using MockAI fallback', async () => {
    const provider = await chatService.resolveProvider();
    const info = chatService.getActiveProviderSync();

    expect(provider.id).toBe('mock');
    expect(info.isLocalAI).toBe(false);
    expect(info.name).toBe('Mock Study Assistant');
  });

  it('handles unavailable local model with a friendly, understandable error instead of crashing', async () => {
    const engine = new LocalAIEngine();
    await engine.initialize();
    const llamaProvider = new LlamaCppProvider(engine);

    // Custom chat service strictly set to llama provider
    const localChatService = new ChatService(llamaProvider);
    const conv = localChatService.createConversation('Error Test');

    const result = await localChatService.sendMessage(conv.id, 'Hello');
    expect(result.assistantMessage.content).toContain('Local AI Error:');
    expect(result.assistantMessage.content).toContain('The local model could not be loaded');
  });
});

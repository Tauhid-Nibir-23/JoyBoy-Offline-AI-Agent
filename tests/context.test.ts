import { describe, it, expect } from 'vitest';
import { 
  estimateTokens, 
  estimateMessageTokens, 
  buildContextWindow, 
  formatToChatML, 
  DEFAULT_SYSTEM_PROMPT 
} from '../ai/context';
import { ChatMessage } from '../ai/provider';

describe('Phase 2B Context & History Management Tests', () => {
  it('estimates token count conservatively', () => {
    const text = 'What is an operating system?';
    const tokens = estimateTokens(text);
    expect(tokens).toBeGreaterThan(0);
    expect(tokens).toBe(Math.ceil(text.length / 3.5));
  });

  it('preserves system prompt at index 0 of context window', () => {
    const history: ChatMessage[] = [
      {
        id: 'msg_1',
        conversationId: 'c1',
        role: 'user',
        content: 'Explain binary search',
        createdAt: new Date().toISOString()
      }
    ];

    const context = buildContextWindow(history, {
      systemPrompt: 'Custom Study Prompt',
      contextLength: 2048,
      reservedOutputTokens: 256
    });

    expect(context[0].role).toBe('system');
    expect(context[0].content).toBe('Custom Study Prompt');
    expect(context[1].role).toBe('user');
    expect(context[1].content).toBe('Explain binary search');
  });

  it('uses default study system prompt when custom prompt is omitted', () => {
    const history: ChatMessage[] = [
      {
        id: 'msg_1',
        conversationId: 'c1',
        role: 'user',
        content: 'Hello',
        createdAt: new Date().toISOString()
      }
    ];

    const context = buildContextWindow(history);
    expect(context[0].content).toBe(DEFAULT_SYSTEM_PROMPT);
  });

  it('includes multi-turn conversation history for follow-up questions', () => {
    const history: ChatMessage[] = [
      {
        id: '1',
        conversationId: 'c1',
        role: 'user',
        content: 'What is an operating system?',
        createdAt: new Date(1000).toISOString()
      },
      {
        id: '2',
        conversationId: 'c1',
        role: 'assistant',
        content: 'An OS manages hardware and software resources.',
        createdAt: new Date(2000).toISOString()
      },
      {
        id: '3',
        conversationId: 'c1',
        role: 'user',
        content: 'Give me an example of one.',
        createdAt: new Date(3000).toISOString()
      }
    ];

    const context = buildContextWindow(history);
    expect(context.length).toBe(4); // system + 3 messages
    expect(context[1].content).toBe('What is an operating system?');
    expect(context[2].content).toBe('An OS manages hardware and software resources.');
    expect(context[3].content).toBe('Give me an example of one.');
  });

  it('truncates older messages when context length budget is tight while preserving newest user message', () => {
    // Create multiple long messages
    const longText = 'A'.repeat(500); // ~143 tokens each
    const history: ChatMessage[] = [
      { id: '1', conversationId: 'c1', role: 'user', content: 'Old msg 1: ' + longText, createdAt: new Date(1).toISOString() },
      { id: '2', conversationId: 'c1', role: 'assistant', content: 'Old response 1: ' + longText, createdAt: new Date(2).toISOString() },
      { id: '3', conversationId: 'c1', role: 'user', content: 'Old msg 2: ' + longText, createdAt: new Date(3).toISOString() },
      { id: '4', conversationId: 'c1', role: 'assistant', content: 'Old response 2: ' + longText, createdAt: new Date(4).toISOString() },
      { id: '5', conversationId: 'c1', role: 'user', content: 'Latest urgent query: Explain OS', createdAt: new Date(5).toISOString() }
    ];

    // Tight budget: 500 total tokens with 200 reserved output = 300 input tokens
    const context = buildContextWindow(history, {
      contextLength: 500,
      reservedOutputTokens: 200
    });

    // Must include system prompt
    expect(context[0].role).toBe('system');
    // Must include newest user message
    const lastMsg = context[context.length - 1];
    expect(lastMsg.content).toBe('Latest urgent query: Explain OS');
    // Older messages should have been truncated
    expect(context.length).toBeLessThan(history.length + 1);
  });

  it('formats messages into ChatML prompt string', () => {
    const messages: ChatMessage[] = [
      { id: '1', conversationId: 'c1', role: 'system', content: 'System instruction', createdAt: '' },
      { id: '2', conversationId: 'c1', role: 'user', content: 'User question', createdAt: '' }
    ];

    const prompt = formatToChatML(messages);
    expect(prompt).toContain('<|im_start|>system\nSystem instruction<|im_end|>');
    expect(prompt).toContain('<|im_start|>user\nUser question<|im_end|>');
    expect(prompt.endsWith('<|im_start|>assistant\n')).toBe(true);
  });
});

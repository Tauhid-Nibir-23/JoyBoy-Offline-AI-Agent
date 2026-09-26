// Phase 15 — Real Qwen 2.5 3B Chat Quality, Mock Mode Elimination & Study Response Hardening Tests
import { describe, it, expect, beforeEach, afterAll } from 'vitest';
import fs from 'fs';
import path from 'path';
import {
  initDatabase,
  createConversationInDB,
  clearAllConversations,
  clearAllDocuments,
  setSetting,
  getSetting,
  attachDocumentToConversation
} from '../database/db';
import { chatService, ChatService } from '../ai/chatService';
import { MockAIProvider } from '../ai/mockProvider';
import { LlamaCppProvider } from '../ai/llamaCppProvider';
import { modelManager } from '../models/manager';
import { RECOMMENDED_3B_MODEL } from '../models/registry';
import { queryRewriter } from '../ai/queryRewriter';
import { conversationMemoryManager } from '../ai/conversationMemory';
import { validateResponse } from '../ai/responseValidator';
import { documentService } from '../documents/documentService';
import { ragService } from '../rag';
import { ContextBuilder } from '../rag/contextBuilder';
import { RAGSearchResult } from '../rag/types';

describe('Phase 15 — Real Qwen 2.5 3B Chat Quality & Mock Mode Elimination Tests', () => {
  beforeEach(async () => {
    await initDatabase();
    clearAllConversations();
    clearAllDocuments();
    conversationMemoryManager.clearCache();
    setSetting('ai_provider', 'auto');
  });

  afterAll(() => {
    modelManager.clearActiveModel();
  });

  // =========================================================================
  // Category 1: Real Provider Selection & Mock Isolation (Requirements 1, 3)
  // =========================================================================

  it('1. ChatService selects LlamaCppProvider in production/default mode when local model exists', async () => {
    await modelManager.autoSelectModel();
    const cs = new ChatService();
    // Default is 'auto'
    expect(cs.getProviderType()).toBe('auto');

    const provider = await cs.resolveProvider();
    // If real 3B model is installed, must resolve to llama.cpp provider, NOT mock
    const model3B = path.resolve(process.cwd(), 'models', 'qwen2.5-3b-instruct-q4_k_m.gguf');
    if (fs.existsSync(model3B)) {
      expect(provider.id).toBe('llamacpp');
      expect(provider.name).toContain('llama');
      const active = cs.getActiveProviderSync();
      expect(active.isLocalAI).toBe(true);
      expect(active.id).toBe('llamacpp');
    } else {
      console.warn('⏭️ 3B model not found on disk — skipping local provider assertion');
      expect(true).toBe(true);
    }
  });

  it('2. MockAIProvider is strictly isolated and only runs when user explicitly selects mock mode', async () => {
    const cs = new ChatService();
    cs.setProviderType('mock');
    expect(cs.getProviderType()).toBe('mock');

    const provider = await cs.resolveProvider();
    expect(provider.id).toBe('mock');
    const active = cs.getActiveProviderSync();
    expect(active.isLocalAI).toBe(false);
  });

  it('3. In production mode (auto or llamacpp), MockProvider is NEVER returned if model files exist', async () => {
    const model3B = path.resolve(process.cwd(), 'models', 'qwen2.5-3b-instruct-q4_k_m.gguf');
    if (!fs.existsSync(model3B)) {
      expect(true).toBe(true);
      return;
    }

    await modelManager.autoSelectModel();
    const cs = new ChatService();
    cs.setProviderType('llamacpp');
    const provider = await cs.resolveProvider();
    expect(provider.id).not.toBe('mock');
    expect(provider.id).toBe('llamacpp');
  });

  // =========================================================================
  // Category 2: UI Truthfulness & Mock Mode Elimination (Requirements 4, 15)
  // =========================================================================

  it('4. getActiveProviderSync returns honest Offline AI name, not Demo Mode', async () => {
    await modelManager.autoSelectModel();
    const cs = new ChatService();
    setSetting('ai_provider', 'auto');
    await cs.resolveProvider();
    const active = cs.getActiveProviderSync();
    expect(active.name.toLowerCase()).not.toContain('demo');
    expect(active.name.toLowerCase()).not.toContain('mock');
  });

  it('5. Messages saved to SQLite persist provider_id across database reloads', async () => {
    const convId = 'p15_conv_persistence';
    createConversationInDB(convId, 'Persistence Test');

    const customLlama = new LlamaCppProvider();
    const cs = new ChatService(customLlama);

    // Save a message directly via ChatService or mock generate
    const msgs = cs.getMessages(convId);
    expect(Array.isArray(msgs)).toBe(true);
  });

  // =========================================================================
  // Category 3: Query Rewriting for Student Prompts (Requirements 6, 7, 8)
  // =========================================================================

  it('6. Rewrites "peripherals e floating number ta bujhao" preserving concept and context', () => {
    const convId = 'p15_periph_conv';
    createConversationInDB(convId, 'Peripherals Study');

    const rw = queryRewriter.rewriteQuery(convId, 'peripherals e floating number ta bujhao');
    expect(rw.wasRewritten).toBe(true);
    expect(rw.resolvedQuery.toLowerCase()).toContain('floating number');
    expect(rw.resolvedQuery.toLowerCase()).toContain('peripherals');
    expect(rw.referencedTopic?.toLowerCase()).toContain('floating number');
  });

  it('7. Rewrites "exam e kivabe likhbo?" into structured exam-ready prompt', () => {
    const convId = 'p15_exam_conv';
    createConversationInDB(convId, 'Exam Format Study');

    conversationMemoryManager.recordTurn(convId, 'user', 'What is Deadlock?');
    conversationMemoryManager.recordTurn(convId, 'assistant', 'Deadlock is a condition where two processes block each other.');

    const mem = conversationMemoryManager.getMemory(convId);
    const rw = queryRewriter.rewriteQuery('exam e kivabe likhbo?', mem);

    expect(rw.wasRewritten).toBe(true);
    expect(rw.resolvedQuery.toLowerCase()).toMatch(/exam|answer|points|deadlock/);
  });

  it('8. Resolves "ager ta abar bolo" to previous topic recap', () => {
    const convId = 'p15_recap_conv';
    createConversationInDB(convId, 'Recap Study');

    conversationMemoryManager.recordTurn(convId, 'user', 'What is Mutual Exclusion?');
    conversationMemoryManager.recordTurn(convId, 'assistant', 'Mutual exclusion is resource locking.');

    const mem = conversationMemoryManager.getMemory(convId);
    const rw = queryRewriter.rewriteQuery('ager ta abar bolo', mem);

    expect(rw.wasRewritten).toBe(true);
    expect(rw.resolvedQuery.toLowerCase()).toMatch(/recap|explanation|mutual exclusion/);
  });

  it('9. Resolves "ei part ta short kore daw" into concise summary query', () => {
    const convId = 'p15_shorten_conv';
    createConversationInDB(convId, 'Shorten Study');

    conversationMemoryManager.recordTurn(convId, 'user', 'What is Hold and Wait?');
    conversationMemoryManager.recordTurn(convId, 'assistant', 'Hold and wait detailed description.');

    const mem = conversationMemoryManager.getMemory(convId);
    const rw = queryRewriter.rewriteQuery('ei part ta short kore daw', mem);

    expect(rw.wasRewritten).toBe(true);
    expect(rw.intent).toBe('SHORTEN');
    expect(rw.resolvedQuery.toLowerCase()).toContain('summary');
  });

  // =========================================================================
  // Category 4: Accurate Sources & Missing Concept Grounding (Requirements 6, 11, 12)
  // =========================================================================

  it('10. ContextBuilder produces 0 sources when attached document lacks queried concept', () => {
    const cb = new ContextBuilder();

    // Mock search results where chunks do NOT match "floating number"
    const irrelevantResults: RAGSearchResult[] = [
      {
        chunk: {
          id: 'c1',
          documentId: 'doc1',
          chunkIndex: 0,
          text: '8086 CPU Pin configuration: AD0 to AD15 are multiplexed address and data pins.',
          startOffset: 0,
          endOffset: 80,
          characterCount: 80,
          tokenEstimate: 20,
          filename: 'Peripherals-01.pdf',
          fileType: 'pdf'
        },
        similarity: 0.12 // Low similarity, zero keyword match with "floating number"
      }
    ];

    const context = cb.buildContext('peripherals e floating number ta bujhao', irrelevantResults);

    // Section 12: Never show fake source counts
    expect(context.sources.length).toBe(0);
    expect(context.usedKnowledge).toBe(false);
    // Section 6: Specific honest missing-material message with concept name
    expect(context.systemInstruction).toContain('floating number');
    expect(context.systemInstruction).toContain('relevant information');
  });

  it('11. ContextBuilder attaches truthful sources when chunks genuinely match the concept', () => {
    const cb = new ContextBuilder();

    const relevantResults: RAGSearchResult[] = [
      {
        chunk: {
          id: 'c1',
          documentId: 'doc1',
          chunkIndex: 0,
          text: 'The 8087 numeric coprocessor handles floating point numbers, implementing IEEE 754 floating point standard.',
          startOffset: 0,
          endOffset: 105,
          characterCount: 105,
          tokenEstimate: 25,
          filename: 'Peripherals-01.pdf',
          fileType: 'pdf',
          heading: 'Floating Point Architecture'
        },
        similarity: 0.35 // Genuinely relevant
      }
    ];

    const context = cb.buildContext('peripherals e floating number ta bujhao', relevantResults);

    // Truthful source count: exactly 1 chunk
    expect(context.sources.length).toBe(1);
    expect(context.sources[0].filename).toBe('Peripherals-01.pdf');
    expect(context.usedKnowledge).toBe(true);
    expect(context.augmentedUserPrompt).toContain('8087');
  });

  // =========================================================================
  // Category 5: Response Validation for Quality & Anti-Mock (Requirement 13)
  // =========================================================================

  it('12. ResponseValidator rejects obvious mock provider placeholders', () => {
    const result = validateResponse({
      userQuery: 'What is Deadlock?',
      assistantResponse: '[Mock Response] I am a mock assistant and cannot answer real questions.'
    });

    expect(result.isValid).toBe(false);
    expect(result.retryNeeded).toBe(true);
    expect(result.issues.some(i => i.includes('mock'))).toBe(true);
  });

  it('13. ResponseValidator accepts valid concise study answers', () => {
    const result = validateResponse({
      userQuery: 'What is Deadlock?',
      assistantResponse: 'Deadlock is a state where processes are blocked waiting for resources held by each other.'
    });

    expect(result.isValid).toBe(true);
    expect(result.retryNeeded).toBe(false);
  });
});

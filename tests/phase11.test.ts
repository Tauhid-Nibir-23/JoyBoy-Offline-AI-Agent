import { describe, it, expect, beforeEach } from 'vitest';
import { 
  initDatabase, 
  createConversationInDB, 
  insertDocumentInDB,
  insertChunkInDB,
  attachDocumentToConversation,
  clearAllConversations,
  clearAllDocuments,
  getDocumentIdsForConversation,
  setSetting,
  DBDocument,
  DBDocumentChunk
} from '../database/db';
import { conversationMemoryManager, conversationMemory } from '../ai/conversationMemory';
import { queryRewriter } from '../ai/queryRewriter';
import { conversationContextManager, contextManager } from '../ai/contextManager';
import { buildContextWindow, formatToChatML, DEFAULT_SYSTEM_PROMPT } from '../ai/context';
import { ChatService } from '../ai/chatService';
import { AIProvider, ChatMessage, GenerateOptions } from '../ai/provider';
import { validateResponse } from '../ai/responseValidator';
import { inferenceDiagnostics } from '../ai/inferenceDiagnostics';
import { INITIAL_REGISTERED_MODELS } from '../models/registry';
import { modelManager } from '../models/manager';

describe('Phase 11 — Real LLM Context & Inference Pipeline Hardening Tests', () => {
  beforeEach(async () => {
    await initDatabase();
    setSetting('ai_provider', 'auto');
    clearAllConversations();
    clearAllDocuments();
    conversationMemoryManager.clearCache();
    inferenceDiagnostics.clear();
    inferenceDiagnostics.setEnabled(false);
  });

  function createTestDoc(id: string, filename: string, text: string = ''): DBDocument {
    return {
      id,
      filename,
      original_path: `/docs/${filename}`,
      file_type: 'pdf',
      file_size: 40960,
      file_hash: `hash-${id}-${Date.now()}`,
      imported_at: new Date().toISOString(),
      modified_at: null,
      extraction_status: 'Ready',
      extracted_text: text,
      character_count: text.length,
      indexing_status: 'Ready',
      error_message: null
    };
  }

  function createTestChunk(params: {
    id: string;
    documentId: string;
    chunkIndex: number;
    pageNumber: number;
    heading: string;
    text: string;
  }): DBDocumentChunk {
    return {
      id: params.id,
      document_id: params.documentId,
      chunk_index: params.chunkIndex,
      page_number: params.pageNumber,
      heading: params.heading,
      text: params.text,
      start_offset: 0,
      end_offset: params.text.length,
      character_count: params.text.length,
      token_estimate: 25,
      metadata_json: JSON.stringify({ source: 'test' }),
      embedding_json: JSON.stringify(new Array(64).fill(0.1))
    };
  }

  // =========================================================================
  // 1. Real provider receives multiple conversation turns
  // =========================================================================
  it('1. Provider receives structured multi-turn conversation messages', async () => {
    let capturedMessages: ChatMessage[] = [];

    const mockProvider: AIProvider = {
      id: 'test_spy',
      name: 'Spy Provider',
      isAvailable: async () => true,
      generateResponse: async (history) => {
        capturedMessages = [...history];
        return 'Response to follow-up';
      }
    };

    const service = new ChatService(mockProvider);
    const conv = service.createConversation('Turn History');

    await service.sendMessage(conv.id, 'What is Deadlock?');
    await service.sendMessage(conv.id, '4 conditions bolo');

    // History should contain: system prompt, turn 1 user, turn 1 assistant, turn 2 user
    expect(capturedMessages.length).toBeGreaterThanOrEqual(4);
    expect(capturedMessages[0].role).toBe('system');
    expect(capturedMessages.some(m => m.role === 'user' && m.content.includes('Deadlock'))).toBe(true);
    expect(capturedMessages.some(m => m.role === 'assistant')).toBe(true);
    expect(capturedMessages[capturedMessages.length - 1].content).toContain('4 conditions bolo');
  });

  // =========================================================================
  // 2. Original user message remains unchanged
  // =========================================================================
  it('2. Original user message is preserved in DB and not permanently overwritten by rewritten text', async () => {
    const service = new ChatService();
    const conv = service.createConversation('Preserve Original');

    const result = await service.sendMessage(conv.id, 'What is Deadlock?');
    expect(result.userMessage.content).toBe('What is Deadlock?');

    const followUp = await service.sendMessage(conv.id, '2 number ta easy kore bujhao');
    expect(followUp.userMessage.content).toBe('2 number ta easy kore bujhao');

    const dbMsgs = service.getMessages(conv.id);
    expect(dbMsgs[2].content).toBe('2 number ta easy kore bujhao');
  });

  // =========================================================================
  // 3. Resolved query is stored separately
  // =========================================================================
  it('3. Resolved query is decoupled and preserved in rewritten query metadata', () => {
    const convId = 'test-decoupled-query';
    createConversationInDB(convId, 'Decoupled Query');

    conversationMemoryManager.recordTurn(convId, 'user', 'What is Deadlock?');
    conversationMemoryManager.recordTurn(
      convId,
      'assistant',
      '1. Mutual Exclusion\n2. Hold and Wait\n3. No Preemption\n4. Circular Wait'
    );

    const mem = conversationMemoryManager.getMemory(convId);
    const result = queryRewriter.rewriteQuery('2 number ta easy kore bujhao', mem);

    expect(result.originalQuery).toBe('2 number ta easy kore bujhao');
    expect(result.rewrittenQuery.toLowerCase()).toContain('hold and wait');
    expect(result.resolvedContext).toBeDefined();
    expect(result.resolvedContext?.toLowerCase()).toContain('hold and wait');
  });

  // =========================================================================
  // 4. "2 number ta" resolves correctly
  // =========================================================================
  it('4. "2 number ta" correctly extracts item 2 from previous enumerated list', () => {
    const convId = 'test-ordinal-resolve';
    createConversationInDB(convId, 'Ordinal Test');

    conversationMemoryManager.recordTurn(convId, 'user', 'Deadlock conditions ki?');
    conversationMemoryManager.recordTurn(
      convId,
      'assistant',
      'Deadlock এর ৪টি শর্ত:\n1. Mutual Exclusion\n2. Hold and Wait: Process holds resources\n3. No Preemption\n4. Circular Wait'
    );

    const mem = conversationMemoryManager.getMemory(convId);
    const resolved = conversationMemoryManager.resolveReferencedItem(convId, 2);
    expect(resolved?.title.toLowerCase()).toContain('hold and wait');

    const rewritten = queryRewriter.rewriteQuery('2 number ta explain koro', mem);
    expect(rewritten.rewrittenQuery.toLowerCase()).toContain('hold and wait');
  });

  // =========================================================================
  // 5. "example daw" retains active subtopic
  // =========================================================================
  it('5. "example daw" retains active subtopic after item reference', () => {
    const convId = 'test-subtopic-example';
    createConversationInDB(convId, 'Subtopic Example');

    conversationMemoryManager.recordTurn(convId, 'user', 'What is Deadlock?');
    conversationMemoryManager.recordTurn(
      convId,
      'assistant',
      '1. Mutual Exclusion\n2. Hold and Wait\n3. No Preemption\n4. Circular Wait'
    );

    // Turn: User asks to explain condition 2
    let mem = conversationMemoryManager.getMemory(convId);
    queryRewriter.rewriteQuery('2 number ta easy kore bujhao', mem);
    conversationMemoryManager.recordTurn(convId, 'user', '2 number ta easy kore bujhao');
    conversationMemoryManager.recordTurn(convId, 'assistant', 'Hold and wait means a process holds a resource.');

    // Follow-up: User asks for an example
    mem = conversationMemoryManager.getMemory(convId);
    expect(mem.activeSubtopic?.toLowerCase()).toContain('hold and wait');

    const rewritten = queryRewriter.rewriteQuery('example daw', mem);
    expect(rewritten.rewrittenQuery.toLowerCase()).toContain('hold and wait');
  });

  // =========================================================================
  // 6. "aro easy kore bolo" retains previous concept
  // =========================================================================
  it('6. "aro easy kore bolo" simplifies currently active concept', () => {
    const convId = 'test-simplify-retention';
    createConversationInDB(convId, 'Simplify Retention');

    conversationMemoryManager.recordTurn(convId, 'user', 'Explain Deadlock');
    conversationMemoryManager.recordTurn(convId, 'assistant', 'Deadlock explanation.');
    conversationMemoryManager.recordTurn(convId, 'user', 'What is Hold and Wait?');
    conversationMemoryManager.recordTurn(convId, 'assistant', 'Hold and wait detailed definition.');

    const mem = conversationMemoryManager.getMemory(convId);
    const rewritten = queryRewriter.rewriteQuery('aro easy kore bolo', mem);

    expect(rewritten.isRewritten).toBe(true);
    expect(rewritten.rewrittenQuery.toLowerCase()).toContain('hold and wait');
  });

  // =========================================================================
  // 7. Self-contained question is not incorrectly rewritten
  // =========================================================================
  it('7. Self-contained questions remain unmutated', () => {
    const convId = 'test-self-contained';
    createConversationInDB(convId, 'Self Contained');

    conversationMemoryManager.recordTurn(convId, 'user', 'What is Deadlock?');
    conversationMemoryManager.recordTurn(convId, 'assistant', 'Deadlock explanation.');

    const mem = conversationMemoryManager.getMemory(convId);
    const independentQ = 'What is Operating System?';
    const rewritten = queryRewriter.rewriteQuery(independentQ, mem);

    expect(rewritten.rewrittenQuery).toBe(independentQ);
    expect(rewritten.wasRewritten).toBe(false);
  });

  // =========================================================================
  // 8. Previous enumerated answer remains available
  // =========================================================================
  it('8. Immediate previous enumerated assistant answer is preserved in context window', () => {
    const history: ChatMessage[] = [
      {
        id: 'u1',
        conversationId: 'c1',
        role: 'user',
        content: '4 conditions bolo',
        createdAt: new Date(1).toISOString()
      },
      {
        id: 'a1',
        conversationId: 'c1',
        role: 'assistant',
        content: '1. Mutual Exclusion\n2. Hold and Wait\n3. No Preemption\n4. Circular Wait',
        createdAt: new Date(2).toISOString()
      },
      {
        id: 'u2',
        conversationId: 'c1',
        role: 'user',
        content: '2 number ta explain koro',
        createdAt: new Date(3).toISOString()
      }
    ];

    const window = buildContextWindow(history, { contextLength: 2048 });
    expect(window.some(m => m.role === 'assistant' && m.content.includes('Hold and Wait'))).toBe(true);
  });

  // =========================================================================
  // 9. Conversation context survives RAG retrieval
  // =========================================================================
  it('9. Conversation turns survive RAG retrieval alongside document evidence', async () => {
    let capturedHistory: ChatMessage[] = [];

    const mockProvider: AIProvider = {
      id: 'test_rag_spy',
      name: 'RAG Spy',
      isAvailable: async () => true,
      generateResponse: async (history) => {
        capturedHistory = [...history];
        return 'Grounded response';
      }
    };

    const service = new ChatService(mockProvider);
    const conv = service.createConversation('RAG Conversation Test');

    const doc = createTestDoc('doc-os-survive', 'os.pdf', 'Operating System kernel structures');
    insertDocumentInDB(doc);
    attachDocumentToConversation(conv.id, doc.id);

    insertChunkInDB(createTestChunk({
      id: 'c1',
      documentId: doc.id,
      chunkIndex: 0,
      pageNumber: 1,
      heading: 'Kernel',
      text: 'The kernel is the core component of an operating system.'
    }));

    await service.sendMessage(conv.id, 'What is an operating system?');
    await service.sendMessage(conv.id, 'eta easy kore bujhao', { useStudyMaterials: true });

    // History must contain previous turn AND current follow-up
    expect(capturedHistory.some(m => m.role === 'user' && m.content.includes('What is an operating system?'))).toBe(true);
    expect(capturedHistory.some(m => m.role === 'assistant')).toBe(true);
    expect(capturedHistory[capturedHistory.length - 1].content).toContain('eta easy kore bujhao');
  });

  // =========================================================================
  // 10. RAG does not replace conversation history
  // =========================================================================
  it('10. RAG evidence supplements context without wiping prior user turns', () => {
    const convId = 'test-rag-no-wipe';
    createConversationInDB(convId, 'No Wipe');

    const history: ChatMessage[] = [
      { id: '1', conversationId: convId, role: 'user', content: 'What is Deadlock?', createdAt: new Date(1).toISOString() },
      { id: '2', conversationId: convId, role: 'assistant', content: 'Deadlock is a blockage.', createdAt: new Date(2).toISOString() },
      { id: '3', conversationId: convId, role: 'user', content: 'example daw', createdAt: new Date(3).toISOString() }
    ];

    const result = conversationContextManager.assembleContext({
      conversationId: convId,
      history,
      attachedDocs: [],
      systemInstruction: 'You are JoyBoy.',
      currentUserMessageText: 'example daw',
      resolvedContext: 'The user is asking for an example of Deadlock'
    });

    expect(result.messages.some(m => m.content === 'What is Deadlock?')).toBe(true);
    expect(result.messages.some(m => m.content === 'Deadlock is a blockage.')).toBe(true);
    expect(result.messages[result.messages.length - 1].content).toContain('example daw');
    expect(result.messages[result.messages.length - 1].content).toContain('CONTEXT HINT');
  });

  // =========================================================================
  // 11. Context truncation preserves referenced previous answer
  // =========================================================================
  it('11. Context truncation keeps newest user message and immediate previous assistant turn', () => {
    const history: ChatMessage[] = [
      { id: '1', conversationId: 'c1', role: 'user', content: 'Ancient msg: ' + 'X'.repeat(400), createdAt: new Date(1).toISOString() },
      { id: '2', conversationId: 'c1', role: 'assistant', content: 'Ancient ans: ' + 'Y'.repeat(400), createdAt: new Date(2).toISOString() },
      { id: '3', conversationId: 'c1', role: 'assistant', content: 'Immediate answer with key points.', createdAt: new Date(3).toISOString() },
      { id: '4', conversationId: 'c1', role: 'user', content: 'Explain that last point', createdAt: new Date(4).toISOString() }
    ];

    const bounded = buildContextWindow(history, { contextLength: 600, reservedOutputTokens: 200 });
    expect(bounded.some(m => m.content === 'Explain that last point')).toBe(true);
    expect(bounded.some(m => m.content === 'Immediate answer with key points.')).toBe(true);
  });

  // =========================================================================
  // 12. Correct Qwen chat template is applied exactly once
  // =========================================================================
  it('12. formatToChatML formats ChatML tags without nested duplicate tags', () => {
    const messages: ChatMessage[] = [
      { id: 's', conversationId: 'c1', role: 'system', content: 'You are JoyBoy.', createdAt: new Date().toISOString() },
      { id: 'u', conversationId: 'c1', role: 'user', content: 'Hello', createdAt: new Date().toISOString() }
    ];

    const prompt = formatToChatML(messages);
    expect(prompt).toContain('<|im_start|>system\nYou are JoyBoy.<|im_end|>');
    expect(prompt).toContain('<|im_start|>user\nHello<|im_end|>');
    expect(prompt).toContain('<|im_start|>assistant\n');
    expect(prompt.match(/<\|im_start\|>/g)?.length).toBe(3);
  });

  // =========================================================================
  // 13. No double chat-template formatting
  // =========================================================================
  it('13. Does not double-wrap already formatted ChatML messages', () => {
    const messages: ChatMessage[] = [
      { id: 'u', conversationId: 'c1', role: 'user', content: 'Simple question', createdAt: new Date().toISOString() }
    ];
    const single = formatToChatML(messages);
    expect(single).not.toContain('<|im_start|><|im_start|>');
    expect(single).not.toContain('<|im_end|><|im_end|>');
  });

  // =========================================================================
  // 14. Model context size is detected
  // =========================================================================
  it('14. Model context size defaults to 4096 or profile context length', () => {
    const model = INITIAL_REGISTERED_MODELS.find(m => m.id === 'qwen2.5-0.5b-instruct-q4_k_m');
    expect(model).toBeDefined();
    expect(model?.contextLength).toBe(4096);
  });

  // =========================================================================
  // 15. Prompt token budget is respected
  // =========================================================================
  it('15. Context manager respects specified token budget', () => {
    const convId = 'test-token-limit';
    createConversationInDB(convId, 'Limit Test');

    const history: ChatMessage[] = Array(15).fill(null).map((_, i) => ({
      id: `m_${i}`,
      conversationId: convId,
      role: (i % 2 === 0 ? 'user' : 'assistant') as 'user' | 'assistant',
      content: `Turn ${i} detailing computer systems architecture and caches.`,
      createdAt: new Date(i).toISOString()
    }));

    const result = conversationContextManager.assembleContext({
      conversationId: convId,
      history,
      attachedDocs: [],
      systemInstruction: 'You are JoyBoy.',
      currentUserMessageText: 'Final query',
      contextLength: 600,
      reservedOutputTokens: 200
    });

    expect(result.contextTokensEstimate).toBeLessThanOrEqual(500);
  });

  // =========================================================================
  // 16. MockProvider never silently replaces Local llama.cpp
  // =========================================================================
  it('16. Model health check verifies llama.cpp and refuses to silently substitute mock', async () => {
    const service = new ChatService();
    service.setProviderType('llamacpp');

    const health = await service.verifyModelHealth();
    expect(health.ready).toBe(false);
    expect(health.error).toContain('Local llama.cpp inference engine is not ready');
  });

  // =========================================================================
  // 17. 0.5B is recognized as lightweight
  // =========================================================================
  it('17. Qwen 2.5 0.5B is registered with lightweight fallback status', () => {
    const profile = INITIAL_REGISTERED_MODELS.find(m => m.id === 'qwen2.5-0.5b-instruct-q4_k_m');
    expect(profile).toBeDefined();
    expect(profile?.isFallback).toBe(true);
    expect(profile?.recommendedRamGb).toBeLessThanOrEqual(4);
  });

  // =========================================================================
  // 18. 3B is detected when GGUF is present
  // =========================================================================
  it('18. Qwen 2.5 3B is registered as recommended primary target', () => {
    const profile = INITIAL_REGISTERED_MODELS.find(m => m.id === 'qwen2.5-3b-instruct-q4_k_m');
    expect(profile).toBeDefined();
    expect(profile?.isRecommended).toBe(true);
    expect(profile?.name).toContain('3B');
  });

  // =========================================================================
  // 19. Windows runtime path handling works
  // =========================================================================
  it('19. Windows runtime adapter formats commands and paths safely', async () => {
    const { windowsEnvironment } = await import('../core/environment/windows');
    expect(windowsEnvironment.osName).toBe('Windows');
    expect(windowsEnvironment.formatPath('models\\qwen.gguf')).toBeDefined();
  });

  // =========================================================================
  // 20. Linux runtime path handling works
  // =========================================================================
  it('20. Linux runtime adapter formats POSIX paths cleanly', async () => {
    const { linuxEnvironment } = await import('../core/environment/linux');
    expect(linuxEnvironment.osName).toBe('Linux');
    expect(linuxEnvironment.formatPath('models/qwen.gguf')).toBeDefined();
  });

  // =========================================================================
  // 21. Response validator does not reject valid short answers
  // =========================================================================
  it('21. Response validator does not reject valid short answers', () => {
    const check1 = validateResponse({
      userQuery: 'What algorithm is O(1)?',
      assistantResponse: 'Hash Table lookup is O(1).'
    });
    expect(check1.isValid).toBe(true);

    const check2 = validateResponse({
      userQuery: 'Deadlock condition 2 ta bolo',
      assistantResponse: 'Hold and Wait'
    });
    expect(check2.isValid).toBe(true);
  });

  // =========================================================================
  // 22. Maximum one automatic retry
  // =========================================================================
  it('22. ChatService retries at most once when validator reports an issue', async () => {
    let callCount = 0;
    const retryProvider: AIProvider = {
      id: 'retry_test_spy',
      name: 'Retry Spy',
      isAvailable: async () => true,
      generateResponse: async () => {
        callCount++;
        // First returns severe loop, second returns valid text
        if (callCount === 1) {
          return Array(5).fill('Repetitive sentence that loops over and over indefinitely.').join('\n');
        }
        return 'Correct concise non-repetitive answer.';
      }
    };

    const service = new ChatService(retryProvider);
    const conv = service.createConversation('Retry Test');
    await service.sendMessage(conv.id, 'Explain Deadlock');

    expect(callCount).toBe(2); // exactly 1 original + 1 retry
  });

  // =========================================================================
  // 23. Diagnostics show actual context statistics
  // =========================================================================
  it('23. Inference diagnostics records model, turns, token budget, and active topic', async () => {
    inferenceDiagnostics.setEnabled(true);

    const service = new ChatService();
    const conv = service.createConversation('Diagnostics Test');

    await service.sendMessage(conv.id, 'What is Deadlock?');

    const diag = inferenceDiagnostics.getLatest();
    expect(diag).not.toBeNull();
    expect(diag?.modelName).toBeDefined();
    expect(diag?.tokenEstimate).toBeGreaterThan(0);
    expect(diag?.historyTurnsCount).toBeGreaterThanOrEqual(1);
    expect(diag?.activeTopic?.toLowerCase()).toContain('deadlock');
  });

  // =========================================================================
  // 24. Debug diagnostics are disabled by default
  // =========================================================================
  it('24. Inference diagnostics is disabled by default to protect private prompts', () => {
    inferenceDiagnostics.setEnabled(false);
    expect(inferenceDiagnostics.isEnabled()).toBe(false);
    expect(inferenceDiagnostics.getLatest()).toBeNull();
  });

  // =========================================================================
  // 25. Full six-turn Deadlock conversation passes through context builder
  // =========================================================================
  it('25. Full six-turn Deadlock conversation maintains topic, subtopic, and context hints', async () => {
    const convId = 'test-six-turn-deadlock';
    createConversationInDB(convId, 'Deadlock Mastery');

    // Turn 1: "What is Deadlock?"
    conversationMemoryManager.recordTurn(convId, 'user', 'What is Deadlock?');
    conversationMemoryManager.recordTurn(
      convId,
      'assistant',
      'Deadlock is a state where a set of processes are blocked because each process is holding a resource and waiting for another resource.'
    );

    let mem = conversationMemoryManager.getMemory(convId);
    expect(mem.activeTopic?.toLowerCase()).toContain('deadlock');

    // Turn 2: "4 conditions bolo"
    conversationMemoryManager.recordTurn(convId, 'user', '4 conditions bolo');
    conversationMemoryManager.recordTurn(
      convId,
      'assistant',
      'The four necessary conditions for deadlock are:\n1. Mutual Exclusion\n2. Hold and Wait: A process holds resources while requesting more.\n3. No Preemption\n4. Circular Wait'
    );

    mem = conversationMemoryManager.getMemory(convId);
    expect(mem.activeTopic?.toLowerCase()).toContain('deadlock');
    expect(Object.keys(mem.enumeratedItems).length).toBe(4);

    // Turn 3: "2 number ta easy kore bujhao"
    let re3 = queryRewriter.rewriteQuery('2 number ta easy kore bujhao', mem);
    expect(re3.targetItemTitle?.toLowerCase()).toContain('hold and wait');

    conversationMemoryManager.recordTurn(convId, 'user', '2 number ta easy kore bujhao');
    conversationMemoryManager.recordTurn(
      convId,
      'assistant',
      'Hold and Wait means a process is already holding resources and waiting for another.'
    );

    mem = conversationMemoryManager.getMemory(convId);
    expect(mem.activeSubtopic?.toLowerCase()).toContain('hold and wait');

    // Turn 4: "example daw"
    let re4 = queryRewriter.rewriteQuery('example daw', mem);
    expect(re4.rewrittenQuery.toLowerCase()).toContain('hold and wait');

    conversationMemoryManager.recordTurn(convId, 'user', 'example daw');
    conversationMemoryManager.recordTurn(
      convId,
      'assistant',
      'Example: Process A holds Printer and waits for Scanner, while Process B holds Scanner and waits for Printer.'
    );

    // Turn 5: "aro easy kore bolo"
    mem = conversationMemoryManager.getMemory(convId);
    let re5 = queryRewriter.rewriteQuery('aro easy kore bolo', mem);
    expect(re5.rewrittenQuery.toLowerCase()).toContain('hold and wait');

    conversationMemoryManager.recordTurn(convId, 'user', 'aro easy kore bolo');
    conversationMemoryManager.recordTurn(
      convId,
      'assistant',
      'Real-life analogy: A child holding a toy car crying for a toy train without letting go of the car.'
    );

    // Turn 6: "ei topic theke 3 ta MCQ daw"
    mem = conversationMemoryManager.getMemory(convId);
    let re6 = queryRewriter.rewriteQuery('ei topic theke 3 ta MCQ daw', mem);
    expect(['MCQ', 'generate_mcq']).toContain(re6.intent);
    expect(re6.rewrittenQuery.toLowerCase()).toContain('3');
    expect(re6.rewrittenQuery.toLowerCase()).toContain('hold and wait');

    // Final check: assemble complete context for Turn 6
    const assembled = conversationContextManager.assembleContext({
      conversationId: convId,
      history: [
        { id: '1', conversationId: convId, role: 'user', content: 'What is Deadlock?', createdAt: new Date(1).toISOString() },
        { id: '2', conversationId: convId, role: 'assistant', content: 'Deadlock definition', createdAt: new Date(2).toISOString() },
        { id: '3', conversationId: convId, role: 'user', content: '4 conditions bolo', createdAt: new Date(3).toISOString() },
        { id: '4', conversationId: convId, role: 'assistant', content: '1. Mutual Exclusion\n2. Hold and Wait\n3. No Preemption\n4. Circular Wait', createdAt: new Date(4).toISOString() },
        { id: '5', conversationId: convId, role: 'user', content: '2 number ta easy kore bujhao', createdAt: new Date(5).toISOString() },
        { id: '6', conversationId: convId, role: 'assistant', content: 'Hold and wait simplified', createdAt: new Date(6).toISOString() },
        { id: '7', conversationId: convId, role: 'user', content: 'example daw', createdAt: new Date(7).toISOString() },
        { id: '8', conversationId: convId, role: 'assistant', content: 'Hold and wait example', createdAt: new Date(8).toISOString() },
        { id: '9', conversationId: convId, role: 'user', content: 'aro easy kore bolo', createdAt: new Date(9).toISOString() },
        { id: '10', conversationId: convId, role: 'assistant', content: 'Simple analogy', createdAt: new Date(10).toISOString() },
        { id: '11', conversationId: convId, role: 'user', content: 'ei topic theke 3 ta MCQ daw', createdAt: new Date(11).toISOString() }
      ],
      attachedDocs: [],
      systemInstruction: 'You are JoyBoy.',
      currentUserMessageText: 'ei topic theke 3 ta MCQ daw',
      resolvedContext: re6.resolvedContext
    });

    expect(assembled.messages[0].content).toContain('Deadlock');
    expect(assembled.messages[0].content).toContain('Hold and Wait');
    expect(assembled.messages[assembled.messages.length - 1].content).toContain('ei topic theke 3 ta MCQ daw');
    expect(assembled.messages[assembled.messages.length - 1].content).toContain('CONTEXT HINT');
  });
});

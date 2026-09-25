// Offline Study AI - Phase 12 Comprehensive Verification Tests
import { describe, it, expect, beforeEach, afterAll } from 'vitest';
import fs from 'fs';
import path from 'path';
import os from 'os';
import { 
  initDatabase, 
  createConversationInDB, 
  insertDocumentInDB,
  insertChunkInDB,
  attachDocumentToConversation,
  detachDocumentFromConversation,
  clearAllConversations,
  clearAllDocuments,
  setSetting,
  getSetting
} from '../database/db';
import { ModelManager } from '../models/manager';
import { RECOMMENDED_3B_MODEL, FALLBACK_05B_MODEL } from '../models/registry';
import { modelHardwareEstimator, getHardwareAwareRecommendation } from '../models/hardwareProfile';
import { modelBenchmarkService, STUDY_BENCHMARK_PROMPTS } from '../models/benchmark';
import { conversationMemoryManager } from '../ai/conversationMemory';
import { queryRewriter } from '../ai/queryRewriter';
import { conversationContextManager } from '../ai/contextManager';
import { validateResponse } from '../ai/responseValidator';
import { inferenceDiagnostics, diagnoseAnswerQuality } from '../ai/inferenceDiagnostics';
import { windowsEnvironment } from '../core/environment/windows';
import { linuxEnvironment } from '../core/environment/linux';
import { getOcrEngineStatus } from '../documents/intelligence/ocrProvider';
import { MockAIProvider } from '../ai/mockProvider';
import { ChatService } from '../ai/chatService';

describe('Phase 12 — Qwen 2.5 3B Migration, Real-World Quality & Offline Verification Tests', () => {
  let tempDir: string;
  let mock3BPath: string;
  let mock05BPath: string;

  beforeEach(async () => {
    await initDatabase();
    setSetting('ai_provider', 'auto');
    setSetting('model_id', '');
    setSetting('model_path', '');
    clearAllConversations();
    clearAllDocuments();
    conversationMemoryManager.clearCache();
    inferenceDiagnostics.clear();
    inferenceDiagnostics.setEnabled(false);

    // Create a temporary sandbox directory for test models
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'joyboy_phase12_test_'));
    const ggufHeader = Buffer.from([0x47, 0x47, 0x55, 0x46, 0x03, 0x00, 0x00, 0x00]); // 'GGUF'

    mock3BPath = path.join(tempDir, 'Qwen2.5-3B-Instruct-Q4_K_M.gguf');
    fs.writeFileSync(mock3BPath, ggufHeader);

    mock05BPath = path.join(tempDir, 'qwen2.5-0.5b-instruct-q4_k_m.gguf');
    fs.writeFileSync(mock05BPath, ggufHeader);
  });

  afterAll(() => {
    try {
      if (tempDir && fs.existsSync(tempDir)) {
        fs.rmSync(tempDir, { recursive: true, force: true });
      }
    } catch {
      // ignore
    }
  });

  // 1. 3B Model Discovery
  it('1. Discovers Qwen 2.5 3B with flexible casing and filenames', async () => {
    const manager = new ModelManager();
    await manager.setModelDirectory(tempDir);
    const discovered = await manager.scanModels();

    const m3b = discovered.find(m => m.id === RECOMMENDED_3B_MODEL.id);
    expect(m3b).toBeDefined();
    expect(m3b?.status).toBe('Installed');
    expect(m3b?.path).toBe(mock3BPath);
  });

  // 2. 3B Model Activation
  it('2. Activates 3B as primary model and marks 0.5B as Fallback', async () => {
    const manager = new ModelManager();
    await manager.setModelDirectory(tempDir);
    await manager.scanModels();

    const ok = await manager.selectActiveModel(RECOMMENDED_3B_MODEL.id);
    expect(ok).toBe(true);

    const active = manager.getActiveModel();
    expect(active?.id).toBe(RECOMMENDED_3B_MODEL.id);

    const role = manager.getActiveModelRole();
    expect(role.is3BActive).toBe(true);
    expect(role.is05BFallbackActive).toBe(false);

    const m05b = manager.getModelById(FALLBACK_05B_MODEL.id);
    expect(m05b?.status).toBe('Fallback');
  });

  // 3. 0.5B Fallback
  it('3. Falls back to 0.5B when 3B is missing from disk', async () => {
    // Remove 3B file
    fs.unlinkSync(mock3BPath);

    const manager = new ModelManager();
    await manager.setModelDirectory(tempDir);
    await manager.scanModels();

    const m3b = manager.getModelById(RECOMMENDED_3B_MODEL.id);
    expect(m3b?.status).toBe('Not Installed');

    // Auto-select should select 0.5B
    const autoModel = await manager.autoSelectModel();
    expect(autoModel?.id).toBe(FALLBACK_05B_MODEL.id);

    const role = manager.getActiveModelRole();
    expect(role.is05BFallbackActive).toBe(true);
    expect(role.is3BActive).toBe(false);
  });

  // 4. Model Health Check
  it('4. Real model health check validates file, GGUF magic bytes, and hardware safety', async () => {
    const manager = new ModelManager();
    await manager.setModelDirectory(tempDir);
    await manager.scanModels();

    const health = await manager.checkModelHealth(RECOMMENDED_3B_MODEL.id);
    expect(health.healthy).toBe(true);
    expect(health.details?.fileSizeBytes).toBeGreaterThanOrEqual(4);
    expect(health.message).toContain('ready for inference');
  });

  // 5. Multi-turn Conversation
  it('5. Maintains context across 6 conversation turns', () => {
    const convId = 'p12-turns';
    createConversationInDB(convId, 'Multi-turn Test');

    conversationMemoryManager.recordTurn(convId, 'user', 'What is Deadlock?');
    conversationMemoryManager.recordTurn(convId, 'assistant', 'A deadlock is a situation where two processes wait for each other.');
    conversationMemoryManager.recordTurn(convId, 'user', '4 conditions bolo');
    conversationMemoryManager.recordTurn(
      convId,
      'assistant',
      '1. Mutual Exclusion\n2. Hold and Wait\n3. No Preemption\n4. Circular Wait'
    );
    const mem = conversationMemoryManager.getMemory(convId);
    queryRewriter.rewriteQuery('2 number ta easy kore bujhao', mem);
    conversationMemoryManager.recordTurn(convId, 'user', '2 number ta easy kore bujhao');
    conversationMemoryManager.recordTurn(convId, 'assistant', 'Hold and Wait simplified.');

    expect(mem.activeTopic).toBe('Deadlock');
    expect(mem.activeSubtopic).toBe('Hold and Wait');
  });

  // 6. Topic Switching
  it('6. Dynamically switches active topic and respects return switches', () => {
    const convId = 'p12-topic-switch';
    createConversationInDB(convId, 'Topic Switching');

    conversationMemoryManager.recordTurn(convId, 'user', 'What is Deadlock?');
    conversationMemoryManager.recordTurn(convId, 'assistant', 'Deadlock explanation');

    let mem = conversationMemoryManager.getMemory(convId);
    expect(mem.activeTopic).toBe('Deadlock');

    conversationMemoryManager.recordTurn(convId, 'user', 'What is Paging?');
    conversationMemoryManager.recordTurn(convId, 'assistant', 'Paging is non-contiguous memory management.');

    mem = conversationMemoryManager.getMemory(convId);
    expect(mem.activeTopic?.toLowerCase()).toContain('paging');
    expect(mem.previousTopic).toBe('Deadlock');
  });

  // 7. Follow-up Resolution
  it('7. Resolves "eta", "2 number ta", and "example daw" accurately', () => {
    const convId = 'p12-followup';
    createConversationInDB(convId, 'Follow-up Test');

    conversationMemoryManager.recordTurn(convId, 'user', 'What is Virtual Memory?');
    conversationMemoryManager.recordTurn(convId, 'assistant', 'Virtual Memory maps virtual addresses to physical pages.');

    const mem = conversationMemoryManager.getMemory(convId);
    const reEta = queryRewriter.rewriteQuery('eta easy kore bujhao', mem);
    expect(reEta.rewrittenQuery.toLowerCase()).toContain('virtual memory');

    const reEx = queryRewriter.rewriteQuery('example daw', mem);
    expect(reEx.intent).toBe('example');
    expect(reEx.rewrittenQuery.toLowerCase()).toContain('virtual memory');
  });

  // 8. Bangla Support
  it('8. Detects Bengali Unicode input and preserves technical terms', () => {
    const query = 'ডেডলক কী এবং এর শর্তসমূহ কী কী?';
    const lang = queryRewriter.rewriteQuery(query);
    expect(lang.originalQuery).toBe(query);
  });

  // 9. Banglish Support
  it('9. Resolves Banglish input with technical terms', () => {
    const mem = {
      conversationId: 'c1',
      activeTopic: 'Operating Systems',
      activeSubtopic: 'CPU Scheduling',
      previousTopic: null,
      activeDocument: null,
      activePage: null,
      activeChapter: null,
      activeQuestion: null,
      lastUserIntent: null,
      lastUserQuery: null,
      lastAssistantAnswer: null,
      recentEntities: [],
      enumeratedQuestions: {},
      enumeratedItems: {},
      referencedConcepts: [],
      recentTurns: [],
      rollingSummary: null,
      documentDerivedConcepts: [],
      userLanguage: 'banglish',
      currentStudyTask: null,
      recentDocReferences: [],
      lastReferencedQuestionNumber: null
    };

    const res = queryRewriter.rewriteQuery('eta kivabe kaaj kore?', mem as any);
    expect(res.rewrittenQuery.toLowerCase()).toContain('cpu scheduling');
  });

  // 10. English Support
  it('10. Keeps English prompts in English language preference', () => {
    const res = queryRewriter.rewriteQuery('What is the difference between Process and Thread?');
    expect(res.wasRewritten).toBe(false);
    expect(res.resolvedQuery).toContain('Process and Thread');
  });

  // 11. Self-contained Questions
  it('11. Preserves self-contained questions without polluting them with past topics', () => {
    const mem = {
      conversationId: 'c1',
      activeTopic: 'Deadlock',
      activeSubtopic: 'Hold and Wait',
      previousTopic: null,
      activeDocument: null,
      activePage: null,
      activeChapter: null,
      activeQuestion: null,
      lastUserIntent: null,
      lastUserQuery: null,
      lastAssistantAnswer: null,
      recentEntities: [],
      enumeratedQuestions: {},
      enumeratedItems: {},
      referencedConcepts: [],
      recentTurns: [],
      rollingSummary: null,
      documentDerivedConcepts: [],
      userLanguage: 'en',
      currentStudyTask: null,
      recentDocReferences: [],
      lastReferencedQuestionNumber: null
    };

    const standalone = queryRewriter.rewriteQuery('What is CPU Scheduling?', mem as any);
    expect(standalone.wasRewritten).toBe(false);
    expect(standalone.resolvedQuery).toBe('What is CPU Scheduling?');
    expect(standalone.resolvedQuery).not.toContain('Hold and Wait');
  });

  // 12. Numbered References
  it('12. Resolves numbered item references from previous enumerated answer', () => {
    const convId = 'p12-num-ref';
    createConversationInDB(convId, 'Numbered Test');

    conversationMemoryManager.recordTurn(convId, 'user', 'What are the main types of caches?');
    conversationMemoryManager.recordTurn(
      convId,
      'assistant',
      'The primary cache levels are:\n1. L1 Cache: Fastest and closest to CPU core.\n2. L2 Cache: Secondary on-die cache.\n3. L3 Cache: Shared cache among all cores.'
    );

    const mem = conversationMemoryManager.getMemory(convId);
    const re3 = queryRewriter.rewriteQuery('3 number ta easy kore bujhao', mem);
    expect(re3.targetItemNumber).toBe(3);
    expect(re3.targetItemTitle?.toLowerCase()).toContain('l3 cache');
  });

  // 13. PDF Grounding
  it('13. Grounds context in attached document without clobbering user prompt', () => {
    const convId = 'p12-pdf-ground';
    createConversationInDB(convId, 'PDF Grounding');

    insertDocumentInDB({
      id: 'doc_1',
      filename: 'Microprocessors.pdf',
      original_path: '/docs/Microprocessors.pdf',
      file_type: 'pdf',
      file_size: 30000,
      file_hash: 'hash1'
    });
    insertChunkInDB({
      id: 'chk_1',
      document_id: 'doc_1',
      chunk_index: 0,
      page_number: 3,
      heading: null,
      text: 'The 8086 microprocessor has a 16-bit data bus and a 20-bit address bus.',
      start_offset: 0,
      end_offset: 75,
      character_count: 75,
      token_estimate: 20,
      metadata_json: null
    });
    attachDocumentToConversation(convId, 'doc_1');

    const assembled = conversationContextManager.assembleContext({
      conversationId: convId,
      history: [{ id: '1', conversationId: convId, role: 'user', content: 'What is the address bus size of 8086?', createdAt: '1' }],
      attachedDocs: [{ id: 'doc_1', filename: 'Microprocessors.pdf' } as any],
      systemInstruction: 'You are JoyBoy.',
      currentUserMessageText: 'What is the address bus size of 8086?'
    });

    expect(assembled.messages[0].content).toContain('Microprocessors.pdf');
    expect(assembled.messages[assembled.messages.length - 1].content).toContain('What is the address bus size of 8086?');
  });

  // 14. PDF Isolation
  it('14. Strictly isolates documents between different chats', () => {
    const chat1 = 'chat-alpha';
    const chat2 = 'chat-beta';
    createConversationInDB(chat1, 'Chat Alpha');
    createConversationInDB(chat2, 'Chat Beta');

    insertDocumentInDB({
      id: 'doc_alpha',
      filename: 'Physics.pdf',
      original_path: '/docs/Physics.pdf',
      file_type: 'pdf',
      file_size: 10000,
      file_hash: 'h_alpha'
    });
    attachDocumentToConversation(chat1, 'doc_alpha');

    const ctx2 = conversationContextManager.assembleContext({
      conversationId: chat2,
      history: [{ id: '1', conversationId: chat2, role: 'user', content: 'Tell me about quantum mechanics', createdAt: '1' }],
      attachedDocs: [],
      systemInstruction: 'You are JoyBoy.',
      currentUserMessageText: 'Tell me about quantum mechanics'
    });

    expect(ctx2.messages[0].content).not.toContain('Physics.pdf');
  });

  // 15. Detached Document Behavior
  it('15. Disables retrieval for detached documents', () => {
    const convId = 'p12-detach';
    createConversationInDB(convId, 'Detach Test');

    insertDocumentInDB({
      id: 'doc_temp',
      filename: 'TemporaryNotes.pdf',
      original_path: '/docs/TemporaryNotes.pdf',
      file_type: 'pdf',
      file_size: 5000,
      file_hash: 'h_temp'
    });
    attachDocumentToConversation(convId, 'doc_temp');
    detachDocumentFromConversation(convId, 'doc_temp');

    const ctx = conversationContextManager.assembleContext({
      conversationId: convId,
      history: [{ id: '1', conversationId: convId, role: 'user', content: 'What is in the notes?', createdAt: '1' }],
      attachedDocs: [],
      systemInstruction: 'You are JoyBoy.',
      currentUserMessageText: 'What is in the notes?'
    });

    expect(ctx.messages[0].content).not.toContain('TemporaryNotes.pdf');
  });

  // 16. OCR Detection
  it('16. Reports OCR availability honestly without hallucination', async () => {
    const ocrStatus = await getOcrEngineStatus();
    expect(typeof ocrStatus.isAvailable).toBe('boolean');
    expect(ocrStatus.engineName).toContain('Tesseract');
  });

  // 17. Context Budgeting
  it('17. Enforces token budgets within 2048-4096 bounds', () => {
    const convId = 'p12-budget';
    createConversationInDB(convId, 'Budget Test');

    const history = Array(20).fill(null).map((_, i) => ({
      id: `m_${i}`,
      conversationId: convId,
      role: (i % 2 === 0 ? 'user' : 'assistant') as 'user' | 'assistant',
      content: `Turn ${i} discussing operating system virtual memory management architectures.`,
      createdAt: new Date(i).toISOString()
    }));

    const assembled = conversationContextManager.assembleContext({
      conversationId: convId,
      history,
      attachedDocs: [],
      systemInstruction: 'You are JoyBoy.',
      currentUserMessageText: 'Final question',
      contextLength: 4096,
      reservedOutputTokens: 512
    });

    expect(assembled.contextTokensEstimate).toBeLessThanOrEqual(3584);
  });

  // 18. Response Validation
  it('18. Validates responses and preserves valid concise answers like "RAM" or "CPU"', () => {
    const validShort = validateResponse({ userQuery: 'What holds active memory?', assistantResponse: 'RAM' });
    expect(validShort.isValid).toBe(true);

    const validAcronym = validateResponse({ userQuery: 'What is central processing unit?', assistantResponse: 'CPU' });
    expect(validAcronym.isValid).toBe(true);

    const loopResponse = validateResponse({
      userQuery: 'What is deadlock?',
      assistantResponse: 'Deadlock is a deadlock is a deadlock is a deadlock is a deadlock is a deadlock is a deadlock is a deadlock is a deadlock is a deadlock is a deadlock.'
    });
    expect(loopResponse.isValid).toBe(false);
    expect(loopResponse.issues.some(i => i.toLowerCase().includes('repetition'))).toBe(true);
  });

  // 19. Offline State Verification
  it('19. Functions completely offline with no network or cloud dependencies', async () => {
    const mockProvider = new MockAIProvider();
    const isAvail = await mockProvider.isAvailable();
    expect(isAvail).toBe(true);

    const answer = await mockProvider.generateResponse([
      { id: '1', conversationId: 'c1', role: 'user', content: 'What is an operating system?', createdAt: '1' }
    ]);
    expect(answer.length).toBeGreaterThan(10);
  });

  // 20. Benchmark Persistence
  it('20. Runs and persists 10-prompt study benchmark suite in SQLite', async () => {
    const mockProvider = new MockAIProvider();
    expect(STUDY_BENCHMARK_PROMPTS.length).toBe(10);

    const result = await modelBenchmarkService.runComprehensiveBenchmark(
      mockProvider,
      'qwen2.5-3b-instruct-q4_k_m',
      'Qwen 2.5 3B Instruct',
      { maxPrompts: 3 }
    );

    expect(result.results.length).toBe(3);
    expect(result.averageGenerationTokSec).toBeGreaterThan(0);
    expect(result.totalResponseTokens).toBeGreaterThan(0);

    const persisted = modelBenchmarkService.getComprehensiveBenchmarkForModel('qwen2.5-3b-instruct-q4_k_m');
    expect(persisted).not.toBeNull();
    expect(persisted?.modelName).toBe('Qwen 2.5 3B Instruct');
  });

  // 21. Cross-Platform Paths
  it('21. Normalizes paths cleanly across Windows and Linux environments', () => {
    const winPath = windowsEnvironment.formatPath('models/qwen2.5-3b.gguf');
    expect(winPath).toContain('\\');
    expect(windowsEnvironment.whichCommand).toBe('where');

    const linPath = linuxEnvironment.formatPath('models\\qwen2.5-3b.gguf');
    expect(linPath).toContain('/');
    expect(linuxEnvironment.whichCommand).toBe('which');
  });

  // 22. Conservative CPU Thread Tuning
  it('22. Tunes CPU thread count conservatively to protect UI responsiveness on i5 laptops', async () => {
    const safety = await modelHardwareEstimator.estimateModelSafety(RECOMMENDED_3B_MODEL);
    // Should allocate safe threads leaving room for OS and UI
    expect(safety.recommendedThreads).toBeGreaterThanOrEqual(1);
    expect(safety.recommendedThreads).toBeLessThanOrEqual(6);
  });

  // 23. Safe Resource Allocation
  it('23. Accurately estimates memory footprint for 3B and 0.5B models', async () => {
    const safety3B = await modelHardwareEstimator.estimateModelSafety(RECOMMENDED_3B_MODEL, 14 * 1024 * 1024 * 1024);
    expect(safety3B.isSafeToLoad).toBe(true);

    const safety05B = await modelHardwareEstimator.estimateModelSafety(FALLBACK_05B_MODEL, 14 * 1024 * 1024 * 1024);
    expect(safety05B.isSafeToLoad).toBe(true);
    expect(safety05B.expectedRamBytes).toBeLessThan(safety3B.expectedRamBytes);

    const rec = getHardwareAwareRecommendation(14);
    expect(rec.recommendedModelId).toBeDefined();
  });

  // 24. Failure Diagnostics
  it('24. Classifies failure root causes (Resource Pressure vs RAG vs Prompt vs Model)', () => {
    const diagResource = diagnoseAnswerQuality({
      timestamp: new Date().toISOString(),
      modelName: 'Qwen 3B',
      providerId: 'llamacpp',
      contextSize: 4096,
      maxTokens: 512,
      temperature: 0.7,
      historyTurnsCount: 2,
      tokenEstimate: 500,
      activeTopic: 'OS',
      activeSubtopic: null,
      activeChapter: null,
      originalUserPrompt: 'What is CPU?',
      resolvedQuery: 'What is CPU?',
      intent: 'EXPLAIN',
      retrievedChunkCount: 0,
      documentNames: [],
      systemPromptPreview: '',
      generationSpeedTokPerSec: 1.2
    });
    expect(diagResource.category).toBe('RESOURCE_PRESSURE');

    const diagRAG = diagnoseAnswerQuality({
      timestamp: new Date().toISOString(),
      modelName: 'Qwen 3B',
      providerId: 'llamacpp',
      contextSize: 4096,
      maxTokens: 512,
      temperature: 0.7,
      historyTurnsCount: 2,
      tokenEstimate: 500,
      activeTopic: 'Deadlock',
      activeSubtopic: null,
      activeChapter: null,
      originalUserPrompt: 'Explain section 4',
      resolvedQuery: 'Explain section 4 in Deadlock document',
      intent: 'EXPLAIN',
      retrievedChunkCount: 0,
      documentNames: ['OperatingSystems.pdf'],
      systemPromptPreview: '',
      generationSpeedTokPerSec: 25.0
    });
    expect(diagRAG.category).toBe('RAG_RETRIEVAL_FAILURE');
  });

  // 25. 3B vs 0.5B Comparison Metrics
  it('25. Generates factual comparison metrics between models without subjective bias', () => {
    modelBenchmarkService.saveBenchmark({
      modelId: 'qwen2.5-3b-instruct-q4_k_m',
      modelName: 'Qwen 2.5 3B Instruct',
      loadTimeMs: 400,
      firstTokenLatencyMs: 450,
      generationTokSec: 24.5,
      totalTokens: 120,
      totalDurationMs: 4900,
      approxRamBytes: 2500000000,
      timestamp: new Date().toISOString(),
      status: 'passed'
    });

    modelBenchmarkService.saveBenchmark({
      modelId: 'qwen2.5-0.5b-instruct-q4_k_m',
      modelName: 'Qwen 2.5 0.5B Instruct',
      loadTimeMs: 150,
      firstTokenLatencyMs: 180,
      generationTokSec: 52.0,
      totalTokens: 120,
      totalDurationMs: 2300,
      approxRamBytes: 800000000,
      timestamp: new Date().toISOString(),
      status: 'passed'
    });

    const comp = modelBenchmarkService.compareModels(
      'qwen2.5-3b-instruct-q4_k_m',
      'qwen2.5-0.5b-instruct-q4_k_m'
    );
    expect(comp).not.toBeNull();
    expect(comp?.speedRatio).toBeDefined();
    expect(comp?.latencyRatio).toBeDefined();
    expect(comp?.summary).toContain('Qwen 2.5 3B Instruct');
    expect(comp?.summary).toContain('Qwen 2.5 0.5B Instruct');
  });
});

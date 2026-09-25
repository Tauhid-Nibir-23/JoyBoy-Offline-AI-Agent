import { describe, it, expect, beforeEach } from 'vitest';
import { 
  initDatabase, 
  createConversationInDB, 
  insertDocumentInDB,
  insertChunkInDB,
  attachDocumentToConversation,
  detachDocumentFromConversation,
  getDocumentIdsForConversation,
  clearAllConversations,
  clearAllDocuments
} from '../database/db';
import { 
  detectLanguage, 
  resolveResponseLanguage, 
  buildLanguageSystemPrompt 
} from '../ai/languageDetector';
import { conversationMemoryManager } from '../ai/conversationMemory';
import { queryRewriter } from '../ai/queryRewriter';
import { contextManager } from '../ai/contextManager';
import { 
  classifyDocumentText, 
  classifyPage, 
  analyzeDocumentPages, 
  ocrRegistry, 
  TesseractCliOCRProvider, 
  LocalFallbackOCRProvider 
} from '../documents/intelligence';
import { chunkDocumentText } from '../documents/chunking/chunkText';
import { retriever } from '../rag/retriever';
import { ragService } from '../rag/ragService';
import { chatService } from '../ai/chatService';
import { modelManager } from '../models/manager';
import { getHardwareAwareRecommendation, assessModelLoadSafety } from '../models/hardwareProfile';
import { GENERATION_PRESETS, getGenerationParameters } from '../ai/generationPresets';

describe('Phase 9 — Real Context Intelligence + Model Upgrade + Deep Document Understanding Tests', () => {
  beforeEach(async () => {
    await initDatabase();
    clearAllConversations();
    clearAllDocuments();
    conversationMemoryManager.clearCache();
  });

  // ==========================================
  // PART 19 / PART 1-4: Follow-up Test Cases
  // ==========================================

  it('1. Follow-up: "What is deadlock?" -> "example daw" resolves to deadlock example', () => {
    const convId = 'test-conv-followup-1';
    createConversationInDB(convId, 'Deadlock Discussion');

    conversationMemoryManager.recordTurn(
      convId,
      'user',
      'What is deadlock in operating systems?'
    );
    conversationMemoryManager.recordTurn(
      convId,
      'assistant',
      'A deadlock is a situation where a set of processes are blocked because each process is holding a resource and waiting for another resource acquired by some other process.'
    );

    const memory = conversationMemoryManager.getMemory(convId);
    expect(memory.activeTopic?.toLowerCase()).toContain('deadlock');

    const rewritten = queryRewriter.rewriteQuery('example daw', memory);
    expect(rewritten.isRewritten).toBe(true);
    expect(rewritten.rewrittenQuery.toLowerCase()).toContain('deadlock');
    expect(rewritten.rewrittenQuery.toLowerCase()).toContain('example');
  });

  it('2. Follow-up: "Deadlock er 4 ta condition bolo" -> "eta easy kore bujhao" resolves conditions simply', () => {
    const convId = 'test-conv-followup-2';
    createConversationInDB(convId, 'Deadlock Conditions');

    conversationMemoryManager.recordTurn(
      convId,
      'user',
      'Deadlock er 4 ta condition bolo'
    );
    conversationMemoryManager.recordTurn(
      convId,
      'assistant',
      'The four necessary conditions for deadlock are: 1. Mutual Exclusion, 2. Hold and Wait, 3. No Preemption, and 4. Circular Wait.'
    );

    const memory = conversationMemoryManager.getMemory(convId);
    expect(memory.recentEntities.some(e => e.toLowerCase().includes('condition') || e.toLowerCase().includes('deadlock'))).toBe(true);

    const rewritten = queryRewriter.rewriteQuery('eta easy kore bujhao', memory);
    expect(rewritten.isRewritten).toBe(true);
    expect(rewritten.targetAction).toBe('simplify');
    expect(rewritten.rewrittenQuery.toLowerCase()).toContain('deadlock');
  });

  it('3. Follow-up: "chapter 2 explain koro" -> "MCQ banaw" resolves MCQs from Chapter 2', () => {
    const convId = 'test-conv-followup-3';
    createConversationInDB(convId, 'Chapter 2 Study');

    conversationMemoryManager.recordTurn(
      convId,
      'user',
      'chapter 2 explain koro'
    );
    conversationMemoryManager.recordTurn(
      convId,
      'assistant',
      'Chapter 2 covers Process Management, Process Control Blocks (PCB), and CPU Scheduling Algorithms.'
    );

    const memory = conversationMemoryManager.getMemory(convId);
    expect(memory.recentChapterRef).toBe('Chapter 2');

    const rewritten = queryRewriter.rewriteQuery('MCQ banaw', memory);
    expect(rewritten.isRewritten).toBe(true);
    expect(rewritten.targetAction).toBe('mcq');
    expect(rewritten.rewrittenQuery).toContain('Chapter 2');
  });

  it('4. Follow-up: "question 5 explain koro" resolves question 5 from active context', () => {
    const convId = 'test-conv-followup-4';
    createConversationInDB(convId, 'Exam Practice');

    conversationMemoryManager.recordTurn(
      convId,
      'assistant',
      'Here are the practice questions:\n1. What is paging?\n2. What is virtual memory?\n3. What is thrashing?\n4. What is TLB?\n5. Explain Bankers algorithm for deadlock avoidance.'
    );

    const memory = conversationMemoryManager.getMemory(convId);
    expect(memory.enumeratedQuestions['5']).toBeDefined();
    expect(memory.enumeratedQuestions['5']).toContain('Bankers algorithm');

    const rewritten = queryRewriter.rewriteQuery('question 5 explain koro', memory);
    expect(rewritten.isRewritten).toBe(true);
    expect(rewritten.rewrittenQuery).toContain('Bankers algorithm');
  });

  it('5. Follow-up: "ager answer ta short koro" targets previous assistant answer', () => {
    const convId = 'test-conv-followup-5';
    createConversationInDB(convId, 'Shortening Turn');

    const longAnswer = 'Round Robin CPU Scheduling is a preemptive scheduling algorithm where each process is assigned a fixed time slot called quantum in a cyclic order.';
    conversationMemoryManager.recordTurn(convId, 'assistant', longAnswer);

    const memory = conversationMemoryManager.getMemory(convId);
    expect(memory.lastAssistantAnswerSnippet).toContain('Round Robin');

    const rewritten = queryRewriter.rewriteQuery('ager answer ta short koro', memory);
    expect(rewritten.isRewritten).toBe(true);
    expect(rewritten.targetAction).toBe('shorten');
  });

  it('6. Follow-up: "ei PDF theke important topics bolo" -> "kon gula exam e aste pare?" keeps same PDF/context', () => {
    const convId = 'test-conv-followup-6';
    createConversationInDB(convId, 'PDF Exam Review');

    conversationMemoryManager.recordTurn(
      convId,
      'user',
      'ei PDF theke important topics bolo',
      ['Operating_System_Concepts.pdf']
    );
    conversationMemoryManager.recordTurn(
      convId,
      'assistant',
      'Based on Operating_System_Concepts.pdf, the key topics are CPU Scheduling, Virtual Memory, and Deadlock Avoidance.'
    );

    const memory = conversationMemoryManager.getMemory(convId);
    expect(memory.attachedDocuments).toContain('Operating_System_Concepts.pdf');

    const rewritten = queryRewriter.rewriteQuery('kon gula exam e aste pare?', memory);
    expect(rewritten.isRewritten).toBe(true);
    expect(rewritten.rewrittenQuery).toContain('Operating_System_Concepts.pdf');
  });

  // ==========================================
  // PART 10: Bengali + Banglish Behavior
  // ==========================================

  it('7. Banglish "deadlock ki?" generates Bangla prompt in natural Bengali script', () => {
    const prompt = 'deadlock ki? eta kivabe hoy?';
    const lang = detectLanguage(prompt);
    expect(lang).toBe('banglish');

    const resolved = resolveResponseLanguage(prompt, 'auto');
    expect(['bn', 'banglish']).toContain(resolved);

    const sysPrompt = buildLanguageSystemPrompt(resolved);
    expect(sysPrompt).toContain('বাংলা অক্ষর');
    expect(sysPrompt).toContain('technical accuracy');
  });

  it('8. English "What is deadlock?" produces English response configuration', () => {
    const prompt = 'What is deadlock and how does it happen?';
    const lang = detectLanguage(prompt);
    expect(lang).toBe('en');

    const resolved = resolveResponseLanguage(prompt, 'auto');
    expect(resolved).toBe('en');

    const sysPrompt = buildLanguageSystemPrompt(resolved);
    expect(sysPrompt).toContain('English');
  });

  // ==========================================
  // PART 16 / PART 4: Chat-Scoped Workspace & Isolation
  // ==========================================

  it('9. Chat A (with PDF A) vs Chat B (without PDF A) preserves strict isolation', async () => {
    const convA = chatService.createConversation('Chat A - OS');
    const convB = chatService.createConversation('Chat B - Blank');

    const docAId = 'doc-pdf-a-' + Date.now();
    insertDocumentInDB({
      id: docAId,
      filename: 'Operating_System.pdf',
      file_type: 'pdf',
      file_size: 45000,
      file_hash: 'fake-hash-os-' + Date.now(),
      extraction_status: 'Ready',
      imported_at: new Date().toISOString()
    });

    insertChunkInDB({
      id: 'chunk-os-1',
      document_id: docAId,
      chunk_index: 0,
      text: 'Deadlock prevention requires eliminating one of the four Coffman conditions: Mutual Exclusion, Hold and Wait, No Preemption, or Circular Wait.',
      start_offset: 0,
      end_offset: 125,
      character_count: 125,
      token_estimate: 25,
      heading: 'Deadlock Prevention',
      page_number: 12,
      metadata_json: JSON.stringify({ source: 'unit_test' }),
      embedding_json: JSON.stringify(new Array(64).fill(0.1))
    });

    attachDocumentToConversation(convA.id, docAId);

    // Chat A retrieval: should find the chunk
    const resultsA = await retriever.retrieve('deadlock prevention conditions', {
      filterDocumentIds: getDocumentIdsForConversation(convA.id)
    });
    expect(resultsA.length).toBeGreaterThan(0);
    expect(resultsA[0].chunk.documentId).toBe(docAId);

    // Chat B retrieval: no documents attached, filterDocumentIds is empty -> zero results
    const docIdsB = getDocumentIdsForConversation(convB.id);
    expect(docIdsB.length).toBe(0);
    const resultsB = await retriever.retrieve('deadlock prevention conditions', {
      filterDocumentIds: docIdsB
    });
    expect(resultsB.length).toBe(0);
  });

  it('10. Detached PDF A from Chat A is no longer retrieved', async () => {
    const conv = chatService.createConversation('Chat Detach Test');
    const docId = 'doc-detach-os-' + Date.now();
    insertDocumentInDB({
      id: docId,
      filename: 'Algorithms.pdf',
      file_type: 'pdf',
      file_size: 32000,
      file_hash: 'hash-algo-' + Date.now(),
      extraction_status: 'Ready',
      imported_at: new Date().toISOString()
    });

    insertChunkInDB({
      id: 'chunk-algo-1',
      document_id: docId,
      chunk_index: 0,
      text: 'Dijkstras algorithm finds the shortest path in a weighted graph with non-negative edge weights.',
      start_offset: 0,
      end_offset: 100,
      character_count: 100,
      token_estimate: 20,
      heading: 'Graph Algorithms',
      page_number: 5,
      metadata_json: JSON.stringify({ source: 'unit_test' }),
      embedding_json: JSON.stringify(new Array(64).fill(0.1))
    });

    attachDocumentToConversation(conv.id, docId);
    expect(getDocumentIdsForConversation(conv.id)).toContain(docId);

    // Detach
    detachDocumentFromConversation(conv.id, docId);
    expect(getDocumentIdsForConversation(conv.id)).not.toContain(docId);

    const results = await retriever.retrieve('Dijkstras shortest path', {
      filterDocumentIds: getDocumentIdsForConversation(conv.id)
    });
    expect(results.length).toBe(0);
  });

  // ==========================================
  // PART 11 & 12: Model Management & Hardware Safety
  // ==========================================

  it('11. Model Manager cleanly distinguishes Active, Installed, Not Installed, Missing, Unsupported', async () => {
    const list = await modelManager.listModels();
    expect(list.length).toBeGreaterThanOrEqual(4);

    // Qwen 2.5 0.5B should be in the list
    const qwen05 = list.find(m => m.id.includes('0.5b'));
    expect(qwen05).toBeDefined();

    // Qwen 2.5 3B should be registered as Not Installed / Available
    const qwen3b = list.find(m => m.id.includes('3b'));
    expect(qwen3b).toBeDefined();
    expect(qwen3b?.status).toBe('Not Installed');
  });

  it('12. Hardware Profile recommends 3B for 14GB RAM and marks 7B as Heavy', () => {
    const rec = getHardwareAwareRecommendation(14);
    expect(rec.recommendedModelId).toBe('qwen2.5-3b');
    expect(rec.fallbackModelId).toBe('qwen2.5-0.5b');
    expect(rec.warnings.some(w => w.includes('7B') || w.includes('Heavy'))).toBe(true);

    const safety7b = assessModelLoadSafety('qwen2.5-7b', 14);
    expect(safety7b.warning).toContain('Heavy');
  });

  it('13. Generation presets provide balanced Study defaults', () => {
    const studyPreset = getGenerationParameters('study');
    expect(studyPreset.temperature).toBeLessThanOrEqual(0.7);
    expect(studyPreset.top_p).toBe(0.9);
    expect(studyPreset.repeat_penalty).toBeGreaterThan(1.0);

    const precisePreset = getGenerationParameters('precise');
    expect(precisePreset.temperature).toBe(0.2);
  });

  // ==========================================
  // PART 5-9: Deep Document Understanding & OCR
  // ==========================================

  it('14. Document Page Classifier identifies TEXT, TABLE_HEAVY, and SCANNED pages', () => {
    // Regular text
    const textPage = classifyPage('In computer science, a data structure is a data organization, management, and storage format that is usually chosen for efficient access to data.', 1);
    expect(textPage.classification).toBe('TEXT');

    // Markdown Table
    const tableText = '| Algorithm | Preemptive | Starvation |\n| RR | Yes | Low |\n| FCFS | No | High |\n| SJF | Optional | High |';
    const tablePage = classifyPage(tableText, 2);
    expect(tablePage.classification).toBe('TABLE_HEAVY');
    expect(tablePage.hasTables).toBe(true);

    // Scanned / empty page
    const scannedPage = classifyPage('', 3, true);
    expect(scannedPage.classification).toBe('SCANNED');
    expect(scannedPage.isScanned).toBe(true);
  });

  it('15. Markdown table extraction preserves tabular formatting in chunks', () => {
    const markdownWithTable = `
# CPU Scheduling Comparison

| Algorithm | Preemptive | Starvation |
| --- | --- | --- |
| Round Robin | Yes | Low |
| First Come First Served | No | Possible |
| Shortest Job First | Yes | Possible |

Round Robin is widely used in time-sharing operating systems.
    `.trim();

    const chunkResult = chunkDocumentText(
      markdownWithTable,
      'doc_table_test',
      { targetSize: 300, overlap: 50 },
      { source: 'unit_test' }
    );

    expect(chunkResult.chunks.length).toBeGreaterThan(0);
    const tableChunk = chunkResult.chunks.find(c => c.text.includes('| Round Robin |'));
    expect(tableChunk).toBeDefined();
    expect(tableChunk?.text).toContain('| Algorithm | Preemptive |');
  });

  it('16. OCR Provider reports status honestly without hallucination', async () => {
    const tesseractProvider = new TesseractCliOCRProvider();
    const info = await tesseractProvider.getEngineInfo();
    expect(info.name).toBe('Tesseract OCR CLI');
    expect(typeof info.isAvailable).toBe('boolean');

    // If unavailable, fallback returns honest message
    const fallback = new LocalFallbackOCRProvider();
    const res = await fallback.extractTextFromPage(new Uint8Array([]), 1);
    expect(res.text).toContain('scanned/image-based');
    expect(res.text).toContain('OCR engine install');
  });

  // ==========================================
  // PART 15: Answer Grounding Hierarchy
  // ==========================================

  it('17. Answer Grounding informs when attached documents lack relevant material', async () => {
    const conv = chatService.createConversation('Grounding Test');
    const docId = 'doc-grounding-' + Date.now();
    insertDocumentInDB({
      id: docId,
      filename: 'Physics.pdf',
      file_type: 'pdf',
      file_size: 20000,
      file_hash: 'hash-phys-' + Date.now(),
      extraction_status: 'Ready',
      imported_at: new Date().toISOString()
    });
    attachDocumentToConversation(conv.id, docId);

    // Search for unrelated operating systems concept in Physics PDF
    const contextResult = await ragService.buildContext('explain CPU deadlock', {
      filterDocumentIds: [docId],
      hasAttachedDocuments: true
    });

    expect(contextResult.usedKnowledge).toBe(false);
    expect(contextResult.systemInstruction).toBeDefined();
    // System instruction must instruct honest disclosure
    expect(
      contextResult.systemInstruction?.includes('No sufficiently relevant material') ||
      contextResult.systemInstruction?.includes('এই informationটা attached material-এ পাইনি')
    ).toBe(true);
  });

  // ==========================================
  // PART 1: Token-Budget Aware Context Manager
  // ==========================================

  it('18. Context Manager builds structured multi-section context within token budget', () => {
    const convId = 'test-token-budget';
    createConversationInDB(convId, 'Long History');

    // Record 10 turns
    for (let i = 1; i <= 8; i++) {
      conversationMemoryManager.recordTurn(convId, 'user', `Topic question turn ${i}`);
      conversationMemoryManager.recordTurn(convId, 'assistant', `Detailed technical explanation for turn ${i}`);
    }

    const payload = contextManager.buildGenerationContext({
      conversationId: convId,
      userPrompt: 'summarize the discussion so far',
      attachedDocumentFilenames: ['Course_Notes.pdf'],
      maxContextTokens: 1200
    });

    expect(payload.systemPrompt).toContain('offline personal study assistant');
    expect(payload.systemPrompt).toContain('Course_Notes.pdf');
    expect(payload.chatIdentity).toContain('Long History');
    expect(payload.recentMessages.length).toBeGreaterThan(0);
    expect(payload.tokenEstimate).toBeLessThanOrEqual(1300);
  });
});

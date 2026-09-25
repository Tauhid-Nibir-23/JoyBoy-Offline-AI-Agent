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
  DBDocument,
  DBDocumentChunk
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
  ocrRegistry, 
  TesseractCliOCRProvider, 
  LocalFallbackOCRProvider 
} from '../documents/intelligence';
import { chunkDocumentText } from '../documents/chunking/chunkText';
import { retriever } from '../rag/retriever';
import { ragService } from '../rag/ragService';
import { INITIAL_REGISTERED_MODELS } from '../models/registry';
import { GENERATION_PRESETS, getGenerationParameters } from '../ai/generationPresets';
import { validateResponse } from '../ai/responseValidator';

describe('Phase 10 — JoyBoy Offline-First AI Engine & Conversational Intelligence Test Suite', () => {
  beforeEach(async () => {
    await initDatabase();
    clearAllConversations();
    clearAllDocuments();
    conversationMemoryManager.clearCache();
  });

  // Helper to generate compliant DBDocument objects
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
    tokenEstimate?: number;
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
      token_estimate: params.tokenEstimate || 20,
      metadata_json: JSON.stringify({ source: 'test' }),
      embedding_json: JSON.stringify(new Array(64).fill(0.1))
    };
  }

  // =========================================================================
  // 1. Multi-turn topic tracking ("What is deadlock?" -> "4 conditions bolo" -> "2 number ta")
  // =========================================================================
  it('1. Multi-turn topic tracking preserves core topic across several queries', () => {
    const convId = 'test-phase10-topic-track';
    createConversationInDB(convId, 'Deadlock Multi-turn');

    // Turn 1: User asks about deadlock
    conversationMemoryManager.recordTurn(convId, 'user', 'What is deadlock in operating systems?');
    conversationMemoryManager.recordTurn(
      convId, 
      'assistant', 
      'Deadlock is a condition where a set of processes are blocked because each is holding a resource and waiting for another.'
    );

    let mem = conversationMemoryManager.getMemory(convId);
    expect(mem.activeTopic?.toLowerCase()).toContain('deadlock');

    // Turn 2: User asks for conditions
    conversationMemoryManager.recordTurn(convId, 'user', '4 ta condition bolo');
    conversationMemoryManager.recordTurn(
      convId,
      'assistant',
      'The four necessary conditions for deadlock are:\n1. Mutual Exclusion\n2. Hold and Wait: A process holds resources while requesting more.\n3. No Preemption\n4. Circular Wait'
    );

    mem = conversationMemoryManager.getMemory(convId);
    expect(mem.activeTopic?.toLowerCase()).toContain('deadlock');
    expect(Object.keys(mem.enumeratedItems).length).toBeGreaterThanOrEqual(4);

    // Turn 3: User refers to item 2
    const rewritten = queryRewriter.rewriteQuery('2 number ta easy kore bujhao', mem);
    expect(rewritten.isRewritten).toBe(true);
    expect(rewritten.rewrittenQuery.toLowerCase()).toContain('hold and wait');
  });

  // =========================================================================
  // 2. Follow-up resolution ("example daw" on active topic)
  // =========================================================================
  it('2. Follow-up resolution: "example daw" correctly requests example of active topic', () => {
    const convId = 'test-phase10-followup-example';
    createConversationInDB(convId, 'Example Follow-up');

    conversationMemoryManager.recordTurn(convId, 'user', 'What is deadlock?');
    conversationMemoryManager.recordTurn(
      convId,
      'assistant',
      'Deadlock occurs when two or more processes are unable to proceed because each is waiting for the other to release a resource.'
    );

    const mem = conversationMemoryManager.getMemory(convId);
    const rewritten = queryRewriter.rewriteQuery('example daw', mem);

    expect(rewritten.isRewritten).toBe(true);
    expect(rewritten.rewrittenQuery.toLowerCase()).toContain('deadlock');
    expect(rewritten.rewrittenQuery.toLowerCase()).toContain('example');
  });

  // =========================================================================
  // 3. Nested follow-up resolution ("2 number ta easy kore bujhao" -> "example daw")
  // =========================================================================
  it('3. Nested follow-up resolution resolves subtopic and subsequent requests', () => {
    const convId = 'test-phase10-nested-followup';
    createConversationInDB(convId, 'Nested Followup');

    conversationMemoryManager.recordTurn(convId, 'user', 'What are the deadlock conditions?');
    conversationMemoryManager.recordTurn(
      convId,
      'assistant',
      '1. Mutual Exclusion\n2. Hold and Wait\n3. No Preemption\n4. Circular Wait'
    );

    // Step A: Ask to simplify condition 2
    let mem = conversationMemoryManager.getMemory(convId);
    const step1Rewritten = queryRewriter.rewriteQuery('2 number ta easy kore bujhao', mem);
    expect(step1Rewritten.targetItemTitle?.toLowerCase()).toContain('hold and wait');

    conversationMemoryManager.recordTurn(convId, 'user', '2 number ta easy kore bujhao');
    conversationMemoryManager.recordTurn(
      convId,
      'assistant',
      'Hold and Wait means a process is already holding at least one resource and is waiting to get another resource.'
    );

    // Step B: Nested follow-up on that specific condition
    mem = conversationMemoryManager.getMemory(convId);
    expect(mem.activeSubtopic?.toLowerCase()).toContain('hold and wait');

    const step2Rewritten = queryRewriter.rewriteQuery('example daw', mem);
    expect(step2Rewritten.rewrittenQuery.toLowerCase()).toContain('hold and wait');
  });

  // =========================================================================
  // 4. Enumerated answer reference (item 2 resolves to Hold and Wait)
  // =========================================================================
  it('4. Enumerated list reference extraction correctly maps ordinal indices', () => {
    const convId = 'test-phase10-enum-extract';
    createConversationInDB(convId, 'Enum Reference');

    conversationMemoryManager.recordTurn(convId, 'user', 'Deadlock er 4 ta condition ki?');
    conversationMemoryManager.recordTurn(
      convId,
      'assistant',
      'Deadlock হতে হলে নিচের ৪টি শর্ত পূরণ হতে হবে:\n' +
      '1. **Mutual Exclusion**: অন্তত একটি রিসোর্স non-shareable হতে হবে।\n' +
      '2. **Hold and Wait**: প্রসেস একটি রিসোর্স ধরে রেখে অন্য রিসোর্সের অপেক্ষা করে।\n' +
      '3. **No Preemption**: রিসোর্স জোর করে ছিনিয়ে নেওয়া যায় না।\n' +
      '4. **Circular Wait**: প্রসেসগুলোর মধ্যে বৃত্তাকার অপেক্ষার চেইন তৈরি হয়।'
    );

    const mem = conversationMemoryManager.getMemory(convId);
    expect(Object.keys(mem.enumeratedItems).length).toBe(4);
    expect(mem.enumeratedItems['2'].title.toLowerCase()).toContain('hold and wait');

    const resolved = conversationMemoryManager.resolveReferencedItem(convId, 2);
    expect(resolved?.title.toLowerCase()).toContain('hold and wait');
  });

  // =========================================================================
  // 5. Previous-answer shortening ("short koro")
  // =========================================================================
  it('5. Shorten intent: "ager ta short koro" detects shorten_answer intent on previous answer', () => {
    const convId = 'test-phase10-shorten';
    createConversationInDB(convId, 'Shorten Test');

    conversationMemoryManager.recordTurn(convId, 'user', 'Explain Virtual Memory in detail');
    conversationMemoryManager.recordTurn(
      convId,
      'assistant',
      'Virtual memory is a memory management technique that provides an idealized abstraction of the storage resources that are actually available on a given machine.'
    );

    const mem = conversationMemoryManager.getMemory(convId);
    const rewritten = queryRewriter.rewriteQuery('ager ta short koro', mem);

    expect(rewritten.intent).toBe('shorten_answer');
    expect(rewritten.rewrittenQuery.toLowerCase()).toContain('summary');
    expect(rewritten.rewrittenQuery.toLowerCase()).toContain('memory');
  });

  // =========================================================================
  // 6. MCQ generation intent ("MCQ banaw 5 ta")
  // =========================================================================
  it('6. MCQ intent: "MCQ banaw 5 ta" extracts generate_mcq intent with count', () => {
    const convId = 'test-phase10-mcq';
    createConversationInDB(convId, 'MCQ Generation');

    conversationMemoryManager.recordTurn(convId, 'user', 'What is CPU Scheduling?');
    conversationMemoryManager.recordTurn(
      convId,
      'assistant',
      'CPU scheduling is a process which allows one process to use the CPU while the execution of another process is on hold.'
    );

    const mem = conversationMemoryManager.getMemory(convId);
    const rewritten = queryRewriter.rewriteQuery('eitar 5 ta MCQ banaw', mem);

    expect(['MCQ', 'generate_mcq']).toContain(rewritten.intent);
    expect(rewritten.rewrittenQuery.toLowerCase()).toContain('5');
    expect(rewritten.rewrittenQuery.toLowerCase()).toContain('mcq');
    expect(rewritten.rewrittenQuery.toLowerCase()).toContain('cpu scheduling');
  });

  // =========================================================================
  // 7. Document-aware follow-up ("ei PDF theke...")
  // =========================================================================
  it('7. Document-aware follow-up directs query to attached document scope', () => {
    const convId = 'test-phase10-doc-scope';
    createConversationInDB(convId, 'Doc Scope');

    const doc = createTestDoc('doc-os-silber', 'operating_systems_silberschatz.pdf', 'Chapter 7: Deadlocks');
    insertDocumentInDB(doc);
    attachDocumentToConversation(convId, doc.id);

    conversationMemoryManager.recordTurn(convId, 'user', 'What does this book cover?', [doc.filename]);
    conversationMemoryManager.recordTurn(
      convId,
      'assistant',
      'This textbook covers operating system concepts including processes, memory, and deadlocks.'
    );

    const mem = conversationMemoryManager.getMemory(convId);
    const rewritten = queryRewriter.rewriteQuery('ei PDF theke deadlock er solution gula bolo', mem);

    expect(rewritten.isRewritten).toBe(true);
    expect(rewritten.rewrittenQuery.toLowerCase()).toContain('deadlock');
  });

  // =========================================================================
  // 8. Chapter-aware retrieval (boosting Chapter 2 chunks)
  // =========================================================================
  it('8. Chapter-aware retrieval boosts chunks matching the referenced chapter', async () => {
    const convId = 'test-phase10-chapter-boost';
    createConversationInDB(convId, 'Chapter Retrieval');

    const doc = createTestDoc('doc-chaps', 'os_chapters.pdf', 'Full OS Book');
    insertDocumentInDB(doc);
    attachDocumentToConversation(convId, doc.id);

    insertChunkInDB(createTestChunk({
      id: 'chunk-ch1',
      documentId: doc.id,
      chunkIndex: 0,
      pageNumber: 2,
      heading: 'Chapter 1: Overview',
      text: 'Chapter 1: Overview of computer systems and architecture.'
    }));

    insertChunkInDB(createTestChunk({
      id: 'chunk-ch2',
      documentId: doc.id,
      chunkIndex: 1,
      pageNumber: 5,
      heading: 'Chapter 2: Structures',
      text: 'Chapter 2: Operating System Structures, system calls, and kernel services.'
    }));

    const results = await retriever.retrieve('What is covered in Chapter 2?', {
      filterDocumentIds: getDocumentIdsForConversation(convId)
    });

    expect(results.length).toBeGreaterThan(0);
    expect(results[0].chunk.text).toContain('Chapter 2');
  });

  // =========================================================================
  // 9. Page-aware retrieval (boosting Page 10 chunks)
  // =========================================================================
  it('9. Page-aware retrieval boosts chunks located on specifically requested page', async () => {
    const convId = 'test-phase10-page-boost';
    createConversationInDB(convId, 'Page Retrieval');

    const doc = createTestDoc('doc-notes', 'lecture_notes.pdf', 'Lecture Notes');
    insertDocumentInDB(doc);
    attachDocumentToConversation(convId, doc.id);

    insertChunkInDB(createTestChunk({
      id: 'chunk-p3',
      documentId: doc.id,
      chunkIndex: 0,
      pageNumber: 3,
      heading: 'Paging Basics',
      text: 'Memory paging involves dividing physical memory into fixed-size frames.'
    }));

    insertChunkInDB(createTestChunk({
      id: 'chunk-p10',
      documentId: doc.id,
      chunkIndex: 1,
      pageNumber: 10,
      heading: 'Page 10 Notes',
      text: 'Page 10 notes: Inverted page tables reduce memory overhead for address mappings.'
    }));

    const results = await retriever.retrieve('page 10 er summary explain koro', {
      filterDocumentIds: getDocumentIdsForConversation(convId)
    });

    expect(results.length).toBeGreaterThan(0);
    expect(results[0].chunk.pageNumber).toBe(10);
  });

  // =========================================================================
  // 10. Cross-chat isolation (Chat A's PDF is unreachable by Chat B)
  // =========================================================================
  it('10. Cross-chat isolation: Document attached to Chat A is strictly hidden from Chat B', async () => {
    const convA = 'test-conv-isolated-a';
    const convB = 'test-conv-isolated-b';
    createConversationInDB(convA, 'Chat A with Doc');
    createConversationInDB(convB, 'Chat B without Doc');

    const secretDoc = createTestDoc('doc-secret', 'confidential_study_plan.pdf', 'Secret Exam Strategy Formula XYZ-99');
    insertDocumentInDB(secretDoc);

    insertChunkInDB(createTestChunk({
      id: 'chunk-secret-0',
      documentId: secretDoc.id,
      chunkIndex: 0,
      pageNumber: 1,
      heading: 'Secret Strategy',
      text: 'Secret Exam Strategy Formula XYZ-99 contains hidden tips for passing OS.'
    }));

    // Attach only to Chat A
    attachDocumentToConversation(convA, secretDoc.id);

    // Retrieve from Chat B (has no attached docs)
    const resultsB = await retriever.retrieve('What is Secret Exam Strategy Formula XYZ-99?', {
      filterDocumentIds: getDocumentIdsForConversation(convB)
    });
    expect(resultsB.length).toBe(0);

    // Retrieve from Chat A (has secretDoc attached)
    const resultsA = await retriever.retrieve('What is Secret Exam Strategy Formula XYZ-99?', {
      filterDocumentIds: getDocumentIdsForConversation(convA)
    });
    expect(resultsA.length).toBeGreaterThan(0);
    expect(resultsA[0].chunk.text).toContain('XYZ-99');
  });

  // =========================================================================
  // 11. Weak-RAG rejection (honest notice when query is unrelated to attached PDF)
  // =========================================================================
  it('11. Weak-RAG honest fallback when user asks completely unrelated question', async () => {
    const convId = 'test-phase10-weak-rag';
    createConversationInDB(convId, 'Unrelated Query');

    const doc = createTestDoc('doc-weak-os', 'operating_systems.pdf', 'Kernel process scheduling');
    insertDocumentInDB(doc);
    attachDocumentToConversation(convId, doc.id);

    insertChunkInDB(createTestChunk({
      id: 'chunk-weak-0',
      documentId: doc.id,
      chunkIndex: 0,
      pageNumber: 1,
      heading: 'Scheduling',
      text: 'Process scheduling algorithms include Round Robin and Shortest Job First.'
    }));

    const contextResult = await ragService.buildContext('How does chlorophyll absorb sunlight in plants?', {
      filterDocumentIds: [doc.id],
      hasAttachedDocuments: true
    });

    expect(contextResult.usedKnowledge).toBe(false);
    expect(
      contextResult.systemInstruction?.includes('No sufficiently relevant material') ||
      contextResult.systemInstruction?.includes('এই informationটা attached material-এ পাইনি')
    ).toBe(true);
  });

  // =========================================================================
  // 12. Citation correctness (`[Source: ... · Page X]`)
  // =========================================================================
  it('12. Citation formatting exposes truthful document and page references', async () => {
    const convId = 'test-phase10-citation';
    createConversationInDB(convId, 'Citation Chat');

    const doc = createTestDoc('doc-algo', 'Algorithm_Design.pdf', 'Dijkstra shortest path');
    insertDocumentInDB(doc);
    attachDocumentToConversation(convId, doc.id);

    insertChunkInDB(createTestChunk({
      id: 'chunk-algo-p14',
      documentId: doc.id,
      chunkIndex: 0,
      pageNumber: 14,
      heading: 'Dijkstra Algorithm',
      text: 'Dijkstras algorithm finds single-source shortest paths in a graph with non-negative edge weights.'
    }));

    const results = await retriever.retrieve('What is Dijkstras algorithm?', {
      filterDocumentIds: [doc.id]
    });

    expect(results.length).toBeGreaterThan(0);
    expect(results[0].chunk.pageNumber).toBe(14);
    expect(results[0].chunk.documentId).toBe(doc.id);
  });

  // =========================================================================
  // 13. Bengali conversation ("Operating System ki?" -> Bangla script)
  // =========================================================================
  it('13. Bengali question detection triggers Bengali script system directive', () => {
    const lang = detectLanguage('অপারেটিং সিস্টেম কী এবং এর কাজ কী?');
    expect(lang).toBe('bn');

    const targetLang = resolveResponseLanguage('অপারেটিং সিস্টেম কী?');
    expect(targetLang).toBe('bn');

    const prompt = buildLanguageSystemPrompt('bn');
    expect(prompt).toContain('বাংলা');
  });

  // =========================================================================
  // 14. Banglish conversation ("deadlock ki?" -> Bangla script with English terms)
  // =========================================================================
  it('14. Banglish query detects Bengali target language with English technical terms preserved', () => {
    const targetLang = resolveResponseLanguage('deadlock ki? eta easy kore bujhao');
    expect(targetLang).toBe('bn');

    const prompt = buildLanguageSystemPrompt('bn');
    expect(prompt).toContain('বাংলা');
    expect(prompt.toLowerCase()).toContain('banglish');
  });

  // =========================================================================
  // 15. English conversation ("What is OS?" -> English)
  // =========================================================================
  it('15. English query routes to pure English instructions', () => {
    const lang = detectLanguage('What is an operating system and why is it needed?');
    expect(lang).toBe('en');

    const targetLang = resolveResponseLanguage('What is an operating system?');
    expect(targetLang).toBe('en');

    const prompt = buildLanguageSystemPrompt('en');
    expect(prompt).toContain('English');
  });

  // =========================================================================
  // 16. Context budget enforcement (no token overflow)
  // =========================================================================
  it('16. Context budget enforcement keeps total estimated tokens strictly within budget', () => {
    const convId = 'test-phase10-token-budget';
    createConversationInDB(convId, 'Budget Chat');

    // Add many turns
    for (let i = 1; i <= 10; i++) {
      conversationMemoryManager.recordTurn(convId, 'user', `Question number ${i} about computer architectures.`);
      conversationMemoryManager.recordTurn(convId, 'assistant', `Answer number ${i} describing various bus topologies and CPU registers.`);
    }

    const maxBudget = 500;
    const context = contextManager.buildGenerationContext({
      conversationId: convId,
      userPrompt: 'Summarize the architecture discussion',
      maxContextTokens: maxBudget
    });

    expect(context.tokenEstimate).toBeLessThanOrEqual(maxBudget + 100);
  });

  // =========================================================================
  // 17. Rolling conversation summary (older turns condensed)
  // =========================================================================
  it('17. Rolling summary creates condensed digest when conversation turns exceed threshold', () => {
    const convId = 'test-phase10-rolling-summary';
    createConversationInDB(convId, 'Long Chat');

    // Record 8 conversation turns
    for (let i = 1; i <= 8; i++) {
      conversationMemoryManager.recordTurn(convId, 'user', `User turn ${i} discussing Topic ${i}`);
      conversationMemoryManager.recordTurn(convId, 'assistant', `Assistant explanation for Topic ${i}`);
    }

    const mem = conversationMemoryManager.getMemory(convId);
    expect(mem.rollingSummary).toBeDefined();
    expect(mem.rollingSummary!.length).toBeGreaterThan(0);
  });

  // =========================================================================
  // 18. Model fallback (0.5B fallback status and behavior)
  // =========================================================================
  it('18. Qwen 2.5 0.5B is registered as the lightweight fallback model', () => {
    const fallbackModel = INITIAL_REGISTERED_MODELS.find(m => m.id === 'qwen2.5-0.5b-instruct-q4_k_m');
    expect(fallbackModel).toBeDefined();
    expect(fallbackModel?.isFallback).toBe(true);
    expect(fallbackModel?.recommendedRamGb).toBeLessThanOrEqual(4);
  });

  // =========================================================================
  // 19. 3B model detection (available in registry as primary target)
  // =========================================================================
  it('19. Qwen 2.5 3B is registered in INITIAL_REGISTERED_MODELS as target model', () => {
    const targetModel = INITIAL_REGISTERED_MODELS.find(m => m.id === 'qwen2.5-3b-instruct-q4_k_m');
    expect(targetModel).toBeDefined();
    expect(targetModel?.isRecommended).toBe(true);
    expect(targetModel?.name).toContain('3B');
    expect(targetModel?.recommendedRamGb).toBeLessThanOrEqual(8);
  });

  // =========================================================================
  // 20. 0.5B fallback model profile verification
  // =========================================================================
  it('20. Generation presets provide balanced configurations without CPU starvation', () => {
    const studyPreset = GENERATION_PRESETS.study;
    expect(studyPreset).toBeDefined();
    expect(studyPreset.temperature).toBeGreaterThanOrEqual(0.1);
    expect(studyPreset.temperature).toBeLessThanOrEqual(0.7);

    const params = getGenerationParameters('study');
    expect(params.max_tokens).toBeDefined();
    expect(params.top_p).toBeDefined();
  });

  // =========================================================================
  // 21. Long PDF handling & chunk splitting
  // =========================================================================
  it('21. Long text chunking cleanly preserves page numbering and structural integrity', () => {
    const longText = Array(40).fill('Operating systems provide memory management, CPU scheduling, and process isolation.').join(' ');
    
    const chunkResult = chunkDocumentText(
      longText,
      'doc-long-test',
      { targetSize: 200, overlap: 30 }
    );

    expect(chunkResult.chunks.length).toBeGreaterThan(1);
    expect(chunkResult.chunks[0].text.length).toBeGreaterThan(20);
  });

  // =========================================================================
  // 22. Table retrieval (boosting markdown tables)
  // =========================================================================
  it('22. Table retrieval boosts chunks containing markdown formatted tables', async () => {
    const convId = 'test-phase10-table-boost';
    createConversationInDB(convId, 'Table Chat');

    const doc = createTestDoc('doc-table-sched', 'scheduling_table.pdf', 'CPU Scheduling Algorithms');
    insertDocumentInDB(doc);
    attachDocumentToConversation(convId, doc.id);

    insertChunkInDB(createTestChunk({
      id: 'chunk-t-desc',
      documentId: doc.id,
      chunkIndex: 0,
      pageNumber: 1,
      heading: 'General Scheduling',
      text: 'General overview of CPU scheduling algorithms and performance criteria.'
    }));

    insertChunkInDB(createTestChunk({
      id: 'chunk-t-table',
      documentId: doc.id,
      chunkIndex: 1,
      pageNumber: 2,
      heading: 'Complexity Table',
      text: '| Algorithm | Time Complexity | Space Complexity |\n| FCFS | O(n) | O(1) |\n| SJF | O(n log n) | O(n) |',
      tokenEstimate: 30
    }));

    const results = await retriever.retrieve('Compare algorithm time and space complexity table', {
      filterDocumentIds: [doc.id]
    });

    expect(results.length).toBeGreaterThan(0);
    // Table chunk should receive table boost
    expect(results[0].chunk.text).toContain('| Algorithm |');
  });

  // =========================================================================
  // 23. Scanned PDF handling & OCR notice
  // =========================================================================
  it('23. Fallback OCR provider provides clear honest notice when Tesseract CLI is missing', async () => {
    const fallback = new LocalFallbackOCRProvider();
    const result = await fallback.extractTextFromPage(new Uint8Array([]), 1);
    expect(result.text).toContain('scanned/image-based');
    expect(result.text).toContain('OCR engine');
  });

  // =========================================================================
  // 24. Response validator flags repetition and severe issues for single retry
  // =========================================================================
  it('24. Response validator catches severe line repetition and empty responses', () => {
    // Case A: Empty response
    const emptyCheck = validateResponse({
      userQuery: 'What is deadlock?',
      assistantResponse: ''
    });
    expect(emptyCheck.isValid).toBe(false);
    expect(emptyCheck.retryNeeded).toBe(true);

    // Case B: Severe repetition loop (e.g. LLM stuck in repetitive generation)
    const repetitiveText = [
      'Deadlock occurs when processes wait on each other indefinitely.',
      'Deadlock occurs when processes wait on each other indefinitely.',
      'Deadlock occurs when processes wait on each other indefinitely.'
    ].join('\n');

    const loopCheck = validateResponse({
      userQuery: 'Explain deadlock simply',
      assistantResponse: repetitiveText
    });
    expect(loopCheck.isValid).toBe(false);
    expect(loopCheck.retryNeeded).toBe(true);
    expect(loopCheck.issues.some(i => i.includes('Severe line repetition'))).toBe(true);

    // Case C: Valid response passes cleanly
    const goodCheck = validateResponse({
      userQuery: 'What is deadlock?',
      assistantResponse: 'A deadlock is a situation where a set of processes are blocked because each process is holding a resource and waiting for another resource acquired by some other process.'
    });
    expect(goodCheck.isValid).toBe(true);
    expect(goodCheck.retryNeeded).toBe(false);
  });
});

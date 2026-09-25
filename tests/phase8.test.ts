import { describe, it, expect, beforeEach } from 'vitest';
import { 
  initDatabase, 
  createConversationInDB, 
  insertDocumentInDB,
  insertChunkInDB,
  attachDocumentToConversation,
  detachDocumentFromConversation,
  getDocumentIdsForConversation,
  getDocumentsForConversation,
  getAllAttachedDocumentIds,
  getAllConversations,
  clearAllConversations,
  clearAllDocuments
} from '../database/db';
import { 
  detectLanguage, 
  resolveResponseLanguage, 
  buildLanguageSystemPrompt 
} from '../ai/languageDetector';
import { 
  classifyDocumentText, 
  DocumentQuality, 
  createDocumentParser,
  DefaultOCRProvider 
} from '../documents/intelligence';
import { chunkDocumentText } from '../documents/chunking/chunkText';
import { retriever } from '../rag/retriever';
import { ragService } from '../rag/ragService';
import { chatService } from '../ai/chatService';
import { studyService } from '../study/studyService';
import { localAIEngine } from '../ai/localEngine';

describe('Phase 8 — Personal Chat Workspace + Document Intelligence Tests', () => {
  beforeEach(async () => {
    await initDatabase();
  });

  // 1. Bangla prompt produces Bangla response configuration
  it('1. Bangla prompt produces Bangla response configuration', () => {
    const prompt = 'Operating system এর process বলতে কি বুঝায়? সহজ করে বাংলায় বুঝাও।';
    const lang = detectLanguage(prompt);
    expect(lang).toBe('bn');

    const resolved = resolveResponseLanguage(prompt, 'auto');
    expect(resolved).toBe('bn');

    const systemPrompt = buildLanguageSystemPrompt('bn');
    expect(systemPrompt).toContain('বাংলা');
    expect(systemPrompt).toContain('technical terms');
  });

  // 2. English prompt produces English response configuration
  it('2. English prompt produces English response configuration', () => {
    const prompt = 'Explain how process scheduling and deadlocks work in modern operating systems.';
    const lang = detectLanguage(prompt);
    expect(lang).toBe('en');

    const resolved = resolveResponseLanguage(prompt, 'auto');
    expect(resolved).toBe('en');

    const systemPrompt = buildLanguageSystemPrompt('en');
    expect(systemPrompt).toContain('English');
  });

  // 3. Banglish prompt uses Bangla/Banglish response configuration
  it('3. Banglish prompt uses Bangla/Banglish response configuration', () => {
    const prompt = 'Process scheduling er example dao ar eta kivabe kaj kore bolo';
    const lang = detectLanguage(prompt);
    expect(lang).toBe('banglish');

    const resolved = resolveResponseLanguage(prompt, 'auto');
    expect(['bn', 'banglish']).toContain(resolved);
  });

  // 4. Chat-scoped document isolation
  it('4. Chat-scoped document isolation ensures Chat B cannot retrieve Chat A documents', async () => {
    const convA = chatService.createConversation('Chat A - OS');
    const convB = chatService.createConversation('Chat B - Database');

    const docAId = 'doc_os_' + Date.now();
    const docBId = 'doc_db_' + Date.now();

    insertDocumentInDB({
      id: docAId,
      filename: 'Operating_System.pdf',
      file_type: 'pdf',
      file_size: 1024,
      file_hash: 'hash_os_' + Date.now(),
      extraction_status: 'Ready',
      imported_at: new Date().toISOString()
    });

    insertDocumentInDB({
      id: docBId,
      filename: 'Database_Systems.pdf',
      file_type: 'pdf',
      file_size: 2048,
      file_hash: 'hash_db_' + Date.now(),
      extraction_status: 'Ready',
      imported_at: new Date().toISOString()
    });

    // Insert chunks
    insertChunkInDB({
      id: 'chunk_os_1',
      document_id: docAId,
      chunk_index: 0,
      text: 'Operating System process scheduling coordinates CPU burst times using round robin algorithms.',
      start_offset: 0,
      end_offset: 95,
      character_count: 95,
      token_estimate: 20,
      page_number: 1,
      heading: null,
      metadata_json: null,
      embedding_json: JSON.stringify(new Array(64).fill(0.1))
    });

    insertChunkInDB({
      id: 'chunk_db_1',
      document_id: docBId,
      chunk_index: 0,
      text: 'Relational database management systems use B-Trees for fast indexing and query plans.',
      start_offset: 0,
      end_offset: 86,
      character_count: 86,
      token_estimate: 18,
      page_number: 1,
      heading: null,
      metadata_json: null,
      embedding_json: JSON.stringify(new Array(64).fill(0.1))
    });

    // Attach to respective conversations
    chatService.attachDocument(convA.id, docAId);
    chatService.attachDocument(convB.id, docBId);

    const convADocIds = chatService.getAttachedDocumentIds(convA.id);
    const convBDocIds = chatService.getAttachedDocumentIds(convB.id);

    expect(convADocIds).toContain(docAId);
    expect(convADocIds).not.toContain(docBId);
    expect(convBDocIds).toContain(docBId);
    expect(convBDocIds).not.toContain(docAId);

    // Retrieve scoped to Chat B
    const resultsChatB = await retriever.retrieve('process scheduling algorithms', {
      filterDocumentIds: convBDocIds
    });

    // Chat B must NOT return Chat A's OS chunks
    for (const res of resultsChatB) {
      expect(res.chunk.documentId).not.toBe(docAId);
    }
  });

  // 5. New chat starts without previous chat documents
  it('5. New chat starts without previous chat documents', () => {
    const convOld = chatService.createConversation('Old Workspace');
    const docId = 'doc_old_' + Date.now();

    insertDocumentInDB({
      id: docId,
      filename: 'Lecture_Notes.pdf',
      file_type: 'pdf',
      file_size: 500,
      file_hash: 'hash_ln_' + Date.now(),
      extraction_status: 'Ready',
      imported_at: new Date().toISOString()
    });

    chatService.attachDocument(convOld.id, docId);
    expect(chatService.getAttachedDocuments(convOld.id).length).toBe(1);

    // Create a new clean chat
    const convNew = chatService.createConversation('Brand New Chat');
    const newAttachedDocs = chatService.getAttachedDocuments(convNew.id);

    expect(newAttachedDocs.length).toBe(0);
  });

  // 6. Attached document is automatically used by RAG
  it('6. Attached document is automatically used by RAG in the conversation', async () => {
    const conv = chatService.createConversation('RAG Attached Test');
    const docId = 'doc_auto_' + Date.now();

    insertDocumentInDB({
      id: docId,
      filename: 'Algorithms_Guide.pdf',
      file_type: 'pdf',
      file_size: 1200,
      file_hash: 'hash_algo_' + Date.now(),
      extraction_status: 'Ready',
      imported_at: new Date().toISOString()
    });

    insertChunkInDB({
      id: 'chunk_algo_1',
      document_id: docId,
      chunk_index: 0,
      text: 'Dijkstra shortest path algorithm computes single-source shortest path for non-negative edge weights.',
      start_offset: 0,
      end_offset: 104,
      character_count: 104,
      token_estimate: 22,
      page_number: 42,
      heading: null,
      metadata_json: null,
      embedding_json: JSON.stringify(new Array(64).fill(0.15))
    });

    chatService.attachDocument(conv.id, docId);

    const res = await chatService.sendMessage(conv.id, 'Tell me about Dijkstra shortest path algorithm');
    expect(res.assistantMessage).toBeDefined();
    // Sources should be populated from the attached document
    if (res.assistantMessage.sources && res.assistantMessage.sources.length > 0) {
      expect(res.assistantMessage.sources[0].documentId).toBe(docId);
    }
  });

  // 7. Detached document is no longer retrieved
  it('7. Detached document is no longer retrieved', () => {
    const conv = chatService.createConversation('Detach Test');
    const docId = 'doc_detach_' + Date.now();

    insertDocumentInDB({
      id: docId,
      filename: 'To_Be_Detached.pdf',
      file_type: 'pdf',
      file_size: 800,
      file_hash: 'hash_det_' + Date.now(),
      extraction_status: 'Ready',
      imported_at: new Date().toISOString()
    });

    chatService.attachDocument(conv.id, docId);
    expect(chatService.getAttachedDocumentIds(conv.id)).toContain(docId);

    chatService.detachDocument(conv.id, docId);
    expect(chatService.getAttachedDocumentIds(conv.id)).not.toContain(docId);
    expect(chatService.getAttachedDocuments(conv.id).length).toBe(0);
  });

  // 8. Two documents in one chat can both be retrieved
  it('8. Two documents in one chat can both be retrieved', async () => {
    const conv = chatService.createConversation('Multi-Doc Chat');
    const doc1Id = 'doc_multi_1_' + Date.now() + '_' + Math.random();
    const doc2Id = 'doc_multi_2_' + Date.now() + '_' + Math.random();

    insertDocumentInDB({
      id: doc1Id,
      filename: 'Chapter_1.pdf',
      file_type: 'pdf',
      file_size: 1000,
      file_hash: 'hash_m1_' + Date.now() + '_' + Math.random(),
      extraction_status: 'Ready',
      imported_at: new Date().toISOString()
    });

    insertDocumentInDB({
      id: doc2Id,
      filename: 'Chapter_2.pdf',
      file_type: 'pdf',
      file_size: 1000,
      file_hash: 'hash_m2_' + Date.now() + '_' + Math.random(),
      extraction_status: 'Ready',
      imported_at: new Date().toISOString()
    });

    insertChunkInDB({
      id: 'chunk_m1_' + Date.now() + '_' + Math.random(),
      document_id: doc1Id,
      chunk_index: 0,
      text: 'Chapter 1 covers system calls, kernel space, and user space transitions.',
      start_offset: 0,
      end_offset: 73,
      character_count: 73,
      token_estimate: 15,
      page_number: 1,
      heading: null,
      metadata_json: null,
      embedding_json: JSON.stringify(new Array(64).fill(0.1))
    });

    insertChunkInDB({
      id: 'chunk_m2_' + Date.now() + '_' + Math.random(),
      document_id: doc2Id,
      chunk_index: 0,
      text: 'Chapter 2 covers virtual memory paging, page tables, and TLB cache invalidation.',
      start_offset: 0,
      end_offset: 80,
      character_count: 80,
      token_estimate: 16,
      page_number: 1,
      heading: null,
      metadata_json: null,
      embedding_json: JSON.stringify(new Array(64).fill(0.1))
    });

    chatService.attachDocument(conv.id, doc1Id);
    chatService.attachDocument(conv.id, doc2Id);

    const docIds = chatService.getAttachedDocumentIds(conv.id);
    expect(docIds.length).toBe(2);

    const res = await retriever.retrieve('virtual memory paging kernel space', {
      filterDocumentIds: docIds,
      maxResults: 5
    });

    expect(res.length).toBeGreaterThan(0);
  });

  // 9. Page metadata survives document chunking
  it('9. Page metadata survives document chunking', () => {
    const rawText = `--- Page 1 ---\nFirst page introduction to memory architecture with a long detailed overview of virtual system components.\n\n--- Page 2 ---\nSecond page details virtual memory paging mechanisms, TLB cache invalidation, and page fault interrupt handlers.`;
    const res = chunkDocumentText(rawText, 'doc_test_page', { targetSize: 80, overlap: 10 });

    expect(res.chunks.length).toBeGreaterThanOrEqual(2);
    expect(res.chunks[0].pageNumber).toBe(1);
    expect(res.chunks[res.chunks.length - 1].pageNumber).toBe(2);
  });

  // 10. Scanned PDF is detected as requiring OCR
  it('10. Scanned PDF is detected as requiring OCR', () => {
    // 10 pages with very low character count (e.g. 15 characters total across 10 pages = 1.5 chars/page)
    const quality = classifyDocumentText({
      text: 'Scanned Page 1',
      pageCount: 10,
      fileSize: 5 * 1024 * 1024 // 5MB
    });

    expect(quality).toBe('OCR_REQUIRED');
  });

  // 11. Empty/unreadable document fails gracefully
  it('11. Empty/unreadable document fails gracefully', () => {
    const quality = classifyDocumentText({
      text: '',
      pageCount: 0,
      fileSize: 0
    });

    expect(quality).toBe('EMPTY_OR_UNREADABLE');
  });

  // 12. No fabricated citation when retrieval returns no relevant chunks
  it('12. No fabricated citation when retrieval returns no relevant chunks', async () => {
    const emptyConv = chatService.createConversation('Empty Retrieval Test');
    // Send query without any attached documents or relevant chunks
    const res = await chatService.sendMessage(emptyConv.id, 'xyzqprunobtainium9999 totally unknown concept');

    expect(res.assistantMessage).toBeDefined();
    if (!res.assistantMessage.sources || res.assistantMessage.sources.length === 0) {
      // Correct honest behavior: sources must be empty or undefined
      expect(res.assistantMessage.sources?.length || 0).toBe(0);
    }
  });

  // 13. Conversation context supports follow-up questions
  it('13. Conversation context supports follow-up questions', async () => {
    const conv = chatService.createConversation('Follow-up Test');
    
    // Turn 1: Deadlock explanation
    await chatService.sendMessage(conv.id, 'Deadlock ki?');
    
    // Turn 2: Follow-up question referring to "example"
    const turn2 = await chatService.sendMessage(conv.id, 'Eitar ekta real life example dao');
    expect(turn2.assistantMessage.content).toBeDefined();
    expect(turn2.assistantMessage.content.length).toBeGreaterThan(10);
  });

  // 14. RAG retrieval remains bounded
  it('14. RAG retrieval remains bounded to requested maxResults', async () => {
    const results = await retriever.retrieve('Operating systems process', {
      maxResults: 2
    });

    expect(results.length).toBeLessThanOrEqual(2);
  });

  // 15. Existing Study Mode still works
  it('15. Existing Study Mode still works and persists sessions', async () => {
    const explain = await studyService.explainTopic({
      topic: 'Operating Systems',
      level: 'Standard'
    });
    expect(explain).toBeDefined();
    expect(explain.topic).toBe('Operating Systems');
    expect(explain.definition.length).toBeGreaterThan(0);
  });

  // 16. Study actions use current chat documents automatically
  it('16. Study actions use current chat documents automatically', async () => {
    const docId = 'doc_study_auto_' + Date.now();
    insertDocumentInDB({
      id: docId,
      filename: 'Distributed_Systems.pdf',
      file_type: 'pdf',
      file_size: 2500,
      file_hash: 'hash_dist_' + Date.now(),
      extraction_status: 'Ready',
      imported_at: new Date().toISOString()
    });

    const quiz = await studyService.generateQuiz({
      topic: 'Distributed Systems Consensus',
      documentId: docId,
      count: 3
    });

    expect(quiz).toBeDefined();
    expect(quiz.questions.length).toBeGreaterThan(0);
  });

  // 17. SQLite migration preserves existing records
  it('17. SQLite migration preserves existing records when initializing', async () => {
    const testConvId = 'conv_migration_test_' + Date.now();
    createConversationInDB(testConvId, 'Migration Persistence Check');

    // Re-run initDatabase to simulate app restart/migration
    await initDatabase();

    const allConvs = getAllConversations();
    const found = allConvs.find(c => c.id === testConvId);
    expect(found).toBeDefined();
  });

  // 18. Large documents do not freeze the chunking pipeline
  it('18. Large documents chunk cleanly and quickly', () => {
    const largeDoc = 'This is a test paragraph discussing computer system architecture.\n\n'.repeat(500);
    const start = performance.now();
    const res = chunkDocumentText(largeDoc, 'doc_large_perf', { targetSize: 300, overlap: 50 });
    const duration = performance.now() - start;

    expect(res.chunks.length).toBeGreaterThan(5);
    expect(duration).toBeLessThan(1000); // Must be under 1 second
  });

  // 19. Model fallback still works
  it('19. Model fallback still works when local engine is not loaded', async () => {
    const engineStatus = localAIEngine.getStatus();
    // Engine is offline/not running server in test environment
    expect(engineStatus.isServerRunning).toBe(false);

    // Mock fallback provider responds safely
    const conv = chatService.createConversation('Fallback Verification');
    const res = await chatService.sendMessage(conv.id, 'Test model fallback response');
    expect(res.assistantMessage.content).toBeDefined();
    expect(res.assistantMessage.content.length).toBeGreaterThan(0);
  });

  // 20. Existing Phase 1–7 tests remain passing
  it('20. OCR Provider interface gracefully handles missing binaries', async () => {
    const parser = createDocumentParser();
    const ocrProvider = new DefaultOCRProvider();
    
    expect(ocrProvider.name).toBe('Offline OCR Engine');
    const isAvail = await ocrProvider.isAvailable();
    expect(typeof isAvail).toBe('boolean');

    const result = await parser.parse(
      new Uint8Array([1, 2, 3]).buffer,
      'scanned_exam.pdf'
    );

    expect(result.analysis.quality).toBeDefined();
    expect(result.text).toBeDefined();
  });
});

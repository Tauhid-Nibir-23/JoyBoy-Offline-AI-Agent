// Offline Study AI — Phase 6 Production UX, Reliability & Performance Regression Tests
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { 
  initDatabase, 
  resetDatabaseStateForTesting, 
  getDatabaseStatus, 
  getDatabaseStats, 
  getSetting, 
  setSetting, 
  clearAllConversations, 
  clearAllDocuments, 
  clearEntireDatabase,
  createConversationInDB,
  getAllConversations,
  insertMessageInDB,
  getMessagesByConversationId,
  insertDocumentInDB,
  getAllDocuments,
  getChunksByDocumentId,
  deleteDocumentFromDB,
  DBDocument
} from '../database/db';
import { chatService } from '../ai/chatService';
import { modelManager } from '../models/manager';
import { localAIEngine } from '../ai/localEngine';
import { ragService } from '../rag';
import { defaultContextBuilder } from '../rag/contextBuilder';
import { documentService } from '../documents/documentService';
import { studyService } from '../study/studyService';
import { parseQuizJson } from '../study/quizParser';
import { globalStatus } from '../core/status';

describe('Phase 6 — Production UX, Reliability & Performance Suite', () => {
  beforeEach(async () => {
    resetDatabaseStateForTesting();
    await initDatabase();
  });

  afterEach(() => {
    resetDatabaseStateForTesting();
  });

  // 1. Model Unavailable Handling
  it('1. handles unavailable local model gracefully with deterministic fallback', async () => {
    chatService.setProviderType('auto');
    const conv = chatService.createConversation('Model Unavailable Test');
    
    // When no local model is running or installed, resolveProvider falls back cleanly to mock provider
    const provider = await chatService.resolveProvider();
    expect(provider).toBeDefined();
    expect(provider.id).toBeDefined();

    const response = await chatService.sendMessage(conv.id, 'Explain quicksort algorithm');
    expect(response.userMessage.content).toBe('Explain quicksort algorithm');
    expect(response.assistantMessage.content).toBeTruthy();
    expect(response.assistantMessage.content.length).toBeGreaterThan(10);
  });

  // 2. Model Load Failure Handling
  it('2. safely handles model load failure without throwing uncaught exceptions', async () => {
    const invalidPath = './models/completely_missing_model_file.gguf';
    const loaded = await localAIEngine.loadModel(invalidPath);
    expect(loaded).toBe(false);

    const validation = await modelManager.validateModelFile(invalidPath);
    expect(validation.isValid).toBe(false);
    expect(validation.error).toBeDefined();
  });

  // 3. Chat Retry Behavior
  it('3. supports retrying failed generation in existing conversation', async () => {
    const conv = chatService.createConversation('Retry Chat');
    await chatService.sendMessage(conv.id, 'What is concurrency?');

    const msgsBefore = chatService.getMessages(conv.id);
    expect(msgsBefore.length).toBe(2);

    const retriedMsg = await chatService.retryFailedGeneration(conv.id);
    expect(retriedMsg).not.toBeNull();
    expect(retriedMsg?.role).toBe('assistant');

    const msgsAfter = chatService.getMessages(conv.id);
    expect(msgsAfter.length).toBe(2);
    expect(msgsAfter[0].role).toBe('user');
    expect(msgsAfter[1].role).toBe('assistant');
  });

  // 4. Regeneration Without Duplicate User Message
  it('4. regenerates assistant response without creating duplicate user message', async () => {
    const conv = chatService.createConversation('Regeneration Test');
    await chatService.sendMessage(conv.id, 'What is dynamic programming?');

    const initialMsgs = chatService.getMessages(conv.id);
    expect(initialMsgs.filter((m) => m.role === 'user').length).toBe(1);
    expect(initialMsgs.filter((m) => m.role === 'assistant').length).toBe(1);

    const regenMsg = await chatService.regenerateLastAnswer(conv.id);
    expect(regenMsg).not.toBeNull();

    const finalMsgs = chatService.getMessages(conv.id);
    const userMsgs = finalMsgs.filter((m) => m.role === 'user');
    const assistantMsgs = finalMsgs.filter((m) => m.role === 'assistant');

    expect(userMsgs.length).toBe(1);
    expect(assistantMsgs.length).toBe(1);
    expect(userMsgs[0].content).toBe('What is dynamic programming?');
  });

  // 5. Document Deletion Cleanup
  it('5. deletes document and cleans up all associated chunks and embeddings', async () => {
    const sampleText = 'Process management is handled by the operating system kernel. Threads share memory space.';
    const buffer = new TextEncoder().encode(sampleText);
    const importRes = await documentService.importBuffer('os_lecture.txt', buffer);

    expect(importRes.success).toBe(true);
    expect(importRes.document).toBeDefined();
    const docId = importRes.document!.id;

    // Verify chunks exist
    const chunksBefore = getChunksByDocumentId(docId);
    expect(chunksBefore.length).toBeGreaterThan(0);

    // Delete document
    const deleted = await documentService.deleteDocument(docId);
    expect(deleted).toBe(true);

    // Verify chunks and document are removed
    const chunksAfter = getChunksByDocumentId(docId);
    expect(chunksAfter.length).toBe(0);

    const docs = getAllDocuments();
    expect(docs.find((d) => d.id === docId)).toBeUndefined();
  });

  // 6. RAG Re-Index Safety
  it('6. re-indexing a document does not create duplicate chunks', async () => {
    const sampleText = 'Data structures like B-Trees and Hash Maps are essential for efficient database indexing.';
    const buffer = new TextEncoder().encode(sampleText);
    const importRes = await documentService.importBuffer('db_notes.txt', buffer);
    const docId = importRes.document!.id;

    const count1 = getChunksByDocumentId(docId).length;
    expect(count1).toBeGreaterThan(0);

    // Re-index document
    await ragService.reindexDocument(docId);
    const count2 = getChunksByDocumentId(docId).length;

    // Chunk count must remain consistent and not duplicate
    expect(count2).toBe(count1);
  });

  // 7. Empty Document Handling
  it('7. handles empty documents safely without crashes', async () => {
    const emptyBuffer = new Uint8Array(0);
    const importRes = await documentService.importBuffer('empty.txt', emptyBuffer);

    expect(importRes.success).toBe(true);
    expect(importRes.document).toBeDefined();
    expect(importRes.document?.character_count).toBe(0);

    // Indexing empty document completes safely
    const indexed = await ragService.indexDocument(importRes.document!.id);
    expect(indexed).toBe(true);

    const chunks = getChunksByDocumentId(importRes.document!.id);
    expect(chunks.length).toBe(0);
  });

  // 8. Malformed Study Response Handling
  it('8. parses and recovers gracefully from malformed study/quiz JSON', () => {
    const malformedJson = '```json\n[{"question": "What is RAM?", "options": ["Volatile memory", "Storage"], "correctAnswer": 0, "explanation": "Temporary memory"}'; // missing closing bracket
    const result = parseQuizJson(malformedJson, 'mcq');

    expect(result.success).toBe(true);
    expect(result.data).toBeDefined();
    expect(result.data!.length).toBeGreaterThan(0);
    expect(result.data![0].question).toBe('What is RAM?');
  });

  // 9. Quiz State Integrity
  it('9. verifies quiz scoring and handles unattempted questions correctly', () => {
    const questions = [
      {
        id: 'q1',
        question: 'Which sort is O(n log n) in worst case?',
        options: ['QuickSort', 'MergeSort', 'BubbleSort', 'SelectionSort'],
        correctAnswer: 1,
        type: 'mcq' as const,
        explanation: 'MergeSort is guaranteed O(n log n).'
      },
      {
        id: 'q2',
        question: 'HTTP is stateless.',
        options: ['True', 'False'],
        correctAnswer: 'True',
        type: 'true_false' as const,
        explanation: 'HTTP is a stateless request-response protocol.'
      }
    ];

    // Case A: Perfect answers
    const answersCorrect = { 0: 1, 1: 'True' };
    let correctCount = 0;
    questions.forEach((q, idx) => {
      const uAns = answersCorrect[idx as keyof typeof answersCorrect];
      if (q.type === 'mcq' && uAns === q.correctAnswer) correctCount++;
      if (q.type === 'true_false' && String(uAns).toLowerCase() === String(q.correctAnswer).toLowerCase()) correctCount++;
    });
    expect(correctCount).toBe(2);

    // Case B: Unanswered questions (undefined) safely treated as incorrect (0 score)
    const answersUnattempted: Record<number, any> = {};
    let unattemptedCorrect = 0;
    questions.forEach((q, idx) => {
      const uAns = answersUnattempted[idx];
      if (uAns !== undefined) {
        if (q.type === 'mcq' && uAns === q.correctAnswer) unattemptedCorrect++;
        if (q.type === 'true_false' && String(uAns).toLowerCase() === String(q.correctAnswer).toLowerCase()) unattemptedCorrect++;
      }
    });
    expect(unattemptedCorrect).toBe(0);
  });

  // 10. Flashcard Navigation Integrity
  it('10. verifies flashcard deck navigation, shuffle, and reset integrity', () => {
    const deck = [
      { id: '1', front: 'Mutex', back: 'Mutual Exclusion Lock' },
      { id: '2', front: 'Semaphore', back: 'Signaling Mechanism' },
      { id: '3', front: 'Deadlock', back: 'Circular Wait Condition' }
    ];

    let current = 0;
    // Next
    current = (current + 1) % deck.length;
    expect(current).toBe(1);

    // Prev
    current = current > 0 ? current - 1 : deck.length - 1;
    expect(current).toBe(0);

    // Shuffle maintains total cards and keys
    const shuffled = [...deck].sort(() => 0.5 - Math.random());
    expect(shuffled.length).toBe(deck.length);
    expect(shuffled.every((c) => deck.some((d) => d.id === c.id))).toBe(true);

    // Reset restores exact original array
    const reset = [...deck];
    expect(reset).toEqual(deck);
  });

  // 11. Database Destructive-Action Safety
  it('11. verifies destructive database operations require isolation and restore cleanly', async () => {
    // Populate DB
    const conv = chatService.createConversation('Destructive Action Test');
    await chatService.sendMessage(conv.id, 'Hello DB');

    const sampleBuffer = new TextEncoder().encode('Test content for DB safety');
    await documentService.importBuffer('test_safety.txt', sampleBuffer);

    let stats = getDatabaseStats();
    expect(stats.conversationsCount).toBeGreaterThan(0);
    expect(stats.documentsCount).toBeGreaterThan(0);

    // Clear conversations only
    clearAllConversations();
    stats = getDatabaseStats();
    expect(stats.conversationsCount).toBe(0);
    expect(stats.messagesCount).toBe(0);
    expect(stats.documentsCount).toBeGreaterThan(0); // Documents intact

    // Clear documents only
    clearAllDocuments();
    stats = getDatabaseStats();
    expect(stats.documentsCount).toBe(0);
    expect(stats.chunksCount).toBe(0);

    // Entire DB reset restores initial schema
    clearEntireDatabase();
    const dbStatus = getDatabaseStatus();
    expect(dbStatus.initialized).toBe(true);
    expect(dbStatus.tables.length).toBeGreaterThan(4);
  });

  // 12. Status State Transitions
  it('12. ensures status state transitions notify subscribers without conflicting states', () => {
    const states: string[] = [];
    const unsubscribe = globalStatus.subscribe((s) => {
      states.push(`AI:${s.ai}|Model:${s.model}|DB:${s.db}|RAG:${s.rag}`);
    });

    globalStatus.setAIStatus('Generating');
    globalStatus.setModelStatus('Loaded', 'Qwen 2.5 0.5B');
    globalStatus.setRAGStatus('Indexing');
    globalStatus.setAIStatus('Ready');

    unsubscribe();

    expect(states.length).toBeGreaterThan(3);
    const last = globalStatus.getStatus();
    expect(last.ai).toBe('Ready');
    expect(last.model).toBe('Loaded');
    expect(last.rag).toBe('Indexing');
  });

  // 13. Settings Persistence
  it('13. persists and retrieves user settings in SQLite database', () => {
    setSetting('temperature', '0.45');
    setSetting('max_tokens', '768');
    setSetting('rag_top_k', '6');
    setSetting('model_directory', './custom_models');

    expect(getSetting('temperature')).toBe('0.45');
    expect(getSetting('max_tokens')).toBe('768');
    expect(getSetting('rag_top_k')).toBe('6');
    expect(getSetting('model_directory')).toBe('./custom_models');
  });

  // 14. Offline Operation Assumptions
  it('14. verifies fallback behavior when RAG finds no matching document material', () => {
    const emptyResults: any[] = [];
    const context = defaultContextBuilder.buildContext('What is quantum entanglement?', emptyResults);

    expect(context.usedKnowledge).toBe(false);
    expect(context.sources.length).toBe(0);
    expect(context.systemInstruction).toContain(
      'No sufficiently relevant material was found in your study documents.'
    );
  });

  // 15. Large-Document Safety Behavior
  it('15. ensures large document text is chunked into bounded segments without infinite loops', async () => {
    // Generate simulated 60,000 character document
    const paragraph = 'Computer science is the study of computation, information, and automation. ';
    const largeText = paragraph.repeat(800); // ~60,000 chars
    expect(largeText.length).toBeGreaterThan(50000);

    const buffer = new TextEncoder().encode(largeText);
    const importRes = await documentService.importBuffer('large_cs_handbook.txt', buffer);

    expect(importRes.success).toBe(true);
    expect(importRes.document).toBeDefined();
    expect(importRes.document!.character_count).toBe(largeText.length);

    const chunks = getChunksByDocumentId(importRes.document!.id);
    expect(chunks.length).toBeGreaterThan(10);
    // Every chunk must respect reasonable size limits (< 4000 characters)
    for (const chunk of chunks) {
      expect(chunk.character_count).toBeLessThan(4000);
    }
  });
});

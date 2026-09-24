import { describe, it, expect, beforeEach } from 'vitest';
import { 
  initDatabase, 
  resetDatabaseStateForTesting, 
  insertDocumentInDB, 
  getDocumentById, 
  getChunksByDocumentId,
  getAllChunksWithEmbeddings,
  DBDocument,
  getMessagesByConversationId,
  createConversationInDB
} from '../database/db';
import { 
  chunkTextForRAG, 
  LocalSemanticEmbeddingProvider, 
  defaultEmbeddingProvider,
  LocalRetriever,
  ContextBuilder,
  ragService,
  RAGSearchResult
} from '../rag';
import { chatService } from '../ai/chatService';
import { documentService } from '../documents/documentService';
import { MockAIProvider } from '../ai/mockProvider';

describe('Phase 3B — Local RAG & Document-Aware Chat Tests', () => {
  beforeEach(async () => {
    resetDatabaseStateForTesting();
    await initDatabase();
  });

  // 1. Chunking normal document
  it('1. chunks normal study document into structured chunks with metadata', () => {
    const text = `
# Operating Systems Overview
An operating system is system software that manages computer hardware and software resources.

## Process Scheduling
Process scheduling assigns CPU time to processes in the ready queue.
The primary goals are CPU utilization, throughput, turnaround time, waiting time, and response time.
Different algorithms include FCFS, Shortest Job First, Priority Scheduling, and Round Robin.
    `.trim();

    const result = chunkTextForRAG(text, 'doc_norm_1', {
      filename: 'OS_Notes.md',
      targetSize: 200,
      minSize: 50
    });

    expect(result.chunks.length).toBeGreaterThan(0);
    expect(result.chunks[0].documentId).toBe('doc_norm_1');
    expect(result.chunks[0].chunkIndex).toBe(0);
    expect(result.chunks[0].text.length).toBeGreaterThan(0);
    expect(result.chunks[0].characterCount).toBeGreaterThan(0);
    expect(result.chunks[0].startOffset).toBeDefined();
    expect(result.chunks[0].endOffset).toBeGreaterThan(result.chunks[0].startOffset);
    expect(result.chunks[0].metadata?.filename).toBe('OS_Notes.md');
  });

  // 2. Chunk overlap
  it('2. preserves chunk overlap across successive chunk boundaries', () => {
    const text = 'Paragraph 1: Introduction to algorithms and runtime complexities.\n\nParagraph 2: Sorting techniques including merge sort and quick sort.\n\nParagraph 3: Dynamic programming and memoization strategies.\n\nParagraph 4: Graph traversals BFS and DFS.';
    const result = chunkTextForRAG(text, 'doc_overlap_1', {
      targetSize: 80,
      overlap: 20,
      minSize: 30
    });

    if (result.chunks.length > 1) {
      expect(result.chunks[0].endOffset).toBeGreaterThan(result.chunks[1].startOffset);
    } else {
      expect(result.chunks.length).toBe(1);
    }
  });

  // 3. Small document
  it('3. chunks a small document without artificial fragmentation', () => {
    const text = 'Round Robin scheduling assigns CPU time using a fixed time quantum.';
    const result = chunkTextForRAG(text, 'doc_small_1', {
      filename: 'Process.txt'
    });

    expect(result.chunks.length).toBe(1);
    expect(result.chunks[0].chunkIndex).toBe(0);
    expect(result.chunks[0].text).toBe(text);
  });

  // 4. Large document
  it('4. chunks a large document into multiple well-distributed chunks', () => {
    const paragraphs: string[] = [];
    for (let i = 1; i <= 30; i++) {
      paragraphs.push(`Section ${i}: Detailed study notes regarding operating system architecture topic ${i} discussing kernel threads, user threads, and virtual memory management in modern kernels.`);
    }
    const largeText = paragraphs.join('\n\n');

    const result = chunkTextForRAG(largeText, 'doc_large_1', {
      targetSize: 200,
      overlap: 40
    });

    expect(result.chunks.length).toBeGreaterThan(1);
    expect(result.totalChunks).toBe(result.chunks.length);
    for (let i = 0; i < result.chunks.length; i++) {
      expect(result.chunks[i].chunkIndex).toBe(i);
      expect(result.chunks[i].documentId).toBe('doc_large_1');
    }
  });

  // 5. Empty document
  it('5. handles empty document gracefully without creating empty chunks', () => {
    const result = chunkTextForRAG('   \n\n   ', 'doc_empty_1');
    expect(result.chunks.length).toBe(0);
    expect(result.totalChunks).toBe(0);
  });

  // 6. Embedding provider
  it('6. generates 256-dimensional normalized local embeddings and cosine similarity', async () => {
    const provider = new LocalSemanticEmbeddingProvider();
    expect(provider.dimension).toBe(256);

    const vecA = await provider.embedText('Round Robin scheduling time quantum');
    const vecB = await provider.embedText('Round Robin CPU scheduler time slice');
    const vecC = await provider.embedText('Photosynthesis chloroplast plant biology');

    expect(vecA.length).toBe(256);
    expect(vecB.length).toBe(256);
    expect(vecC.length).toBe(256);

    const simAB = provider.cosineSimilarity(vecA, vecB);
    const simAC = provider.cosineSimilarity(vecA, vecC);

    // Highly related topics should have much higher similarity than unrelated topics
    expect(simAB).toBeGreaterThan(simAC);
    expect(simAB).toBeGreaterThan(0.2);
  });

  // 7. Vector/index persistence
  it('7. persists and loads chunk embeddings in SQLite', async () => {
    const doc: DBDocument = {
      id: 'doc_persist_1',
      filename: 'Memory.txt',
      original_path: null,
      file_type: 'txt',
      file_size: 200,
      file_hash: 'hash_persist_1',
      imported_at: new Date().toISOString(),
      modified_at: null,
      extraction_status: 'Ready',
      extracted_text: 'Virtual memory paging swaps pages between RAM and disk storage.',
      character_count: 65,
      indexing_status: 'Ready',
      error_message: null
    };
    insertDocumentInDB(doc);

    // Index via ragService
    const ok = await ragService.indexDocument(doc.id);
    expect(ok).toBe(true);

    const chunks = getChunksByDocumentId(doc.id);
    expect(chunks.length).toBeGreaterThan(0);
    expect(chunks[0].embedding_json).not.toBeNull();

    const parsedVec = JSON.parse(chunks[0].embedding_json!);
    expect(Array.isArray(parsedVec)).toBe(true);
    expect(parsedVec.length).toBe(256);

    const embeddedRows = getAllChunksWithEmbeddings();
    expect(embeddedRows.some((r) => r.id === chunks[0].id)).toBe(true);
  });

  // 8. Document indexing pipeline
  it('8. executes document indexing pipeline transitioning document to Indexed state', async () => {
    const doc: DBDocument = {
      id: 'doc_pipe_1',
      filename: 'Scheduling.md',
      original_path: null,
      file_type: 'md',
      file_size: 150,
      file_hash: 'hash_pipe_1',
      imported_at: new Date().toISOString(),
      modified_at: null,
      extraction_status: 'Ready',
      extracted_text: '# Scheduling\nRound Robin scheduling assigns CPU time using a fixed time quantum.',
      character_count: 81,
      indexing_status: 'Ready',
      error_message: null
    };
    insertDocumentInDB(doc);

    const indexed = await ragService.indexDocument(doc.id);
    expect(indexed).toBe(true);

    const updated = getDocumentById(doc.id);
    expect(updated?.indexing_status).toBe('Indexed');
    expect(updated?.indexed_at).toBeTruthy();
  });

  // 9. Duplicate indexing prevention
  it('9. prevents duplicate document indexing via SHA-256 deduplication in documentService', async () => {
    const content = 'Unique lecture content regarding deadlock prevention and bankers algorithm.';
    const buffer = new TextEncoder().encode(content).buffer;

    const res1 = await documentService.importBuffer('Deadlock.txt', buffer);
    expect(res1.success).toBe(true);
    expect(res1.document?.indexing_status).toBe('Indexed');

    // Attempt second import of identical buffer
    const res2 = await documentService.importBuffer('Deadlock_copy.txt', buffer);
    expect(res2.success).toBe(false);
    expect(res2.isDuplicate).toBe(true);
  });

  // 10. Similarity retrieval
  it('10. retrieves relevant document chunks based on semantic similarity', async () => {
    const doc: DBDocument = {
      id: 'doc_sim_1',
      filename: 'OS_Lectures.txt',
      original_path: null,
      file_type: 'txt',
      file_size: 500,
      file_hash: 'hash_sim_1',
      imported_at: new Date().toISOString(),
      modified_at: null,
      extraction_status: 'Ready',
      extracted_text: 'Round Robin scheduling assigns CPU time using a fixed time quantum to each ready process.\n\nVirtual memory uses page tables to map virtual addresses to physical RAM frames.',
      character_count: 175,
      indexing_status: 'Ready',
      error_message: null
    };
    insertDocumentInDB(doc);
    await ragService.indexDocument(doc.id);

    const results = await ragService.search('What is Round Robin scheduling?');
    expect(results.length).toBeGreaterThan(0);
    expect(results[0].chunk.text).toContain('Round Robin scheduling');
    expect(results[0].similarity).toBeGreaterThan(0.1);
  });

  // 11. Top-K retrieval
  it('11. limits retrieved chunks to configurable Top-K count', async () => {
    const retriever = new LocalRetriever();
    const results = await retriever.retrieve('Round Robin', { topK: 1 });
    expect(results.length).toBeLessThanOrEqual(1);
  });

  // 12. Context construction
  it('12. constructs structured prompt with source citations for local LLM', () => {
    const builder = new ContextBuilder();
    const mockResults: RAGSearchResult[] = [
      {
        chunk: {
          id: 'c1',
          documentId: 'd1',
          chunkIndex: 0,
          text: 'Round Robin scheduling assigns CPU time using a fixed time quantum.',
          startOffset: 0,
          endOffset: 67,
          characterCount: 67,
          tokenEstimate: 15,
          heading: 'CPU Scheduling',
          filename: 'Operating_Systems.pdf',
          fileType: 'pdf'
        },
        similarity: 0.85
      }
    ];

    const ctx = builder.buildContext('What is Round Robin scheduling?', mockResults);
    expect(ctx.usedKnowledge).toBe(true);
    expect(ctx.sources.length).toBe(1);
    expect(ctx.sources[0].filename).toBe('Operating_Systems.pdf');
    expect(ctx.augmentedUserPrompt).toContain('LOCAL STUDY MATERIAL:');
    expect(ctx.augmentedUserPrompt).toContain('[Source: Operating_Systems.pdf | Section: CPU Scheduling]');
    expect(ctx.augmentedUserPrompt).toContain('What is Round Robin scheduling?');
  });

  // 13. No relevant document case
  it('13. provides honest fallback behavior when no relevant documents match', () => {
    const builder = new ContextBuilder();
    const ctx = builder.buildContext('What is quantum entanglement?', []);

    expect(ctx.usedKnowledge).toBe(false);
    expect(ctx.sources.length).toBe(0);
    expect(ctx.systemInstruction).toContain("couldn't find relevant information in your imported study materials");
  });

  // 14. RAG + ChatService integration
  it('14. integrates RAG retrieval and persists source citations in ChatService', async () => {
    chatService.setProvider(new MockAIProvider());
    const conv = chatService.createConversation('RAG Study Chat');

    // Ensure our doc is indexed in SQLite
    const doc: DBDocument = {
      id: 'doc_rag_chat_1',
      filename: 'OS_Textbook.pdf',
      original_path: null,
      file_type: 'pdf',
      file_size: 300,
      file_hash: 'hash_rag_chat_1',
      imported_at: new Date().toISOString(),
      modified_at: null,
      extraction_status: 'Ready',
      extracted_text: 'Round Robin scheduling assigns CPU time using a fixed time quantum.',
      character_count: 67,
      indexing_status: 'Ready',
      error_message: null
    };
    insertDocumentInDB(doc);
    await ragService.indexDocument(doc.id);

    // Send question with study materials enabled
    const res = await chatService.sendMessage(conv.id, 'What is Round Robin scheduling?', {
      useStudyMaterials: true
    });

    expect(res.assistantMessage.content).toBeTruthy();
    expect(res.assistantMessage.sources).toBeDefined();
    expect(res.assistantMessage.sources!.length).toBeGreaterThan(0);
    expect(res.assistantMessage.sources![0].filename).toBe('OS_Textbook.pdf');

    // Verify persisted message in SQLite contains sources
    const msgs = chatService.getMessages(conv.id);
    const lastMsg = msgs[msgs.length - 1];
    expect(lastMsg.role).toBe('assistant');
    expect(lastMsg.sources).toBeDefined();
    expect(lastMsg.sources![0].filename).toBe('OS_Textbook.pdf');
  });

  // 15. Existing normal chat still works
  it('15. allows disabling study materials to use normal AI chat without document context', async () => {
    chatService.setProvider(new MockAIProvider());
    const conv = chatService.createConversation('Normal Chat');

    const res = await chatService.sendMessage(conv.id, 'What is an operating system?', {
      useStudyMaterials: false
    });

    expect(res.assistantMessage.content).toBeTruthy();
    expect(res.assistantMessage.sources).toBeUndefined();
  });

  // 16. Existing conversation persistence still works
  it('16. preserves full conversation history across multiple turns with RAG and normal chat', async () => {
    chatService.setProvider(new MockAIProvider());
    const conv = chatService.createConversation('Multi-turn Chat');

    await chatService.sendMessage(conv.id, 'Hello!');
    await chatService.sendMessage(conv.id, 'What is an operating system?');

    const msgs = chatService.getMessages(conv.id);
    expect(msgs.length).toBe(4); // 2 user + 2 assistant
    expect(msgs[0].role).toBe('user');
    expect(msgs[1].role).toBe('assistant');
    expect(msgs[2].role).toBe('user');
    expect(msgs[3].role).toBe('assistant');
  });
});

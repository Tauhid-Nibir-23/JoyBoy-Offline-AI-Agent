// Offline Study AI - RAG Service (Phase 3B)
import { 
  EmbeddingProvider, 
  RAGSearchResult, 
  RAGContextResult, 
  RAGQueryOptions, 
  RAGIndexingStats 
} from './types';
import { defaultEmbeddingProvider } from './embeddings';
import { LocalRetriever } from './retriever';
import { ContextBuilder, defaultContextBuilder } from './contextBuilder';
import { 
  getDocumentById, 
  getAllDocuments, 
  getChunksByDocumentId, 
  updateChunkEmbedding, 
  updateDocumentIndexingStatus,
  getAllChunksWithEmbeddings 
} from '../database/db';
import { chunkService } from '../documents/chunking';

export class RAGService {
  private embeddingProvider: EmbeddingProvider;
  private retriever: LocalRetriever;
  private contextBuilder: ContextBuilder;

  constructor(
    embeddingProvider?: EmbeddingProvider,
    retriever?: LocalRetriever,
    contextBuilder?: ContextBuilder
  ) {
    this.embeddingProvider = embeddingProvider || defaultEmbeddingProvider;
    this.retriever = retriever || new LocalRetriever(this.embeddingProvider);
    this.contextBuilder = contextBuilder || defaultContextBuilder;
  }

  public setEmbeddingProvider(provider: EmbeddingProvider): void {
    this.embeddingProvider = provider;
    this.retriever.setEmbeddingProvider(provider);
  }

  public getEmbeddingProvider(): EmbeddingProvider {
    return this.embeddingProvider;
  }

  /**
   * Run the indexing pipeline for a specific document:
   * 1. Check document exists and has extracted text
   * 2. Ensure chunks exist (or generate them via chunkService)
   * 3. Compute local embeddings for each chunk
   * 4. Persist embeddings into SQLite
   * 5. Update document status to 'Indexed'
   */
  public async indexDocument(documentId: string): Promise<boolean> {
    const doc = getDocumentById(documentId);
    if (!doc) {
      return false;
    }

    if (!doc.extracted_text || doc.extracted_text.trim().length === 0) {
      updateDocumentIndexingStatus(documentId, 'Ready');
      return true;
    }

    try {
      updateDocumentIndexingStatus(documentId, 'Indexing');

      // 1. Fetch chunks for document, generating them if not already done
      let chunks = getChunksByDocumentId(documentId);
      if (chunks.length === 0) {
        await chunkService.processDocumentChunks(documentId);
        chunks = getChunksByDocumentId(documentId);
      }

      if (chunks.length === 0) {
        updateDocumentIndexingStatus(documentId, 'Ready');
        return true;
      }

      // 2. Generate local embeddings for each chunk and update SQLite
      for (const chunk of chunks) {
        const embedding = await this.embeddingProvider.embedText(chunk.text);
        updateChunkEmbedding(chunk.id, JSON.stringify(embedding));
      }

      // 3. Mark document as successfully indexed
      updateDocumentIndexingStatus(documentId, 'Indexed');
      return true;
    } catch (err: any) {
      console.error(`Indexing failed for document ${documentId}:`, err);
      updateDocumentIndexingStatus(
        documentId, 
        'Index Failed', 
        err?.message || 'Embedding generation failed'
      );
      return false;
    }
  }

  /**
   * Indexes all documents currently marked as 'Ready' or 'Pending'
   */
  public async indexAllPendingDocuments(): Promise<number> {
    const docs = getAllDocuments();
    let indexedCount = 0;

    for (const doc of docs) {
      if (doc.extraction_status === 'Ready' && doc.indexing_status !== 'Indexed') {
        const ok = await this.indexDocument(doc.id);
        if (ok) indexedCount++;
      }
    }

    return indexedCount;
  }

  /**
   * Force re-indexing of a document
   */
  public async reindexDocument(documentId: string): Promise<boolean> {
    await chunkService.processDocumentChunks(documentId);
    return this.indexDocument(documentId);
  }

  /**
   * Query the local knowledge base using semantic cosine similarity
   */
  public async search(
    query: string,
    options?: RAGQueryOptions
  ): Promise<RAGSearchResult[]> {
    return this.retriever.retrieve(query, options);
  }

  /**
   * Build augmented context ready for Qwen 2.5 0.5B prompt injection
   */
  public async buildContext(
    userQuestion: string,
    options?: RAGQueryOptions
  ): Promise<RAGContextResult> {
    const searchResults = await this.search(userQuestion, options);
    return this.contextBuilder.buildContext(userQuestion, searchResults, {
      hasAttachedDocuments: options?.hasAttachedDocuments
    });
  }

  /**
   * Summarizes current knowledge base and vector index state
   */
  public getIndexingStats(): RAGIndexingStats {
    const allDocs = getAllDocuments();
    const embeddedChunks = getAllChunksWithEmbeddings();

    let totalChunks = 0;
    for (const doc of allDocs) {
      const chunks = getChunksByDocumentId(doc.id);
      totalChunks += chunks.length;
    }

    return {
      totalDocuments: allDocs.length,
      indexedDocuments: allDocs.filter((d) => d.indexing_status === 'Indexed').length,
      indexingDocuments: allDocs.filter((d) => d.indexing_status === 'Indexing').length,
      failedDocuments: allDocs.filter((d) => d.indexing_status === 'Index Failed').length,
      totalChunks,
      embeddedChunks: embeddedChunks.length
    };
  }
}

export const ragService = new RAGService();

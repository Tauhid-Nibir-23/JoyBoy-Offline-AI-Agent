// Offline Study AI - Local RAG Retriever (Phase 3B Part 5)
import { 
  EmbeddingProvider, 
  RAGChunk, 
  RAGQueryOptions, 
  RAGSearchResult 
} from './types';
import { defaultEmbeddingProvider } from './embeddings';
import { getAllChunksWithEmbeddings } from '../database/db';

export class LocalRetriever {
  private embeddingProvider: EmbeddingProvider;

  constructor(provider?: EmbeddingProvider) {
    this.embeddingProvider = provider || defaultEmbeddingProvider;
  }

  public setEmbeddingProvider(provider: EmbeddingProvider): void {
    this.embeddingProvider = provider;
  }

  public getEmbeddingProvider(): EmbeddingProvider {
    return this.embeddingProvider;
  }

  /**
   * Retrieves the most relevant chunks for a user question using cosine similarity
   * over locally stored chunk embeddings in SQLite.
   */
  public async retrieve(
    query: string,
    options?: RAGQueryOptions
  ): Promise<RAGSearchResult[]> {
    const trimmed = (typeof query === 'string' ? query : '').trim();
    if (!trimmed) {
      return [];
    }

    const topK = options?.topK ?? 3;
    const minSimilarity = options?.minSimilarity ?? 0.08;
    const filterDocIds = options?.filterDocumentIds ? new Set(options.filterDocumentIds) : null;

    // 1. Generate local embedding vector for user query
    const queryVector = await this.embeddingProvider.embedText(trimmed);

    // 2. Fetch all indexed document chunks from SQLite
    const dbChunks = getAllChunksWithEmbeddings();
    if (dbChunks.length === 0) {
      return [];
    }

    const results: RAGSearchResult[] = [];

    // 3. Compute cosine similarity against each chunk
    for (const chunkRow of dbChunks) {
      if (filterDocIds && !filterDocIds.has(chunkRow.document_id)) {
        continue;
      }

      if (!chunkRow.embedding_json) {
        continue;
      }

      let chunkVector: number[];
      try {
        chunkVector = JSON.parse(chunkRow.embedding_json);
      } catch {
        continue;
      }

      const similarity = this.embeddingProvider.cosineSimilarity(queryVector, chunkVector);

      if (similarity >= minSimilarity) {
        let metadata: Record<string, unknown> | null = null;
        if (chunkRow.metadata_json) {
          try {
            metadata = JSON.parse(chunkRow.metadata_json);
          } catch {
            metadata = null;
          }
        }

        const chunk: RAGChunk = {
          id: chunkRow.id,
          documentId: chunkRow.document_id,
          chunkIndex: chunkRow.chunk_index,
          text: chunkRow.text,
          startOffset: chunkRow.start_offset,
          endOffset: chunkRow.end_offset,
          characterCount: chunkRow.character_count,
          tokenEstimate: chunkRow.token_estimate,
          heading: chunkRow.heading,
          pageNumber: chunkRow.page_number,
          filename: chunkRow.filename,
          fileType: chunkRow.file_type,
          metadata,
          embedding: chunkVector,
          createdAt: chunkRow.created_at
        };

        results.push({
          chunk,
          similarity
        });
      }
    }

    // 4. Rank by similarity descending
    results.sort((a, b) => b.similarity - a.similarity);

    // 5. Select top K results
    return results.slice(0, topK);
  }
}

export const defaultRetriever = new LocalRetriever();

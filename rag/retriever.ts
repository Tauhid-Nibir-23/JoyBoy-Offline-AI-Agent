// Offline Study AI - Local RAG Retriever (Phase 3B, Phase 8 & Phase 9)
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
   * Phase 9: Page-aware matching, neighbor expansion, and table priority.
   */
  public async retrieve(
    query: string,
    options?: RAGQueryOptions & { targetPage?: number | null }
  ): Promise<RAGSearchResult[]> {
    const trimmed = (typeof query === 'string' ? query : '').trim();
    if (!trimmed) {
      return [];
    }

    const topK = options?.topK ?? options?.maxResults ?? 3;
    const minSimilarity = options?.minSimilarity ?? 0.08;
    const filterDocIds = options?.filterDocumentIds ? new Set(options.filterDocumentIds) : null;

    // Detect target page from query if not provided
    let targetPage = options?.targetPage ?? null;
    if (targetPage === null) {
      const pageMatch = trimmed.match(/\bpage\s*([0-9]+)\b/i) || trimmed.match(/পৃষ্ঠা\s*([0-9]+)/i);
      if (pageMatch) {
        targetPage = parseInt(pageMatch[1], 10);
      }
    }

    // 1. Generate local embedding vector for user query
    const queryVector = await this.embeddingProvider.embedText(trimmed);

    // 2. Fetch all indexed document chunks from SQLite
    const dbChunks = getAllChunksWithEmbeddings();
    if (dbChunks.length === 0) {
      return [];
    }

    const results: RAGSearchResult[] = [];

    // Extract normalized search keywords for hybrid lexical matching
    const queryWords = trimmed
      .toLowerCase()
      .split(/[\s,.;:!?()[\]{}"']+/)
      .filter((w) => w.length >= 3);

    // 3. Compute hybrid semantic and keyword similarity against each chunk
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

      const cosineSim = this.embeddingProvider.cosineSimilarity(queryVector, chunkVector);

      // Lexical keyword matching ratio
      let keywordScore = 0;
      if (queryWords.length > 0) {
        const textLower = chunkRow.text.toLowerCase();
        const headingLower = (chunkRow.heading || '').toLowerCase();
        let matches = 0;
        for (const word of queryWords) {
          if (textLower.includes(word) || headingLower.includes(word)) {
            matches++;
          }
        }
        keywordScore = matches / queryWords.length;
      }

      // Hybrid blended score (70% semantic embedding + 30% lexical keyword overlap)
      let blendedSimilarity = queryWords.length > 0 
        ? (0.7 * cosineSim) + (0.3 * keywordScore)
        : cosineSim;

      // Page-aware boosting
      if (targetPage !== null && chunkRow.page_number === targetPage) {
        blendedSimilarity = Math.min(1.0, blendedSimilarity + 0.35);
      }

      // Chapter-aware boosting
      const chapterMatch = trimmed.match(/\bchapter\s*([0-9]{1,2})\b/i) || trimmed.match(/অধ্যায়\s*([০-৯0-9]{1,2})/i);
      if (chapterMatch) {
        const chapNum = chapterMatch[1];
        const textLower = chunkRow.text.toLowerCase();
        const headingLower = (chunkRow.heading || '').toLowerCase();
        if (
          textLower.includes(`chapter ${chapNum}`) ||
          headingLower.includes(`chapter ${chapNum}`) ||
          headingLower.includes(`ch ${chapNum}`) ||
          headingLower.includes(`chapter 0${chapNum}`)
        ) {
          blendedSimilarity = Math.min(1.0, blendedSimilarity + 0.30);
        }
      }

      // Table boosting if query asks about differences, comparison or tables
      const isTableQuery = /\b(difference|compare|vs|table|properties|algorithm)\b/i.test(trimmed);
      if (isTableQuery && chunkRow.text.includes('|')) {
        blendedSimilarity = Math.min(1.0, blendedSimilarity + 0.15);
      }

      if (blendedSimilarity >= minSimilarity) {
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
          similarity: blendedSimilarity
        });
      }
    }

    // 4. Rank by hybrid similarity descending
    results.sort((a, b) => b.similarity - a.similarity);

    // 5. Deduplicate identical text chunks
    const seenTexts = new Set<string>();
    const deduplicated: RAGSearchResult[] = [];
    for (const res of results) {
      const simplified = res.chunk.text.substring(0, 100).trim();
      if (!seenTexts.has(simplified)) {
        seenTexts.add(simplified);
        deduplicated.push(res);
      }
    }

    // 6. Neighboring chunk expansion (Part 14)
    // If top chunk has high relevance and there's room, pull in adjacent chunk from same document
    const finalResults = deduplicated.slice(0, topK);
    if (finalResults.length > 0 && finalResults.length < topK + 1) {
      const topChunk = finalResults[0].chunk;
      const neighborIdx = topChunk.chunkIndex + 1;
      const neighborRow = dbChunks.find(
        (c) => c.document_id === topChunk.documentId && c.chunk_index === neighborIdx
      );

      if (neighborRow && !finalResults.some((r) => r.chunk.id === neighborRow.id)) {
        let metadata: Record<string, unknown> | null = null;
        if (neighborRow.metadata_json) {
          try { metadata = JSON.parse(neighborRow.metadata_json); } catch {}
        }
        finalResults.push({
          chunk: {
            id: neighborRow.id,
            documentId: neighborRow.document_id,
            chunkIndex: neighborRow.chunk_index,
            text: neighborRow.text,
            startOffset: neighborRow.start_offset,
            endOffset: neighborRow.end_offset,
            characterCount: neighborRow.character_count,
            tokenEstimate: neighborRow.token_estimate,
            heading: neighborRow.heading,
            pageNumber: neighborRow.page_number,
            filename: neighborRow.filename,
            fileType: neighborRow.file_type,
            metadata,
            createdAt: neighborRow.created_at
          },
          similarity: Math.max(0.1, finalResults[0].similarity * 0.8)
        });
      }
    }

    return finalResults.slice(0, topK);
  }
}

export const defaultRetriever = new LocalRetriever();
export const retriever = defaultRetriever;

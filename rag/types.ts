// Offline Study AI - Local RAG Types (Phase 3B)

export interface EmbeddingProvider {
  readonly id: string;
  readonly name: string;
  readonly dimension: number;
  embedText(text: string): Promise<number[]>;
  embedTexts(texts: string[]): Promise<number[][]>;
  cosineSimilarity(vecA: number[], vecB: number[]): number;
}

export interface RAGChunk {
  id: string;
  documentId: string;
  chunkIndex: number;
  text: string;
  startOffset: number;
  endOffset: number;
  characterCount: number;
  tokenEstimate: number;
  heading?: string | null;
  pageNumber?: number | null;
  filename: string;
  fileType: string;
  metadata?: Record<string, unknown> | null;
  embedding?: number[];
  createdAt?: string;
}

export interface RAGSourceCitation {
  documentId: string;
  filename: string;
  chunkIndex: number;
  heading?: string | null;
  similarity: number;
  snippet: string;
}

export interface RAGSearchResult {
  chunk: RAGChunk;
  similarity: number;
}

export interface RAGQueryOptions {
  /**
   * Maximum number of chunks to retrieve (default: 3, top 3-5 for small Qwen model)
   */
  topK?: number;
  /**
   * Minimum cosine similarity threshold to consider relevant (default: 0.08)
   */
  minSimilarity?: number;
  /**
   * Optional restriction to specific document IDs
   */
  filterDocumentIds?: string[];
}

export interface RAGContextResult {
  augmentedUserPrompt: string;
  sources: RAGSourceCitation[];
  usedKnowledge: boolean;
  systemInstruction?: string;
}

export interface RAGIndexingStats {
  totalDocuments: number;
  indexedDocuments: number;
  indexingDocuments: number;
  failedDocuments: number;
  totalChunks: number;
  embeddedChunks: number;
}

// Offline Study AI - Document Chunking Types (Phase 3B)

export interface ChunkingOptions {
  targetSize: number;
  overlap: number;
  minSize: number;
  maxSize: number;
}

export const DEFAULT_CHUNKING_OPTIONS: ChunkingOptions = {
  targetSize: 1200,
  overlap: 200,
  minSize: 100,
  maxSize: 2000
};

export interface DocumentChunk {
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
  metadata?: Record<string, unknown> | null;
  createdAt?: string;
}

export interface ChunkingResult {
  chunks: DocumentChunk[];
  totalChunks: number;
  totalCharacters: number;
  totalTokensEstimate: number;
}

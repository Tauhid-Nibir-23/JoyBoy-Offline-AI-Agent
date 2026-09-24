// Offline Study AI - RAG Document Chunker (Phase 3B Part 1)
import { 
  chunkDocumentText, 
  ChunkingOptions, 
  ChunkingResult, 
  DEFAULT_CHUNKING_OPTIONS,
  DocumentChunk 
} from '../documents/chunking';

export type { ChunkingOptions, ChunkingResult, DocumentChunk };
export { DEFAULT_CHUNKING_OPTIONS };

export interface RAGChunkerOptions extends Partial<ChunkingOptions> {
  filename?: string;
  fileType?: string;
  metadata?: Record<string, unknown>;
}

/**
 * Splits extracted document text into clean, structured chunks with offsets,
 * token estimates, and metadata while strictly preserving the original document text.
 */
export function chunkTextForRAG(
  text: string,
  documentId: string,
  options?: RAGChunkerOptions
): ChunkingResult {
  const metadata: Record<string, unknown> = {
    filename: options?.filename || 'document',
    fileType: options?.fileType || 'txt',
    ...(options?.metadata || {})
  };

  return chunkDocumentText(text, documentId, options, metadata);
}

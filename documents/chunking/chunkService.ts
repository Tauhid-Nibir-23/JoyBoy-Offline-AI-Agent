// Offline Study AI - Document Chunk Service (Phase 3B)
import { 
  DocumentChunk, 
  ChunkingOptions, 
  DEFAULT_CHUNKING_OPTIONS 
} from './types';
import { chunkDocumentText } from './chunkText';
import { 
  getDocumentById, 
  getChunksByDocumentId, 
  insertChunksInDB, 
  deleteChunksByDocumentId, 
  DBDocumentChunk 
} from '../../database/db';

export class ChunkService {
  /**
   * Process a document into normalized chunks and persist them to SQLite.
   * Cleans up any existing chunks first to ensure idempotent re-indexing.
   */
  public async processDocumentChunks(
    documentId: string,
    options?: Partial<ChunkingOptions>
  ): Promise<DocumentChunk[]> {
    const doc = getDocumentById(documentId);
    if (!doc) {
      throw new Error(`Document with ID "${documentId}" not found`);
    }

    if (!doc.extracted_text || doc.extracted_text.trim().length === 0) {
      // No text to chunk; remove any stale chunks
      deleteChunksByDocumentId(documentId);
      return [];
    }

    // 1. Remove previous chunks for this document
    deleteChunksByDocumentId(documentId);

    // 2. Perform chunking
    const metadata: Record<string, unknown> = {
      filename: doc.filename,
      fileType: doc.file_type,
      fileSize: doc.file_size
    };

    const result = chunkDocumentText(doc.extracted_text, documentId, options, metadata);

    // 3. Convert to database records and insert
    const dbChunks: DBDocumentChunk[] = result.chunks.map((c) => ({
      id: c.id,
      document_id: c.documentId,
      chunk_index: c.chunkIndex,
      text: c.text,
      start_offset: c.startOffset,
      end_offset: c.endOffset,
      character_count: c.characterCount,
      token_estimate: c.tokenEstimate,
      heading: c.heading || null,
      page_number: c.pageNumber || null,
      metadata_json: c.metadata ? JSON.stringify(c.metadata) : null
    }));

    insertChunksInDB(dbChunks);

    return result.chunks;
  }

  /**
   * Retrieve all chunks for a document ordered by chunk_index ASC.
   */
  public async getChunksForDocument(documentId: string): Promise<DocumentChunk[]> {
    const rows = getChunksByDocumentId(documentId);
    return rows.map((r) => {
      let metadata: Record<string, unknown> | null = null;
      if (r.metadata_json) {
        try {
          metadata = JSON.parse(r.metadata_json);
        } catch {
          metadata = null;
        }
      }

      return {
        id: r.id,
        documentId: r.document_id,
        chunkIndex: r.chunk_index,
        text: r.text,
        startOffset: r.start_offset,
        endOffset: r.end_offset,
        characterCount: r.character_count,
        tokenEstimate: r.token_estimate,
        heading: r.heading,
        pageNumber: r.page_number,
        metadata,
        createdAt: r.created_at
      };
    });
  }

  /**
   * Reprocess an existing document: deletes existing chunks, re-normalizes, re-chunks, and persists.
   */
  public async reprocessDocument(
    documentId: string,
    options?: Partial<ChunkingOptions>
  ): Promise<DocumentChunk[]> {
    return this.processDocumentChunks(documentId, options);
  }

  /**
   * Delete all chunks associated with a document.
   */
  public async deleteChunksForDocument(documentId: string): Promise<void> {
    deleteChunksByDocumentId(documentId);
  }
}

export const chunkService = new ChunkService();

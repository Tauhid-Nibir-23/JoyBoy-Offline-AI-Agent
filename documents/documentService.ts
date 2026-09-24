// Offline Study AI - Document Service (Phase 3A & 3B)
import { 
  DocumentRecord, 
  ImportResult, 
  SupportedFileType, 
  FileImportInput 
} from './types';
import { extractDocumentText } from './extractors';
import { chunkService } from './chunking';
import { ragService } from '../rag';
import { 
  getAllDocuments, 
  getDocumentById, 
  getDocumentByHash, 
  insertDocumentInDB, 
  updateDocumentInDB, 
  deleteDocumentFromDB,
  DBDocument
} from '../database/db';

export function normalizeBuffer(buffer: ArrayBuffer | ArrayBufferView): ArrayBuffer {
  if (ArrayBuffer.isView(buffer)) {
    return buffer.buffer.slice(buffer.byteOffset, buffer.byteOffset + buffer.byteLength) as ArrayBuffer;
  }
  return buffer.slice(0) as ArrayBuffer;
}

export async function calculateSHA256(buffer: ArrayBuffer | ArrayBufferView): Promise<string> {
  const clean = normalizeBuffer(buffer);
  if (typeof crypto !== 'undefined' && crypto.subtle && typeof crypto.subtle.digest === 'function') {
    const hashBuffer = await crypto.subtle.digest('SHA-256', clean);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    return hashArray.map((b) => b.toString(16).padStart(2, '0')).join('');
  }

  try {
    const nodeCrypto = await import('crypto');
    return nodeCrypto.createHash('sha256').update(Buffer.from(clean)).digest('hex');
  } catch {
    throw new Error('No crypto implementation available for SHA-256 calculation');
  }
}

export function detectFileType(filename: string): SupportedFileType | null {
  const ext = filename.split('.').pop()?.toLowerCase();
  const supported: Record<string, SupportedFileType> = {
    pdf: 'pdf',
    docx: 'docx',
    txt: 'txt',
    md: 'md',
    py: 'py',
    js: 'js',
    ts: 'ts',
    tsx: 'tsx',
    java: 'java',
    cpp: 'cpp',
    c: 'c',
    html: 'html',
    css: 'css',
    json: 'json'
  };

  return (ext && supported[ext]) || null;
}

export class DocumentService {
  /**
   * List all documents sorted by imported_at DESC
   */
  public async listDocuments(): Promise<DocumentRecord[]> {
    return getAllDocuments();
  }

  /**
   * Get single document by ID
   */
  public async getDocument(id: string): Promise<DocumentRecord | null> {
    return getDocumentById(id);
  }

  /**
   * Import a document from an ArrayBuffer
   */
  public async importBuffer(
    filename: string,
    buffer: ArrayBuffer | ArrayBufferView,
    options?: {
      originalPath?: string | null;
      modifiedAt?: string | null;
    }
  ): Promise<ImportResult> {
    try {
      const cleanBuffer = normalizeBuffer(buffer);
      const fileType = detectFileType(filename);
      if (!fileType) {
        return {
          success: false,
          error: `Unsupported file format for "${filename}". Supported formats: PDF, DOCX, TXT, MD, PY, JS, TS, TSX, JAVA, CPP, C, HTML, CSS, JSON.`
        };
      }

      const fileHash = await calculateSHA256(cleanBuffer);

      // Duplicate detection
      const existing = getDocumentByHash(fileHash);
      if (existing) {
        return {
          success: false,
          isDuplicate: true,
          document: existing,
          error: `"${filename}" has already been imported.`
        };
      }

      const docId = `doc_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
      const now = new Date().toISOString();

      const initialDoc: DBDocument = {
        id: docId,
        filename,
        original_path: options?.originalPath || null,
        file_type: fileType,
        file_size: cleanBuffer.byteLength,
        file_hash: fileHash,
        imported_at: now,
        modified_at: options?.modifiedAt || null,
        extraction_status: 'Processing',
        extracted_text: null,
        character_count: 0,
        error_message: null
      };

      insertDocumentInDB(initialDoc);

      // Perform local offline text extraction
      try {
        const extraction = await extractDocumentText(fileType, cleanBuffer);

        if (extraction.error && !extraction.text) {
          updateDocumentInDB(docId, {
            extraction_status: 'Failed',
            error_message: extraction.error,
            modified_at: new Date().toISOString()
          });
        } else {
          updateDocumentInDB(docId, {
            extraction_status: 'Ready',
            extracted_text: extraction.text,
            character_count: extraction.characterCount,
            error_message: null,
            modified_at: new Date().toISOString()
          });

          // Phase 3B Processing Pipeline: Normalize -> Chunk -> Store chunks -> Index Embeddings
          try {
            await chunkService.processDocumentChunks(docId);
            // Asynchronously generate embeddings and index document for RAG
            await ragService.indexDocument(docId);
          } catch (chunkErr: any) {
            updateDocumentInDB(docId, {
              extraction_status: 'Failed',
              error_message: `Processing failed: ${chunkErr?.message || String(chunkErr)}`,
              modified_at: new Date().toISOString()
            });
            await chunkService.deleteChunksForDocument(docId);
          }
        }
      } catch (extractErr: any) {
        updateDocumentInDB(docId, {
          extraction_status: 'Failed',
          error_message: extractErr?.message || 'Text extraction failed',
          modified_at: new Date().toISOString()
        });
      }

      const finalizedDoc = getDocumentById(docId);
      return {
        success: finalizedDoc?.extraction_status === 'Ready',
        document: finalizedDoc || undefined,
        error: finalizedDoc?.extraction_status === 'Failed' ? finalizedDoc.error_message || 'Extraction failed' : undefined
      };
    } catch (err: any) {
      return {
        success: false,
        error: err?.message || 'Failed to import document'
      };
    }
  }

  /**
   * Import a File or FileImportInput
   */
  public async importFile(file: File | FileImportInput): Promise<ImportResult> {
    const buffer = await file.arrayBuffer();
    const modifiedAt = 'lastModified' in file && file.lastModified ? new Date(file.lastModified).toISOString() : null;
    const path = 'path' in file ? (file as any).path : null;

    return this.importBuffer(file.name, buffer, {
      originalPath: path,
      modifiedAt
    });
  }

  /**
   * Import multiple files sequentially
   */
  public async importMultipleFiles(files: (File | FileImportInput)[]): Promise<ImportResult[]> {
    const results: ImportResult[] = [];
    for (const file of files) {
      const result = await this.importFile(file);
      results.push(result);
    }
    return results;
  }

  /**
   * Delete a document by ID
   */
  public async deleteDocument(id: string): Promise<boolean> {
    try {
      await chunkService.deleteChunksForDocument(id);
      deleteDocumentFromDB(id);
      return true;
    } catch {
      return false;
    }
  }
}

export const documentService = new DocumentService();

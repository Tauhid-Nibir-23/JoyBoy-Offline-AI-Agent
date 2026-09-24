// Offline Study AI - Document Types (Phase 3A)

export type SupportedFileType =
  | 'pdf'
  | 'docx'
  | 'txt'
  | 'md'
  | 'py'
  | 'js'
  | 'ts'
  | 'tsx'
  | 'java'
  | 'cpp'
  | 'c'
  | 'html'
  | 'css'
  | 'json';

export type ExtractionStatus = 'Imported' | 'Processing' | 'Ready' | 'Failed';

export interface DocumentRecord {
  id: string;
  filename: string;
  original_path: string | null;
  file_type: SupportedFileType | string;
  file_size: number;
  file_hash: string;
  imported_at: string;
  modified_at: string | null;
  extraction_status: ExtractionStatus;
  extracted_text: string | null;
  character_count: number;
  indexing_status?: 'Ready' | 'Indexing' | 'Indexed' | 'Index Failed' | null;
  indexed_at?: string | null;
  error_message: string | null;
}

export interface ImportResult {
  success: boolean;
  document?: DocumentRecord;
  isDuplicate?: boolean;
  error?: string;
}

export interface ExtractionResult {
  text: string;
  characterCount: number;
  pageCount?: number;
  error?: string;
}

export interface FileImportInput {
  name: string;
  size: number;
  arrayBuffer: () => Promise<ArrayBuffer>;
  lastModified?: number;
  path?: string;
}

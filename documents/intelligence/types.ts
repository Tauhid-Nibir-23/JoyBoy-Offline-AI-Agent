// Offline Study AI - Document Intelligence & OCR Types (Phase 8)

export type DocumentQuality = 
  | 'TEXT'
  | 'OCR_REQUIRED'
  | 'IMAGE_HEAVY'
  | 'EMPTY_OR_UNREADABLE';

export interface DocumentStatusBadge {
  label: string;
  type: 'success' | 'warning' | 'info' | 'error';
  message: string;
}

export interface DocumentAnalysis {
  quality: DocumentQuality;
  pageCount: number;
  characterCount: number;
  averageCharsPerPage: number;
  badge: DocumentStatusBadge;
}

export interface OCRProvider {
  readonly id: string;
  readonly name: string;
  isAvailable(): Promise<boolean>;
  recognize(buffer: ArrayBuffer | Uint8Array): Promise<string>;
}

export interface TextExtractor {
  extract(buffer: ArrayBuffer, fileType: string): Promise<{ text: string; pageCount: number; error?: string }>;
}

export interface DocumentParser {
  parse(buffer: ArrayBuffer, filename: string): Promise<{
    text: string;
    analysis: DocumentAnalysis;
    error?: string;
  }>;
}

// Offline Study AI - Document Intelligence & OCR Types (Phase 8 & 9)

export type DocumentQuality = 
  | 'TEXT'
  | 'OCR_REQUIRED'
  | 'IMAGE_HEAVY'
  | 'EMPTY_OR_UNREADABLE';

export type PageClassification =
  | 'TEXT'
  | 'TEXT_WITH_IMAGE'
  | 'IMAGE_HEAVY'
  | 'SCANNED'
  | 'TABLE_HEAVY';

export interface DocumentStatusBadge {
  label: string;
  type: 'success' | 'warning' | 'info' | 'error';
  message: string;
}

export interface PageAnalysis {
  pageNumber: number;
  classification: PageClassification;
  characterCount: number;
  hasTable: boolean;
  hasDiagramOrImage: boolean;
  rawText: string;
  disclaimer?: string;
}

export interface DocumentAnalysis {
  quality: DocumentQuality;
  pageCount: number;
  characterCount: number;
  averageCharsPerPage: number;
  badge: DocumentStatusBadge;
  pageAnalyses?: PageAnalysis[];
}

export interface OCREngineInfo {
  isAvailable: boolean;
  engineName: string;
  name?: string;
  executablePath?: string | null;
  statusText: string;
}

export interface OCRProvider {
  readonly id: string;
  readonly name: string;
  isAvailable(): Promise<boolean>;
  getEngineInfo(): Promise<OCREngineInfo>;
  recognize(buffer: ArrayBuffer | Uint8Array, pageNumber?: number): Promise<string>;
}

export interface LocalVisionProvider {
  readonly id: string;
  readonly name: string;
  isAvailable(): Promise<boolean>;
  describeImage(imageBuffer: ArrayBuffer | Uint8Array, prompt?: string): Promise<string>;
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

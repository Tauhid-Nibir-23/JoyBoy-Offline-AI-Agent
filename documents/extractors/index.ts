// Offline Study AI - Extractors Index (Phase 3A)
import { SupportedFileType, ExtractionResult } from '../types';
import { extractTextFromBuffer } from './textExtractor';
import { extractDocxFromBuffer } from './docxExtractor';
import { extractPdfFromBuffer } from './pdfExtractor';

export async function extractDocumentText(
  fileType: SupportedFileType | string,
  buffer: ArrayBuffer
): Promise<ExtractionResult> {
  const type = fileType.toLowerCase();

  switch (type) {
    case 'pdf':
      return await extractPdfFromBuffer(buffer);
    case 'docx':
      return await extractDocxFromBuffer(buffer);
    case 'txt':
    case 'md':
    case 'py':
    case 'js':
    case 'ts':
    case 'tsx':
    case 'java':
    case 'cpp':
    case 'c':
    case 'html':
    case 'css':
    case 'json':
      return extractTextFromBuffer(buffer);
    default:
      return extractTextFromBuffer(buffer);
  }
}

export { extractTextFromBuffer, extractDocxFromBuffer, extractPdfFromBuffer };

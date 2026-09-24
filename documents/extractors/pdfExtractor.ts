// Offline Study AI - PDF Extractor (Phase 3A)
import { ExtractionResult } from '../types';
import { extractText } from 'unpdf';

export async function extractPdfFromBuffer(arrayBuffer: ArrayBuffer): Promise<ExtractionResult> {
  try {
    if (!arrayBuffer || arrayBuffer.byteLength === 0) {
      return {
        text: '',
        characterCount: 0,
        error: 'PDF file is empty'
      };
    }

    const uint8 = new Uint8Array(arrayBuffer);
    const result = await extractText(uint8, { mergePages: true });

    const resText: any = result.text;
    let rawText = '';
    if (typeof resText === 'string') {
      rawText = resText;
    } else if (Array.isArray(resText)) {
      rawText = resText.join('\n\n');
    }

    const normalized = rawText.replace(/\r\n/g, '\n').replace(/\r/g, '\n');

    return {
      text: normalized,
      characterCount: normalized.length,
      pageCount: result.totalPages || 1
    };
  } catch (error: any) {
    return {
      text: '',
      characterCount: 0,
      error: error?.message || 'Failed to extract text from PDF document'
    };
  }
}

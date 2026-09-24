// Offline Study AI - DOCX Extractor (Phase 3A)
import { ExtractionResult } from '../types';
import mammoth from 'mammoth';

export async function extractDocxFromBuffer(arrayBuffer: ArrayBuffer): Promise<ExtractionResult> {
  try {
    if (!arrayBuffer || arrayBuffer.byteLength === 0) {
      return {
        text: '',
        characterCount: 0,
        error: 'DOCX file is empty'
      };
    }

    const mammothExtract = (mammoth as any)?.extractRawText || (mammoth as any)?.default?.extractRawText;
    if (typeof mammothExtract !== 'function') {
      throw new Error('Mammoth extraction function not available');
    }

    const options: any = {
      arrayBuffer
    };

    if (typeof Buffer !== 'undefined') {
      options.buffer = Buffer.from(arrayBuffer);
    }

    const result = await mammothExtract(options);
    const rawText = result?.value || '';
    const normalized = rawText.replace(/\r\n/g, '\n').replace(/\r/g, '\n');

    return {
      text: normalized,
      characterCount: normalized.length
    };
  } catch (error: any) {
    return {
      text: '',
      characterCount: 0,
      error: error?.message || 'Failed to extract text from DOCX file'
    };
  }
}

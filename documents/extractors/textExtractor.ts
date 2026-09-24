// Offline Study AI - Text & Code Extractor (Phase 3A)
import { ExtractionResult } from '../types';

export function extractTextFromBuffer(buffer: ArrayBuffer | ArrayBufferView | string): ExtractionResult {
  try {
    let rawText: string;

    if (typeof buffer === 'string') {
      rawText = buffer;
    } else {
      const decoder = new TextDecoder('utf-8', { fatal: false });
      const view = ArrayBuffer.isView(buffer)
        ? new Uint8Array(buffer.buffer, buffer.byteOffset, buffer.byteLength)
        : new Uint8Array(buffer);
      rawText = decoder.decode(view);
    }

    // Normalize line breaks to \n and remove null bytes
    const normalized = rawText.replace(/\0/g, '').replace(/\r\n/g, '\n').replace(/\r/g, '\n');

    return {
      text: normalized,
      characterCount: normalized.length
    };
  } catch (error: any) {
    return {
      text: '',
      characterCount: 0,
      error: error?.message || 'Failed to decode UTF-8 text'
    };
  }
}

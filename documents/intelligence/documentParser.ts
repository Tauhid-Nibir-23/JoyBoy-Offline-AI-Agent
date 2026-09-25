// Offline Study AI - Unified Document Parser & Intelligence Pipeline (Phase 8)
import { DocumentParser, DocumentAnalysis, TextExtractor } from './types';
import { documentAnalyzer } from './documentAnalyzer';
import { ocrRegistry } from './ocrProvider';
import { extractDocumentText } from '../extractors';

export class UnifiedDocumentParser implements DocumentParser, TextExtractor {
  public async extract(
    buffer: ArrayBuffer,
    fileType: string
  ): Promise<{ text: string; pageCount: number; error?: string }> {
    try {
      const res = await extractDocumentText(fileType, buffer);
      return {
        text: res.text || '',
        pageCount: res.pageCount || 1,
        error: res.error
      };
    } catch (err: any) {
      return {
        text: '',
        pageCount: 1,
        error: err?.message || 'Text extraction failed'
      };
    }
  }

  public async parse(
    buffer: ArrayBuffer,
    filename: string
  ): Promise<{
    text: string;
    analysis: DocumentAnalysis;
    error?: string;
  }> {
    const ext = filename.split('.').pop()?.toLowerCase() || 'txt';
    const extraction = await this.extract(buffer, ext);

    let text = extraction.text;
    let analysis = documentAnalyzer.analyze(filename, ext, text, extraction.pageCount);

    // If scanned PDF with low text density, attempt OCR fallback
    if (analysis.quality === 'OCR_REQUIRED' || analysis.quality === 'EMPTY_OR_UNREADABLE') {
      const ocrProvider = ocrRegistry.getProvider();
      const ocrReady = await ocrProvider.isAvailable();

      if (ocrReady) {
        try {
          const ocrText = await ocrProvider.recognize(buffer);
          if (ocrText && ocrText.trim().length > 0) {
            text = ocrText;
            analysis = documentAnalyzer.analyze(filename, ext, text, extraction.pageCount);
          }
        } catch {
          // Keep graceful fallback notice
        }
      }
    }

    return {
      text,
      analysis,
      error: extraction.error
    };
  }
}

export const unifiedDocumentParser = new UnifiedDocumentParser();

export function createDocumentParser(): UnifiedDocumentParser {
  return new UnifiedDocumentParser();
}

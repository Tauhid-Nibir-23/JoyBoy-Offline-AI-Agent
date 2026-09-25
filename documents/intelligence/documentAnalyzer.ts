// Offline Study AI - Document Quality Classifier & Analyzer (Phase 8)
import { DocumentQuality, DocumentAnalysis } from './types';

export class DocumentAnalyzer {
  /**
   * Classifies document extraction quality into:
   * - TEXT: Standard text document with sufficient density
   * - OCR_REQUIRED: Scanned or image-based PDF where character density is below threshold
   * - IMAGE_HEAVY: Documents containing mostly images or graphics
   * - EMPTY_OR_UNREADABLE: Zero extracted text or unreadable stream
   */
  public analyze(
    filename: string,
    fileType: string,
    extractedText: string | null | undefined,
    pageCount: number = 1
  ): DocumentAnalysis {
    const raw = (extractedText || '').trim();
    const characterCount = raw.length;
    const safePages = Math.max(1, pageCount);
    const averageCharsPerPage = Math.round(characterCount / safePages);

    if (characterCount === 0) {
      return {
        quality: 'EMPTY_OR_UNREADABLE',
        pageCount: safePages,
        characterCount: 0,
        averageCharsPerPage: 0,
        badge: {
          label: '⚠ Unreadable',
          type: 'error',
          message: 'No readable text was found in this document. It may be image-based or scanned.'
        }
      };
    }

    const normType = (fileType || '').toLowerCase();

    // Check scanned/image-heavy PDFs
    if (normType === 'pdf') {
      // Scanned PDF check: less than 70 characters per page
      if (averageCharsPerPage < 70) {
        return {
          quality: 'OCR_REQUIRED',
          pageCount: safePages,
          characterCount,
          averageCharsPerPage,
          badge: {
            label: '⚠ Scanned PDF',
            type: 'warning',
            message: 'Scanned PDF — low text density. OCR may be required.'
          }
        };
      }

      // Image heavy PDF check: between 70 and 160 characters per page
      if (averageCharsPerPage < 160) {
        return {
          quality: 'IMAGE_HEAVY',
          pageCount: safePages,
          characterCount,
          averageCharsPerPage,
          badge: {
            label: '⚠ Image-Heavy PDF',
            type: 'info',
            message: 'This document contains mostly images and may have limited text understanding.'
          }
        };
      }
    }

    return {
      quality: 'TEXT',
      pageCount: safePages,
      characterCount,
      averageCharsPerPage,
      badge: {
        label: '✓ Text extracted',
        type: 'success',
        message: 'Text extracted and ready for study.'
      }
    };
  }
}

export const documentAnalyzer = new DocumentAnalyzer();

export function classifyDocumentText(params: {
  filename?: string;
  fileType?: string;
  text: string | null | undefined;
  pageCount?: number;
  fileSize?: number;
}): DocumentQuality {
  const analysis = documentAnalyzer.analyze(
    params.filename || 'document.pdf',
    params.fileType || 'pdf',
    params.text,
    params.pageCount || 1
  );
  return analysis.quality;
}

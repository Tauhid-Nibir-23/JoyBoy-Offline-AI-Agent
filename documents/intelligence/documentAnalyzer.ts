// Offline Study AI - Document Quality Classifier & Page Analyzer (Phase 8 & 9)
import { DocumentQuality, DocumentAnalysis, PageAnalysis, PageClassification } from './types';

export const DIAGRAM_PAGE_DISCLAIMER = 
  "এই page-এ visual/diagram content আছে। Current offline model text extraction থেকে যতটুকু পাওয়া গেছে, তার ভিত্তিতেই উত্তর দেওয়া হচ্ছে.";

export class DocumentAnalyzer {
  /**
   * Analyzes an individual page to classify its structural nature:
   * TEXT, TEXT_WITH_IMAGE, IMAGE_HEAVY, SCANNED, or TABLE_HEAVY.
   */
  public analyzePage(pageText: string, pageNumber: number): PageAnalysis {
    const raw = (pageText || '').trim();
    const characterCount = raw.length;

    // Check table structure: markdown tables or multiple pipe-delimited lines
    const lines = raw.split('\n');
    let pipeLineCount = 0;
    for (const l of lines) {
      if (l.trim().startsWith('|') && l.trim().endsWith('|')) {
        pipeLineCount++;
      }
    }
    const hasTable = pipeLineCount >= 2;

    // Check diagram / visual indicators
    const hasDiagramKeywords = /\b(figure|diagram|schematic|chart|graph|illustration|চিত্র|ডায়াগ্রাম)\b/i.test(raw);
    const hasImageStreamMarker = /\[image\]|\[embedded graphic\]/i.test(raw);
    const hasDiagramOrImage = hasDiagramKeywords || hasImageStreamMarker;

    let classification: PageClassification = 'TEXT';
    let disclaimer: string | undefined = undefined;

    if (characterCount < 40) {
      classification = 'SCANNED';
      disclaimer = 'এই PDF-টি scanned/image-based হওয়ায় সরাসরি text পাওয়া যায়নি। OCR engine install করলে JoyBoy এই document বুঝতে পারবে।';
    } else if (hasTable) {
      classification = 'TABLE_HEAVY';
    } else if (hasDiagramOrImage) {
      if (characterCount < 200) {
        classification = 'IMAGE_HEAVY';
      } else {
        classification = 'TEXT_WITH_IMAGE';
      }
      disclaimer = DIAGRAM_PAGE_DISCLAIMER;
    } else {
      classification = 'TEXT';
    }

    return {
      pageNumber,
      classification,
      characterCount,
      hasTable,
      hasDiagramOrImage,
      rawText: raw,
      disclaimer
    };
  }

  /**
   * Classifies entire document extraction quality and performs page-level decomposition.
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

    // Deconstruct pages if page markers exist
    const pageAnalyses: PageAnalysis[] = [];
    const pageSegments = raw.split(/--- Page \d+ ---/g).map(s => s.trim()).filter(Boolean);

    if (pageSegments.length > 0) {
      pageSegments.forEach((seg, idx) => {
        pageAnalyses.push(this.analyzePage(seg, idx + 1));
      });
    } else {
      pageAnalyses.push(this.analyzePage(raw, 1));
    }

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
        },
        pageAnalyses
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
          },
          pageAnalyses
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
          },
          pageAnalyses
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
      },
      pageAnalyses
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

export function classifyPage(
  pageText: string,
  pageNumber: number = 1,
  isScanned: boolean = false
): PageAnalysis & { hasTables?: boolean; isScanned?: boolean } {
  const analysis = documentAnalyzer.analyzePage(pageText, pageNumber);
  if (isScanned) {
    analysis.classification = 'SCANNED';
  }
  return {
    ...analysis,
    hasTables: analysis.hasTable,
    isScanned: analysis.classification === 'SCANNED'
  };
}

export function analyzeDocumentPages(pages: string[]): PageAnalysis[] {
  return pages.map((text, idx) => documentAnalyzer.analyzePage(text, idx + 1));
}


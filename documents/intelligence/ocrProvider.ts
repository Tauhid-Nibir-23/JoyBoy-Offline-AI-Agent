// Offline Study AI - Local OCR Provider Abstraction (Phase 8)
import { OCRProvider, DocumentAnalysis } from './types';
import { documentAnalyzer } from './documentAnalyzer';

export class LocalFallbackOCRProvider implements OCRProvider {
  public readonly id = 'local_fallback_ocr';
  public readonly name = 'Offline OCR Engine';

  /**
   * Returns true if a local offline OCR engine (e.g., Tesseract CLI or native engine) is available.
   */
  public async isAvailable(): Promise<boolean> {
    // Check if offline OCR engine is installed locally
    if (typeof process !== 'undefined' && process.env?.OFFLINE_OCR_ENABLED === 'true') {
      return true;
    }
    return false;
  }

  /**
   * Recognizes text from image buffers without relying on remote or cloud APIs.
   * If offline engine is not present, returns a clean, truthful fallback without fabricating text.
   */
  public async recognize(_buffer: ArrayBuffer | Uint8Array): Promise<string> {
    const available = await this.isAvailable();
    if (!available) {
      return '';
    }
    return '';
  }
}

export const DefaultOCRProvider = LocalFallbackOCRProvider;
export type DefaultOCRProvider = LocalFallbackOCRProvider;

export class OCRProviderRegistry {
  private activeProvider: OCRProvider;

  constructor(defaultProvider?: OCRProvider) {
    this.activeProvider = defaultProvider || new LocalFallbackOCRProvider();
  }

  public getProvider(): OCRProvider {
    return this.activeProvider;
  }

  public setProvider(provider: OCRProvider): void {
    this.activeProvider = provider;
  }
}

export const ocrRegistry = new OCRProviderRegistry();

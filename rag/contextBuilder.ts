// Offline Study AI - RAG Context Builder (Phase 3B & Phase 8)
import { RAGSearchResult, RAGSourceCitation, RAGContextResult } from './types';
import { resolveResponseLanguage, buildLanguageSystemPrompt } from '../ai/languageDetector';
import { getSetting } from '../database/db';

export interface ContextBuilderOptions {
  maxContextTokens?: number;
  languagePreference?: string;
}

export class ContextBuilder {
  private defaultMaxTokens = 1200;

  /**
   * Builds an augmented prompt and source citations from retrieved local chunks.
   * Tailored for compact context consumption by local Qwen 2.5 3B/GGUF model.
   */
  public buildContext(
    userQuestion: string,
    searchResults: RAGSearchResult[],
    options?: ContextBuilderOptions
  ): RAGContextResult {
    const maxTokens = options?.maxContextTokens || this.defaultMaxTokens;
    const pref = options?.languagePreference || getSetting('response_language') || 'auto';
    const targetLang = resolveResponseLanguage(userQuestion, pref);
    const langPolicy = buildLanguageSystemPrompt(targetLang);

    if (!searchResults || searchResults.length === 0) {
      return {
        augmentedUserPrompt: userQuestion,
        sources: [],
        usedKnowledge: false,
        systemInstruction:
          'You are an offline personal study assistant. If you couldn\'t find relevant information in your imported study materials, note: "No sufficiently relevant material was found in your study documents." and answer helpfully using your general offline knowledge.\n\n' +
          langPolicy
      };
    }

    const sources: RAGSourceCitation[] = [];
    const materialSections: string[] = [];
    let accumulatedTokens = 0;

    for (const res of searchResults) {
      const chunk = res.chunk;
      const citation: RAGSourceCitation = {
        documentId: chunk.documentId,
        filename: chunk.filename,
        chunkIndex: chunk.chunkIndex,
        heading: chunk.heading || null,
        pageNumber: chunk.pageNumber || null,
        similarity: Math.round(res.similarity * 1000) / 1000,
        snippet: chunk.text.length > 180 ? chunk.text.substring(0, 180).trim() + '...' : chunk.text
      };
      sources.push(citation);

      // Page-aware header format: [Source: <filename> · Page <p> | Section: <heading>]
      let header = `[Source: ${chunk.filename}`;
      if (chunk.pageNumber) {
        header += ` · Page ${chunk.pageNumber}`;
      }
      if (chunk.heading) {
        header += ` | Section: ${chunk.heading}`;
      }
      header += ']';

      const sectionText = `${header}\n${chunk.text.trim()}`;

      // Check token budget limit
      if (accumulatedTokens + chunk.tokenEstimate > maxTokens && materialSections.length > 0) {
        break;
      }

      materialSections.push(sectionText);
      accumulatedTokens += chunk.tokenEstimate;
    }

    const combinedMaterials = materialSections.join('\n\n---\n\n');

    const systemInstruction = 
      'You are an offline personal study assistant. Answer the user\'s question using the provided local study materials. ' +
      'Do not invent facts not supported by the material. If the material does not fully cover the question, clearly state what was found.\n\n' +
      langPolicy;

    const augmentedUserPrompt = 
`LOCAL STUDY MATERIAL:
${combinedMaterials}

USER QUESTION:
${userQuestion}

Please provide a clear and direct answer using the local study material above.`;

    return {
      augmentedUserPrompt,
      sources,
      usedKnowledge: true,
      systemInstruction
    };
  }
}

export const defaultContextBuilder = new ContextBuilder();


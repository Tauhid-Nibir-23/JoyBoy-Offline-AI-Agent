// Offline Study AI - RAG Context Builder (Phase 3B, Phase 8 & Phase 9)
import { RAGSearchResult, RAGSourceCitation, RAGContextResult } from './types';
import { resolveResponseLanguage, buildLanguageSystemPrompt } from '../ai/languageDetector';
import { getSetting } from '../database/db';

export interface ContextBuilderOptions {
  maxContextTokens?: number;
  languagePreference?: string;
  hasAttachedDocuments?: boolean;
}

export class ContextBuilder {
  private defaultMaxTokens = 1400;

  /**
   * Builds an augmented prompt and source citations from retrieved local chunks.
   * Enforces Part 15 answer grounding hierarchy and honest disclosure.
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

    const isBengaliOrBanglish = targetLang === 'bn' || targetLang === 'banglish';

    const ungroundedNotice = isBengaliOrBanglish
      ? 'এই informationটা attached material-এ পাইনি। চাইলে আমি general knowledge দিয়ে explain করতে পারি।'
      : 'No sufficiently relevant material was found in your study documents.';

    if (!searchResults || searchResults.length === 0) {
      return {
        augmentedUserPrompt: userQuestion,
        sources: [],
        usedKnowledge: false,
        systemInstruction:
          'You are an offline personal study assistant. If you couldn\'t find relevant information in your imported study materials, note: "No sufficiently relevant material was found in your study documents." (or in Bengali: "এই informationটা attached material-এ পাইনি। চাইলে আমি general knowledge দিয়ে explain করতে পারি.") and answer helpfully using your general offline knowledge.\n\n' +
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
      if (chunk.metadata?.isTable) {
        header += ` | Format: Table`;
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

    const groundingHierarchy = 
      'ANSWER GROUNDING HIERARCHY:\n' +
      '1. Current user instruction\n' +
      '2. Conversation context & active topic\n' +
      '3. Attached study material\n' +
      '4. General model knowledge only when necessary\n\n' +
      `If the attached material does not contain the requested information, state honestly: "${ungroundedNotice}". Do not invent citations or hallucinate content.`;

    const systemInstruction = 
      `You are an offline personal study assistant. Ground your answer on the provided local study material.\n\n${groundingHierarchy}\n\n${langPolicy}`;

    const augmentedUserPrompt = 
`LOCAL STUDY MATERIAL:
${combinedMaterials}

USER QUESTION:
${userQuestion}

Please provide a clear and direct answer grounded on the study material above.`;

    return {
      augmentedUserPrompt,
      sources,
      usedKnowledge: true,
      systemInstruction
    };
  }
}

export const defaultContextBuilder = new ContextBuilder();
export const contextBuilder = defaultContextBuilder;

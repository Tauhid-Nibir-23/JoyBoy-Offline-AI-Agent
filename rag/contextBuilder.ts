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

    // Extract core content keywords from user question to check actual relevance
    // Exclude framing words, meta terms, and general domain/document context words
    const framingStopwords = new Set([
      'what', 'explain', 'bujhao', 'bolo', 'kore', 'this', 'that', 'from', 'with', 'about',
      'concept', 'study', 'material', 'lecture', 'notes', 'simple', 'student', 'friendly',
      'language', 'detail', 'chapter', 'document', 'attached', 'course', 'peripherals', 'interfacing'
    ]);

    const contentKeywords = userQuestion
      .toLowerCase()
      .split(/[\s,.;:!?()[\]{}"']+/)
      .filter((w) => w.length >= 4 && !framingStopwords.has(w));

    // Filter chunks by genuine relevance: either high semantic similarity (>= 0.22)
    // or keyword overlap with queried content terms
    const trulyRelevantResults = (searchResults || []).filter((res) => {
      if (res.similarity >= 0.22) return true;
      if (contentKeywords.length > 0) {
        const textLower = res.chunk.text.toLowerCase();
        const headingLower = (res.chunk.heading || '').toLowerCase();
        const hasKeyword = contentKeywords.some((kw) => textLower.includes(kw) || headingLower.includes(kw));
        if (hasKeyword && res.similarity >= 0.08) return true;
      }
      return false;
    });

    // Extract primary concept name from query if present
    const conceptMatch = userQuestion.match(/(?:e\s+)?([A-Za-z0-9\s-]{3,25}?)\s*(?:ta|ti)?\s*(?:bujhao|explain|bolo|ki|shomporke)/i);
    const conceptName = conceptMatch ? conceptMatch[1].trim() : '';

    const ungroundedNotice = isBengaliOrBanglish
      ? (conceptName 
          ? `এই PDF-এ "${conceptName}" সম্পর্কে relevant information পাইনি। চাইলে আমি general knowledge দিয়ে explain করতে পারি।`
          : 'এই PDF-এ এই টপিক সম্পর্কে relevant information পাইনি। চাইলে আমি general knowledge দিয়ে explain করতে পারি।')
      : (conceptName 
          ? `No sufficiently relevant material on "${conceptName}" was found in your study documents.`
          : 'No sufficiently relevant material was found in your study documents.');

    if (trulyRelevantResults.length === 0) {
      return {
        augmentedUserPrompt: userQuestion,
        sources: [],
        usedKnowledge: false,
        systemInstruction:
          `You are an offline personal study assistant. If you couldn't find relevant information in your imported study materials, note: "${ungroundedNotice}" and answer helpfully using your general offline knowledge without fabricating citations.\n\n` +
          langPolicy
      };
    }

    const sources: RAGSourceCitation[] = [];
    const materialSections: string[] = [];
    let accumulatedTokens = 0;

    for (const res of trulyRelevantResults) {
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

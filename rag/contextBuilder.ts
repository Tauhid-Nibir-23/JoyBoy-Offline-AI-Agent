// Offline Study AI - RAG Context Builder (Phase 3B Part 6 & 9)
import { RAGSearchResult, RAGSourceCitation, RAGContextResult } from './types';

export interface ContextBuilderOptions {
  maxContextTokens?: number;
}

export class ContextBuilder {
  private defaultMaxTokens = 1200;

  /**
   * Builds an augmented prompt and source citations from retrieved local chunks.
   * Tailored for compact context consumption by the local Qwen 2.5 0.5B model.
   */
  public buildContext(
    userQuestion: string,
    searchResults: RAGSearchResult[],
    options?: ContextBuilderOptions
  ): RAGContextResult {
    const maxTokens = options?.maxContextTokens || this.defaultMaxTokens;

    if (!searchResults || searchResults.length === 0) {
      return {
        augmentedUserPrompt: userQuestion,
        sources: [],
        usedKnowledge: false,
        systemInstruction:
        'You are an offline personal study assistant. If you couldn\'t find relevant information in your imported study materials, note: "No sufficiently relevant material was found in your study documents." and answer helpfully using your general offline knowledge.'
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
        similarity: Math.round(res.similarity * 1000) / 1000,
        snippet: chunk.text.length > 180 ? chunk.text.substring(0, 180).trim() + '...' : chunk.text
      };
      sources.push(citation);

      // Compact header format: [Source: <filename> | Section: <heading>]
      const header = chunk.heading
        ? `[Source: ${chunk.filename} | Section: ${chunk.heading}]`
        : `[Source: ${chunk.filename}]`;

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
      'Do not invent facts not supported by the material. If the material does not fully cover the question, clearly state what was found.';

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

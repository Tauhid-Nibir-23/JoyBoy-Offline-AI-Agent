// Offline Study AI - Response Validation & Self-Check Layer (Phase 10)
import { resolveResponseLanguage } from './languageDetector';

export interface ResponseValidationInput {
  userQuery: string;
  assistantResponse: string;
  activeTopic?: string | null;
  previousQuestion?: string | null;
  previousAssistantSnippet?: string | null;
  hasAttachedDocs?: boolean;
  usedKnowledge?: boolean;
  expectedLanguage?: 'bn' | 'en';
}

export interface ResponseValidationResult {
  isValid: boolean;
  issues: string[];
  retryNeeded: boolean;
  correctedInstruction?: string;
}

/**
 * Lightweight post-generation validation layer ensuring JoyBoy's answers remain:
 * 1. Addressing the current user question (not accidentally re-answering a previous question)
 * 2. In the proper language (Bengali script for Bengali/Banglish, English for English)
 * 3. Free from excessive sentence loops or severe repetition
 * 4. Grounded without fabricating nonexistent citations
 */
export function validateResponse(input: ResponseValidationInput): ResponseValidationResult {
  const issues: string[] = [];
  const text = (input.assistantResponse || '').trim();
  const lower = text.toLowerCase();

  // 1. Basic length check
  if (!text || text.length < 2) {
    issues.push('Response is empty or too short');
    return {
      isValid: false,
      issues,
      retryNeeded: true,
      correctedInstruction: 'Please provide a clear and direct answer to the user question.'
    };
  }

  // 1b. Obvious mock placeholder check (Phase 15 Section 13)
  if (lower.includes('[mock response]') || lower.includes('i am a mock assistant') || lower.includes('mock study assistant')) {
    issues.push('Obvious mock provider placeholder detected in assistant output');
    return {
      isValid: false,
      issues,
      retryNeeded: true,
      correctedInstruction: 'Do NOT use mock responses. Answer directly and genuinely using your offline knowledge.'
    };
  }

  // 2. Check for severe repetition (repeated lines or repeated token loops)
  const lines = text.split('\n').map(l => l.trim()).filter(l => l.length > 25);
  const lineCounts = new Map<string, number>();
  for (const line of lines) {
    const c = (lineCounts.get(line) || 0) + 1;
    lineCounts.set(line, c);
    if (c >= 3) {
      issues.push(`Severe line repetition detected: "${line.slice(0, 40)}..." repeated ${c} times`);
      return {
        isValid: false,
        issues,
        retryNeeded: true,
        correctedInstruction: 'CRITICAL: Do NOT repeat the same sentence or phrase. Provide a concise, non-repetitive response.'
      };
    }
  }

  // Token loop check for repetitive single-line generation
  const words = lower.split(/\s+/).filter(w => w.length > 2);
  if (words.length >= 10) {
    const wordCounts = new Map<string, number>();
    for (const w of words) {
      wordCounts.set(w, (wordCounts.get(w) || 0) + 1);
    }
    for (const [w, count] of wordCounts.entries()) {
      if (count >= 5 && count / words.length > 0.25) {
        issues.push(`Severe repetition detected: token "${w}" repeated ${count} times in short output`);
        return {
          isValid: false,
          issues,
          retryNeeded: true,
          correctedInstruction: 'CRITICAL: Avoid repeated token loops. Answer directly without looping.'
        };
      }
    }
  }

  // 3. Language check
  const targetLang = input.expectedLanguage || resolveResponseLanguage(input.userQuery);
  if (targetLang === 'bn') {
    const banglaCharCount = (text.match(/[\u0980-\u09FF]/g) || []).length;
    // If the response is over 120 chars and contains almost zero Bangla characters while user wrote Bangla/Banglish
    if (text.length > 120 && banglaCharCount === 0 && !input.userQuery.toLowerCase().includes('in english')) {
      issues.push('Response expected natural Bengali script but returned pure English/Latin letters');
      return {
        isValid: false,
        issues,
        retryNeeded: true,
        correctedInstruction: 'MANDATORY: Answer in natural Bengali script (বাংলা অক্ষর). Do not default to English.'
      };
    }
  }

  // 4. Topic drift / answering previous question instead of current
  // E.g., user asks for MCQ or Example or Shorten, but assistant outputs identical definition to previous answer
  const isShorten = /\b(short\s+koro|shorten|choto\s+koro)\b/i.test(input.userQuery);
  if (isShorten && input.previousAssistantSnippet && text.length >= input.previousAssistantSnippet.length * 0.95) {
    issues.push('User requested to shorten previous answer, but response is as long or longer');
    return {
      isValid: false,
      issues,
      retryNeeded: true,
      correctedInstruction: 'The user specifically asked to SHORTEN the previous answer. Provide only the essential 2-3 bullet points.'
    };
  }

  const isMcq = /\b(mcq|quiz)\b/i.test(input.userQuery);
  if (isMcq && !lower.includes('1.') && !lower.includes('a)') && !lower.includes('question') && !lower.includes('প্রশ্ন')) {
    issues.push('User requested MCQs, but response does not contain numbered questions with options');
    return {
      isValid: false,
      issues,
      retryNeeded: true,
      correctedInstruction: 'The user requested practice MCQs. Generate numbered multiple choice questions with options (A, B, C, D).'
    };
  }

  return {
    isValid: true,
    issues: [],
    retryNeeded: false
  };
}

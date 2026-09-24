// Offline Study AI - Lightweight Token Estimator (Phase 3B)

/**
 * Calculates a fast, deterministic approximate token count for a text snippet.
 * Models standard BPE tokenization heuristics (~4 chars/token or ~1.3 tokens/word).
 * Clearly labeled as an approximation for chunk sizing and context budgeting.
 */
export function estimateTokenCount(text: string): number {
  if (!text || text.length === 0) return 0;

  // Split on whitespace to get word-like units
  const words = text.trim().split(/\s+/).filter(Boolean);
  const wordCount = words.length;

  // Count code and punctuation symbols that typically form distinct BPE tokens
  const punctuationCount = (text.match(/[{}[\]()<>=;:,./\\!?"'+\-*_@#$%^&|`~]/g) || []).length;

  // Hybrid estimator:
  // Base token estimate from words and punctuation
  const tokenEst = Math.round(wordCount + punctuationCount * 0.5);
  // Character-based estimate (average ~4 chars per token)
  const charBasedEst = Math.ceil(text.length / 4);

  // Return a balanced estimate, minimum 1 token for non-empty string
  return Math.max(1, Math.round((tokenEst + charBasedEst) / 2));
}

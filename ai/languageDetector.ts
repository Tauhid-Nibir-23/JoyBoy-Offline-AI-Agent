// Offline Study AI - Bengali / Banglish Language Intelligence (Phase 8)

export type DetectedLanguage = 'bn' | 'banglish' | 'en' | 'mixed';
export type ResponseLanguage = 'bn' | 'banglish' | 'en';

export const BANGLA_CHAR_REGEX = /[\u0980-\u09FF]/;

/**
 * Common Banglish phonetic tokens, pronouns, and verbs.
 */
export const BANGLISH_PATTERNS: RegExp[] = [
  /\b(ki|kivabe|karon|koro|kore|korte|kora|korbo|korecho|korchen)\b/i,
  /\b(bujhao|bujhte|bujhlam|bujhechi|bujhe|bolte|bolo|bolun|dekhao|dekhun)\b/i,
  /\b(amake|amar|amader|apni|apnar|tumi|tomar|tader|tar)\b/i,
  /\b(eta|eita|sheta|oita|etar|eitar|shetar|oitar)\b/i,
  /\b(theke|shathe|diye|daw|dao|den|dibo|hobe|hoy|ache|nei|nai)\b/i,
  /\b(shob|kichu|kono|kothay|kokhon|keno|kemon|koto|ekta|duita)\b/i,
  /\b(bhalo|kharap|shohoj|shikhte|poro|porbo|porikkha|uttor|prosno|banaw|banao)\b/i
];

export const EXPLICIT_ENGLISH_PATTERNS: RegExp[] = [
  /\b(in\s+english|respond\s+in\s+english|answer\s+in\s+english|write\s+in\s+english|english\s+please)\b/i,
  /(?:ইংলিশ|ইংরেজিতে|ইংরেজীতে|english\s*version)/i
];

export const EXPLICIT_BANGLA_PATTERNS: RegExp[] = [
  /\b(in\s+bangla|in\s+bengali|answer\s+in\s+bangla|respond\s+in\s+bangla|bangla\s+te|banglay)\b/i,
  /(?:বাংলায়|বাংলায়|বাংলা\s*ভাষায়|বাংলা\s*ভাষায়|সহজ\s*করে\s*বাংলায়)/i
];

/**
 * Detect language of input text:
 * - 'bn': Text contains Bengali unicode characters.
 * - 'banglish': Latin-alphabet text containing Bengali phonetic tokens/phrases.
 * - 'en': Pure English text.
 * - 'mixed': Mixture of script/tokens.
 */
export function detectLanguage(text: string): DetectedLanguage {
  if (!text || typeof text !== 'string') return 'en';
  const trimmed = text.trim();
  if (!trimmed) return 'en';

  const banglaCharCount = (trimmed.match(/[\u0980-\u09FF]/g) || []).length;
  const totalLetters = (trimmed.match(/[a-zA-Z\u0980-\u09FF]/g) || []).length;

  if (banglaCharCount > 0) {
    if (banglaCharCount / Math.max(1, totalLetters) > 0.15) {
      return 'bn';
    }
    return 'mixed';
  }

  // Count Banglish keyword matches
  let banglishMatchCount = 0;
  for (const pattern of BANGLISH_PATTERNS) {
    if (pattern.test(trimmed)) {
      banglishMatchCount++;
    }
  }

  // Short queries with at least 1 match or longer queries with 2+ matches
  const wordCount = trimmed.split(/\s+/).length;
  if (banglishMatchCount >= 2 || (wordCount <= 6 && banglishMatchCount >= 1)) {
    return 'banglish';
  }

  return 'en';
}

/**
 * Resolves the target response language based on user prompt and configured preference.
 * Priority:
 * 1. Explicit user prompt request ("in English", "বাংলায় বলুন", etc.)
 * 2. User preference in Settings (if not 'auto')
 * 3. Detected language of the latest user message
 */
export function resolveResponseLanguage(
  userPrompt: string,
  settingPreference: string = 'auto'
): ResponseLanguage {
  const text = (userPrompt || '').trim();

  // 1. Check explicit overrides in prompt
  for (const pat of EXPLICIT_ENGLISH_PATTERNS) {
    if (pat.test(text)) {
      return 'en';
    }
  }

  for (const pat of EXPLICIT_BANGLA_PATTERNS) {
    if (pat.test(text)) {
      return 'bn';
    }
  }

  // 2. Check setting preference if explicit override not found
  const normPref = (settingPreference || 'auto').toLowerCase();
  if (normPref === 'bn' || normPref === 'bangla' || normPref === 'বাংলা') {
    return 'bn';
  }
  if (normPref === 'en' || normPref === 'english') {
    return 'en';
  }

  // 3. Fallback to automated detection
  const detected = detectLanguage(text);
  if (detected === 'bn' || detected === 'mixed') {
    return 'bn';
  }
  if (detected === 'banglish') {
    return 'banglish';
  }

  return 'en';
}

/**
 * Builds the system-level language policy instruction according to Phase 8 specifications.
 */
export function buildLanguageSystemPrompt(targetLang: ResponseLanguage): string {
  if (targetLang === 'bn') {
    return `LANGUAGE POLICY (MANDATORY):
- The user asked in Bengali (বাংলা). You MUST answer in natural, fluent Bengali (বাংলা).
- Do NOT answer in English merely because the study document is in English.
- The response language is determined by the user, not by the document language.
- Standard computer science and academic technical terms (such as CPU, RAM, Process, Deadlock, Scheduling, Memory, Database, Thread, Kernel, Algorithm, Cache) may remain in English for clarity.
- Do NOT translate the user's question into English before answering; respond directly in Bengali.`;
  }

  if (targetLang === 'banglish') {
    return `LANGUAGE POLICY (MANDATORY):
- The user asked in Banglish (Bengali written in English letters).
- You MUST answer in natural, clear Bengali (বাংলা) or fluent Banglish that directly and warmly answers the question.
- Standard computer science and academic technical terms (such as CPU, RAM, Process, Deadlock, Scheduling, Memory, Database) should remain in English for clarity.
- The response language is determined by the user, not by the document language.
- Do not produce an English-only response unless explicitly requested.`;
  }

  return `LANGUAGE POLICY (MANDATORY):
- The user asked in English. Respond in clear, educational, and structured English.
- Maintain an honest, accurate study assistant tone.`;
}

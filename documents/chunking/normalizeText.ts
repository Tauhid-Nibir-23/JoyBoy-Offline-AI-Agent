// Offline Study AI - Text Normalization Pipeline (Phase 3B)

/**
 * Normalizes extracted document text safely without rewriting content.
 * Preserves headings, lists, code formatting, and paragraph structure.
 */
export function normalizeDocumentText(rawText: string): string {
  if (!rawText) return '';

  let text = rawText;

  // 1. Remove null bytes and unprintable control characters (except tab \t, newline \n)
  text = text.replace(/[\x00\x08\x0B\x0C\x0E-\x1F\x7F]/g, '');

  // 2. Standardize CRLF and CR to LF
  text = text.replace(/\r\n/g, '\n').replace(/\r/g, '\n');

  // 3. Convert non-breaking spaces and zero-width spaces to standard spaces
  text = text.replace(/[\u00A0\u1680\u2000-\u200A\u202F\u205F\u3000]/g, ' ');
  text = text.replace(/[\u200B-\u200D\uFEFF]/g, '');

  // 4. Clean trailing whitespace on individual lines while preserving indentation (code / lists)
  const lines = text.split('\n').map(line => line.replace(/[ \t]+$/, ''));
  text = lines.join('\n');

  // 5. Collapse excessive blank lines (3 or more newlines become 2 newlines to preserve paragraphs)
  text = text.replace(/\n{3,}/g, '\n\n');

  // 6. Trim overall document leading and trailing whitespace
  return text.trim();
}

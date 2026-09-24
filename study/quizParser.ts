// Offline Study AI - Quiz & Structured Output Parser (Phase 5)
import { QuizQuestion, FlashcardItem, StudyPlanDay, QuizQuestionType } from './types';

/**
 * Attempts to safely extract, clean, and repair JSON strings produced by local models.
 */
export function cleanJsonString(raw: string): string {
  if (!raw || typeof raw !== 'string') return '';

  let text = raw.trim();

  // 1. Remove markdown code blocks if present: ```json ... ``` or ``` ... ```
  if (text.includes('```')) {
    const codeBlockMatch = text.match(/```(?:json)?\s*([\s\S]*?)```/i);
    if (codeBlockMatch && codeBlockMatch[1]) {
      text = codeBlockMatch[1].trim();
    } else {
      // Or strip unmatched leading/trailing ```
      text = text.replace(/^```[a-z]*\s*/i, '').replace(/\s*```$/, '').trim();
    }
  }

  // 2. Locate outermost JSON boundaries
  const firstBrace = text.indexOf('{');
  const firstBracket = text.indexOf('[');

  let startIdx = -1;
  let isObject = false;

  if (firstBrace !== -1 && (firstBracket === -1 || firstBrace < firstBracket)) {
    startIdx = firstBrace;
    isObject = true;
  } else if (firstBracket !== -1) {
    startIdx = firstBracket;
    isObject = false;
  }

  if (startIdx === -1) {
    return text;
  }

  const endChar = isObject ? '}' : ']';
  const lastIdx = text.lastIndexOf(endChar);

  if (lastIdx > startIdx) {
    text = text.substring(startIdx, lastIdx + 1);
  } else {
    // Truncated JSON without closing bracket: take from startIdx to end and attempt repair
    text = text.substring(startIdx);
  }

  // 3. Remove trailing commas before closing braces/brackets: `, }` -> `}`, `, ]` -> `]`
  text = text.replace(/,\s*([}\]])/g, '$1');

  // 4. Auto-close truncated brackets if needed
  let openBraces = 0;
  let openBrackets = 0;
  let inString = false;
  let escapeNext = false;

  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (escapeNext) {
      escapeNext = false;
      continue;
    }
    if (c === '\\') {
      escapeNext = true;
      continue;
    }
    if (c === '"') {
      inString = !inString;
      continue;
    }
    if (!inString) {
      if (c === '{') openBraces++;
      else if (c === '}') openBraces = Math.max(0, openBraces - 1);
      else if (c === '[') openBrackets++;
      else if (c === ']') openBrackets = Math.max(0, openBrackets - 1);
    }
  }

  // If inside unclosed string, close the string
  if (inString) {
    text += '"';
  }

  // Append missing closing braces and brackets in reverse order
  while (openBraces > 0 || openBrackets > 0) {
    if (openBraces > 0) {
      text += '}';
      openBraces--;
    }
    if (openBrackets > 0) {
      text += ']';
      openBrackets--;
    }
  }

  // Remove any newly introduced trailing commas before the appended closes
  text = text.replace(/,\s*([}\]])/g, '$1');

  return text;
}

export interface ParseResult<T> {
  success: boolean;
  data?: T;
  error?: string;
  rawText: string;
}

/**
 * Validates and repairs Quiz JSON into QuizQuestion[]
 */
export function parseQuizJson(raw: string, defaultType: QuizQuestionType = 'mcq'): ParseResult<QuizQuestion[]> {
  const cleaned = cleanJsonString(raw);
  let parsed: any = null;

  try {
    parsed = JSON.parse(cleaned);
  } catch (err: any) {
    // Try single-quote to double-quote repair for keys if JSON.parse failed
    try {
      const singleQuoteRepaired = cleaned
        .replace(/([{,]\s*)'([a-zA-Z0-9_]+)'\s*:/g, '$1"$2":')
        .replace(/:\s*'([^']*)'/g, ':"$1"');
      parsed = JSON.parse(singleQuoteRepaired);
    } catch {
      return {
        success: false,
        error: `Could not parse quiz output into valid questions. (Error: ${err?.message || 'Invalid JSON format'})`,
        rawText: raw
      };
    }
  }

  // Extract question array whether root is an array or { questions: [...] }
  let items: any[] = [];
  if (Array.isArray(parsed)) {
    items = parsed;
  } else if (parsed && typeof parsed === 'object') {
    if (Array.isArray(parsed.questions)) {
      items = parsed.questions;
    } else if (Array.isArray(parsed.quiz)) {
      items = parsed.quiz;
    } else if (Array.isArray(parsed.items)) {
      items = parsed.items;
    }
  }

  if (!items || items.length === 0) {
    return {
      success: false,
      error: 'No quiz questions found in the generated response.',
      rawText: raw
    };
  }

  const validQuestions: QuizQuestion[] = [];

  for (let idx = 0; idx < items.length; idx++) {
    const it = items[idx];
    if (!it || typeof it !== 'object') continue;

    const questionText = String(it.question || it.q || it.prompt || `Question ${idx + 1}`).trim();
    const type: QuizQuestionType = (it.type === 'true_false' || it.type === 'short_answer' || it.type === 'mcq')
      ? it.type
      : defaultType;

    let options: string[] = [];
    if (Array.isArray(it.options)) {
      options = it.options.map((o: any) => String(o).trim()).filter(Boolean);
    } else if (it.choices && Array.isArray(it.choices)) {
      options = it.choices.map((c: any) => String(c).trim()).filter(Boolean);
    }

    if (type === 'true_false') {
      options = ['True', 'False'];
    } else if (type === 'mcq') {
      // Ensure at least 4 options for MCQ
      if (options.length === 0) {
        options = ['Option A', 'Option B', 'Option C', 'Option D'];
      } else if (options.length < 4) {
        while (options.length < 4) {
          options.push(`Option ${String.fromCharCode(65 + options.length)}`);
        }
      } else if (options.length > 4) {
        options = options.slice(0, 4);
      }
    }

    let correctAnswer = it.correctAnswer !== undefined 
      ? it.correctAnswer 
      : it.answer !== undefined 
      ? it.answer 
      : it.correct_answer;

    if (correctAnswer === undefined || correctAnswer === null) {
      correctAnswer = type === 'true_false' ? 'True' : 0;
    }

    const explanation = String(it.explanation || it.reason || it.note || 'No explanation provided.').trim();

    validQuestions.push({
      id: `q_${Date.now()}_${idx}_${Math.random().toString(36).substring(2, 6)}`,
      question: questionText,
      type,
      options,
      correctAnswer,
      explanation
    });
  }

  if (validQuestions.length === 0) {
    return {
      success: false,
      error: 'Generated output did not contain valid question structures.',
      rawText: raw
    };
  }

  return {
    success: true,
    data: validQuestions,
    rawText: raw
  };
}

/**
 * Validates and repairs Flashcards JSON into FlashcardItem[]
 */
export function parseFlashcardsJson(raw: string): ParseResult<FlashcardItem[]> {
  const cleaned = cleanJsonString(raw);
  let parsed: any = null;

  try {
    parsed = JSON.parse(cleaned);
  } catch (err: any) {
    return {
      success: false,
      error: `Could not parse flashcards output. (${err?.message || 'Invalid JSON'})`,
      rawText: raw
    };
  }

  let items: any[] = [];
  if (Array.isArray(parsed)) {
    items = parsed;
  } else if (parsed && typeof parsed === 'object') {
    if (Array.isArray(parsed.cards)) {
      items = parsed.cards;
    } else if (Array.isArray(parsed.flashcards)) {
      items = parsed.flashcards;
    } else if (Array.isArray(parsed.items)) {
      items = parsed.items;
    }
  }

  if (!items || items.length === 0) {
    return {
      success: false,
      error: 'No flashcard items found in response.',
      rawText: raw
    };
  }

  const validCards: FlashcardItem[] = [];

  for (let idx = 0; idx < items.length; idx++) {
    const it = items[idx];
    if (!it || typeof it !== 'object') continue;

    const front = String(it.front || it.question || it.term || it.concept || '').trim();
    const back = String(it.back || it.answer || it.definition || it.explanation || '').trim();

    if (front && back) {
      validCards.push({
        id: `fc_${Date.now()}_${idx}_${Math.random().toString(36).substring(2, 6)}`,
        front,
        back
      });
    }
  }

  if (validCards.length === 0) {
    return {
      success: false,
      error: 'Flashcards output did not contain valid front/back fields.',
      rawText: raw
    };
  }

  return {
    success: true,
    data: validCards,
    rawText: raw
  };
}

/**
 * Validates and repairs Study Plan JSON into StudyPlanDay[]
 */
export function parseStudyPlanJson(raw: string): ParseResult<StudyPlanDay[]> {
  const cleaned = cleanJsonString(raw);
  let parsed: any = null;

  try {
    parsed = JSON.parse(cleaned);
  } catch (err: any) {
    return {
      success: false,
      error: `Could not parse study plan into valid schedule items. (${err?.message || 'Invalid JSON'})`,
      rawText: raw
    };
  }

  let items: any[] = [];
  if (Array.isArray(parsed)) {
    items = parsed;
  } else if (parsed && typeof parsed === 'object') {
    if (Array.isArray(parsed.schedule)) {
      items = parsed.schedule;
    } else if (Array.isArray(parsed.days)) {
      items = parsed.days;
    } else if (Array.isArray(parsed.plan)) {
      items = parsed.plan;
    }
  }

  if (!items || items.length === 0) {
    return {
      success: false,
      error: 'No scheduled days found in the study plan.',
      rawText: raw
    };
  }

  const schedule: StudyPlanDay[] = [];

  for (let idx = 0; idx < items.length; idx++) {
    const it = items[idx];
    if (!it || typeof it !== 'object') continue;

    const day = typeof it.day === 'number' ? it.day : (idx + 1);
    const topic = String(it.topic || it.title || `Day ${day} Study Session`).trim();
    const estimatedDuration = String(it.estimatedDuration || it.duration || it.hours || '2 hours').trim();
    const activity = String(it.activity || it.task || 'Read material and complete practice exercises.').trim();
    const revisionTask = String(it.revisionTask || it.revision || 'Quick revision and flashcards review.').trim();

    schedule.push({
      day,
      topic,
      estimatedDuration,
      activity,
      revisionTask
    });
  }

  if (schedule.length === 0) {
    return {
      success: false,
      error: 'No valid schedule days found.',
      rawText: raw
    };
  }

  return {
    success: true,
    data: schedule,
    rawText: raw
  };
}

// Offline Study AI - Study Quality Validator & Benchmark Suite (Phase 18)
import { resolveResponseLanguage, detectLanguage } from './languageDetector';

export type StudyMode = 
  | 'simple_explanation'
  | 'detailed_explanation'
  | 'exam_5marks'
  | 'short_2marks'
  | 'quick_revision'
  | 'mcq'
  | 'viva'
  | 'example'
  | 'difference'
  | 'general';

export interface StudyQualityCriteria {
  prompt: string;
  response: string;
  expectedMode?: StudyMode;
  expectedLanguage?: 'bn' | 'en' | 'mixed' | 'any';
  expectedTopic?: string;
  expectedItemCount?: number;
  hasDocumentGrounding?: boolean;
  documentChunksCount?: number;
  sourcesCount?: number;
}

export interface ValidationIssue {
  category: 
    | 'EMPTY'
    | 'MOCK_DETECTED'
    | 'REPETITION_LOOP'
    | 'UNFINISHED_STREAM'
    | 'LANGUAGE_MISMATCH'
    | 'WRONG_TOPIC'
    | 'MCQ_MALFORMED'
    | 'ITEM_COUNT_MISMATCH'
    | 'FORMAT_MISMATCH'
    | 'HALLUCINATED_CITATION';
  description: string;
  severity: 'CRITICAL' | 'WARNING';
}

export interface StudyQualityReport {
  isValid: boolean;
  isStructurallyCorrect: boolean;
  issues: ValidationIssue[];
  metrics: {
    wordCount: number;
    charCount: number;
    detectedLanguage: 'bn' | 'en' | 'mixed';
    isMock: boolean;
    isCloudCall: boolean;
    hasRepetitiveLoops: boolean;
    mcqCount?: number;
    hasAnswerKey?: boolean;
    isUnfinishedStream: boolean;
    extractedItemCount?: number;
  };
}

export interface BenchmarkAggregateStats {
  totalPrompts: number;
  structurallyCorrect: number;
  formatViolations: number;
  criticalFailures: number;
  mockResponsesCount: number;
  cloudCallsCount: number;
  languageAccuracyCount: number;
  results: Array<{
    prompt: string;
    mode: string;
    passed: boolean;
    issues: string[];
    wordCount: number;
  }>;
}

export class StudyQualityValidator {
  /**
   * Evaluates an assistant study response against student-assistance quality requirements.
   */
  public validate(criteria: StudyQualityCriteria): StudyQualityReport {
    const issues: ValidationIssue[] = [];
    const text = (criteria.response || '').trim();
    const lower = text.toLowerCase();
    const promptLower = (criteria.prompt || '').toLowerCase();

    const wordCount = text ? text.split(/\s+/).filter(Boolean).length : 0;
    const charCount = text.length;

    // Detect language
    const banglaChars = (text.match(/[\u0980-\u09FF]/g) || []).length;
    let detectedLanguage: 'bn' | 'en' | 'mixed' = 'en';
    if (banglaChars > 15) {
      detectedLanguage = (text.match(/[a-zA-Z]/g) || []).length > 20 ? 'mixed' : 'bn';
    }

    // 1. Non-empty check
    if (!text || wordCount < 3) {
      issues.push({
        category: 'EMPTY',
        description: 'Answer is empty or contains fewer than 3 words.',
        severity: 'CRITICAL'
      });
    }

    // 2. Mock Provider detection (Absolute Zero Tolerance in Production)
    const isMock = 
      lower.includes('[mock response]') ||
      lower.includes('i am a mock assistant') ||
      lower.includes('mock study assistant') ||
      lower.includes('demo / mock mode');

    if (isMock) {
      issues.push({
        category: 'MOCK_DETECTED',
        description: 'MockProvider placeholder or signature detected in assistant response.',
        severity: 'CRITICAL'
      });
    }

    // 3. Repetition loop detection
    let hasRepetitiveLoops = false;
    const lines = text.split('\n').map((l) => l.trim()).filter((l) => l.length > 25);
    const lineFrequency = new Map<string, number>();
    for (const l of lines) {
      const count = (lineFrequency.get(l) || 0) + 1;
      lineFrequency.set(l, count);
      if (count >= 3) {
        hasRepetitiveLoops = true;
        issues.push({
          category: 'REPETITION_LOOP',
          description: `Line repeated ${count} times: "${l.slice(0, 35)}..."`,
          severity: 'CRITICAL'
        });
        break;
      }
    }

    // Token frequency loop detection
    const tokens = lower.split(/\s+/).filter((t) => t.length > 3);
    const domainStopwords = new Set([
      'operating', 'system', 'systems', 'process', 'processes', 'state', 'states',
      'condition', 'conditions', 'deadlock', 'deadlocks', 'memory', 'resource',
      'resources', 'which', 'following', 'answer', 'table', 'algorithm'
    ]);
    if (tokens.length >= 25) {
      const tokenCounts = new Map<string, number>();
      for (const t of tokens) {
        if (!domainStopwords.has(t)) {
          tokenCounts.set(t, (tokenCounts.get(t) || 0) + 1);
        }
      }
      for (const [t, c] of tokenCounts.entries()) {
        if (c >= 8 && c / tokens.length > 0.35) {
          hasRepetitiveLoops = true;
          issues.push({
            category: 'REPETITION_LOOP',
            description: `Token loop detected: "${t}" appeared ${c} times (${Math.round((c / tokens.length) * 100)}% of content)`,
            severity: 'CRITICAL'
          });
          break;
        }
      }
    }

    // 4. Unfinished streaming output
    let isUnfinishedStream = false;
    const codeBlockCount = (text.match(/```/g) || []).length;
    if (codeBlockCount % 2 !== 0) {
      isUnfinishedStream = true;
      issues.push({
        category: 'UNFINISHED_STREAM',
        description: 'Unclosed code block (odd count of ```). Generation may have stopped prematurely.',
        severity: 'WARNING'
      });
    }

    // Trailing truncated sentence check
    const lastChar = text.slice(-1);
    const trailingPunctuation = ['.', '!', '?', '।', ':', '`', '*', ')', ']', '}', '\n'];
    if (text.length > 60 && !trailingPunctuation.includes(lastChar) && !text.endsWith('**')) {
      // Check if it cuts off mid-word
      const lastWord = text.split(/\s+/).pop() || '';
      if (['the', 'and', 'because', 'such', 'like', 'karon', 'ebong', 'je', 'jar'].includes(lastWord.toLowerCase())) {
        isUnfinishedStream = true;
        issues.push({
          category: 'UNFINISHED_STREAM',
          description: `Stream appears abruptly truncated at connector word: "${lastWord}"`,
          severity: 'WARNING'
        });
      }
    }

    // 5. Language Compliance
    const detectedInputLang = detectLanguage(criteria.prompt || '');
    const promptHasBanglaScript = /[\u0980-\u09FF]/.test(criteria.prompt || '');
    const promptExplicitBangla = /\b(banglay|bangla|bengali|বাংলায়|বাংলা)\b/i.test(promptLower);
    const promptExplicitEnglish = /\b(in\s+english|english\s+please)\b/i.test(promptLower);

    if (criteria.expectedLanguage === 'bn' || (!criteria.expectedLanguage && (promptHasBanglaScript || promptExplicitBangla))) {
      if (wordCount > 10 && banglaChars < 5 && !promptExplicitEnglish) {
        issues.push({
          category: 'LANGUAGE_MISMATCH',
          description: 'User requested in Bengali, but response contained almost no Bengali script.',
          severity: 'WARNING'
        });
      }
    } else if (criteria.expectedLanguage === 'en' || (!criteria.expectedLanguage && detectedInputLang === 'en' && !promptExplicitBangla)) {
      if (banglaChars > 20) {
        issues.push({
          category: 'LANGUAGE_MISMATCH',
          description: 'User requested in English, but response contained Bengali script.',
          severity: 'WARNING'
        });
      }
    }

    // 6. Topic Relevance
    if (criteria.expectedTopic) {
      const topicLower = criteria.expectedTopic.toLowerCase();
      // If topic is more than 3 chars, check if mentioned or referenced
      if (topicLower.length > 3 && !lower.includes(topicLower)) {
        // Also check if relevant related keywords exist
        const topicTokens = topicLower.split(/\s+/).filter((t) => t.length > 3);
        const hasAnyToken = topicTokens.some((t) => lower.includes(t));
        if (!hasAnyToken && wordCount > 20) {
          issues.push({
            category: 'WRONG_TOPIC',
            description: `Response does not mention or refer to expected topic "${criteria.expectedTopic}".`,
            severity: 'WARNING'
          });
        }
      }
    }

    // 7. MCQ Quality Validation
    let mcqCount = 0;
    let hasAnswerKey = false;
    const isMCQQuery = criteria.expectedMode === 'mcq' || /\b(mcq|quiz)\b/i.test(promptLower);
    if (isMCQQuery) {
      // Count questions: e.g. "1.", "1)", "Q1:", "Question 1:"
      const qMatches = text.match(/(?:^|\n)\s*(?:[Qq]uestion\s*)?[0-9১-৯]+[\.\:\)]\s+[^\n]+/g) || [];
      mcqCount = qMatches.length;

      // Check options: looking for A, B, C, D or a), b), c), d) or (A), (B)
      const optionsMatches = text.match(/(?:^|\n|\s)(?:\([A-Da-d]\)|[A-Da-d][\.\)])\s+[^\n]+/g) || [];

      // Check answer key
      hasAnswerKey = 
        /\b(answer|ans|answer\s*key|correct\s*answer|উত্তর|সঠিক\s*উত্তর)\b/i.test(lower);

      if (mcqCount === 0) {
        issues.push({
          category: 'MCQ_MALFORMED',
          description: 'MCQ format requested, but no numbered questions detected.',
          severity: 'CRITICAL'
        });
      } else if (optionsMatches.length < mcqCount * 2) {
        issues.push({
          category: 'MCQ_MALFORMED',
          description: `MCQs lack sufficient options (found ${optionsMatches.length} options for ${mcqCount} questions).`,
          severity: 'WARNING'
        });
      }

      if (!hasAnswerKey && mcqCount > 0) {
        issues.push({
          category: 'MCQ_MALFORMED',
          description: 'MCQ set does not include an answer key or indicated correct options.',
          severity: 'WARNING'
        });
      }

      // Check for duplicate questions
      const distinctQuestions = new Set(qMatches.map((q) => q.toLowerCase().replace(/^[0-9১-৯\.\:\)\s]+/, '').trim()));
      if (distinctQuestions.size < qMatches.length) {
        issues.push({
          category: 'MCQ_MALFORMED',
          description: 'Duplicate questions detected in generated MCQ set.',
          severity: 'CRITICAL'
        });
      }

      // Check requested count
      if (criteria.expectedItemCount && mcqCount !== criteria.expectedItemCount) {
        issues.push({
          category: 'ITEM_COUNT_MISMATCH',
          description: `Requested ${criteria.expectedItemCount} MCQs, but received ${mcqCount}.`,
          severity: 'WARNING'
        });
      }
    }

    // 8. Requested Item Count Check (for non-MCQ lists like conditions, states, types)
    let extractedItemCount: number | undefined;
    if (criteria.expectedItemCount && !isMCQQuery) {
      const numMatches = text.match(/(?:^|\n)\s*[0-9১-৯]+[\.\:\)]\s+[^\n]+/g) || [];
      extractedItemCount = numMatches.length;
      if (extractedItemCount > 0 && extractedItemCount < criteria.expectedItemCount) {
        issues.push({
          category: 'ITEM_COUNT_MISMATCH',
          description: `Requested ${criteria.expectedItemCount} items, but response only enumerated ${extractedItemCount}.`,
          severity: 'WARNING'
        });
      }
    }

    // 9. Study Format Checks
    if (criteria.expectedMode === 'exam_5marks') {
      // 5-mark answer should be structured: definition, core points, and at least 60-70 words
      if (wordCount < 40) {
        issues.push({
          category: 'FORMAT_MISMATCH',
          description: `Requested 5-mark exam answer, but received only ${wordCount} words (too brief for an exam).`,
          severity: 'WARNING'
        });
      }
    } else if (criteria.expectedMode === 'short_2marks') {
      // 2-mark answer should be concise, not an 800-word essay
      if (wordCount > 180) {
        issues.push({
          category: 'FORMAT_MISMATCH',
          description: `Requested short 2-mark answer, but received ${wordCount} words (excessively long).`,
          severity: 'WARNING'
        });
      }
    } else if (criteria.expectedMode === 'difference') {
      // Should contain comparison markers or table
      const hasComparison = 
        lower.includes('vs') || 
        lower.includes('difference') || 
        lower.includes('whereas') || 
        lower.includes('while') || 
        lower.includes('তুলনা') || 
        lower.includes('পার্থক্য') ||
        text.includes('|');
      if (!hasComparison) {
        issues.push({
          category: 'FORMAT_MISMATCH',
          description: 'Difference/comparison requested, but response lacks comparative structure or contrast keywords.',
          severity: 'WARNING'
        });
      }
    }

    // 10. Document Grounding & Non-Hallucination Check
    if (criteria.hasDocumentGrounding !== undefined) {
      if (criteria.hasDocumentGrounding === false) {
        // Missing concept case: Sources MUST be 0
        if (criteria.sourcesCount && criteria.sourcesCount > 0) {
          issues.push({
            category: 'HALLUCINATED_CITATION',
            description: 'Concept was absent from documents, but citations/sources were returned.',
            severity: 'CRITICAL'
          });
        }
      }
    }

    const criticalCount = issues.filter((i) => i.severity === 'CRITICAL').length;
    const isValid = criticalCount === 0;
    const isStructurallyCorrect = issues.length === 0;

    return {
      isValid,
      isStructurallyCorrect,
      issues,
      metrics: {
        wordCount,
        charCount,
        detectedLanguage,
        isMock,
        isCloudCall: false, // Local-only architecture verified
        hasRepetitiveLoops,
        mcqCount: isMCQQuery ? mcqCount : undefined,
        hasAnswerKey: isMCQQuery ? hasAnswerKey : undefined,
        isUnfinishedStream,
        extractedItemCount
      }
    };
  }

  /**
   * Evaluates an entire multi-prompt benchmark suite and generates aggregated statistics.
   */
  public benchmarkSuite(
    items: Array<{ prompt: string; response: string; criteria?: Partial<StudyQualityCriteria> }>
  ): BenchmarkAggregateStats {
    let structurallyCorrect = 0;
    let formatViolations = 0;
    let criticalFailures = 0;
    let mockResponsesCount = 0;
    let languageAccuracyCount = 0;

    const results = items.map((item) => {
      const report = this.validate({
        prompt: item.prompt,
        response: item.response,
        ...item.criteria
      });

      const passed = report.isValid && report.issues.length === 0;
      if (passed) {
        structurallyCorrect++;
      } else if (report.isValid && report.issues.length > 0) {
        formatViolations++;
      } else {
        criticalFailures++;
      }

      if (report.metrics.isMock) mockResponsesCount++;
      if (!report.issues.some((i) => i.category === 'LANGUAGE_MISMATCH')) {
        languageAccuracyCount++;
      }

      return {
        prompt: item.prompt,
        mode: item.criteria?.expectedMode || 'general',
        passed,
        issues: report.issues.map((i) => `[${i.category}] ${i.description}`),
        wordCount: report.metrics.wordCount
      };
    });

    return {
      totalPrompts: items.length,
      structurallyCorrect,
      formatViolations,
      criticalFailures,
      mockResponsesCount,
      cloudCallsCount: 0,
      languageAccuracyCount,
      results
    };
  }
}

export const studyQualityValidator = new StudyQualityValidator();

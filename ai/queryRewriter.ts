// Offline Study AI - Smart Query Rewriter (Phase 9)
import { conversationMemory, ConversationMemoryState } from './conversationMemory';
import { ChatMessage } from './provider';

export type QueryIntent = 
  | 'example'
  | 'clarify_simple'
  | 'generate_mcq'
  | 'question_reference'
  | 'shorten_answer'
  | 'exam_topics'
  | 'page_reference'
  | 'general_followup'
  | 'standalone';

export interface RewrittenQueryResult {
  originalQuery: string;
  resolvedQuery: string;
  rewrittenQuery: string;
  wasRewritten: boolean;
  isRewritten: boolean;
  intent: QueryIntent;
  targetAction?: string;
  referencedTopic?: string | null;
  targetPage?: number | null;
  targetQuestionNumber?: number | null;
}

export class QueryRewriter {
  /**
   * Evaluates the user query against the conversation's active memory and history.
   * If the query is anaphoric or a follow-up ("eta", "oita", "example daw", "make it easier",
   * "question 5 explain koro", "ager answer ta short koro"), resolves it into a complete,
   * context-aware internal retrieval query.
   * 
   * CRITICAL: The rewritten query is internal only and used for RAG/context construction.
   */
  public rewriteQuery(
    firstArg: string,
    secondArg?: string | ConversationMemoryState,
    history: ChatMessage[] = []
  ): RewrittenQueryResult {
    let conversationId: string;
    let rawQuery: string;
    let memory: ConversationMemoryState;

    if (typeof secondArg === 'object' && secondArg !== null) {
      rawQuery = firstArg;
      memory = secondArg;
      conversationId = memory.conversationId || 'default';
    } else if (typeof secondArg === 'string') {
      conversationId = firstArg;
      rawQuery = secondArg;
      memory = conversationMemory.getMemory(conversationId);
    } else {
      conversationId = 'default';
      rawQuery = firstArg;
      memory = conversationMemory.getMemory(conversationId);
    }

    const mapResult = (
      resolvedQuery: string,
      wasRewritten: boolean,
      intent: QueryIntent,
      extra?: Partial<RewrittenQueryResult>
    ): RewrittenQueryResult => {
      let targetAction: string = intent;
      if (intent === 'clarify_simple') targetAction = 'simplify';
      else if (intent === 'generate_mcq') targetAction = 'mcq';
      else if (intent === 'shorten_answer') targetAction = 'shorten';

      return {
        originalQuery: rawQuery,
        resolvedQuery,
        rewrittenQuery: resolvedQuery,
        wasRewritten,
        isRewritten: wasRewritten,
        intent,
        targetAction,
        referencedTopic: memory.activeTopic,
        ...extra
      };
    };

    const trimmed = rawQuery.trim();
    if (!trimmed) {
      return mapResult(rawQuery, false, 'standalone');
    }

    const lower = trimmed.toLowerCase();

    // 1. Detect Question Number reference: e.g. "question 5 explain koro", "question 5 ta explain koro", "৫ নম্বর প্রশ্নটা বুঝিয়ে বলো"
    const qNumMatch = lower.match(/(?:question|prosno|প্রশ্ন|ques|q)\s*([0-9১-৯]+)/i) ||
      trimmed.match(/([0-9১-৯]+)\s*(?:no|nombor|number|nong|নম্বর)\s*(?:prosno|question|প্রশ্ন)/i);

    if (qNumMatch) {
      const bengaliNumerals: Record<string, number> = {
        '১': 1, '২': 2, '৩': 3, '৪': 4, '৫': 5,
        '৬': 6, '৭': 7, '৮': 8, '৯': 9, '১০': 10
      };
      let qNum = parseInt(qNumMatch[1], 10);
      if (isNaN(qNum) && bengaliNumerals[qNumMatch[1]]) {
        qNum = bengaliNumerals[qNumMatch[1]];
      }

      if (!isNaN(qNum)) {
        const questionText = conversationMemory.resolveReferencedQuestion(conversationId, qNum);
        const topicPart = memory.activeTopic ? ` regarding ${memory.activeTopic}` : '';
        const resolved = questionText 
          ? `Explain Question ${qNum}: "${questionText}"${topicPart}`
          : `Explain Question ${qNum}${topicPart} from the practice quiz/assessment`;

        return mapResult(resolved, true, 'question_reference', {
          targetQuestionNumber: qNum
        });
      }
    }

    // 2. Detect Page number reference: e.g. "Page 12 e ki bola hoise?", "page 12 ta bujhao", "page 5"
    const pageMatch = lower.match(/\bpage\s*([0-9]+)\b/i) || trimmed.match(/পৃষ্ঠা\s*([০-৯0-9]+)/i);
    if (pageMatch) {
      const pageNum = parseInt(pageMatch[1], 10);
      if (!isNaN(pageNum)) {
        const docRef = memory.recentDocReferences[0] || 'attached document';
        return mapResult(`Content and key concepts from Page ${pageNum} of ${docRef}`, true, 'page_reference', {
          targetPage: pageNum
        });
      }
    }

    // 3. Detect Shorten / Summarize previous answer: e.g. "ager answer ta short koro", "shorten it", "summarize previous answer"
    const isShorten = 
      /\b(ager\s+answer|ager\s+uttor|previous\s+answer|short\s+koro|choto\s+koro|chuto\s+koro|shorten|summarize\s+it)\b/i.test(lower) ||
      /(?:আগের\s*উত্তর|সংক্ষেপ\s*করো|ছোট\s*করো)/.test(trimmed);

    if (isShorten) {
      const topic = memory.activeTopic || 'the previously discussed topic';
      return mapResult(`Concise summary and key points of the previous explanation on ${topic}`, true, 'shorten_answer');
    }

    // 4. Detect Exam questions / Important topics: e.g. "kon gula exam e aste pare?", "important topics", "exam questions"
    const isExamTopics =
      /\b(exam\s*e|porikkha|exam\s+questions|important\s+topics|kon\s+gula\s+exam)\b/i.test(lower) ||
      /(?:পরীক্ষায়|পরীক্ষায়|গুরুত্বপূর্ণ\s*টপিক)/.test(trimmed);

    if (isExamTopics) {
      const docName = memory.recentDocReferences[0] || memory.attachedDocuments?.[0];
      const topic = docName ? `the attached study material ${docName}` : (memory.activeTopic || 'Operating Systems');
      return mapResult(`High yield exam questions, core concepts, and important exam topics for ${topic}`, true, 'exam_topics');
    }

    // 5. Detect MCQ / Quiz request with pronoun/referent: e.g. "eta theke 10 ta MCQ dao", "MCQ banaw", "ei chapter theke MCQ", "quiz me"
    const isMCQ = 
      /\b(mcq|quiz|multiple\s+choice|prosno\s+banaw|prosno\s+dao)\b/i.test(lower) ||
      /(?:কুইজ|এমসিকিউ|প্রশ্ন\s*বানাও|প্রশ্ন\s*দাও)/.test(trimmed);

    if (isMCQ) {
      const topic = memory.recentChapterRef || memory.activeTopic || (memory.recentDocReferences[0] ? `the study material ${memory.recentDocReferences[0]}` : 'core study concepts');
      const countMatch = lower.match(/([0-9]+)\s*ta\s*mcq/i) || trimmed.match(/([০-৯0-9]+)\s*টি/);
      const count = countMatch ? countMatch[1] : '5';
      return mapResult(`Generate ${count} practice multiple choice questions (MCQs) testing core concepts of ${topic}`, true, 'generate_mcq');
    }

    // 6. Detect Simplification / "Make it easier" / "eta easy kore bujhao" / "aro easy kore bolo"
    const isSimpler = 
      /\b(easy\s+kore|shohoj\s+kore|aro\s+easy|make\s+it\s+easier|simple\s+words|eli5|explain\s+simply)\b/i.test(lower) ||
      /(?:সহজ\s*করে|আরেকটু\s*সহজে|সহজ\s*ভাষায়)/.test(trimmed);

    if (isSimpler) {
      const topic = memory.activeTopic || 'the current operating systems topic';
      const entities = memory.recentEntities.length > 0 ? ` (${memory.recentEntities.slice(0, 4).join(', ')})` : '';
      return mapResult(`Simple, easy-to-understand explanation of ${topic}${entities} with everyday analogies`, true, 'clarify_simple');
    }

    // 7. Detect Example request: "example daw", "eta ekta example diye bujhao", "give an example", "আরেকটা উদাহরণ"
    const isExample = 
      /\b(example|udahar|udaron|udahoron|dhoro|dhorun|give\s+an\s+example)\b/i.test(lower) ||
      /(?:উদাহরণ|দৃষ্টান্ত)/.test(trimmed);

    if (isExample) {
      const topic = memory.activeTopic || 'Operating Systems concepts';
      return mapResult(`Concrete real-world example and practical scenario explaining ${topic}`, true, 'example');
    }

    // 8. Detect Pronoun / Anaphoric references: "eta", "eita", "oita", "etar", "eitar", "this", "that", "it"
    const hasPronoun = 
      /\b(eta|eita|oita|sheta|etar|eitar|oitar|shetar|this|that|it|these|those)\b/i.test(lower) ||
      /(?:এটা|এইটা|ওইটা|সেটা|এটার|এইটার|ঐটা)/.test(trimmed);

    if (hasPronoun && memory.activeTopic) {
      const resolved = `${memory.activeTopic} - ${trimmed}`;
      return mapResult(resolved, true, 'general_followup');
    }

    // 9. Short follow-up queries (< 35 chars) in an ongoing conversation
    if (trimmed.length < 35 && (history.length > 0 || memory.lastUserQuery) && memory.activeTopic) {
      return mapResult(`${memory.activeTopic} - ${trimmed}`, true, 'general_followup');
    }

    // 10. Standalone query: No rewriting required
    return mapResult(rawQuery, false, 'standalone');
  }
}

export const queryRewriter = new QueryRewriter();

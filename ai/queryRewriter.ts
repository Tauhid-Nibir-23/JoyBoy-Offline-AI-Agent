// Offline Study AI - Smart Query Rewriter & Intent Resolver (Phase 9 & 10)
import { conversationMemory, ConversationMemoryState } from './conversationMemory';
import { ChatMessage } from './provider';

export type QueryIntent = 
  | 'EXPLAIN'
  | 'SIMPLIFY'
  | 'EXAMPLE'
  | 'SUMMARIZE'
  | 'SHORTEN'
  | 'EXPAND'
  | 'COMPARE'
  | 'TRANSLATE'
  | 'MCQ'
  | 'QUIZ'
  | 'FLASHCARD'
  | 'NOTE'
  | 'QUESTION_GENERATION'
  | 'CONTINUE'
  | 'CLARIFY'
  | 'DOCUMENT_LOOKUP'
  // Phase 9 backward-compatibility intents:
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
  resolvedContext?: string;
  targetPage?: number | null;
  targetQuestionNumber?: number | null;
  targetItemNumber?: number | null;
  targetItemTitle?: string | null;
  extractedQuantity?: number | null;
  chapterRef?: string | null;
}

export class QueryRewriter {
  /**
   * Evaluates the user query against the conversation's active memory and history.
   * If the query is anaphoric or a follow-up ("eta", "oita", "example daw", "2 number ta easy kore bujhao",
   * "short koro", "5 ta MCQ banaw"), resolves it into a complete, context-aware internal retrieval query.
   * 
   * RULE (Phase 10 Section 3 & 6):
   * IF query is self-contained ("What is OS?", "What is deadlock?"): PRESERVE ORIGINAL QUERY.
   * Do NOT bloated-rewrite self-contained questions.
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

    const trimmed = rawQuery.trim();
    if (!trimmed) {
      return {
        originalQuery: rawQuery,
        resolvedQuery: rawQuery,
        rewrittenQuery: rawQuery,
        wasRewritten: false,
        isRewritten: false,
        intent: 'standalone',
        targetAction: 'standalone',
        referencedTopic: memory.activeTopic
      };
    }

    const lower = trimmed.toLowerCase();

    const mapResult = (
      resolvedQuery: string,
      wasRewritten: boolean,
      intent: QueryIntent,
      extra?: Partial<RewrittenQueryResult>
    ): RewrittenQueryResult => {
      let targetAction: string = intent.toLowerCase();
      if (intent === 'clarify_simple' || intent === 'SIMPLIFY') targetAction = 'simplify';
      else if (intent === 'generate_mcq' || intent === 'MCQ') targetAction = 'mcq';
      else if (intent === 'shorten_answer' || intent === 'SHORTEN') targetAction = 'shorten';
      else if (intent === 'example' || intent === 'EXAMPLE') targetAction = 'example';
      else if (intent === 'exam_topics' || intent === 'NOTE') targetAction = 'exam_topics';
      else if (intent === 'EXPLAIN') targetAction = 'explain';

      const topic = extra?.referencedTopic !== undefined ? extra.referencedTopic : (memory.activeSubtopic || memory.activeTopic);
      const resolvedContext = wasRewritten 
        ? `The user is following up on ${topic || 'the active study topic'}. Intent: ${targetAction.toUpperCase()}`
        : undefined;

      return {
        originalQuery: rawQuery,
        resolvedQuery,
        rewrittenQuery: resolvedQuery,
        wasRewritten,
        isRewritten: wasRewritten,
        intent,
        targetAction,
        referencedTopic: topic,
        resolvedContext,
        ...extra
      };
    };

    const bengaliNumerals: Record<string, number> = {
      '১': 1, '২': 2, '৩': 3, '৪': 4, '৫': 5,
      '৬': 6, '৭': 7, '৮': 8, '৯': 9, '১০': 10
    };

    // 1. Ordinal Item Reference (e.g. "2 number ta", "2 number ta easy kore bujhao", "ager answer er 3 number ta", "২ নম্বরটা", "second one")
    const ordinalMatch = lower.match(/(?:ager\s+answer(?:er)?\s+)?([0-9১-৯]+)\s*(?:no|nombor|number|nong|নম্বর)?\s*(?:ta|ti|টা|টি)?/i) ||
      lower.match(/\b(first|second|third|fourth|fifth|1st|2nd|3rd|4th|5th)\s*(?:one|item|condition|topic)?\b/i);

    const ordinalWords: Record<string, number> = {
      'first': 1, '1st': 1,
      'second': 2, '2nd': 2,
      'third': 3, '3rd': 3,
      'fourth': 4, '4th': 4,
      'fifth': 5, '5th': 5
    };

    // Check if query is specifically targeting an enumerated item from previous answer
    const hasOrdinalMention = 
      /\b([0-9১-৯]+)\s*(?:no|nombor|number|nong|নম্বর)?\s*(?:ta|ti|টা|টি)\b/i.test(lower) ||
      /\b(first|second|third|fourth|fifth|1st|2nd|3rd|4th|5th)\b/i.test(lower) ||
      /(?:২|৩|৪|৫)\s*নম্বর/.test(trimmed) ||
      lower.includes('2 number') || lower.includes('3 number') || lower.includes('4 number');

    // If query asks for a quantity of items/MCQs (e.g. "3 ta MCQ daw", "5 ta question banaw"), do not mistake it for item reference #3
    const isQuantityQuery = /\b[0-9১-৯]+\s*(?:ta|ti|টা|টি)?\s*(?:mcq|quiz|question|prosno)\b/i.test(lower);

    if (!isQuantityQuery && hasOrdinalMention && !lower.startsWith('what is') && !lower.startsWith('explain ')) {
      let itemNum = 0;
      if (ordinalMatch) {
        const rawToken = ordinalMatch[1];
        if (bengaliNumerals[rawToken]) {
          itemNum = bengaliNumerals[rawToken];
        } else if (ordinalWords[rawToken]) {
          itemNum = ordinalWords[rawToken];
        } else {
          itemNum = parseInt(rawToken, 10);
        }
      }

      if (itemNum > 0) {
        const referencedItem = 
          (conversationId ? conversationMemory.resolveReferencedItem(conversationId, itemNum) : null) || 
          memory.enumeratedItems?.[itemNum.toString()] ||
          (memory.enumeratedQuestions?.[itemNum.toString()] ? {
            number: itemNum,
            title: memory.enumeratedQuestions[itemNum.toString()].split(/[:\-–]/)[0].replace(/\*\*/g, '').trim(),
            text: memory.enumeratedQuestions[itemNum.toString()]
          } : null);
        const itemTitle = referencedItem?.title || `Item ${itemNum}`;
        const topicContext = memory.activeTopic ? ` (${memory.activeTopic})` : '';

        // Update active subtopic in memory
        memory.activeSubtopic = referencedItem?.title || itemTitle;

        if (/\b(easy|shohoj|simple|bujhao|সহজ)\b/i.test(lower)) {
          return mapResult(
            `Explain ${itemTitle}${topicContext} in simple terms with everyday analogies`,
            true,
            'SIMPLIFY',
            { targetItemNumber: itemNum, targetItemTitle: itemTitle, referencedTopic: itemTitle }
          );
        }
        if (/\b(example|udahar|দৃষ্টান্ত|উদাহরণ)\b/i.test(lower)) {
          return mapResult(
            `Concrete real-world example and practical scenario explaining ${itemTitle}${topicContext}`,
            true,
            'EXAMPLE',
            { targetItemNumber: itemNum, targetItemTitle: itemTitle, referencedTopic: itemTitle }
          );
        }
        if (/\b(mcq|quiz)\b/i.test(lower)) {
          return mapResult(
            `Generate practice multiple choice questions (MCQs) testing ${itemTitle}${topicContext}`,
            true,
            'MCQ',
            { targetItemNumber: itemNum, targetItemTitle: itemTitle, referencedTopic: itemTitle }
          );
        }

        return mapResult(
          `Detailed explanation of ${itemTitle}${topicContext}`,
          true,
          'EXPLAIN',
          { targetItemNumber: itemNum, targetItemTitle: itemTitle, referencedTopic: itemTitle }
        );
      }
    }

    // 2. Question Number Reference: e.g. "question 5 explain koro", "৫ নম্বর প্রশ্নটা বুঝিয়ে বলো"
    const qNumMatch = lower.match(/(?:question|prosno|প্রশ্ন|ques|q)\s*([0-9১-৯]+)/i) ||
      trimmed.match(/([0-9১-৯]+)\s*(?:no|nombor|number|nong|নম্বর)\s*(?:prosno|question|প্রশ্ন)/i);

    if (qNumMatch) {
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

    // 3. Page Number Reference: e.g. "Page 12 e ki bola hoise?", "ei PDF er 10 page ta bujhao", "page 5"
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

    // 4. Shorten / Summarize previous answer: e.g. "short koro", "ager answer ta short koro", "shorten it"
    const isShorten = 
      /\b(ager\s+answer|ager\s+uttor|previous\s+answer|short\s+koro|choto\s+koro|chuto\s+koro|shorten|summarize\s+it)\b/i.test(lower) ||
      /(?:আগের\s*উত্তর|সংক্ষেপ\s*করো|ছোট\s*করো)/.test(trimmed) ||
      lower === 'short koro' || lower === 'shorten';

    if (isShorten) {
      const topic = memory.activeSubtopic || memory.activeTopic || 'the previously discussed topic';
      return mapResult(`Concise summary and key points of the previous explanation on ${topic}`, true, 'shorten_answer');
    }

    // 5. MCQ / Quiz request: e.g. "MCQ banaw", "5 ta MCQ banaw", "MCQ banaw 5 ta", "quiz me"
    const isMCQ = 
      /\b(mcq|quiz|multiple\s+choice|prosno\s+banaw|prosno\s+dao)\b/i.test(lower) ||
      /(?:কুইজ|এমসিকিউ|প্রশ্ন\s*বানাও|প্রশ্ন\s*দাও)/.test(trimmed);

    if (isMCQ) {
      const countMatch = lower.match(/([0-9]+)\s*ta\s*mcq/i) || 
        lower.match(/mcq\s*banaw\s*([0-9]+)\s*ta/i) ||
        lower.match(/([0-9]+)\s*ta/i) ||
        trimmed.match(/([০-৯0-9]+)\s*টি/);
      let count = 5;
      if (countMatch) {
        const parsed = parseInt(countMatch[1], 10);
        if (!isNaN(parsed) && parsed > 0) count = parsed;
      }

      const target = memory.activeSubtopic || memory.recentChapterRef || memory.activeTopic || (memory.recentDocReferences[0] ? `the study material ${memory.recentDocReferences[0]}` : 'core study concepts');
      return mapResult(`Generate ${count} practice multiple choice questions (MCQs) testing core concepts of ${target}`, true, 'generate_mcq', {
        extractedQuantity: count
      });
    }

    // 6. Simplification: e.g. "eta easy kore bujhao", "easy kore bolo", "aro easy kore bolo"
    const isSimpler = 
      /\b(easy\s+kore|shohoj\s+kore|aro\s+easy|make\s+it\s+easier|simple\s+words|eli5|explain\s+simply)\b/i.test(lower) ||
      /(?:সহজ\s*করে|আরেকটু\s*সহজে|সহজ\s*ভাষায়)/.test(trimmed);

    if (isSimpler) {
      const topic = memory.activeSubtopic || memory.activeTopic || 'the current operating systems topic';
      const entities = memory.recentEntities.length > 0 ? ` (${memory.recentEntities.slice(0, 4).join(', ')})` : '';
      return mapResult(`Simple, easy-to-understand explanation of ${topic}${entities} with everyday analogies`, true, 'clarify_simple');
    }

    // 7. Example request: e.g. "example daw", "real life example daw", "give an example", "আরেকটা উদাহরণ"
    const isExample = 
      /\b(example|udahar|udaron|udahoron|dhoro|dhorun|give\s+an\s+example)\b/i.test(lower) ||
      /(?:উদাহরণ|দৃষ্টান্ত)/.test(trimmed) ||
      lower === 'example daw';

    if (isExample) {
      const topic = memory.activeSubtopic || memory.activeTopic || 'Operating Systems concepts';
      return mapResult(`Concrete real-world example and practical scenario explaining ${topic}`, true, 'example');
    }

    // 8. Exam questions / Important topics: e.g. "kon gula exam e aste pare?", "important topics", "exam questions"
    const isExamTopics =
      /\b(exam\s*e|porikkha|exam\s+questions|important\s+topics|kon\s+gula\s+exam|exam\s+er\s+jonno)\b/i.test(lower) ||
      /(?:পরীক্ষায়|পরীক্ষায়|গুরুত্বপূর্ণ\s*টপিক)/.test(trimmed);

    // 8b. Exam Writing Format: e.g. "exam e kivabe likhbo?", "exam format e daw"
    const isExamWriting = /\b(exam\s*e\s*kivabe\s*likhbo|exam\s*format|exam\s*ready)\b/i.test(lower) ||
      /(?:পরীক্ষায়\s*কীভাবে\s*লিখব|পরীক্ষার\s*ফরম্যাটে)/.test(trimmed);
    if (isExamWriting) {
      const topic = memory.activeSubtopic || memory.activeTopic || (memory.recentDocReferences[0] ? `the study topic from ${memory.recentDocReferences[0]}` : 'the active concept');
      return mapResult(`Concise exam-ready answer, structured key points, definition, and bulleted summary for ${topic} suitable for writing in exams`, true, 'exam_topics', {
        referencedTopic: topic
      });
    }

    // 8c. Marks-based Exam Question Format: e.g. "5 marks er answer daw", "2 marks er jonno short answer daw", "10 marks question"
    const marksMatch = lower.match(/\b([0-9১-৯]+)\s*(?:marks?|mark|নম্বর|নম্বরের)\b/i);
    if (marksMatch) {
      let mark = parseInt(marksMatch[1], 10);
      if (isNaN(mark) && bengaliNumerals[marksMatch[1]]) mark = bengaliNumerals[marksMatch[1]];
      const topic = memory.activeSubtopic || memory.activeTopic || 'the active concept';
      if (mark && mark <= 3) {
        return mapResult(`Concise ${mark}-mark exam answer for ${topic} containing precise definition, key principle, and direct explanation in 2-4 sentences`, true, 'SHORTEN', {
          referencedTopic: topic
        });
      } else {
        return mapResult(`Comprehensive ${mark || 5}-mark university exam answer for ${topic} with clear heading, definition, core concepts, bullet points, and practical example`, true, 'exam_topics', {
          referencedTopic: topic
        });
      }
    }

    // 8d. Types, States, Conditions: e.g. "types gula bolo", "process state gula bolo", "4 ta condition bolo"
    const isTypesOrStatesOrConditions = 
      /\b(types?\s+gula|type\s+gula|types|state\s+gula|states?\s+gula|states?|condition\s+gula|conditions?)\s*(?:bolo|bujhao|explain\s+koro|ki\s*ki|list\s+koro)?\b/i.test(lower) ||
      /\b[0-9১-৯]+\s*(?:ta|ti)?\s*(?:condition|state|type)\b/i.test(lower);
    if (isTypesOrStatesOrConditions && !lower.includes('what is') && !lower.includes('explain ')) {
      const topic = memory.activeSubtopic || memory.activeTopic || 'the active study topic';
      if (lower.includes('state')) {
        return mapResult(`Explain the different states of ${topic} (such as New, Ready, Running, Waiting, Terminated) with state transitions and numbered list`, true, 'EXPLAIN', { referencedTopic: topic });
      }
      if (lower.includes('condition')) {
        return mapResult(`Explain the 4 necessary conditions for ${topic} (Mutual Exclusion, Hold and Wait, No Preemption, Circular Wait) in a clear numbered list`, true, 'EXPLAIN', { referencedTopic: topic });
      }
      return mapResult(`Explain the different types, categories, and classifications of ${topic} with a clear numbered list`, true, 'EXPLAIN', { referencedTopic: topic });
    }

    // 8e. Viva Voce Questions: e.g. "viva question daw", "viva te ki dhoron er question ashbe"
    const isViva = /\b(viva|oral\s+exam|ভাইভা)\b/i.test(lower);
    if (isViva) {
      const topic = memory.activeSubtopic || memory.activeTopic || 'core study concepts';
      return mapResult(`High-yield viva voce questions and short crisp model answers for ${topic}`, true, 'QUESTION_GENERATION', { referencedTopic: topic });
    }

    // 8f. Differences / Comparison: e.g. "Deadlock ar starvation er difference bolo"
    const isDiff = /\b(difference|parthokko|তুলনা|পার্থক্য|vs|versus)\b/i.test(lower);
    if (isDiff) {
      const diffMatch = lower.match(/([a-z\s_-]{3,25})\s+(?:ar|and|o|vs|versus)\s+([a-z\s_-]{3,25})\s+(?:er\s+)?(?:difference|parthokko)/i);
      if (diffMatch) {
        const itemA = diffMatch[1].trim();
        const itemB = diffMatch[2].trim();
        return mapResult(`Detailed comparison and key differences between ${itemA} and ${itemB} with comparison table and key points`, true, 'COMPARE', { referencedTopic: `${itemA} vs ${itemB}` });
      }
    }

    // 8g. Quick Revision / Recap: e.g. "Exam er age quick revision daw", "quick revision"
    const isRevision = /\b(revision|quick\s+revision|recap|রিভিশন)\b/i.test(lower);
    if (isRevision) {
      const topic = memory.activeSubtopic || memory.activeTopic || 'the study topic';
      return mapResult(`Quick high-yield revision bullet points summarizing key formulas, definitions, and takeaways for ${topic}`, true, 'SUMMARIZE', { referencedTopic: topic });
    }

    if (isExamTopics) {
      const docName = memory.recentDocReferences[0] || memory.attachedDocuments?.[0];
      const topic = docName ? `the attached study material ${docName}` : (memory.activeSubtopic || memory.activeTopic || 'Operating Systems');
      return mapResult(`High yield exam questions, core concepts, and important exam topics for ${topic}`, true, 'exam_topics');
    }

    // 9. Chapter questions: "chapter 2 er main topic gula bolo", "chapter 3 theke important ki?"
    const chapMatch = lower.match(/\bchapter\s*([0-9]+)\b/i);
    if (chapMatch) {
      const chapNum = chapMatch[1];
      const chapRef = `Chapter ${chapNum}`;
      memory.activeChapter = chapRef;
      const docName = memory.recentDocReferences[0] || 'the study document';
      return mapResult(`Main topics, key concepts, and summaries from ${chapRef} of ${docName}`, true, 'DOCUMENT_LOOKUP', {
        chapterRef: chapRef
      });
    }

    // 9b. Contextual concept explanation: e.g. "peripherals e floating number ta bujhao"
    const contextConceptMatch = lower.match(/([a-z0-9_-]{3,20})\s+e\s+([a-z0-9\s_-]{3,30}?)\s*(?:ta|ti)?\s*(?:bujhao|explain\s+koro|bolo|shomporke)/i);
    if (contextConceptMatch) {
      const contextSubject = contextConceptMatch[1].trim();
      const targetConcept = contextConceptMatch[2].trim();
      memory.activeTopic = contextSubject;
      memory.activeSubtopic = targetConcept;
      return mapResult(
        `Explain the ${targetConcept} concept in the context of ${contextSubject} in simple student-friendly language`,
        true,
        'EXPLAIN',
        { referencedTopic: targetConcept }
      );
    }

    // 9c. Previous concept reference: e.g. "ager ta abar bolo", "oita explain koro"
    const isPreviousRef = /\b(ager\s*ta\s*abar\s*bolo|oita\s*explain\s*koro|ager\s*point\s*ta)\b/i.test(lower) ||
      /(?:আগেরটা\s*আবার\s*বলো|ঐটা\s*বুঝিয়ে\s*দাও)/.test(trimmed);
    if (isPreviousRef) {
      const target = memory.previousTopic || memory.activeTopic || 'the previously discussed concept';
      return mapResult(`Detailed explanation and recap of ${target} in simple terms`, true, 'EXPLAIN', {
        referencedTopic: target
      });
    }

    // 9d. Shorten this part: e.g. "ei part ta short kore daw", "short kore daw"
    const isShortenPart = /\b(ei\s*part\s*ta\s*short|short\s*kore\s*daw|choto\s*kore\s*daw)\b/i.test(lower) ||
      /(?:এই\s*অংশটা\s*সংক্ষেপ\s*করো)/.test(trimmed);
    if (isShortenPart) {
      const target = memory.activeSubtopic || memory.activeTopic || 'the active topic';
      return mapResult(`Concise 2-3 sentence summary of the key points of ${target}`, true, 'SHORTEN', {
        referencedTopic: target
      });
    }

    // 10. Document-referencing query: "ei PDF theke...", "ei doc theke...", "from this pdf"
    const isDocQuery = /\b(ei\s+pdf|ei\s+doc|ei\s+document|from\s+this\s+pdf|in\s+this\s+pdf|this\s+document)\b/i.test(lower) ||
      /(?:এই\s*পিডিএফ|এই\s*ডকুমেন্ট)/.test(trimmed);
    if (isDocQuery) {
      const docName = memory.recentDocReferences[0] || 'the attached document';
      return mapResult(`${rawQuery} (scoped to ${docName})`, true, 'DOCUMENT_LOOKUP');
    }

    // 11. Self-contained query guard (Phase 10 Section 3 & 6):
    // If the query defines its own topic or is an independent complete question, DO NOT overwrite!
    const isSelfContained = 
      /^(what is|explain|define|tell me about|how does|what are)\s+/i.test(lower) ||
      (lower.includes(' ki?') && !lower.includes('eta') && !lower.includes('oita') && !lower.includes('eita')) ||
      (lower.length > 25 && !lower.includes('eta') && !lower.includes('oita') && !lower.includes('ager') && !isDocQuery);

    if (isSelfContained) {
      return mapResult(rawQuery, false, 'standalone');
    }

    // 11. Pronoun / Anaphoric references: "eta", "eita", "oita", "etar", "eitar", "this", "that", "it"
    const hasPronoun = 
      /\b(eta|eita|oita|sheta|etar|eitar|oitar|shetar|this|that|it|these|those)\b/i.test(lower) ||
      /(?:এটা|এইটা|ওইটা|সেটা|এটার|এইটার|ঐটা)/.test(trimmed);

    if (hasPronoun && (memory.activeSubtopic || memory.activeTopic)) {
      const topic = memory.activeSubtopic || memory.activeTopic;
      const resolved = `${topic} - ${trimmed}`;
      return mapResult(resolved, true, 'general_followup');
    }

    // 12. Short follow-up queries (< 35 chars) in an ongoing conversation
    if (trimmed.length < 35 && (history.length > 0 || memory.lastUserQuery) && (memory.activeSubtopic || memory.activeTopic)) {
      const topic = memory.activeSubtopic || memory.activeTopic;
      return mapResult(`${topic} - ${trimmed}`, true, 'general_followup');
    }

    // 13. Default standalone
    return mapResult(rawQuery, false, 'standalone');
  }
}

export const queryRewriter = new QueryRewriter();


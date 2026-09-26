// Offline Study AI - Conversation Memory Layer (Phase 9)
import { ChatMessage } from './provider';
import { DBDocument, getConversationMemoryFromDB, upsertConversationMemoryInDB, deleteConversationMemoryFromDB } from '../database/db';

export interface ExtractedQuestionItem {
  number: number;
  text: string;
}

export interface ExtractedEnumeratedItem {
  number: number;
  title: string;
  text: string;
}

export interface ConversationTurnRecord {
  role: 'user' | 'assistant';
  content: string;
  timestamp: string;
  topic?: string | null;
  intent?: string | null;
}

export interface ConversationMemoryState {
  conversationId: string;
  activeTopic: string | null;
  previousTopic: string | null;
  activeSubtopic?: string | null;
  activeDocument: string | null;
  activePage: number | null;
  activeChapter: string | null;
  activeQuestion: string | null;
  lastUserIntent: string | null;
  lastUserQuery: string | null;
  lastAssistantAnswer: string | null;
  recentEntities: string[];
  enumeratedQuestions: Record<string, string>;
  enumeratedItems: Record<string, ExtractedEnumeratedItem>;
  referencedConcepts: string[];
  recentTurns: ConversationTurnRecord[];
  rollingSummary: string | null;
  documentDerivedConcepts: string[];
  userLanguage: string;
  currentStudyTask: string | null;
  // Backward compatibility:
  recentDocReferences: string[];
  lastQuestionOrAnswerSnippet: string | null;
  lastQuestionsList: ExtractedQuestionItem[];
  recentChapterRef?: string | null;
  attachedDocuments?: string[];
  lastAssistantAnswerSnippet?: string | null;
}

export class ConversationMemoryManager {
  private cache: Map<string, ConversationMemoryState> = new Map();

  public clearCache(): void {
    this.cache.clear();
  }

  /**
   * Retrieves active memory state for a given conversation.
   * Loads from persistent SQLite if not in memory cache.
   */
  public getMemory(conversationId: string): ConversationMemoryState {
    if (this.cache.has(conversationId)) {
      return this.cache.get(conversationId)!;
    }

    const fromDb = getConversationMemoryFromDB(conversationId);
    if (fromDb) {
      let recentEntities: string[] = [];
      let recentDocReferences: string[] = [];
      let lastQuestionsList: ExtractedQuestionItem[] = [];
      let enumeratedItems: Record<string, ExtractedEnumeratedItem> = {};
      let stateExtra: any = {};

      try {
        if (fromDb.recent_entities_json) recentEntities = JSON.parse(fromDb.recent_entities_json);
      } catch {}
      try {
        if (fromDb.recent_doc_references_json) recentDocReferences = JSON.parse(fromDb.recent_doc_references_json);
      } catch {}
      try {
        if (fromDb.last_qa_snippet) {
          const parsed = JSON.parse(fromDb.last_qa_snippet);
          if (Array.isArray(parsed.questions)) lastQuestionsList = parsed.questions;
          if (parsed.enumeratedItems) enumeratedItems = parsed.enumeratedItems;
          if (parsed.stateExtra) stateExtra = parsed.stateExtra;
        }
      } catch {}

      const enumRecord: Record<string, string> = {};
      for (const q of lastQuestionsList) {
        enumRecord[q.number.toString()] = q.text;
      }
      for (const [k, v] of Object.entries(enumeratedItems)) {
        if (!enumRecord[k]) {
          enumRecord[k] = v.title ? `${v.title}: ${v.text}` : v.text;
        }
      }

      const state: ConversationMemoryState = {
        conversationId,
        activeTopic: fromDb.active_topic,
        previousTopic: stateExtra.previousTopic || null,
        activeSubtopic: stateExtra.activeSubtopic || null,
        activeDocument: recentDocReferences[0] || null,
        activePage: stateExtra.activePage || null,
        activeChapter: stateExtra.activeChapter || null,
        activeQuestion: stateExtra.activeQuestion || null,
        lastUserIntent: stateExtra.lastUserIntent || null,
        recentEntities,
        recentDocReferences,
        rollingSummary: fromDb.summary,
        lastQuestionOrAnswerSnippet: fromDb.last_qa_snippet,
        lastQuestionsList,
        lastAssistantAnswer: stateExtra.lastAssistantAnswer || null,
        lastUserQuery: stateExtra.lastUserQuery || null,
        attachedDocuments: recentDocReferences,
        enumeratedQuestions: enumRecord,
        enumeratedItems,
        referencedConcepts: stateExtra.referencedConcepts || [],
        recentTurns: stateExtra.recentTurns || [],
        documentDerivedConcepts: stateExtra.documentDerivedConcepts || [],
        userLanguage: stateExtra.userLanguage || 'auto',
        currentStudyTask: stateExtra.currentStudyTask || null,
        recentChapterRef: stateExtra.activeChapter || null,
        lastAssistantAnswerSnippet: stateExtra.lastAssistantAnswer || null
      };

      this.cache.set(conversationId, state);
      return state;
    }

    const initial: ConversationMemoryState = {
      conversationId,
      activeTopic: null,
      previousTopic: null,
      activeSubtopic: null,
      activeDocument: null,
      activePage: null,
      activeChapter: null,
      activeQuestion: null,
      lastUserIntent: null,
      recentEntities: [],
      recentDocReferences: [],
      rollingSummary: null,
      lastQuestionOrAnswerSnippet: null,
      lastQuestionsList: [],
      lastAssistantAnswer: null,
      lastUserQuery: null,
      attachedDocuments: [],
      enumeratedQuestions: {},
      enumeratedItems: {},
      referencedConcepts: [],
      recentTurns: [],
      documentDerivedConcepts: [],
      userLanguage: 'auto',
      currentStudyTask: null,
      recentChapterRef: null,
      lastAssistantAnswerSnippet: null
    };

    this.cache.set(conversationId, initial);
    return initial;
  }

  /**
   * Records a single turn explicitly for testing or immediate updates.
   */
  public recordTurn(
    conversationId: string,
    role: 'user' | 'assistant',
    content: string,
    attachedDocs: string[] = []
  ): ConversationMemoryState {
    const memory = this.getMemory(conversationId);
    if (attachedDocs && attachedDocs.length > 0) {
      for (const d of attachedDocs) {
        if (!memory.recentDocReferences.includes(d)) {
          memory.recentDocReferences.push(d);
        }
      }
      memory.attachedDocuments = [...memory.recentDocReferences];
      memory.activeDocument = memory.recentDocReferences[0] || null;
    }

    memory.recentTurns.push({
      role,
      content,
      timestamp: new Date().toISOString(),
      topic: memory.activeTopic
    });
    if (memory.recentTurns.length > 20) {
      memory.recentTurns = memory.recentTurns.slice(-20);
    }

    if (role === 'user') {
      memory.lastUserQuery = content;
      this.extractTopicAndEntities(content, memory);
    } else {
      memory.lastAssistantAnswer = content;
      memory.lastAssistantAnswerSnippet = content;
      const newQuestions = this.extractEnumeratedQuestions(content);
      if (newQuestions.length > 0) {
        memory.lastQuestionsList = newQuestions;
      }
      const parsedItems = this.extractEnumeratedItems(content);

      if (parsedItems.length > 0) {
        const itemsRecord: Record<string, ExtractedEnumeratedItem> = {};
        for (const it of parsedItems) {
          itemsRecord[it.number.toString()] = it;
        }
        memory.enumeratedItems = itemsRecord;
      }

      if (parsedItems.length > 0 || newQuestions.length > 0) {
        const enumRecord: Record<string, string> = { ...memory.enumeratedQuestions };
        for (const q of memory.lastQuestionsList) {
          enumRecord[q.number.toString()] = q.text;
        }
        for (const it of parsedItems) {
          if (!enumRecord[it.number.toString()]) {
            enumRecord[it.number.toString()] = it.title ? `${it.title}: ${it.text}` : it.text;
          }
        }
        memory.enumeratedQuestions = enumRecord;
      }

      const snippet = content.length > 300 ? content.substring(0, 300) + '...' : content;
      memory.lastQuestionOrAnswerSnippet = JSON.stringify({
        snippet,
        questions: memory.lastQuestionsList,
        enumeratedItems: memory.enumeratedItems,
        stateExtra: {
          previousTopic: memory.previousTopic,
          activeSubtopic: memory.activeSubtopic,
          activeChapter: memory.activeChapter,
          activePage: memory.activePage,
          activeQuestion: memory.activeQuestion,
          lastUserIntent: memory.lastUserIntent,
          lastUserQuery: memory.lastUserQuery,
          lastAssistantAnswer: memory.lastAssistantAnswer,
          referencedConcepts: memory.referencedConcepts,
          recentTurns: memory.recentTurns.slice(-10),
          documentDerivedConcepts: memory.documentDerivedConcepts,
          userLanguage: memory.userLanguage,
          currentStudyTask: memory.currentStudyTask
        }
      });
    }

    if (memory.recentTurns.length > 6) {
      const older = memory.recentTurns.slice(0, memory.recentTurns.length - 6);
      const summaryItems: string[] = [];
      if (memory.activeTopic) summaryItems.push(`Topic: ${memory.activeTopic}`);
      if (memory.activeSubtopic) summaryItems.push(`Active Concept: ${memory.activeSubtopic}`);
      for (const t of older) {
        if (t.role === 'user') {
          const short = t.content.length > 60 ? t.content.substring(0, 60) + '...' : t.content;
          summaryItems.push(`User asked: "${short}"`);
        }
      }
      memory.rollingSummary = summaryItems.join('; ');
    }
    this.cache.set(conversationId, memory);
    return memory;
  }

  /**
   * Updates conversation memory from latest messages and attached materials.
   */
  public updateMemory(
    conversationId: string,
    messages: ChatMessage[],
    attachedDocs: DBDocument[] = []
  ): ConversationMemoryState {
    const memory = this.getMemory(conversationId);

    // Track attached documents
    const docNames = attachedDocs.map((d) => d.filename);
    for (const name of docNames) {
      if (!memory.recentDocReferences.includes(name)) {
        memory.recentDocReferences.push(name);
      }
    }
    memory.attachedDocuments = [...memory.recentDocReferences];

    // Inspect user and assistant messages
    const userMsgs = messages.filter((m) => m.role === 'user');
    const assistantMsgs = messages.filter((m) => m.role === 'assistant');

    if (userMsgs.length > 0) {
      const lastUser = userMsgs[userMsgs.length - 1];
      memory.lastUserQuery = lastUser.content;
      this.extractTopicAndEntities(lastUser.content, memory);
    }

    if (assistantMsgs.length > 0) {
      const lastAssistant = assistantMsgs[assistantMsgs.length - 1];
      memory.lastAssistantAnswer = lastAssistant.content;
      memory.lastAssistantAnswerSnippet = lastAssistant.content;
      const newQuestions = this.extractEnumeratedQuestions(lastAssistant.content);
      if (newQuestions.length > 0) {
        memory.lastQuestionsList = newQuestions;
      }
      const parsedItems = this.extractEnumeratedItems(lastAssistant.content);

      if (parsedItems.length > 0) {
        const itemsRecord: Record<string, ExtractedEnumeratedItem> = {};
        for (const it of parsedItems) {
          itemsRecord[it.number.toString()] = it;
        }
        memory.enumeratedItems = itemsRecord;
      }

      if (parsedItems.length > 0 || newQuestions.length > 0) {
        const enumRecord: Record<string, string> = { ...memory.enumeratedQuestions };
        for (const q of memory.lastQuestionsList) {
          enumRecord[q.number.toString()] = q.text;
        }
        for (const it of parsedItems) {
          if (!enumRecord[it.number.toString()]) {
            enumRecord[it.number.toString()] = it.title ? `${it.title}: ${it.text}` : it.text;
          }
        }
        memory.enumeratedQuestions = enumRecord;
      }
      
      const snippet = lastAssistant.content.length > 300 
        ? lastAssistant.content.substring(0, 300) + '...'
        : lastAssistant.content;
      
      memory.lastQuestionOrAnswerSnippet = JSON.stringify({
        snippet,
        questions: memory.lastQuestionsList,
        enumeratedItems: memory.enumeratedItems,
        stateExtra: {
          previousTopic: memory.previousTopic,
          activeSubtopic: memory.activeSubtopic,
          activeChapter: memory.activeChapter,
          activePage: memory.activePage,
          activeQuestion: memory.activeQuestion,
          lastUserIntent: memory.lastUserIntent,
          lastUserQuery: memory.lastUserQuery,
          lastAssistantAnswer: memory.lastAssistantAnswer,
          referencedConcepts: memory.referencedConcepts,
          recentTurns: memory.recentTurns.slice(-10),
          documentDerivedConcepts: memory.documentDerivedConcepts,
          userLanguage: memory.userLanguage,
          currentStudyTask: memory.currentStudyTask
        }
      });
    }

    // Maintain rolling summary if conversation grows beyond 6 messages
    if (messages.length > 6) {
      const olderMessages = messages.slice(0, messages.length - 6);
      const summaryItems: string[] = [];
      if (memory.activeTopic) {
        summaryItems.push(`Topic: ${memory.activeTopic}`);
      }
      if (memory.activeSubtopic) {
        summaryItems.push(`Active Concept: ${memory.activeSubtopic}`);
      }
      for (const m of olderMessages) {
        if (m.role === 'user') {
          const short = m.content.length > 60 ? m.content.substring(0, 60) + '...' : m.content;
          summaryItems.push(`User asked: "${short}"`);
        }
      }
      memory.rollingSummary = summaryItems.join('; ');
    }

    // Persist to SQLite
    upsertConversationMemoryInDB({
      conversation_id: conversationId,
      active_topic: memory.activeTopic,
      summary: memory.rollingSummary,
      recent_entities_json: JSON.stringify(memory.recentEntities.slice(-15)),
      recent_doc_references_json: JSON.stringify(memory.recentDocReferences.slice(-10)),
      last_qa_snippet: memory.lastQuestionOrAnswerSnippet,
      updated_at: new Date().toISOString()
    });

    this.cache.set(conversationId, memory);
    return memory;
  }

  /**
   * Extracts primary study topic, key concepts, chapter mentions, and technical entities.
   */
  private extractTopicAndEntities(text: string, memory: ConversationMemoryState): void {
    const raw = text.trim();
    const lower = raw.toLowerCase();

    // Check Chapter mentions (e.g. Chapter 2, Chapter 02, অধ্যায় ২)
    const chapterMatch = lower.match(/\bchapter\s*([0-9]{1,2})\b/i) || raw.match(/অধ্যায়\s*([০-৯0-9]{1,2})/i);
    if (chapterMatch) {
      const chapNum = chapterMatch[1];
      const chapEntity = `Chapter ${chapNum}`;
      if (!memory.recentEntities.includes(chapEntity)) {
        memory.recentEntities.push(chapEntity);
      }
      memory.recentChapterRef = chapEntity;
      memory.activeChapter = chapEntity;
      if (!memory.activeTopic) {
        memory.activeTopic = chapEntity;
      }
      return;
    }

    // Check Page mentions
    const pageMatch = lower.match(/\bpage\s*([0-9]+)\b/i) || raw.match(/পৃষ্ঠা\s*([০-৯0-9]+)/i);
    if (pageMatch) {
      const pageNum = parseInt(pageMatch[1], 10);
      if (!isNaN(pageNum)) {
        memory.activePage = pageNum;
      }
    }

    // Subtopic: Deadlock conditions
    if (lower.includes('condition') || lower.includes('শর্ত')) {
      if (memory.activeTopic === 'Deadlock' || lower.includes('deadlock')) {
        memory.activeSubtopic = 'Four Conditions of Deadlock';
        if (!memory.referencedConcepts.includes('Four Conditions of Deadlock')) {
          memory.referencedConcepts.push('Four Conditions of Deadlock');
        }
      }
    }

    // Check specific known operating system & computer science concepts
    const knownTopics: Array<{ pattern: RegExp; topic: string; entities: string[] }> = [
      {
        pattern: /\bdeadlock\b/i,
        topic: 'Deadlock',
        entities: ['deadlock', 'mutual exclusion', 'hold and wait', 'no preemption', 'circular wait', "banker's algorithm"]
      },
      {
        pattern: /\b(process\s+scheduling|scheduling\s+algorithm|round\s+robin|fcfs|sjf|priority\s+scheduling)\b/i,
        topic: 'Process Scheduling',
        entities: ['process scheduling', 'Round Robin', 'FCFS', 'SJF', 'time quantum', 'preemption']
      },
      {
        pattern: /\b(process\s+state|process\s+states|new\s+ready\s+running|pcb|process\s+control\s+block)\b/i,
        topic: 'Process',
        entities: ['process', 'process state', 'PCB', 'context switch', 'fork()', 'exec()']
      },
      {
        pattern: /\b(operating\s+system|os)\b/i,
        topic: 'Operating System',
        entities: ['operating system', 'kernel', 'process management', 'memory management', 'file system', 'system calls']
      },
      {
        pattern: /\bpaging\b/i,
        topic: 'Paging',
        entities: ['paging', 'page table', 'page fault', 'frames', 'virtual address', 'MMU']
      },
      {
        pattern: /\bvirtual\s+memory\b/i,
        topic: 'Virtual Memory',
        entities: ['virtual memory', 'paging', 'page fault', 'TLB', 'MMU', 'frames']
      },
      {
        pattern: /\b(page\s+fault|tlb|segmentation|memory\s+management)\b/i,
        topic: 'Memory Management',
        entities: ['virtual memory', 'paging', 'page fault', 'TLB', 'MMU', 'frames']
      },
      {
        pattern: /\b(binary\s+search|sorting|algorithm|array|linked\s+list)\b/i,
        topic: 'Data Structures & Algorithms',
        entities: ['binary search', 'time complexity', 'divide and conquer', 'array']
      },
      {
        pattern: /\b(dbms|database|sql|rdbms|transaction|acid)\b/i,
        topic: 'Database Management Systems',
        entities: ['DBMS', 'SQL', 'ACID', 'transactions', 'relational model', 'normalization']
      },
      {
        pattern: /\b(networking|tcp|ip|osi\s+model|udp|http|dns)\b/i,
        topic: 'Computer Networks',
        entities: ['computer networks', 'OSI model', 'TCP/IP', 'packets', 'routing', 'protocols']
      }
    ];

    for (const item of knownTopics) {
      if (item.pattern.test(lower)) {
        if (memory.activeTopic && memory.activeTopic !== item.topic) {
          memory.previousTopic = memory.activeTopic;
          memory.activeSubtopic = null;
          memory.recentEntities = [...item.entities];
        } else {
          for (const e of item.entities) {
            if (!memory.recentEntities.includes(e)) {
              memory.recentEntities.push(e);
            }
          }
        }
        memory.activeTopic = item.topic;
        return;
      }
    }

    // Dynamic Topic Switching: If user explicitly asks a standalone question defining a topic
    const isTopicDefiningQuery = 
      /^(what is|explain|define|tell me about)\s+/i.test(lower) ||
      lower.startsWith('what is ') ||
      lower.includes(' ki?') ||
      lower.includes(' কাকে বলে') ||
      lower.includes(' বলতে কি বোঝায়');

    if (isTopicDefiningQuery) {
      const topicCandidate = raw
        .replace(/^(what is|explain|define|tell me about)\s+/i, '')
        .replace(/\s+(ki\?|ki|বলতে কি বোঝায়|কাকে বলে)\??$/i, '')
        .replace(/[?।!.,]+$/, '')
        .trim();
      if (topicCandidate.length > 2 && topicCandidate.length < 50) {
        if (memory.activeTopic && memory.activeTopic.toLowerCase() !== topicCandidate.toLowerCase()) {
          memory.previousTopic = memory.activeTopic;
          memory.activeSubtopic = null;
          memory.recentEntities = [topicCandidate];
        } else if (!memory.activeTopic) {
          memory.recentEntities = [topicCandidate];
        }
        memory.activeTopic = topicCandidate;
      }
    }
  }

  /**
   * Extracts numbered list items and concepts from assistant message.
   * E.g.
   * 1. Mutual Exclusion: ...
   * 2. Hold and Wait: ...
   * 3. No Preemption: ...
   * 4. Circular Wait: ...
   */
  public extractEnumeratedItems(assistantContent: string): ExtractedEnumeratedItem[] {
    const items: ExtractedEnumeratedItem[] = [];
    const lines = assistantContent.split('\n');
    const bengaliNumerals: Record<string, number> = {
      '১': 1, '২': 2, '৩': 3, '৪': 4, '৫': 5,
      '৬': 6, '৭': 7, '৮': 8, '৯': 9, '১০': 10
    };

    const regex = /^(?:\*\*|\#\#)?\s*(?:[Qq]uestion\s*)?([0-9১-৯]+)[\.\:\)]\s*(.+)/;

    for (const line of lines) {
      const trimmed = line.trim();
      const match = trimmed.match(regex);
      if (match) {
        let numStr = match[1];
        let num = parseInt(numStr, 10);
        if (isNaN(num) && bengaliNumerals[numStr]) {
          num = bengaliNumerals[numStr];
        }
        if (!isNaN(num)) {
          const raw = match[2].trim();
          let title = '';
          const boldMatch = raw.match(/^\*\*([^*]+)\*\*/);
          if (boldMatch) {
            title = boldMatch[1].trim();
          } else {
            const sepMatch = raw.match(/^([^:\-–]+)(?::\s+|\s+[\-–]\s+)/);
            if (sepMatch) {
              title = sepMatch[1].trim();
            } else if (raw.includes(':')) {
              title = raw.split(':')[0].trim();
            } else {
              title = raw.slice(0, 45).trim();
            }
          }
          title = title.replace(/\*\*/g, '').trim();
          const cleanText = raw.replace(/\*\*/g, '').trim();
          items.push({
            number: num,
            title: title || cleanText,
            text: cleanText
          });
        }
      }
    }

    return items;
  }

  /**
   * Resolves a referenced enumerated item (e.g. 2 number ta -> Hold and Wait).
   */
  public resolveReferencedItem(
    conversationId: string,
    itemNumber: number
  ): { number: number; title: string; text: string } | null {
    const memory = this.getMemory(conversationId);
    const found = memory.enumeratedItems[itemNumber.toString()];
    if (found) {
      return found;
    }
    const qText = memory.enumeratedQuestions[itemNumber.toString()];
    if (qText) {
      const title = qText.split(/[:\-–]/)[0].replace(/\*\*/g, '').trim();
      return { number: itemNumber, title, text: qText };
    }
    return null;
  }

  /**
   * Extracts numbered questions from assistant message (e.g. 1. ... 2. ... or Question 1: ...).
   */
  public extractEnumeratedQuestions(assistantContent: string): ExtractedQuestionItem[] {
    const questions: ExtractedQuestionItem[] = [];
    const lines = assistantContent.split('\n');

    // Pattern 1: **১. ...** or 1. ... or Question 1: ...
    const regex = /^(?:\*\*|\#\#)?\s*(?:[Qq]uestion\s*)?([0-9১-৯]+)[\.\:\)]\s*(.+)/;
    const bengaliNumerals: Record<string, number> = {
      '১': 1, '২': 2, '৩': 3, '৪': 4, '৫': 5,
      '৬': 6, '৭': 7, '৮': 8, '৯': 9, '১০': 10
    };

    for (const line of lines) {
      const trimmed = line.trim();
      const match = trimmed.match(regex);
      if (match) {
        let numStr = match[1];
        let num = parseInt(numStr, 10);
        if (isNaN(num) && bengaliNumerals[numStr]) {
          num = bengaliNumerals[numStr];
        }
        if (!isNaN(num)) {
          const cleanText = match[2].replace(/\*\*/g, '').trim();
          questions.push({ number: num, text: cleanText });
        }
      }
    }

    return questions;
  }

  /**
   * Resolves a referenced question number (e.g. Question 5) from memory.
   */
  public resolveReferencedQuestion(conversationId: string, questionNumber: number): string | null {
    const memory = this.getMemory(conversationId);
    const found = memory.lastQuestionsList.find((q) => q.number === questionNumber);
    if (found) {
      return found.text;
    }
    return null;
  }

  public clearMemory(conversationId: string): void {
    this.cache.delete(conversationId);
    deleteConversationMemoryFromDB(conversationId);
  }
}

export const conversationMemory = new ConversationMemoryManager();
export const conversationMemoryManager = conversationMemory;

// Offline Study AI - Conversation Memory Layer (Phase 9)
import { ChatMessage } from './provider';
import { DBDocument, getConversationMemoryFromDB, upsertConversationMemoryInDB, deleteConversationMemoryFromDB } from '../database/db';

export interface ExtractedQuestionItem {
  number: number;
  text: string;
}

export interface ConversationMemoryState {
  conversationId: string;
  activeTopic: string | null;
  recentEntities: string[];
  recentDocReferences: string[];
  rollingSummary: string | null;
  lastQuestionOrAnswerSnippet: string | null;
  lastQuestionsList: ExtractedQuestionItem[];
  lastAssistantAnswer: string | null;
  lastUserQuery: string | null;
  recentChapterRef?: string | null;
  attachedDocuments?: string[];
  lastAssistantAnswerSnippet?: string | null;
  enumeratedQuestions: Record<string, string>;
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
        }
      } catch {}

      const enumRecord: Record<string, string> = {};
      for (const q of lastQuestionsList) {
        enumRecord[q.number.toString()] = q.text;
      }

      const state: ConversationMemoryState = {
        conversationId,
        activeTopic: fromDb.active_topic,
        recentEntities,
        recentDocReferences,
        rollingSummary: fromDb.summary,
        lastQuestionOrAnswerSnippet: fromDb.last_qa_snippet,
        lastQuestionsList,
        lastAssistantAnswer: null,
        lastUserQuery: null,
        attachedDocuments: recentDocReferences,
        enumeratedQuestions: enumRecord
      };

      this.cache.set(conversationId, state);
      return state;
    }

    const initial: ConversationMemoryState = {
      conversationId,
      activeTopic: null,
      recentEntities: [],
      recentDocReferences: [],
      rollingSummary: null,
      lastQuestionOrAnswerSnippet: null,
      lastQuestionsList: [],
      lastAssistantAnswer: null,
      lastUserQuery: null,
      attachedDocuments: [],
      enumeratedQuestions: {}
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
    }
    if (role === 'user') {
      memory.lastUserQuery = content;
      this.extractTopicAndEntities(content, memory);
    } else {
      memory.lastAssistantAnswer = content;
      memory.lastAssistantAnswerSnippet = content;
      memory.lastQuestionsList = this.extractEnumeratedQuestions(content);
      const enumRecord: Record<string, string> = {};
      for (const q of memory.lastQuestionsList) {
        enumRecord[q.number.toString()] = q.text;
      }
      memory.enumeratedQuestions = enumRecord;
      const snippet = content.length > 300 ? content.substring(0, 300) + '...' : content;
      memory.lastQuestionOrAnswerSnippet = JSON.stringify({
        snippet,
        questions: memory.lastQuestionsList
      });
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
      memory.lastQuestionsList = this.extractEnumeratedQuestions(lastAssistant.content);
      const enumRecord: Record<string, string> = {};
      for (const q of memory.lastQuestionsList) {
        enumRecord[q.number.toString()] = q.text;
      }
      memory.enumeratedQuestions = enumRecord;
      
      const snippet = lastAssistant.content.length > 300 
        ? lastAssistant.content.substring(0, 300) + '...'
        : lastAssistant.content;
      
      memory.lastQuestionOrAnswerSnippet = JSON.stringify({
        snippet,
        questions: memory.lastQuestionsList
      });
    }

    // Maintain rolling summary if conversation grows beyond 6 messages
    if (messages.length > 6) {
      const olderMessages = messages.slice(0, messages.length - 6);
      const summaryItems: string[] = [];
      if (memory.activeTopic) {
        summaryItems.push(`Topic: ${memory.activeTopic}`);
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
      memory.activeTopic = chapEntity;
      return;
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
        pattern: /\b(process|thread|pcb|process\s+control\s+block)\b/i,
        topic: 'Operating System Process',
        entities: ['process', 'thread', 'PCB', 'context switch', 'fork()', 'exec()']
      },
      {
        pattern: /\b(virtual\s+memory|paging|page\s+fault|tlb|segmentation|memory\s+management)\b/i,
        topic: 'Memory Management',
        entities: ['virtual memory', 'paging', 'page fault', 'TLB', 'MMU', 'frames']
      },
      {
        pattern: /\b(binary\s+search|sorting|algorithm|array|linked\s+list)\b/i,
        topic: 'Data Structures & Algorithms',
        entities: ['binary search', 'time complexity', 'divide and conquer', 'array']
      }
    ];

    for (const item of knownTopics) {
      if (item.pattern.test(lower)) {
        memory.activeTopic = item.topic;
        for (const e of item.entities) {
          if (!memory.recentEntities.includes(e)) {
            memory.recentEntities.push(e);
          }
        }
        return;
      }
    }

    // Fallback: If user asks a standalone question that defines a topic
    if (!memory.activeTopic && (lower.includes(' ki?') || lower.includes(' what is ') || lower.startsWith('what is '))) {
      const topicCandidate = raw
        .replace(/^(what is|explain|define|tell me about)\s+/i, '')
        .replace(/\s+(ki\?|ki|বলতে কি বোঝায়|কাকে বলে)\??$/i, '')
        .trim();
      if (topicCandidate.length > 2 && topicCandidate.length < 50) {
        memory.activeTopic = topicCandidate;
        if (!memory.recentEntities.includes(topicCandidate)) {
          memory.recentEntities.push(topicCandidate);
        }
      }
    }
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

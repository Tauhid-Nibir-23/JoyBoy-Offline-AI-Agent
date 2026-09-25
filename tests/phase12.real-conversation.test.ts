// Offline Study AI - Phase 12 Real Student Conversation Scenarios
import { describe, it, expect, beforeEach } from 'vitest';
import { 
  initDatabase, 
  createConversationInDB, 
  insertDocumentInDB,
  insertChunkInDB,
  attachDocumentToConversation,
  clearAllConversations,
  clearAllDocuments,
  setSetting
} from '../database/db';
import { conversationMemoryManager } from '../ai/conversationMemory';
import { queryRewriter } from '../ai/queryRewriter';
import { conversationContextManager } from '../ai/contextManager';
import { resolveResponseLanguage } from '../ai/languageDetector';

describe('Phase 12 — Real Student Conversation Tests', () => {
  beforeEach(async () => {
    await initDatabase();
    setSetting('ai_provider', 'auto');
    clearAllConversations();
    clearAllDocuments();
    conversationMemoryManager.clearCache();
  });

  // =========================================================================
  // Scenario A: 6-Turn Deadlock progression (Section 8)
  // =========================================================================
  it('Scenario A: Deadlock 6-turn progression tracks Topic, Subtopic (Hold and Wait) and MCQs', () => {
    const convId = 'conv-scenario-a';
    createConversationInDB(convId, 'Deadlock Study Session');

    // Turn 1: "What is Deadlock?"
    conversationMemoryManager.recordTurn(convId, 'user', 'What is Deadlock?');
    conversationMemoryManager.recordTurn(
      convId,
      'assistant',
      'Deadlock is a situation in an operating system where a set of processes are blocked because each process is holding a resource and waiting for another resource acquired by some other process.'
    );

    let mem = conversationMemoryManager.getMemory(convId);
    expect(mem.activeTopic?.toLowerCase()).toContain('deadlock');

    // Turn 2: "4 ta condition bolo"
    let re2 = queryRewriter.rewriteQuery('4 ta condition bolo', mem);
    expect(re2.rewrittenQuery.toLowerCase()).toContain('deadlock');
    conversationMemoryManager.recordTurn(convId, 'user', '4 ta condition bolo');
    conversationMemoryManager.recordTurn(
      convId,
      'assistant',
      `The four necessary Coffman conditions for deadlock are:
1. Mutual Exclusion: Only one process can use the resource at a time.
2. Hold and Wait: A process is holding at least one resource and waiting to acquire additional resources.
3. No Preemption: Resources cannot be preempted; they are released only voluntarily.
4. Circular Wait: A set of processes are waiting for each other in a circular chain.`
    );

    mem = conversationMemoryManager.getMemory(convId);
    expect(Object.keys(mem.enumeratedItems).length).toBe(4);

    // Turn 3: "2 number ta easy kore bujhao"
    let re3 = queryRewriter.rewriteQuery('2 number ta easy kore bujhao', mem);
    expect(re3.targetItemNumber).toBe(2);
    expect(re3.targetItemTitle?.toLowerCase()).toContain('hold and wait');
    conversationMemoryManager.recordTurn(convId, 'user', '2 number ta easy kore bujhao');
    conversationMemoryManager.recordTurn(
      convId,
      'assistant',
      'Hold and Wait means a process refuses to let go of what it has while demanding more, like a child keeping a toy car while crying for a toy train.'
    );

    mem = conversationMemoryManager.getMemory(convId);
    expect(mem.activeTopic).toBe('Deadlock');
    expect(mem.activeSubtopic).toBe('Hold and Wait');

    // Turn 4: "example daw"
    let re4 = queryRewriter.rewriteQuery('example daw', mem);
    expect(re4.rewrittenQuery.toLowerCase()).toContain('hold and wait');
    conversationMemoryManager.recordTurn(convId, 'user', 'example daw');
    conversationMemoryManager.recordTurn(
      convId,
      'assistant',
      'Real example: Process P1 has acquired the DVD drive and now waits for the printer held by P2.'
    );

    // Turn 5: "aro easy kore bolo"
    mem = conversationMemoryManager.getMemory(convId);
    let re5 = queryRewriter.rewriteQuery('aro easy kore bolo', mem);
    expect(re5.rewrittenQuery.toLowerCase()).toContain('hold and wait');
    conversationMemoryManager.recordTurn(convId, 'user', 'aro easy kore bolo');
    conversationMemoryManager.recordTurn(
      convId,
      'assistant',
      'Even simpler: Cooking analogy. You hold the salt shaker in your left hand and wait for pepper before starting.'
    );

    // Turn 6: "ei topic theke 3 ta MCQ daw"
    mem = conversationMemoryManager.getMemory(convId);
    let re6 = queryRewriter.rewriteQuery('ei topic theke 3 ta MCQ daw', mem);
    expect(re6.intent).toBe('generate_mcq');
    expect(re6.rewrittenQuery.toLowerCase()).toContain('3');
    expect(re6.rewrittenQuery.toLowerCase()).toContain('hold and wait');

    // Verify context sent to provider
    const assembled = conversationContextManager.assembleContext({
      conversationId: convId,
      history: [
        { id: '1', conversationId: convId, role: 'user', content: 'What is Deadlock?', createdAt: '1' },
        { id: '2', conversationId: convId, role: 'assistant', content: 'Deadlock def', createdAt: '2' },
        { id: '3', conversationId: convId, role: 'user', content: '4 ta condition bolo', createdAt: '3' },
        { id: '4', conversationId: convId, role: 'assistant', content: '1. Mutual Exclusion 2. Hold and Wait', createdAt: '4' },
        { id: '5', conversationId: convId, role: 'user', content: '2 number ta easy kore bujhao', createdAt: '5' },
        { id: '6', conversationId: convId, role: 'assistant', content: 'Hold and wait simplified', createdAt: '6' },
        { id: '7', conversationId: convId, role: 'user', content: 'ei topic theke 3 ta MCQ daw', createdAt: '7' }
      ],
      attachedDocs: [],
      systemInstruction: 'You are JoyBoy.',
      currentUserMessageText: 'ei topic theke 3 ta MCQ daw',
      resolvedContext: re6.resolvedContext,
      resolvedQuery: re6.resolvedQuery,
      intent: re6.intent
    });

    const userMsg = assembled.messages[assembled.messages.length - 1];
    expect(userMsg.content).toContain('ei topic theke 3 ta MCQ daw');
    expect(userMsg.content).toContain('Hold and Wait');
  });

  // =========================================================================
  // Scenario B: Topic Switching (Section 12)
  // =========================================================================
  it('Scenario B: Topic Switching correctly switches from Deadlock to Paging and back', () => {
    const convId = 'conv-topic-switch';
    createConversationInDB(convId, 'Switching Test');

    // Turn 1 & 2: Deadlock
    conversationMemoryManager.recordTurn(convId, 'user', 'What is Deadlock?');
    conversationMemoryManager.recordTurn(convId, 'assistant', 'Deadlock definition');
    conversationMemoryManager.recordTurn(convId, 'user', '4 conditions bolo');
    conversationMemoryManager.recordTurn(
      convId,
      'assistant',
      '1. Mutual Exclusion\n2. Hold and Wait\n3. No Preemption\n4. Circular Wait'
    );

    let mem = conversationMemoryManager.getMemory(convId);
    expect(mem.activeTopic).toBe('Deadlock');

    // Turn 3: "What is Paging?" (Self-contained new topic)
    let re3 = queryRewriter.rewriteQuery('What is Paging?', mem);
    expect(re3.wasRewritten).toBe(false);
    expect(re3.resolvedQuery).toBe('What is Paging?');

    conversationMemoryManager.recordTurn(convId, 'user', 'What is Paging?');
    conversationMemoryManager.recordTurn(
      convId,
      'assistant',
      'Paging is a memory management scheme that eliminates the need for contiguous allocation of physical memory.'
    );

    mem = conversationMemoryManager.getMemory(convId);
    expect(mem.activeTopic?.toLowerCase()).toContain('paging');
    expect(mem.previousTopic).toBe('Deadlock');

    // Turn 4: "eta easy kore bujhao" -> must refer to Paging, NOT Deadlock!
    let re4 = queryRewriter.rewriteQuery('eta easy kore bujhao', mem);
    expect(re4.rewrittenQuery.toLowerCase()).toContain('paging');
    expect(re4.rewrittenQuery.toLowerCase()).not.toContain('deadlock');

    // Turn 5: "deadlock er 2 number condition ta abar bolo" -> explicit switch back to Deadlock
    conversationMemoryManager.recordTurn(convId, 'user', 'deadlock er 2 number condition ta abar bolo');
    mem = conversationMemoryManager.getMemory(convId);
    let re5 = queryRewriter.rewriteQuery('deadlock er 2 number condition ta abar bolo', mem);
    expect(re5.targetItemNumber).toBe(2);
    expect(re5.targetItemTitle?.toLowerCase()).toContain('hold and wait');
  });

  // =========================================================================
  // Scenario C: Bengali Unicode Input (Section 9)
  // =========================================================================
  it('Scenario C: Bengali Unicode input resolves context and detects target language', () => {
    const convId = 'conv-bengali';
    createConversationInDB(convId, 'Bengali Test');

    const q1 = 'ডেডলক কী?';
    expect(resolveResponseLanguage(q1)).toBe('bn');

    conversationMemoryManager.recordTurn(convId, 'user', q1);
    conversationMemoryManager.recordTurn(
      convId,
      'assistant',
      'ডেডলক (Deadlock) হলো এমন একটি অবস্থা যেখানে দুটি বা ততোধিক Process একে অপরের Resource মুক্ত করার জন্য অনির্দিষ্টকালের জন্য অপেক্ষা করতে থাকে।'
    );

    let mem = conversationMemoryManager.getMemory(convId);
    expect(mem.activeTopic).toBeDefined();

    // Turn 2: "এর চারটা শর্ত বলো"
    conversationMemoryManager.recordTurn(convId, 'user', 'এর চারটা শর্ত বলো');
    conversationMemoryManager.recordTurn(
      convId,
      'assistant',
      'ডেডলকের ৪টি প্রধান শর্ত:\n১. Mutual Exclusion\n২. Hold and Wait\n৩. No Preemption\n৪. Circular Wait'
    );

    mem = conversationMemoryManager.getMemory(convId);
    // Turn 3: "২ নম্বরটা সহজ করে বুঝাও"
    let re3 = queryRewriter.rewriteQuery('২ নম্বরটা সহজ করে বুঝাও', mem);
    expect(re3.targetItemNumber).toBe(2);
    expect(re3.targetItemTitle?.toLowerCase()).toContain('hold and wait');

    // Turn 4: "একটা বাস্তব উদাহরণ দাও"
    conversationMemoryManager.recordTurn(convId, 'user', '২ নম্বরটা সহজ করে বুঝাও');
    conversationMemoryManager.recordTurn(convId, 'assistant', 'Hold and Wait এর ব্যাখ্যা');
    mem = conversationMemoryManager.getMemory(convId);
    let re4 = queryRewriter.rewriteQuery('একটা বাস্তব উদাহরণ দাও', mem);
    expect(re4.intent).toBe('example');
    expect(re4.rewrittenQuery.toLowerCase()).toContain('hold and wait');
  });

  // =========================================================================
  // Scenario D: Banglish Input (Section 10)
  // =========================================================================
  it('Scenario D: Banglish input resolves anaphoric follow-up queries', () => {
    const convId = 'conv-banglish';
    createConversationInDB(convId, 'Banglish Test');

    conversationMemoryManager.recordTurn(convId, 'user', 'deadlock ki?');
    conversationMemoryManager.recordTurn(
      convId,
      'assistant',
      'Deadlock হলো একটি অবস্থা যেখানে দুইটি বা তার বেশি প্রসেস একে অপরের জন্য রিসোর্স আটকে রেখে অপেক্ষা করে।'
    );

    let mem = conversationMemoryManager.getMemory(convId);

    // "eta easy kore bujhao"
    let re1 = queryRewriter.rewriteQuery('eta easy kore bujhao', mem);
    expect(re1.rewrittenQuery.toLowerCase()).toContain('deadlock');

    // "real life example daw"
    let re2 = queryRewriter.rewriteQuery('real life example daw', mem);
    expect(re2.intent).toBe('example');
    expect(re2.rewrittenQuery.toLowerCase()).toContain('deadlock');

    // "exam e kivabe likhbo?"
    let re3 = queryRewriter.rewriteQuery('exam e kivabe likhbo?', mem);
    expect(re3.intent).toBe('exam_topics');
    expect(re3.rewrittenQuery.toLowerCase()).toContain('deadlock');
  });

  // =========================================================================
  // Scenario E: English Follow-ups (Section 11)
  // =========================================================================
  it('Scenario E: English conversation remains in English language preference', () => {
    const q = 'What is deadlock?';
    expect(resolveResponseLanguage(q)).toBe('en');

    const followUp = 'Explain the second condition simply.';
    expect(resolveResponseLanguage(followUp)).toBe('en');
  });

  // =========================================================================
  // Scenario F: PDF Grounding & Document Isolation (Section 15 & 16)
  // =========================================================================
  it('Scenario F: PDF attachment supplies evidence without leaking across chats', async () => {
    const chatA = 'chat-os';
    const chatB = 'chat-db';
    createConversationInDB(chatA, 'Operating Systems Chat');
    createConversationInDB(chatB, 'Database Chat');

    // Insert OS doc into DB
    insertDocumentInDB({
      id: 'doc-os',
      filename: 'OS_Chapter7.pdf',
      original_path: '/docs/OS_Chapter7.pdf',
      file_type: 'pdf',
      file_size: 50000,
      file_hash: 'hash-os',
      imported_at: new Date().toISOString(),
      modified_at: null,
      extraction_status: 'Ready',
      extracted_text: 'OS Content',
      character_count: 10,
      indexing_status: 'Ready',
      error_message: null
    });
    insertChunkInDB({
      id: 'chunk-os-1',
      document_id: 'doc-os',
      chunk_index: 0,
      page_number: 14,
      heading: 'Deadlock',
      text: 'In Chapter 7, Deadlock prevention can be achieved by invalidating Hold and Wait condition.',
      start_offset: 0,
      end_offset: 90,
      character_count: 90,
      token_estimate: 25,
      metadata_json: null
    });
    attachDocumentToConversation(chatA, 'doc-os');

    // Insert DB doc into DB
    insertDocumentInDB({
      id: 'doc-db',
      filename: 'DBMS_Normalization.pdf',
      original_path: '/docs/DBMS_Normalization.pdf',
      file_type: 'pdf',
      file_size: 40000,
      file_hash: 'hash-db',
      imported_at: new Date().toISOString(),
      modified_at: null,
      extraction_status: 'Ready',
      extracted_text: 'DBMS Content',
      character_count: 12,
      indexing_status: 'Ready',
      error_message: null
    });
    insertChunkInDB({
      id: 'chunk-db-1',
      document_id: 'doc-db',
      chunk_index: 0,
      page_number: 5,
      heading: 'Normalization',
      text: 'Third Normal Form (3NF) requires removing transitive dependencies.',
      start_offset: 0,
      end_offset: 68,
      character_count: 68,
      token_estimate: 20,
      metadata_json: null
    });
    attachDocumentToConversation(chatB, 'doc-db');

    // Context assembled for Chat A must only include OS doc
    const ctxA = conversationContextManager.assembleContext({
      conversationId: chatA,
      history: [{ id: '1', conversationId: chatA, role: 'user', content: 'What does this PDF say about Deadlock?', createdAt: '1' }],
      attachedDocs: [{ id: 'doc-os', filename: 'OS_Chapter7.pdf' } as any],
      systemInstruction: 'You are JoyBoy.',
      currentUserMessageText: 'What does this PDF say about Deadlock?'
    });
    expect(ctxA.messages[0].content).toContain('OS_Chapter7.pdf');
    expect(ctxA.messages[0].content).not.toContain('DBMS_Normalization.pdf');

    // Context assembled for Chat B must only include DB doc
    const ctxB = conversationContextManager.assembleContext({
      conversationId: chatB,
      history: [{ id: '2', conversationId: chatB, role: 'user', content: 'Explain 3NF', createdAt: '2' }],
      attachedDocs: [{ id: 'doc-db', filename: 'DBMS_Normalization.pdf' } as any],
      systemInstruction: 'You are JoyBoy.',
      currentUserMessageText: 'Explain 3NF'
    });
    expect(ctxB.messages[0].content).toContain('DBMS_Normalization.pdf');
    expect(ctxB.messages[0].content).not.toContain('OS_Chapter7.pdf');
  });
});

import { describe, it, expect, beforeEach } from 'vitest';
import { 
  initDatabase, 
  resetDatabaseStateForTesting,
  insertDocumentInDB, 
  insertChunkInDB,
  getAllStudySessionsFromDB,
  getStudySessionByIdFromDB,
  deleteStudySessionFromDB,
  clearAllStudySessionsFromDB,
  getQuizBySessionIdFromDB,
  getFlashcardDeckBySessionIdFromDB,
  getStudyPlanBySessionIdFromDB,
  getAllConversations,
  getMessagesByConversationId
} from '../database/db';
import { studyService } from '../study/studyService';
import { parseQuizJson, parseFlashcardsJson, parseStudyPlanJson, cleanJsonString } from '../study/quizParser';
import { ragService } from '../rag';
import { defaultEmbeddingProvider } from '../rag/embeddings';

describe('Phase 5 — AI Study Features Automated Tests', () => {
  beforeEach(async () => {
    resetDatabaseStateForTesting();
    await initDatabase();
    clearAllStudySessionsFromDB();
  });

  describe('1. Study Mode & Prompt Construction', () => {
    it('generates a structured explanation with required educational sections', async () => {
      const result = await studyService.explainTopic({
        topic: 'Virtual Memory',
        level: 'Standard'
      });

      expect(result).toBeDefined();
      expect(result.topic).toBe('Virtual Memory');
      expect(result.definition.length).toBeGreaterThan(0);
      expect(result.howItWorks.length).toBeGreaterThan(0);
      expect(result.components.length).toBeGreaterThan(0);
      expect(result.example.length).toBeGreaterThan(0);
      expect(result.examPoints.length).toBeGreaterThan(0);
    });

    it('generates structured notes formatted with standard markdown headings', async () => {
      const notes = await studyService.makeNotes({
        topic: 'Operating Systems & Concurrency'
      });

      expect(notes).toBeDefined();
      expect(notes.topic).toBe('Operating Systems & Concurrency');
      expect(notes.markdown).toContain('#');
      expect(notes.markdown.toLowerCase()).toContain('key concepts');
      expect(notes.markdown.toLowerCase()).toContain('important definitions');
    });
  });

  describe('2. Summarization (Small & Multi-Chunk Documents)', () => {
    it('summarizes a small document cleanly with key takeaways', async () => {
      const docId = 'doc_small_' + Date.now();
      insertDocumentInDB({
        id: docId,
        filename: 'small_notes.txt',
        file_type: 'txt',
        file_size: 450,
        file_hash: 'hash_small_' + Date.now(),
        extraction_status: 'Ready',
        extracted_text: 'Operating system scheduling determines which process runs when CPU is free.',
        character_count: 75,
        indexing_status: 'Ready'
      });

      insertChunkInDB({
        id: 'chunk_sm_1',
        document_id: docId,
        chunk_index: 0,
        text: 'Operating system scheduling determines which process runs when CPU is free. Preemptive scheduling switches processes at quantum boundaries.',
        start_offset: 0,
        end_offset: 140,
        character_count: 140,
        token_estimate: 28,
        heading: 'Scheduling Basics',
        page_number: 1,
        metadata_json: JSON.stringify({ section: 'intro' })
      });

      const summary = await studyService.summarizeDocument({
        documentId: docId,
        mode: 'short'
      });

      expect(summary).toBeDefined();
      expect(summary.isChunked).toBe(false);
      expect(summary.content.length).toBeGreaterThan(0);
      expect(summary.sources).toBeDefined();
      expect(summary.sources?.length).toBe(1);
      expect(summary.sources?.[0].filename).toBe('small_notes.txt');
    });

    it('performs chunk-based multi-pass summarization on large multi-chunk documents', async () => {
      const docId = 'doc_large_' + Date.now();
      insertDocumentInDB({
        id: docId,
        filename: 'large_textbook.pdf',
        file_type: 'pdf',
        file_size: 15000,
        file_hash: 'hash_large_' + Date.now(),
        extraction_status: 'Ready',
        extracted_text: 'Comprehensive OS textbook chapter covering memory, processes, filesystems, and I/O.',
        character_count: 5000,
        indexing_status: 'Ready'
      });

      // Insert 4 chunks to trigger multi-chunk batching (> 2 chunks)
      for (let i = 0; i < 4; i++) {
        insertChunkInDB({
          id: `chunk_lg_${i}`,
          document_id: docId,
          chunk_index: i,
          text: `Section ${i + 1}: Detailed textbook content covering system module ${i + 1}, its algorithms, architecture, and tradeoffs.`,
          start_offset: i * 300,
          end_offset: (i + 1) * 300,
          character_count: 300,
          token_estimate: 60,
          heading: `Chapter ${i + 1}`,
          page_number: i + 1,
          metadata_json: JSON.stringify({ part: i + 1 })
        });
      }

      const progressSteps: string[] = [];
      const summary = await studyService.summarizeDocument({
        documentId: docId,
        mode: 'detailed',
        options: {
          onProgress: (msg) => {
            progressSteps.push(msg);
          }
        }
      });

      expect(summary).toBeDefined();
      expect(summary.isChunked).toBe(true);
      expect(summary.chunkCount).toBe(4);
      expect(summary.content.length).toBeGreaterThan(0);
      expect(summary.sources?.length).toBeGreaterThanOrEqual(4);
      expect(progressSteps.length).toBeGreaterThan(0);
      expect(progressSteps.some((p) => p.includes('Summarizing part'))).toBe(true);
    });
  });

  describe('3. Quiz Generator & JSON Parsing / Repair', () => {
    it('parses valid MCQ JSON into questions with 4 options and explanations', () => {
      const validJson = JSON.stringify([
        {
          question: "Which scheduling algorithm is non-preemptive?",
          type: "mcq",
          options: ["FCFS", "Round Robin", "SRTF", "Multilevel Queue"],
          correctAnswer: 0,
          explanation: "First-Come, First-Served runs jobs to completion without preemption."
        }
      ]);

      const res = parseQuizJson(validJson, 'mcq');
      expect(res.success).toBe(true);
      expect(res.data?.length).toBe(1);
      expect(res.data?.[0].options.length).toBe(4);
      expect(res.data?.[0].correctAnswer).toBe(0);
    });

    it('safely repairs markdown code blocks and trailing commas in LLM output', () => {
      const malformedJson = 
`Here is the quiz you requested:
\`\`\`json
[
  {
    "question": "What does MMU stand for?",
    "type": "mcq",
    "options": [
      "Memory Management Unit",
      "Main Memory Utility",
      "Micro Module Unit",
      "Macro Memory Utility",
    ],
    "correctAnswer": 0,
    "explanation": "MMU is the Memory Management Unit.",
  },
]
\`\`\`
Hope this helps!`;

      const res = parseQuizJson(malformedJson, 'mcq');
      expect(res.success).toBe(true);
      expect(res.data?.length).toBe(1);
      expect(res.data?.[0].question).toContain('MMU');
      expect(res.data?.[0].options.length).toBe(4);
    });

    it('safely repairs truncated JSON with unclosed brackets', () => {
      const truncated = `[{"question": "Is virtual memory infinite?", "type": "true_false", "options": ["True", "False"], "correctAnswer": "False", "explanation": "It is bounded by address space and swap disk capacity."`;

      const res = parseQuizJson(truncated, 'true_false');
      expect(res.success).toBe(true);
      expect(res.data?.length).toBe(1);
      expect(res.data?.[0].type).toBe('true_false');
    });

    it('gracefully returns friendly error when JSON is completely invalid instead of crashing', () => {
      const garbage = 'Sorry, as an AI I am unable to generate a quiz right now.';
      const res = parseQuizJson(garbage);
      expect(res.success).toBe(false);
      expect(res.error).toBeDefined();
    });

    it('generates a full quiz via StudyService and saves to SQLite', async () => {
      const quiz = await studyService.generateQuiz({
        topic: 'CPU Scheduling Algorithms',
        count: 5,
        difficulty: 'Medium',
        type: 'mcq'
      });

      expect(quiz).toBeDefined();
      expect(quiz.questions.length).toBe(5);
      expect(quiz.difficulty).toBe('Medium');
      expect(quiz.questionType).toBe('mcq');

      // Verify SQLite persistence
      const history = studyService.getStudyHistory();
      const session = history.find((h) => h.topic === 'CPU Scheduling Algorithms' && h.type === 'quiz');
      expect(session).toBeDefined();

      if (session) {
        const storedQuiz = getQuizBySessionIdFromDB(session.id);
        expect(storedQuiz).toBeDefined();
        expect(storedQuiz?.question_count).toBe(5);
      }
    });
  });

  describe('4. Flashcards Generation & Persistence', () => {
    it('generates flashcards and persists them to SQLite', async () => {
      const deck = await studyService.generateFlashcards({
        topic: 'Operating System Memory Terms',
        count: 5
      });

      expect(deck).toBeDefined();
      expect(deck.cards.length).toBe(5);
      expect(deck.cards[0].front).toBeDefined();
      expect(deck.cards[0].back).toBeDefined();

      // Check SQLite table
      const history = studyService.getStudyHistory();
      const session = history.find((h) => h.topic === 'Operating System Memory Terms' && h.type === 'flashcards');
      expect(session).toBeDefined();

      if (session) {
        const storedDeck = getFlashcardDeckBySessionIdFromDB(session.id);
        expect(storedDeck).toBeDefined();
        expect(storedDeck?.card_count).toBe(5);
      }
    });
  });

  describe('5. Study Plan Input Validation & Disclaimer', () => {
    it('generates a daily study schedule with mandatory safety disclaimer', async () => {
      const plan = await studyService.generateStudyPlan({
        subject: 'Algorithms Final Exam',
        days: 7,
        hoursPerDay: 2,
        examDate: '2026-10-15'
      });

      expect(plan).toBeDefined();
      expect(plan.days).toBe(7);
      expect(plan.hoursPerDay).toBe(2);
      expect(plan.examDate).toBe('2026-10-15');
      expect(plan.schedule.length).toBe(7);
      expect(plan.schedule[0].day).toBe(1);
      expect(plan.schedule[0].activity).toBeDefined();
      expect(plan.schedule[0].revisionTask).toBeDefined();
      
      // Safety disclaimer verification
      expect(plan.disclaimer).toContain('does not guarantee');

      // SQLite persistence check
      const history = studyService.getStudyHistory();
      const session = history.find((h) => h.topic === 'Algorithms Final Exam' && h.type === 'plan');
      expect(session).toBeDefined();

      if (session) {
        const storedPlan = getStudyPlanBySessionIdFromDB(session.id);
        expect(storedPlan).toBeDefined();
        expect(storedPlan?.days).toBe(7);
      }
    });
  });

  describe('6. RAG Grounding & No-Context Fallback Safety', () => {
    it('grounds study features in local document chunks when relevant material exists', async () => {
      const docId = 'doc_rag_test_' + Date.now();
      insertDocumentInDB({
        id: docId,
        filename: 'scheduling_guide.txt',
        file_type: 'txt',
        file_size: 600,
        file_hash: 'hash_rag_test_' + Date.now(),
        extraction_status: 'Ready',
        extracted_text: 'Round Robin assigns time quantum in circular order.',
        character_count: 50,
        indexing_status: 'Indexed'
      });

      const embedding = await defaultEmbeddingProvider.embedText('Round Robin scheduling time quantum');

      insertChunkInDB({
        id: 'chunk_rr_1',
        document_id: docId,
        chunk_index: 0,
        text: 'Round Robin (RR) assigns CPU execution time to each process using a fixed time quantum in circular order.',
        start_offset: 0,
        end_offset: 105,
        character_count: 105,
        token_estimate: 22,
        heading: 'Round Robin Scheduling',
        page_number: 1,
        metadata_json: JSON.stringify({ topic: 'Round Robin' }),
        embedding_json: JSON.stringify(embedding)
      });

      const explanation = await studyService.explainTopic({
        topic: 'Round Robin scheduling',
        documentId: docId
      });

      expect(explanation.sources).toBeDefined();
      expect(explanation.sources?.length).toBeGreaterThan(0);
      expect(explanation.sources?.[0].filename).toBe('scheduling_guide.txt');
      expect(explanation.sources?.[0].similarity).toBeGreaterThan(0.08);
      expect(explanation.groundingNotice).toBeUndefined();
    });

    it('exposes clear no-context notice and does not fabricate citations when no matching material exists', async () => {
      // Query an unrelated topic with a document that has zero matching content
      const docId = 'doc_unrelated_' + Date.now();
      insertDocumentInDB({
        id: docId,
        filename: 'botany_notes.txt',
        file_type: 'txt',
        file_size: 400,
        file_hash: 'hash_unrelated_' + Date.now(),
        extraction_status: 'Ready',
        extracted_text: 'Chlorophyll absorbs sunlight in plant leaves during photosynthesis.',
        character_count: 65,
        indexing_status: 'Indexed'
      });

      const result = await studyService.explainTopic({
        topic: 'Quantum Computing Superposition',
        documentId: docId
      });

      // Verification of Requirement 11:
      // "No sufficiently relevant material was found in your study documents."
      // "Do not fabricate citations."
      expect(result.groundingNotice).toBe('No sufficiently relevant material was found in your study documents.');
      expect(result.sources).toEqual([]);
    });
  });

  describe('7. History Persistence & Chat Integration', () => {
    it('supports saving, retrieving by id, and deleting study sessions in SQLite', async () => {
      const quiz = await studyService.generateQuiz({
        topic: 'Quick Sort Complexity',
        count: 5
      });

      const history = studyService.getStudyHistory();
      expect(history.length).toBeGreaterThanOrEqual(1);

      const item = history.find((h) => h.topic === 'Quick Sort Complexity');
      expect(item).toBeDefined();

      if (item) {
        const retrieved = studyService.getStudySession(item.id);
        expect(retrieved).toBeDefined();
        expect(retrieved?.id).toBe(item.id);

        studyService.deleteStudySession(item.id);
        const afterDelete = studyService.getStudySession(item.id);
        expect(afterDelete).toBeNull();
      }
    });

    it('integrates with ChatService by seeding study content into an interactive chat conversation', async () => {
      const convId = await studyService.openInChat({
        type: 'quiz',
        topic: 'Memory Management',
        initialSummaryText: '1. What is paging?\n2. What is segmentation?',
        documentName: 'OS_Textbook.pdf'
      });

      expect(convId).toBeDefined();

      const convs = getAllConversations();
      const matchedConv = convs.find((c) => c.id === convId);
      expect(matchedConv).toBeDefined();
      expect(matchedConv?.title).toContain('Memory Management');

      const messages = getMessagesByConversationId(convId);
      expect(messages.length).toBe(1);
      expect(messages[0].role).toBe('assistant');
      expect(messages[0].content).toContain('Memory Management');
      expect(messages[0].content).toContain('What is paging?');
    });
  });
});

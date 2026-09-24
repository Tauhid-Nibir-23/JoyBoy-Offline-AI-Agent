// Offline Study AI - Study Service (Phase 5)
import { 
  StudyActionType, 
  QuizDifficulty, 
  QuizQuestionType, 
  QuizData, 
  FlashcardDeck, 
  StudyPlanData, 
  SummaryData, 
  SummaryMode, 
  NotesData, 
  ExplainData, 
  StudySession 
} from './types';
import { parseQuizJson, parseFlashcardsJson, parseStudyPlanJson } from './quizParser';
import { chatService } from '../ai/chatService';
import { ChatMessage } from '../ai/provider';
import { ragService } from '../rag';
import { RAGSourceCitation, RAGSearchResult } from '../rag/types';
import { 
  saveStudySessionInDB, 
  getAllStudySessionsFromDB, 
  getStudySessionByIdFromDB, 
  deleteStudySessionFromDB, 
  clearAllStudySessionsFromDB,
  saveQuizInDB,
  saveFlashcardDeckInDB,
  saveStudyPlanInDB,
  getDocumentById,
  getChunksByDocumentId,
  insertMessageInDB,
  isDatabaseReady,
  initDatabase,
  DBDocumentChunk
} from '../database/db';

export interface GenerateStudyOptions {
  signal?: AbortSignal;
  onProgress?: (message: string, percent: number) => void;
  onToken?: (token: string) => void;
}

export class StudyService {
  public async ensureReady(): Promise<boolean> {
    if (isDatabaseReady()) return true;
    return await initDatabase();
  }

  /**
   * Helper: Retrieve grounded RAG context for a topic or document.
   */
  private async retrieveContext(
    topicOrQuery: string,
    documentId?: string
  ): Promise<{
    sources: RAGSourceCitation[];
    materialContext: string;
    hasGroundedMaterial: boolean;
    groundingNotice?: string;
  }> {
    const isDocSpecified = !!documentId;
    const isStudyMaterialsEnabled = chatService.isStudyMaterialsEnabled();

    if (!isDocSpecified && !isStudyMaterialsEnabled) {
      return {
        sources: [],
        materialContext: '',
        hasGroundedMaterial: false
      };
    }

    try {
      const searchResults: RAGSearchResult[] = await ragService.search(topicOrQuery, {
        topK: 4,
        minSimilarity: 0.08,
        filterDocumentIds: documentId ? [documentId] : undefined
      });

      if (!searchResults || searchResults.length === 0) {
        return {
          sources: [],
          materialContext: '',
          hasGroundedMaterial: false,
          groundingNotice: 'No sufficiently relevant material was found in your study documents.'
        };
      }

      const sources: RAGSourceCitation[] = searchResults.map((r) => ({
        documentId: r.chunk.documentId,
        filename: r.chunk.filename,
        chunkIndex: r.chunk.chunkIndex,
        heading: r.chunk.heading || null,
        similarity: Math.round(r.similarity * 1000) / 1000,
        snippet: r.chunk.text.length > 180 ? r.chunk.text.substring(0, 180).trim() + '...' : r.chunk.text
      }));

      const materialContext = searchResults
        .map((r) => `[Source: ${r.chunk.filename}${r.chunk.heading ? ` | ${r.chunk.heading}` : ''}]\n${r.chunk.text.trim()}`)
        .join('\n\n---\n\n');

      return {
        sources,
        materialContext,
        hasGroundedMaterial: true
      };
    } catch (err) {
      console.warn('RAG context retrieval failed for study action:', err);
      return {
        sources: [],
        materialContext: '',
        hasGroundedMaterial: false,
        groundingNotice: 'No sufficiently relevant material was found in your study documents.'
      };
    }
  }

  /**
   * Helper: Execute AI generation with active provider
   */
  private async callModel(
    systemPrompt: string,
    userPrompt: string,
    options?: GenerateStudyOptions,
    maxTokens: number = 1024,
    temperature: number = 0.5
  ): Promise<string> {
    await this.ensureReady();
    const provider = await chatService.resolveProvider();

    const messages: ChatMessage[] = [
      {
        id: `sys_${Date.now()}`,
        conversationId: 'temp_study',
        role: 'system',
        content: systemPrompt,
        createdAt: new Date().toISOString()
      },
      {
        id: `usr_${Date.now()}`,
        conversationId: 'temp_study',
        role: 'user',
        content: userPrompt,
        createdAt: new Date().toISOString()
      }
    ];

    return await provider.generateResponse(messages, {
      systemPrompt,
      maxTokens,
      temperature,
      signal: options?.signal,
      callbacks: {
        onToken: options?.onToken
      }
    });
  }

  // ==========================================
  // 1. EXPLAIN MODE
  // ==========================================
  public async explainTopic(params: {
    topic: string;
    documentId?: string;
    level?: 'Standard' | 'Beginner' | 'Exam-focused';
    options?: GenerateStudyOptions;
  }): Promise<ExplainData> {
    await this.ensureReady();
    const { topic, documentId, level = 'Standard', options } = params;
    const doc = documentId ? getDocumentById(documentId) : null;

    const rag = await this.retrieveContext(topic, documentId);

    const systemPrompt = 
      'You are an expert offline study assistant. Provide clear, well-structured educational explanations. ' +
      'Organize your explanation into: Simple Definition, How It Works, Important Components, Concrete Example, and Exam-Focused Points. ' +
      'Do not pretend information came from a document if no document context is provided.';

    let userPrompt = '';
    if (rag.hasGroundedMaterial) {
      userPrompt = 
`LOCAL STUDY MATERIAL:
${rag.materialContext}

USER REQUEST:
Please explain "${topic}" (Target depth: ${level}) using the local study material above. Ground your answer in the provided text.

Format your response strictly using these sections:
### Simple Definition
### How It Works
### Important Components
### Concrete Example
### Exam-Focused Points`;
    } else {
      userPrompt = 
`${rag.groundingNotice ? `[Note: ${rag.groundingNotice}]\n\n` : ''}USER REQUEST:
Please explain "${topic}" (Target depth: ${level}) based on your local AI knowledge.

Format your response strictly using these sections:
### Simple Definition
### How It Works
### Important Components
### Concrete Example
### Exam-Focused Points`;
    }

    const rawOutput = await this.callModel(systemPrompt, userPrompt, options, 1200, 0.6);

    // Extract structured sections from output
    const extractSection = (headerName: string, fallback: string = ''): string => {
      const regex = new RegExp(`###?\\s*${headerName}[^\\n]*\\n([\\s\\S]*?)(?=(?:###?\\s*|$))`, 'i');
      const match = rawOutput.match(regex);
      return match && match[1] ? match[1].trim() : fallback;
    };

    const definition = extractSection('Simple Definition', rawOutput.slice(0, 300));
    const howItWorks = extractSection('How It Works', 'Explanation of functional mechanics and workflow.');
    
    const componentsText = extractSection('Important Components', '');
    const components = componentsText
      ? componentsText.split(/\n[-*•]\s*/).map((c) => c.trim()).filter((c) => c.length > 2)
      : ['Core Architecture', 'Operational Interface', 'Memory Subsystem'];

    const example = extractSection('Concrete Example', 'Real-world application scenario.');
    
    const examPointsText = extractSection('Exam-Focused Points', '');
    const examPoints = examPointsText
      ? examPointsText.split(/\n[-*•]\s*/).map((e) => e.trim()).filter((e) => e.length > 2)
      : ['Key distinction and definition', 'Common pitfall/exception'];

    const explainData: ExplainData = {
      topic,
      definition: definition || rawOutput,
      howItWorks,
      components: components.length > 0 ? components : ['Core principles'],
      example,
      examPoints: examPoints.length > 0 ? examPoints : ['Review key terminology'],
      markdown: rawOutput,
      sources: rag.sources,
      groundingNotice: rag.groundingNotice
    };

    // Save to study session history
    const sessionId = `exp_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
    saveStudySessionInDB({
      id: sessionId,
      session_type: 'explain',
      title: `Explanation: ${topic}`,
      topic,
      document_id: documentId || null,
      document_name: doc ? doc.filename : null,
      data_json: JSON.stringify(explainData),
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    });

    return explainData;
  }

  // ==========================================
  // 2. SUMMARIZER (Supports chunk-based for large documents)
  // ==========================================
  public async summarizeDocument(params: {
    topic?: string;
    documentId?: string;
    mode?: SummaryMode;
    options?: GenerateStudyOptions;
  }): Promise<SummaryData> {
    await this.ensureReady();
    const { topic = '', documentId, mode = 'short', options } = params;
    const doc = documentId ? getDocumentById(documentId) : null;
    const effectiveTopic = topic || (doc ? doc.filename : 'Document Summary');

    let allChunks: DBDocumentChunk[] = [];
    if (documentId) {
      allChunks = getChunksByDocumentId(documentId);
    }

    let summaryText = '';
    let sources: RAGSourceCitation[] = [];
    let isChunked = false;
    let chunkCount = 0;
    let groundingNotice: string | undefined;

    // Check if we need chunk-based summarization (> 2 chunks)
    if (allChunks.length > 2) {
      isChunked = true;
      chunkCount = allChunks.length;
      options?.onProgress?.(`Starting multi-chunk summarization (${allChunks.length} chunks)...`, 10);

      // Batch chunks in pairs to stay strictly within local model context limit
      const batchSize = 2;
      const intermediateSummaries: string[] = [];

      for (let i = 0; i < allChunks.length; i += batchSize) {
        const batch = allChunks.slice(i, i + batchSize);
        const batchNum = Math.floor(i / batchSize) + 1;
        const totalBatches = Math.ceil(allChunks.length / batchSize);
        const percent = Math.round(15 + (batchNum / totalBatches) * 60);

        options?.onProgress?.(`Summarizing part ${batchNum} of ${totalBatches}...`, percent);

        const batchText = batch.map((c) => c.text).join('\n\n');
        const intermediatePrompt = 
`Summarize the key information, main concepts, and important facts from this section of "${doc?.filename || 'document'}":

${batchText}

Provide a concise, factual 2-3 paragraph summary of this section.`;

        const partSummary = await this.callModel(
          'You are a concise summarizer. Extract essential points accurately without hallucination.',
          intermediatePrompt,
          options,
          400,
          0.3
        );
        intermediateSummaries.push(`--- Part ${batchNum} ---\n${partSummary}`);
      }

      options?.onProgress?.('Synthesizing consolidated final summary...', 85);

      const modeInstruction = mode === 'short' 
        ? 'a concise, high-level executive summary (2-3 paragraphs)'
        : mode === 'exam'
        ? 'an exam-focused summary emphasizing key definitions, mechanisms, and probable test topics'
        : 'a thorough, detailed summary covering all major concepts and findings';

      const finalSynthesisPrompt = 
`The following are section-by-section summaries of "${doc?.filename || 'the document'}":

${intermediateSummaries.join('\n\n')}

Synthesize these section summaries into ${modeInstruction}.
End your summary with a section titled:
### Key Takeaways
- Point 1
- Point 2
- Point 3`;

      summaryText = await this.callModel(
        'You are an expert study assistant. Synthesize section summaries into a coherent final summary with key takeaways.',
        finalSynthesisPrompt,
        options,
        1000,
        0.4
      );

      // Assign all chunks as sources
      sources = allChunks.slice(0, 8).map((c) => ({
        documentId: c.document_id,
        filename: doc?.filename || 'Document',
        chunkIndex: c.chunk_index,
        heading: c.heading || null,
        similarity: 1.0,
        snippet: c.text.substring(0, 160) + '...'
      }));

      options?.onProgress?.('Summary complete!', 100);
    } else if (allChunks.length > 0) {
      // Small document (1 or 2 chunks)
      chunkCount = allChunks.length;
      options?.onProgress?.('Summarizing document...', 30);

      const combinedText = allChunks.map((c) => c.text).join('\n\n');
      const modeInstruction = mode === 'short' 
        ? 'a concise overview summary' 
        : mode === 'exam' 
        ? 'an exam-focused summary highlighting key points to memorize' 
        : 'a detailed summary with comprehensive explanations';

      const prompt = 
`DOCUMENT CONTENT:
${combinedText}

Please provide ${modeInstruction} of the above material.
Include:
1. Main Overview
2. Core Topics & Mechanisms
3. Key Takeaways (bulleted list)`;

      summaryText = await this.callModel(
        'You are a factual study summarizer. Summarize accurately from the provided text.',
        prompt,
        options,
        800,
        0.4
      );

      sources = allChunks.map((c) => ({
        documentId: c.document_id,
        filename: doc?.filename || 'Document',
        chunkIndex: c.chunk_index,
        heading: c.heading || null,
        similarity: 1.0,
        snippet: c.text.substring(0, 160) + '...'
      }));

      options?.onProgress?.('Summary complete!', 100);
    } else {
      // Topic summary without direct document, or using RAG search
      const rag = await this.retrieveContext(effectiveTopic, documentId);
      sources = rag.sources;
      groundingNotice = rag.groundingNotice;

      const prompt = rag.hasGroundedMaterial
        ? `LOCAL STUDY MATERIAL:\n${rag.materialContext}\n\nPlease generate a ${mode} summary on "${effectiveTopic}" using the local study material above.`
        : `${rag.groundingNotice ? `[Note: ${rag.groundingNotice}]\n\n` : ''}Please generate a ${mode} summary on "${effectiveTopic}" based on your offline knowledge.`;

      summaryText = await this.callModel(
        'You are an offline study assistant providing structured summaries.',
        prompt,
        options,
        800,
        0.4
      );
    }

    // Extract key takeaways
    const takeawaysMatch = summaryText.match(/Key Takeaways[^\n]*\n([\s\S]*?)(?=(?:###|$))/i);
    const keyTakeaways = takeawaysMatch && takeawaysMatch[1]
      ? takeawaysMatch[1].split(/\n[-*•]\s*/).map((t) => t.trim()).filter((t) => t.length > 2)
      : ['Essential concept review', 'Core application principles'];

    const summaryData: SummaryData = {
      topic: effectiveTopic,
      mode,
      content: summaryText,
      keyTakeaways: keyTakeaways.length > 0 ? keyTakeaways : ['Core summary'],
      sources: sources.length > 0 ? sources : undefined,
      isChunked,
      chunkCount,
      groundingNotice
    };

    // Save to study session history
    const sessionId = `sum_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
    saveStudySessionInDB({
      id: sessionId,
      session_type: 'summarize',
      title: `Summary (${mode}): ${effectiveTopic}`,
      topic: effectiveTopic,
      document_id: documentId || null,
      document_name: doc ? doc.filename : null,
      data_json: JSON.stringify(summaryData),
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    });

    return summaryData;
  }

  // ==========================================
  // 3. NOTE GENERATOR
  // ==========================================
  public async makeNotes(params: {
    topic: string;
    documentId?: string;
    options?: GenerateStudyOptions;
  }): Promise<NotesData> {
    await this.ensureReady();
    const { topic = '', documentId, options } = params;
    const doc = documentId ? getDocumentById(documentId) : null;
    const effectiveTopic = topic.trim() || (doc ? doc.filename : 'Document Notes');

    const rag = await this.retrieveContext(effectiveTopic, documentId);

    const systemPrompt = 
      'You are a high-performing student assistant. Create structured, clear study notes. ' +
      'Strictly format notes using standard markdown headings:\n' +
      '# Topic\n## Key Concepts\n## Important Definitions\n## Important Points\n## Examples\n## Exam Tips\n## Quick Revision';

    let userPrompt = '';
    if (rag.hasGroundedMaterial) {
      userPrompt = 
`LOCAL STUDY MATERIAL:
${rag.materialContext}

TASK:
Create comprehensive study notes for "${effectiveTopic}" strictly grounded in the local study material above.

Format with these exact markdown headers:
# ${effectiveTopic}
## Key Concepts
## Important Definitions
## Important Points
## Examples
## Exam Tips
## Quick Revision`;
    } else {
      userPrompt = 
`${rag.groundingNotice ? `[Note: ${rag.groundingNotice}]\n\n` : ''}TASK:
Create comprehensive study notes for "${topic}" based on offline AI knowledge.

Format with these exact markdown headers:
# ${topic}
## Key Concepts
## Important Definitions
## Important Points
## Examples
## Exam Tips
## Quick Revision`;
    }

    const rawMarkdown = await this.callModel(systemPrompt, userPrompt, options, 1400, 0.5);

    const notesData: NotesData = {
      topic: effectiveTopic,
      markdown: rawMarkdown,
      sources: rag.sources.length > 0 ? rag.sources : undefined,
      groundingNotice: rag.groundingNotice
    };

    // Save session
    const sessionId = `not_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
    saveStudySessionInDB({
      id: sessionId,
      session_type: 'notes',
      title: `Notes: ${effectiveTopic}`,
      topic: effectiveTopic,
      document_id: documentId || null,
      document_name: doc ? doc.filename : null,
      data_json: JSON.stringify(notesData),
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    });

    return notesData;
  }

  // ==========================================
  // 4. QUIZ GENERATOR
  // ==========================================
  public async generateQuiz(params: {
    topic: string;
    documentId?: string;
    count?: 5 | 10 | 20;
    difficulty?: QuizDifficulty;
    type?: QuizQuestionType;
    options?: GenerateStudyOptions;
  }): Promise<QuizData> {
    await this.ensureReady();
    const { topic, documentId, count = 5, difficulty = 'Medium', type = 'mcq', options } = params;
    const doc = documentId ? getDocumentById(documentId) : null;

    const rag = await this.retrieveContext(topic, documentId);

    const systemPrompt = 
      'You are a testing and assessment engine. Generate quizzes in pure JSON format only. ' +
      'Do not include markdown chat outside of code blocks. Return a valid JSON array of question objects.';

    let contextChunk = '';
    if (rag.hasGroundedMaterial) {
      contextChunk = `\nUse the following local study materials to formulate the questions:\n${rag.materialContext}\n`;
    }

    const questionFormatGuide = type === 'mcq'
      ? `Each object must have:
- "question": "Question text"
- "type": "mcq"
- "options": ["Option A", "Option B", "Option C", "Option D"]
- "correctAnswer": 0 (0-indexed integer of the correct option)
- "explanation": "Brief explanation why this option is correct"`
      : type === 'true_false'
      ? `Each object must have:
- "question": "Statement to evaluate"
- "type": "true_false"
- "options": ["True", "False"]
- "correctAnswer": "True" or "False"
- "explanation": "Brief explanation"`
      : `Each object must have:
- "question": "Direct question prompt"
- "type": "short_answer"
- "options": []
- "correctAnswer": "Sample correct answer"
- "explanation": "Evaluation guidelines / model answer"`;

    const userPrompt = 
`Generate exactly ${count} ${difficulty} level ${type.toUpperCase()} questions for the topic: "${topic}".
${contextChunk}
${rag.groundingNotice ? `[Note: ${rag.groundingNotice}]\n` : ''}
Output format must be valid JSON:
[
  ${questionFormatGuide}
]`;

    const rawResponse = await this.callModel(systemPrompt, userPrompt, options, 1600, 0.4);

    const parseRes = parseQuizJson(rawResponse, type);

    if (!parseRes.success || !parseRes.data) {
      throw new Error(parseRes.error || 'Failed to parse generated quiz output.');
    }

    const quizData: QuizData = {
      topic,
      difficulty,
      questionType: type,
      questions: parseRes.data,
      sources: rag.sources.length > 0 ? rag.sources : undefined,
      groundingNotice: rag.groundingNotice
    };

    // Save to DB
    const sessionId = `qzs_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
    saveStudySessionInDB({
      id: sessionId,
      session_type: 'quiz',
      title: `${difficulty} Quiz (${count} Qs): ${topic}`,
      topic,
      document_id: documentId || null,
      document_name: doc ? doc.filename : null,
      data_json: JSON.stringify(quizData),
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    });

    saveQuizInDB({
      id: `qz_${Date.now()}`,
      session_id: sessionId,
      topic,
      difficulty,
      question_count: quizData.questions.length,
      questions_json: JSON.stringify(quizData.questions),
      created_at: new Date().toISOString()
    });

    return quizData;
  }

  // ==========================================
  // 5. FLASHCARDS GENERATOR
  // ==========================================
  public async generateFlashcards(params: {
    topic: string;
    documentId?: string;
    count?: 5 | 10 | 20;
    options?: GenerateStudyOptions;
  }): Promise<FlashcardDeck> {
    await this.ensureReady();
    const { topic, documentId, count = 5, options } = params;
    const doc = documentId ? getDocumentById(documentId) : null;

    const rag = await this.retrieveContext(topic, documentId);

    const systemPrompt = 
      'You are a study card generator. Create active recall flashcards in JSON format. ' +
      'Front contains a specific concept, term, or question. Back contains a concise, accurate definition or answer.';

    let contextChunk = '';
    if (rag.hasGroundedMaterial) {
      contextChunk = `\nBase your flashcards on this local study material:\n${rag.materialContext}\n`;
    }

    const userPrompt = 
`Generate exactly ${count} high-yield flashcards for: "${topic}".
${contextChunk}
${rag.groundingNotice ? `[Note: ${rag.groundingNotice}]\n` : ''}
Output pure JSON array:
[
  {
    "front": "Term or Question",
    "back": "Clear, concise definition or answer"
  }
]`;

    const rawResponse = await this.callModel(systemPrompt, userPrompt, options, 1200, 0.4);

    const parseRes = parseFlashcardsJson(rawResponse);
    if (!parseRes.success || !parseRes.data) {
      throw new Error(parseRes.error || 'Failed to parse generated flashcards.');
    }

    const deck: FlashcardDeck = {
      topic,
      cardCount: parseRes.data.length,
      cards: parseRes.data,
      sources: rag.sources.length > 0 ? rag.sources : undefined,
      groundingNotice: rag.groundingNotice
    };

    // Save to DB
    const sessionId = `fcs_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
    saveStudySessionInDB({
      id: sessionId,
      session_type: 'flashcards',
      title: `Flashcards (${deck.cardCount}): ${topic}`,
      topic,
      document_id: documentId || null,
      document_name: doc ? doc.filename : null,
      data_json: JSON.stringify(deck),
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    });

    saveFlashcardDeckInDB({
      id: `fc_${Date.now()}`,
      session_id: sessionId,
      topic,
      card_count: deck.cards.length,
      cards_json: JSON.stringify(deck.cards),
      created_at: new Date().toISOString()
    });

    return deck;
  }

  // ==========================================
  // 6. STUDY PLAN GENERATOR
  // ==========================================
  public async generateStudyPlan(params: {
    subject?: string;
    topic?: string;
    days: number;
    hoursPerDay: number;
    examDate?: string;
    documentId?: string;
    options?: GenerateStudyOptions;
  }): Promise<StudyPlanData> {
    await this.ensureReady();
    const { days, hoursPerDay, examDate, documentId, options } = params;
    const doc = documentId ? getDocumentById(documentId) : null;
    const subject = (params.subject || params.topic || (doc ? doc.filename : 'General Study')).trim();

    const rag = await this.retrieveContext(subject, documentId);

    const systemPrompt = 
      'You are a realistic academic study planner. Build structured, achievable daily study schedules. ' +
      'Prioritize topics logically from fundamentals to practice and revision. Return pure JSON.';

    let contextChunk = '';
    if (rag.hasGroundedMaterial) {
      contextChunk = `\nIncorporate and prioritize topics found in this local study material:\n${rag.materialContext}\n`;
    }

    const userPrompt = 
`Create an offline study plan for: "${subject}".
- Total Available Days: ${days}
- Daily Study Time: ${hoursPerDay} hour(s) per day
${examDate ? `- Target Exam Date: ${examDate}\n` : ''}
${contextChunk}
${rag.groundingNotice ? `[Note: ${rag.groundingNotice}]\n` : ''}
Format as JSON:
[
  {
    "day": 1,
    "topic": "Specific Topic Name",
    "estimatedDuration": "${hoursPerDay} hours",
    "activity": "Reading and core concept practice",
    "revisionTask": "Quick self-quiz or active recall"
  }
]`;

    const rawResponse = await this.callModel(systemPrompt, userPrompt, options, 1400, 0.4);

    const parseRes = parseStudyPlanJson(rawResponse);
    if (!parseRes.success || !parseRes.data) {
      throw new Error(parseRes.error || 'Failed to parse study plan.');
    }

    const planData: StudyPlanData = {
      subject,
      days,
      hoursPerDay,
      examDate,
      schedule: parseRes.data,
      disclaimer: 'Notice: This study plan is an AI-assisted schedule tool and does not guarantee specific exam results.',
      sources: rag.sources.length > 0 ? rag.sources : undefined,
      groundingNotice: rag.groundingNotice
    };

    // Save to DB
    const sessionId = `pls_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
    saveStudySessionInDB({
      id: sessionId,
      session_type: 'plan',
      title: `Study Plan (${days} days): ${subject}`,
      topic: subject,
      document_id: documentId || null,
      document_name: doc ? doc.filename : null,
      data_json: JSON.stringify(planData),
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    });

    saveStudyPlanInDB({
      id: `pl_${Date.now()}`,
      session_id: sessionId,
      subject,
      days,
      hours_per_day: hoursPerDay,
      plan_json: JSON.stringify(planData.schedule),
      created_at: new Date().toISOString()
    });

    return planData;
  }

  // ==========================================
  // 7. STUDY HISTORY MANAGEMENT
  // ==========================================
  public getStudyHistory(): StudySession[] {
    if (!isDatabaseReady()) return [];
    const rows = getAllStudySessionsFromDB();
    return rows.map((r) => {
      let parsedData: any = {};
      try {
        parsedData = JSON.parse(r.data_json);
      } catch {
        parsedData = {};
      }

      return {
        id: r.id,
        type: r.session_type as StudyActionType,
        title: r.title,
        topic: r.topic,
        documentId: r.document_id,
        documentName: r.document_name,
        data: parsedData,
        createdAt: r.created_at,
        updatedAt: r.updated_at
      };
    });
  }

  public getStudySession(id: string): StudySession | null {
    if (!isDatabaseReady()) return null;
    const r = getStudySessionByIdFromDB(id);
    if (!r) return null;

    let parsedData: any = {};
    try {
      parsedData = JSON.parse(r.data_json);
    } catch {
      parsedData = {};
    }

    return {
      id: r.id,
      type: r.session_type as StudyActionType,
      title: r.title,
      topic: r.topic,
      documentId: r.document_id,
      documentName: r.document_name,
      data: parsedData,
      createdAt: r.created_at,
      updatedAt: r.updated_at
    };
  }

  public deleteStudySession(id: string): void {
    if (!isDatabaseReady()) return;
    deleteStudySessionFromDB(id);
  }

  public clearStudyHistory(): void {
    if (!isDatabaseReady()) return;
    clearAllStudySessionsFromDB();
  }

  // ==========================================
  // 8. CHAT INTEGRATION
  // ==========================================
  public async openInChat(params: {
    type: StudyActionType;
    topic: string;
    initialSummaryText: string;
    documentName?: string | null;
  }): Promise<string> {
    await this.ensureReady();
    const { type, topic, initialSummaryText, documentName } = params;

    const convTitle = `${type.toUpperCase()}: ${topic.substring(0, 24)}`;
    const conv = chatService.createConversation(convTitle);

    // Seed conversation with the study item context as assistant greeting
    const introPrompt = 
`**Study Context (${type.toUpperCase()}): ${topic}**${documentName ? ` (from ${documentName})` : ''}

${initialSummaryText}

*You can ask follow-up questions, request deeper explanations, or customize this study material.*`;

    // Add seeded assistant message
    insertMessageInDB({
      id: `msg_seed_${Date.now()}`,
      conversation_id: conv.id,
      role: 'assistant',
      content: introPrompt,
      created_at: new Date().toISOString()
    });

    return conv.id;
  }
}

export const studyService = new StudyService();

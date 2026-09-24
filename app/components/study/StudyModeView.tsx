// Offline Study AI - Study Mode View (Phase 5)
import React, { useState, useEffect, useRef } from 'react';
import { 
  Lightbulb, 
  FileText, 
  BookOpen, 
  Award, 
  Layers, 
  Calendar, 
  Clock, 
  Sparkles, 
  RefreshCw, 
  Square, 
  AlertCircle,
  ChevronDown
} from 'lucide-react';
import { 
  StudyActionType, 
  QuizDifficulty, 
  QuizQuestionType, 
  QuizData, 
  FlashcardDeck, 
  FlashcardItem, 
  StudyPlanData, 
  SummaryData, 
  SummaryMode, 
  NotesData, 
  ExplainData, 
  StudySession 
} from '../../../study/types';
import { studyService } from '../../../study/studyService';
import { chatService } from '../../../ai/chatService';
import { getAllDocuments, DBDocument } from '../../../database/db';
import { QuizView } from './QuizView';
import { FlashcardView } from './FlashcardView';
import { StudyPlanView } from './StudyPlanView';
import { NotesView } from './NotesView';
import { SummaryView } from './SummaryView';
import { ExplainView } from './ExplainView';
import { StudyHistoryView } from './StudyHistoryView';

export interface StudyModeViewProps {
  initialAction?: StudyActionType | 'history';
  initialDocumentId?: string | null;
  onNavigateToChat?: (conversationId: string) => void;
}

export const StudyModeView: React.FC<StudyModeViewProps> = ({
  initialAction = 'explain',
  initialDocumentId = null,
  onNavigateToChat
}) => {
  const [activeAction, setActiveAction] = useState<StudyActionType | 'history'>(initialAction);
  const [topic, setTopic] = useState<string>('');
  const [documents, setDocuments] = useState<DBDocument[]>([]);
  const [selectedDocId, setSelectedDocId] = useState<string>(initialDocumentId || '');
  const [useStudyMaterials, setUseStudyMaterials] = useState<boolean>(true);

  // Action-specific configurations
  const [explainLevel, setExplainLevel] = useState<'Standard' | 'Beginner' | 'Exam-focused'>('Standard');
  const [summaryMode, setSummaryMode] = useState<SummaryMode>('short');
  const [quizCount, setQuizCount] = useState<5 | 10 | 20>(5);
  const [quizDifficulty, setQuizDifficulty] = useState<QuizDifficulty>('Medium');
  const [quizType, setQuizType] = useState<QuizQuestionType>('mcq');
  const [flashcardCount, setFlashcardCount] = useState<5 | 10 | 20>(5);
  const [planDays, setPlanDays] = useState<number>(7);
  const [planHours, setPlanHours] = useState<number>(2);
  const [planExamDate, setPlanExamDate] = useState<string>('');

  // Execution state
  const [isGenerating, setIsGenerating] = useState<boolean>(false);
  const [progressMsg, setProgressMsg] = useState<string>('');
  const [progressPercent, setProgressPercent] = useState<number>(0);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Result state
  const [explainResult, setExplainResult] = useState<ExplainData | null>(null);
  const [summaryResult, setSummaryResult] = useState<SummaryData | null>(null);
  const [notesResult, setNotesResult] = useState<NotesData | null>(null);
  const [quizResult, setQuizResult] = useState<QuizData | null>(null);
  const [flashcardResult, setFlashcardResult] = useState<FlashcardDeck | null>(null);
  const [planResult, setPlanResult] = useState<StudyPlanData | null>(null);
  const [historyList, setHistoryList] = useState<StudySession[]>([]);

  const abortControllerRef = useRef<AbortController | null>(null);

  useEffect(() => {
    try {
      const docs = getAllDocuments();
      setDocuments(docs);
      setUseStudyMaterials(chatService.isStudyMaterialsEnabled());
      loadHistory();
    } catch (err) {
      console.warn('Failed to load documents or history:', err);
    }
  }, []);

  useEffect(() => {
    if (initialAction) {
      setActiveAction(initialAction);
    }
    if (initialDocumentId) {
      setSelectedDocId(initialDocumentId);
      const matched = documents.find((d) => d.id === initialDocumentId);
      if (matched && !topic) {
        setTopic(matched.filename.replace(/\.[^/.]+$/, ''));
      }
    }
  }, [initialAction, initialDocumentId, documents]);

  const loadHistory = () => {
    try {
      const hist = studyService.getStudyHistory();
      setHistoryList(hist);
    } catch (err) {
      console.warn('Failed to load history:', err);
    }
  };

  const handleToggleMaterials = () => {
    const next = !useStudyMaterials;
    setUseStudyMaterials(next);
    chatService.setStudyMaterialsEnabled(next);
  };

  const handleStop = () => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      abortControllerRef.current = null;
    }
    setIsGenerating(false);
    setProgressMsg('Generation cancelled by user.');
  };

  const handleGenerate = async () => {
    const trimmedTopic = topic.trim();
    if (!trimmedTopic && !selectedDocId) {
      setErrorMsg('Please enter a topic or select a study document.');
      return;
    }

    const controller = new AbortController();
    abortControllerRef.current = controller;
    setIsGenerating(true);
    setErrorMsg(null);
    setProgressPercent(0);

    const effectiveTopic = trimmedTopic || (selectedDocId ? documents.find((d) => d.id === selectedDocId)?.filename.replace(/\.[^/.]+$/, '') : '') || 'Study Topic';

    const opts = {
      signal: controller.signal,
      onProgress: (msg: string, pct: number) => {
        setProgressMsg(msg);
        setProgressPercent(pct);
      }
    };

    try {
      if (activeAction === 'explain') {
        setProgressMsg('Formulating structured explanation...');
        const res = await studyService.explainTopic({
          topic: effectiveTopic,
          documentId: selectedDocId || undefined,
          level: explainLevel,
          options: opts
        });
        setExplainResult(res);
      } else if (activeAction === 'summarize') {
        setProgressMsg('Analyzing document and generating summary...');
        const res = await studyService.summarizeDocument({
          topic: effectiveTopic,
          documentId: selectedDocId || undefined,
          mode: summaryMode,
          options: opts
        });
        setSummaryResult(res);
      } else if (activeAction === 'notes') {
        setProgressMsg('Compiling structured study notes...');
        const res = await studyService.makeNotes({
          topic: effectiveTopic,
          documentId: selectedDocId || undefined,
          options: opts
        });
        setNotesResult(res);
      } else if (activeAction === 'quiz') {
        setProgressMsg(`Generating ${quizCount} ${quizDifficulty} ${quizType} questions...`);
        const res = await studyService.generateQuiz({
          topic: effectiveTopic,
          documentId: selectedDocId || undefined,
          count: quizCount,
          difficulty: quizDifficulty,
          type: quizType,
          options: opts
        });
        setQuizResult(res);
      } else if (activeAction === 'flashcards') {
        setProgressMsg(`Generating ${flashcardCount} high-yield flashcards...`);
        const res = await studyService.generateFlashcards({
          topic: effectiveTopic,
          documentId: selectedDocId || undefined,
          count: flashcardCount,
          options: opts
        });
        setFlashcardResult(res);
      } else if (activeAction === 'plan') {
        setProgressMsg(`Creating ${planDays}-day study schedule...`);
        const res = await studyService.generateStudyPlan({
          subject: effectiveTopic,
          days: planDays,
          hoursPerDay: planHours,
          examDate: planExamDate || undefined,
          documentId: selectedDocId || undefined,
          options: opts
        });
        setPlanResult(res);
      }

      loadHistory();
    } catch (err: any) {
      if (controller.signal.aborted) {
        // cancelled
      } else {
        setErrorMsg(err.message || 'An error occurred during study generation.');
      }
    } finally {
      setIsGenerating(false);
      abortControllerRef.current = null;
    }
  };

  // Chat integrations
  const handleOpenQuizInChat = async (q: QuizData) => {
    const summary = q.questions.map((item, i) => `${i + 1}. ${item.question} (Correct: ${item.type === 'mcq' && typeof item.correctAnswer === 'number' ? item.options[item.correctAnswer] : item.correctAnswer})`).join('\n');
    const convId = await studyService.openInChat({
      type: 'quiz',
      topic: q.topic,
      initialSummaryText: `Here is the quiz on **${q.topic}** (${q.difficulty} · ${q.questionType}):\n\n${summary}`,
      documentName: selectedDocId ? documents.find((d) => d.id === selectedDocId)?.filename : null
    });
    onNavigateToChat?.(convId);
  };

  const handleOpenFlashcardInChat = async (card: FlashcardItem, topicName: string) => {
    const convId = await studyService.openInChat({
      type: 'flashcards',
      topic: `${topicName} - ${card.front}`,
      initialSummaryText: `**Term/Question:** ${card.front}\n**Answer:** ${card.back}\n\nCould you explain this concept in greater detail?`,
      documentName: selectedDocId ? documents.find((d) => d.id === selectedDocId)?.filename : null
    });
    onNavigateToChat?.(convId);
  };

  const handleOpenNotesInChat = async (notes: NotesData) => {
    const convId = await studyService.openInChat({
      type: 'notes',
      topic: notes.topic,
      initialSummaryText: notes.markdown,
      documentName: selectedDocId ? documents.find((d) => d.id === selectedDocId)?.filename : null
    });
    onNavigateToChat?.(convId);
  };

  const handleOpenSummaryInChat = async (summary: SummaryData) => {
    const convId = await studyService.openInChat({
      type: 'summarize',
      topic: summary.topic,
      initialSummaryText: summary.content,
      documentName: selectedDocId ? documents.find((d) => d.id === selectedDocId)?.filename : null
    });
    onNavigateToChat?.(convId);
  };

  const handleOpenExplainInChat = async (explain: ExplainData) => {
    const convId = await studyService.openInChat({
      type: 'explain',
      topic: explain.topic,
      initialSummaryText: `**Definition:** ${explain.definition}\n\n**How It Works:** ${explain.howItWorks}\n\n**Example:** ${explain.example}`,
      documentName: selectedDocId ? documents.find((d) => d.id === selectedDocId)?.filename : null
    });
    onNavigateToChat?.(convId);
  };

  const handleOpenPlanInChat = async (plan: StudyPlanData) => {
    const scheduleSummary = plan.schedule.map((s) => `Day ${s.day}: ${s.topic} (${s.estimatedDuration}) - ${s.activity}`).join('\n');
    const convId = await studyService.openInChat({
      type: 'plan',
      topic: plan.subject,
      initialSummaryText: `**${plan.subject} (${plan.days} Days Schedule):**\n\n${scheduleSummary}`,
      documentName: selectedDocId ? documents.find((d) => d.id === selectedDocId)?.filename : null
    });
    onNavigateToChat?.(convId);
  };

  const handleOpenHistorySession = (session: StudySession) => {
    setActiveAction(session.type);
    setTopic(session.topic);
    if (session.documentId) setSelectedDocId(session.documentId);

    if (session.type === 'explain') setExplainResult(session.data);
    else if (session.type === 'summarize') setSummaryResult(session.data);
    else if (session.type === 'notes') setNotesResult(session.data);
    else if (session.type === 'quiz') setQuizResult(session.data);
    else if (session.type === 'flashcards') setFlashcardResult(session.data);
    else if (session.type === 'plan') setPlanResult(session.data);
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px', paddingBottom: '32px' }}>
      {/* Top Action Tabs */}
      <div style={{ 
        display: 'flex', 
        gap: '8px', 
        background: '#0a0f1d', 
        padding: '8px', 
        borderRadius: '10px', 
        border: '1px solid #1e293b', 
        overflowX: 'auto' 
      }}>
        <button
          onClick={() => setActiveAction('explain')}
          style={{
            padding: '8px 14px',
            background: activeAction === 'explain' ? '#1e293b' : 'transparent',
            color: activeAction === 'explain' ? '#ec4899' : '#94a3b8',
            border: activeAction === 'explain' ? '1px solid #db2777' : '1px solid transparent',
            borderRadius: '6px',
            cursor: 'pointer',
            fontSize: '13px',
            fontWeight: 600,
            display: 'flex',
            alignItems: 'center',
            gap: '6px',
            whiteSpace: 'nowrap'
          }}
        >
          <Lightbulb size={15} /> Explain
        </button>

        <button
          onClick={() => setActiveAction('summarize')}
          style={{
            padding: '8px 14px',
            background: activeAction === 'summarize' ? '#1e293b' : 'transparent',
            color: activeAction === 'summarize' ? '#10b981' : '#94a3b8',
            border: activeAction === 'summarize' ? '1px solid #059669' : '1px solid transparent',
            borderRadius: '6px',
            cursor: 'pointer',
            fontSize: '13px',
            fontWeight: 600,
            display: 'flex',
            alignItems: 'center',
            gap: '6px',
            whiteSpace: 'nowrap'
          }}
        >
          <FileText size={15} /> Summarize
        </button>

        <button
          onClick={() => setActiveAction('notes')}
          style={{
            padding: '8px 14px',
            background: activeAction === 'notes' ? '#1e293b' : 'transparent',
            color: activeAction === 'notes' ? '#a855f7' : '#94a3b8',
            border: activeAction === 'notes' ? '1px solid #7c3aed' : '1px solid transparent',
            borderRadius: '6px',
            cursor: 'pointer',
            fontSize: '13px',
            fontWeight: 600,
            display: 'flex',
            alignItems: 'center',
            gap: '6px',
            whiteSpace: 'nowrap'
          }}
        >
          <BookOpen size={15} /> Make Notes
        </button>

        <button
          onClick={() => setActiveAction('quiz')}
          style={{
            padding: '8px 14px',
            background: activeAction === 'quiz' ? '#1e293b' : 'transparent',
            color: activeAction === 'quiz' ? '#f59e0b' : '#94a3b8',
            border: activeAction === 'quiz' ? '1px solid #d97706' : '1px solid transparent',
            borderRadius: '6px',
            cursor: 'pointer',
            fontSize: '13px',
            fontWeight: 600,
            display: 'flex',
            alignItems: 'center',
            gap: '6px',
            whiteSpace: 'nowrap'
          }}
        >
          <Award size={15} /> Generate Quiz
        </button>

        <button
          onClick={() => setActiveAction('flashcards')}
          style={{
            padding: '8px 14px',
            background: activeAction === 'flashcards' ? '#1e293b' : 'transparent',
            color: activeAction === 'flashcards' ? '#3b82f6' : '#94a3b8',
            border: activeAction === 'flashcards' ? '1px solid #2563eb' : '1px solid transparent',
            borderRadius: '6px',
            cursor: 'pointer',
            fontSize: '13px',
            fontWeight: 600,
            display: 'flex',
            alignItems: 'center',
            gap: '6px',
            whiteSpace: 'nowrap'
          }}
        >
          <Layers size={15} /> Flashcards
        </button>

        <button
          onClick={() => setActiveAction('plan')}
          style={{
            padding: '8px 14px',
            background: activeAction === 'plan' ? '#1e293b' : 'transparent',
            color: activeAction === 'plan' ? '#06b6d4' : '#94a3b8',
            border: activeAction === 'plan' ? '1px solid #0891b2' : '1px solid transparent',
            borderRadius: '6px',
            cursor: 'pointer',
            fontSize: '13px',
            fontWeight: 600,
            display: 'flex',
            alignItems: 'center',
            gap: '6px',
            whiteSpace: 'nowrap'
          }}
        >
          <Calendar size={15} /> Study Plan
        </button>

        <button
          onClick={() => {
            setActiveAction('history');
            loadHistory();
          }}
          style={{
            padding: '8px 14px',
            background: activeAction === 'history' ? '#1e293b' : 'transparent',
            color: activeAction === 'history' ? '#cbd5e1' : '#94a3b8',
            border: activeAction === 'history' ? '1px solid #475569' : '1px solid transparent',
            borderRadius: '6px',
            cursor: 'pointer',
            fontSize: '13px',
            fontWeight: 600,
            display: 'flex',
            alignItems: 'center',
            gap: '6px',
            whiteSpace: 'nowrap',
            marginLeft: 'auto'
          }}
        >
          <Clock size={15} /> History ({historyList.length})
        </button>
      </div>

      {/* Main Mode View */}
      {activeAction === 'history' ? (
        <StudyHistoryView
          history={historyList}
          onOpenSession={handleOpenHistorySession}
          onDeleteSession={(id) => {
            studyService.deleteStudySession(id);
            loadHistory();
          }}
          onClearAll={() => {
            studyService.clearStudyHistory();
            loadHistory();
          }}
        />
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
          {/* Action Parameters Configuration Card */}
          <div className="card" style={{ padding: '20px' }}>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: '14px', marginBottom: '14px' }}>
              {/* Topic / Prompt Input */}
              <div style={{ gridColumn: 'span 2' }}>
                <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: '#cbd5e1', marginBottom: '6px' }}>
                  {activeAction === 'plan' ? 'Subject / Goal' : 'Study Topic / Concept'}
                </label>
                <input
                  type="text"
                  placeholder={
                    activeAction === 'explain' ? 'e.g. Virtual Memory, QuickSort, Photosynthesis...' :
                    activeAction === 'summarize' ? 'e.g. Operating System Architecture (or select document below)' :
                    activeAction === 'notes' ? 'e.g. Database Indexing and B-Trees' :
                    activeAction === 'quiz' ? 'e.g. CPU Scheduling Algorithms' :
                    activeAction === 'flashcards' ? 'e.g. Computer Networks Terminology' :
                    'e.g. Data Structures & Algorithms Exam Prep'
                  }
                  value={topic}
                  onChange={(e) => setTopic(e.target.value)}
                  disabled={isGenerating}
                  style={{
                    width: '100%',
                    padding: '9px 12px',
                    background: '#0f172a',
                    border: '1px solid #334155',
                    borderRadius: '6px',
                    color: '#f8fafc',
                    fontSize: '13px'
                  }}
                />
              </div>

              {/* Study Material Document Selector */}
              <div>
                <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: '#cbd5e1', marginBottom: '6px' }}>
                  Study Document (Optional)
                </label>
                <select
                  value={selectedDocId}
                  onChange={(e) => {
                    setSelectedDocId(e.target.value);
                    if (e.target.value && !topic) {
                      const doc = documents.find((d) => d.id === e.target.value);
                      if (doc) setTopic(doc.filename.replace(/\.[^/.]+$/, ''));
                    }
                  }}
                  disabled={isGenerating}
                  style={{
                    width: '100%',
                    padding: '9px 12px',
                    background: '#0f172a',
                    border: '1px solid #334155',
                    borderRadius: '6px',
                    color: '#f8fafc',
                    fontSize: '13px'
                  }}
                >
                  <option value="">None (Use general offline AI)</option>
                  {documents.map((d) => (
                    <option key={d.id} value={d.id}>
                      {d.filename} ({d.character_count.toLocaleString()} chars)
                    </option>
                  ))}
                </select>
              </div>

              {/* Toggle Study Materials (RAG) */}
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', paddingTop: '24px' }}>
                <input
                  type="checkbox"
                  id="study-materials-toggle"
                  checked={useStudyMaterials}
                  onChange={handleToggleMaterials}
                  style={{ width: '16px', height: '16px', cursor: 'pointer' }}
                />
                <label htmlFor="study-materials-toggle" style={{ fontSize: '12px', color: '#cbd5e1', cursor: 'pointer' }}>
                  Ground in local study materials (RAG)
                </label>
              </div>
            </div>

            {/* Mode-Specific Option Pickers */}
            <div style={{ display: 'flex', gap: '14px', flexWrap: 'wrap', borderTop: '1px solid #334155', paddingTop: '14px', alignItems: 'center' }}>
              {activeAction === 'explain' && (
                <div>
                  <label style={{ fontSize: '11px', color: '#94a3b8', display: 'block', marginBottom: '4px' }}>Depth Level</label>
                  <select
                    value={explainLevel}
                    onChange={(e: any) => setExplainLevel(e.target.value)}
                    style={{ padding: '6px 10px', background: '#0f172a', border: '1px solid #334155', borderRadius: '5px', color: '#f8fafc', fontSize: '12px' }}
                  >
                    <option value="Standard">Standard</option>
                    <option value="Beginner">Beginner / Intuitive</option>
                    <option value="Exam-focused">Exam-focused</option>
                  </select>
                </div>
              )}

              {activeAction === 'summarize' && (
                <div>
                  <label style={{ fontSize: '11px', color: '#94a3b8', display: 'block', marginBottom: '4px' }}>Summary Mode</label>
                  <select
                    value={summaryMode}
                    onChange={(e: any) => setSummaryMode(e.target.value)}
                    style={{ padding: '6px 10px', background: '#0f172a', border: '1px solid #334155', borderRadius: '5px', color: '#f8fafc', fontSize: '12px' }}
                  >
                    <option value="short">Short Summary</option>
                    <option value="detailed">Detailed Summary</option>
                    <option value="exam">Exam-Focused Summary</option>
                  </select>
                </div>
              )}

              {activeAction === 'quiz' && (
                <>
                  <div>
                    <label style={{ fontSize: '11px', color: '#94a3b8', display: 'block', marginBottom: '4px' }}>Questions</label>
                    <select
                      value={quizCount}
                      onChange={(e: any) => setQuizCount(Number(e.target.value) as 5 | 10 | 20)}
                      style={{ padding: '6px 10px', background: '#0f172a', border: '1px solid #334155', borderRadius: '5px', color: '#f8fafc', fontSize: '12px' }}
                    >
                      <option value={5}>5 Questions</option>
                      <option value={10}>10 Questions</option>
                      <option value={20}>20 Questions</option>
                    </select>
                  </div>

                  <div>
                    <label style={{ fontSize: '11px', color: '#94a3b8', display: 'block', marginBottom: '4px' }}>Difficulty</label>
                    <select
                      value={quizDifficulty}
                      onChange={(e: any) => setQuizDifficulty(e.target.value)}
                      style={{ padding: '6px 10px', background: '#0f172a', border: '1px solid #334155', borderRadius: '5px', color: '#f8fafc', fontSize: '12px' }}
                    >
                      <option value="Easy">Easy</option>
                      <option value="Medium">Medium</option>
                      <option value="Hard">Hard</option>
                    </select>
                  </div>

                  <div>
                    <label style={{ fontSize: '11px', color: '#94a3b8', display: 'block', marginBottom: '4px' }}>Type</label>
                    <select
                      value={quizType}
                      onChange={(e: any) => setQuizType(e.target.value)}
                      style={{ padding: '6px 10px', background: '#0f172a', border: '1px solid #334155', borderRadius: '5px', color: '#f8fafc', fontSize: '12px' }}
                    >
                      <option value="mcq">Multiple Choice (MCQ)</option>
                      <option value="true_false">True / False</option>
                      <option value="short_answer">Short Answer</option>
                    </select>
                  </div>
                </>
              )}

              {activeAction === 'flashcards' && (
                <div>
                  <label style={{ fontSize: '11px', color: '#94a3b8', display: 'block', marginBottom: '4px' }}>Card Count</label>
                  <select
                    value={flashcardCount}
                    onChange={(e: any) => setFlashcardCount(Number(e.target.value) as 5 | 10 | 20)}
                    style={{ padding: '6px 10px', background: '#0f172a', border: '1px solid #334155', borderRadius: '5px', color: '#f8fafc', fontSize: '12px' }}
                  >
                    <option value={5}>5 Flashcards</option>
                    <option value={10}>10 Flashcards</option>
                    <option value={20}>20 Flashcards</option>
                  </select>
                </div>
              )}

              {activeAction === 'plan' && (
                <>
                  <div>
                    <label style={{ fontSize: '11px', color: '#94a3b8', display: 'block', marginBottom: '4px' }}>Available Days</label>
                    <select
                      value={planDays}
                      onChange={(e: any) => setPlanDays(Number(e.target.value))}
                      style={{ padding: '6px 10px', background: '#0f172a', border: '1px solid #334155', borderRadius: '5px', color: '#f8fafc', fontSize: '12px' }}
                    >
                      <option value={3}>3 Days (Crash Course)</option>
                      <option value={7}>7 Days (1 Week)</option>
                      <option value={14}>14 Days (2 Weeks)</option>
                      <option value={30}>30 Days (1 Month)</option>
                    </select>
                  </div>

                  <div>
                    <label style={{ fontSize: '11px', color: '#94a3b8', display: 'block', marginBottom: '4px' }}>Hours / Day</label>
                    <select
                      value={planHours}
                      onChange={(e: any) => setPlanHours(Number(e.target.value))}
                      style={{ padding: '6px 10px', background: '#0f172a', border: '1px solid #334155', borderRadius: '5px', color: '#f8fafc', fontSize: '12px' }}
                    >
                      <option value={1}>1 Hour</option>
                      <option value={2}>2 Hours</option>
                      <option value={4}>4 Hours</option>
                      <option value={6}>6 Hours</option>
                    </select>
                  </div>

                  <div>
                    <label style={{ fontSize: '11px', color: '#94a3b8', display: 'block', marginBottom: '4px' }}>Exam Date (Optional)</label>
                    <input
                      type="date"
                      value={planExamDate}
                      onChange={(e) => setPlanExamDate(e.target.value)}
                      style={{ padding: '5px 10px', background: '#0f172a', border: '1px solid #334155', borderRadius: '5px', color: '#f8fafc', fontSize: '12px' }}
                    />
                  </div>
                </>
              )}

              <div style={{ marginLeft: 'auto', display: 'flex', gap: '8px' }}>
                {isGenerating ? (
                  <button
                    onClick={handleStop}
                    style={{
                      padding: '8px 16px',
                      background: '#ef4444',
                      color: '#fff',
                      border: 'none',
                      borderRadius: '6px',
                      cursor: 'pointer',
                      fontSize: '13px',
                      fontWeight: 600,
                      display: 'flex',
                      alignItems: 'center',
                      gap: '6px'
                    }}
                  >
                    <Square size={13} /> Stop
                  </button>
                ) : (
                  <button
                    onClick={handleGenerate}
                    style={{
                      padding: '8px 20px',
                      background: '#f59e0b',
                      color: '#0f172a',
                      border: 'none',
                      borderRadius: '6px',
                      cursor: 'pointer',
                      fontSize: '13px',
                      fontWeight: 700,
                      display: 'flex',
                      alignItems: 'center',
                      gap: '6px'
                    }}
                  >
                    <Sparkles size={15} /> Generate {activeAction.charAt(0).toUpperCase() + activeAction.slice(1)}
                  </button>
                )}
              </div>
            </div>
          </div>

          {/* Loading / Progress State */}
          {isGenerating && (
            <div className="card" style={{ padding: '20px', textAlign: 'center' }}>
              <RefreshCw size={24} style={{ color: '#f59e0b', margin: '0 auto 10px auto', animation: 'spin 1.5s linear infinite' }} />
              <div style={{ fontSize: '14px', fontWeight: 600, color: '#f8fafc' }}>
                {progressMsg || 'Processing study materials with local AI...'}
              </div>
              {progressPercent > 0 && (
                <div style={{ width: '240px', height: '6px', background: '#1e293b', borderRadius: '3px', margin: '12px auto 0 auto', overflow: 'hidden' }}>
                  <div style={{ width: `${progressPercent}%`, height: '100%', background: '#f59e0b', transition: 'width 0.3s ease' }} />
                </div>
              )}
            </div>
          )}

          {/* Error Banner */}
          {errorMsg && (
            <div style={{ 
              background: 'rgba(239, 68, 68, 0.1)', 
              border: '1px solid rgba(239, 68, 68, 0.3)', 
              color: '#fca5a5', 
              padding: '12px 16px', 
              borderRadius: '8px', 
              display: 'flex', 
              alignItems: 'center', 
              justifyContent: 'space-between' 
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '13px' }}>
                <AlertCircle size={16} />
                <span>{errorMsg}</span>
              </div>
              <button
                onClick={handleGenerate}
                style={{
                  padding: '4px 10px',
                  background: '#ef4444',
                  color: '#fff',
                  border: 'none',
                  borderRadius: '4px',
                  cursor: 'pointer',
                  fontSize: '12px',
                  fontWeight: 600
                }}
              >
                Retry
              </button>
            </div>
          )}

          {/* Dynamic Action Results */}
          {!isGenerating && activeAction === 'explain' && explainResult && (
            <ExplainView
              explain={explainResult}
              onOpenInChat={handleOpenExplainInChat}
              onRetry={handleGenerate}
            />
          )}

          {!isGenerating && activeAction === 'summarize' && summaryResult && (
            <SummaryView
              summary={summaryResult}
              onOpenInChat={handleOpenSummaryInChat}
              onRetry={handleGenerate}
            />
          )}

          {!isGenerating && activeAction === 'notes' && notesResult && (
            <NotesView
              notes={notesResult}
              onOpenInChat={handleOpenNotesInChat}
              onRetry={handleGenerate}
            />
          )}

          {!isGenerating && activeAction === 'quiz' && quizResult && (
            <QuizView
              quiz={quizResult}
              onOpenInChat={handleOpenQuizInChat}
              onRetry={handleGenerate}
            />
          )}

          {!isGenerating && activeAction === 'flashcards' && flashcardResult && (
            <FlashcardView
              deck={flashcardResult}
              onOpenInChat={handleOpenFlashcardInChat}
              onRetry={handleGenerate}
            />
          )}

          {!isGenerating && activeAction === 'plan' && planResult && (
            <StudyPlanView
              plan={planResult}
              onOpenInChat={handleOpenPlanInChat}
              onRetry={handleGenerate}
            />
          )}
        </div>
      )}
    </div>
  );
};

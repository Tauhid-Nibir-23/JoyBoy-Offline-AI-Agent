// Offline Study AI - Study Features Types (Phase 5)
import { RAGSourceCitation } from '../rag/types';

export type StudyActionType = 
  | 'explain' 
  | 'summarize' 
  | 'notes' 
  | 'quiz' 
  | 'flashcards' 
  | 'plan';

export type QuizDifficulty = 'Easy' | 'Medium' | 'Hard';
export type QuizQuestionType = 'mcq' | 'true_false' | 'short_answer';

export interface QuizQuestion {
  id: string;
  question: string;
  type: QuizQuestionType;
  options: string[];
  correctAnswer: string | number;
  explanation: string;
  userAnswer?: string | number;
}

export interface QuizData {
  topic: string;
  difficulty: QuizDifficulty;
  questionType: QuizQuestionType;
  questions: QuizQuestion[];
  score?: {
    correct: number;
    total: number;
  };
  sources?: RAGSourceCitation[];
  groundingNotice?: string;
}

export interface FlashcardItem {
  id: string;
  front: string;
  back: string;
}

export interface FlashcardDeck {
  topic: string;
  cardCount: number;
  cards: FlashcardItem[];
  sources?: RAGSourceCitation[];
  groundingNotice?: string;
}

export interface StudyPlanDay {
  day: number;
  topic: string;
  estimatedDuration: string;
  activity: string;
  revisionTask: string;
}

export interface StudyPlanData {
  subject: string;
  days: number;
  hoursPerDay: number;
  examDate?: string;
  schedule: StudyPlanDay[];
  disclaimer: string;
  sources?: RAGSourceCitation[];
  groundingNotice?: string;
}

export type SummaryMode = 'short' | 'detailed' | 'exam';

export interface SummaryData {
  topic: string;
  mode: SummaryMode;
  content: string;
  keyTakeaways: string[];
  sources?: RAGSourceCitation[];
  isChunked?: boolean;
  chunkCount?: number;
  groundingNotice?: string;
}

export interface NotesData {
  topic: string;
  markdown: string;
  sources?: RAGSourceCitation[];
  groundingNotice?: string;
}

export interface ExplainData {
  topic: string;
  definition: string;
  howItWorks: string;
  components: string[];
  example: string;
  examPoints: string[];
  markdown?: string;
  sources?: RAGSourceCitation[];
  groundingNotice?: string;
}

export interface StudySession<T = any> {
  id: string;
  type: StudyActionType;
  title: string;
  topic: string;
  documentId?: string | null;
  documentName?: string | null;
  data: T;
  createdAt: string;
  updatedAt: string;
}

export interface ChatMessageSource {
  documentId: string;
  filename: string;
  chunkIndex: number;
  pageNumber?: number | null;
  heading?: string | null;
  similarity: number;
  snippet: string;
}

export interface ChatMessage {
  id: string;
  conversationId: string;
  role: 'system' | 'user' | 'assistant';
  content: string;
  createdAt: string;
  providerId?: string;
  metrics?: GenerationMetrics;
  sources?: ChatMessageSource[];
}

export interface GenerationMetrics {
  providerId: string;
  providerName: string;
  modelName?: string;
  totalDurationMs: number;
  tokenCount: number;
  tokensPerSecond?: number;
  firstTokenLatencyMs?: number;
}

export interface StreamCallbacks {
  onToken?: (token: string) => void;
  onStart?: () => void;
  onComplete?: (fullText: string, metrics?: GenerationMetrics) => void;
  onError?: (error: Error) => void;
}

export interface GenerateOptions {
  temperature?: number;
  maxTokens?: number;
  topP?: number;
  systemPrompt?: string;
  signal?: AbortSignal;
  callbacks?: StreamCallbacks;
}

export interface AIProvider {
  id: string;
  name: string;
  isAvailable(): Promise<boolean>;
  generateResponse(history: ChatMessage[], options?: GenerateOptions): Promise<string>;
  stop?(): void;
  dispose?(): void;
}

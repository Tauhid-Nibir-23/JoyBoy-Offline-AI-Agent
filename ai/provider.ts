export interface ChatMessage {
  id: string;
  conversationId: string;
  role: 'system' | 'user' | 'assistant';
  content: string;
  createdAt: string;
}

export interface GenerateOptions {
  temperature?: number;
  maxTokens?: number;
  stopSequences?: string[];
  signal?: AbortSignal;
}

export interface AIProvider {
  id: string;
  name: string;
  isAvailable(): Promise<boolean>;
  generateResponse(history: ChatMessage[], options?: GenerateOptions): Promise<string>;
  stop?(): void;
  dispose?(): void;
}

export interface ChatMessage {
  id: string;
  conversationId: string;
  role: 'system' | 'user' | 'assistant';
  content: string;
  createdAt: string;
}

export interface AIProvider {
  name: string;
  generateResponse(history: ChatMessage[]): Promise<string>;
}

import { ChatMessage } from './provider';

export const DEFAULT_SYSTEM_PROMPT = 
  'You are an offline personal study assistant. Answer the student\'s actual question directly and thoroughly in clear, structured markdown. ' +
  'When study material is provided, prioritize that material and ground your explanations directly on it without inventing citations. ' +
  'If the retrieved material does not contain enough information, clearly say so: "No sufficiently relevant material was found in your study documents." and answer helpfully using your general offline knowledge. ' +
  'Always treat the student\'s question as your primary instruction.';

/**
 * Conservative token count estimation (~3.5 characters per token + 4 framing tokens per message).
 */
export function estimateTokens(text: string): number {
  if (!text) return 0;
  return Math.ceil(text.length / 3.5);
}

export function estimateMessageTokens(message: ChatMessage): number {
  return estimateTokens(message.content) + 4; // 4 tokens for <|im_start|>role...<|im_end|>
}

export interface ContextBuildOptions {
  systemPrompt?: string;
  contextLength?: number;
  reservedOutputTokens?: number;
}

/**
 * Context Management Strategy:
 * 1. Reserves tokens for output generation (e.g., 512 tokens).
 * 2. Mandatory inclusion: System prompt is always preserved at the start.
 * 3. Mandatory inclusion: The latest user message is always preserved.
 * 4. Recent message priority: History is traversed backwards from the latest to the oldest.
 * 5. Older messages are truncated when cumulative token estimate exceeds the context budget.
 */
export function buildContextWindow(
  history: ChatMessage[],
  options: ContextBuildOptions = {}
): ChatMessage[] {
  const systemPromptText = options.systemPrompt || DEFAULT_SYSTEM_PROMPT;
  const contextLength = options.contextLength || 4096;
  const reservedOutputTokens = options.reservedOutputTokens || 512;
  const availableInputTokens = Math.max(256, contextLength - reservedOutputTokens);

  const systemMsg: ChatMessage = {
    id: 'system_prompt',
    conversationId: history[0]?.conversationId || 'default',
    role: 'system',
    content: systemPromptText,
    createdAt: new Date(0).toISOString()
  };

  const systemTokens = estimateMessageTokens(systemMsg);
  let remainingBudget = availableInputTokens - systemTokens;

  // Filter out any previous system messages from raw history
  const nonSystemHistory = history.filter((m) => m.role !== 'system');

  if (nonSystemHistory.length === 0) {
    return [systemMsg];
  }

  // Work backwards from the most recent message
  const selected: ChatMessage[] = [];
  for (let i = nonSystemHistory.length - 1; i >= 0; i--) {
    const msg = nonSystemHistory[i];
    const msgTokens = estimateMessageTokens(msg);

    // Always keep the newest message even if it takes most of the budget
    if (selected.length === 0 || msgTokens <= remainingBudget) {
      selected.unshift(msg);
      remainingBudget -= msgTokens;
    } else {
      // Exceeded budget, stop adding older messages
      break;
    }
  }

  return [systemMsg, ...selected];
}

/**
 * Formats structured messages into ChatML prompt string suitable for GGUF models.
 */
export function formatToChatML(messages: ChatMessage[]): string {
  let prompt = '';
  for (const msg of messages) {
    prompt += `<|im_start|>${msg.role}\n${msg.content.trim()}<|im_end|>\n`;
  }
  prompt += '<|im_start|>assistant\n';
  return prompt;
}

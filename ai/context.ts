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
  const contextLength = options.contextLength || 4096;
  const reservedOutputTokens = options.reservedOutputTokens || 512;
  const availableInputTokens = Math.max(256, contextLength - reservedOutputTokens);

  // Check if an existing system message is already present in history
  const existingSystemMsg = history.find((m) => m.role === 'system' && m.id !== 'conv_summary');
  const systemPromptText = options.systemPrompt || existingSystemMsg?.content || DEFAULT_SYSTEM_PROMPT;

  const systemMsg: ChatMessage = {
    id: existingSystemMsg?.id || 'system_prompt',
    conversationId: history[0]?.conversationId || 'default',
    role: 'system',
    content: systemPromptText,
    createdAt: new Date(0).toISOString()
  };

  const systemTokens = estimateMessageTokens(systemMsg);
  let remainingBudget = availableInputTokens - systemTokens;

  // Check for prior summary
  const summaryMsg = history.find((m) => m.id === 'conv_summary');
  let includedSummary: ChatMessage | null = null;
  if (summaryMsg) {
    const summaryTokens = estimateMessageTokens(summaryMsg);
    if (summaryTokens < remainingBudget * 0.3) {
      includedSummary = summaryMsg;
      remainingBudget -= summaryTokens;
    }
  }

  // Filter out any system messages from non-system conversation history
  const nonSystemHistory = history.filter((m) => m.role !== 'system');

  if (nonSystemHistory.length === 0) {
    return includedSummary ? [systemMsg, includedSummary] : [systemMsg];
  }

  // Work backwards from the most recent message:
  // Priority 1: Latest user message (mandatory)
  // Priority 2: Immediate previous assistant turn (preserved if it fits)
  // Priority 3: Recent conversation turns
  const selected: ChatMessage[] = [];
  for (let i = nonSystemHistory.length - 1; i >= 0; i--) {
    const msg = nonSystemHistory[i];
    const msgTokens = estimateMessageTokens(msg);

    // Always keep newest message; prioritize immediate previous assistant message if it fits
    const isNewest = selected.length === 0;
    const isImmediatePrevious = selected.length === 1 && msg.role === 'assistant';

    if (isNewest || (isImmediatePrevious && msgTokens <= remainingBudget) || msgTokens <= remainingBudget) {
      selected.unshift(msg);
      remainingBudget -= msgTokens;
    } else {
      // Exceeded budget, stop adding older messages
      break;
    }
  }

  const result: ChatMessage[] = [systemMsg];
  if (includedSummary) {
    result.push(includedSummary);
  }
  result.push(...selected);
  return result;
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

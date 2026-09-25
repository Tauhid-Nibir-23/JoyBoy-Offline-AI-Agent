// Offline Study AI - Context Manager & Window Assembly (Phase 9)
import { ChatMessage } from './provider';
import { conversationMemory } from './conversationMemory';
import { DBDocument, getConversationFromDB, getMessagesByConversationIdFromDB } from '../database/db';
import { RAGSearchResult } from '../rag/types';
import { estimateMessageTokens, estimateTokens } from './context';

export interface ContextAssembleOptions {
  conversationId: string;
  history: ChatMessage[];
  attachedDocs: DBDocument[];
  retrievedChunks?: RAGSearchResult[];
  systemInstruction: string;
  currentUserMessageText: string;
  contextLength?: number;
  reservedOutputTokens?: number;
}

export interface AssembledContextResult {
  messages: ChatMessage[];
  contextTokensEstimate: number;
  hasSummary: boolean;
  attachedDocCount: number;
}

export class ConversationContextManager {
  /**
   * Assembles a structured, token-budget-aware context window:
   * 1. System instruction (including language policy)
   * 2. Scoped attached document identity
   * 3. Rolling conversation summary (if older messages exist)
   * 4. Recent conversation turns (kept in full, e.g. last 4-6 messages)
   * 5. Current user query augmented with grounded study material
   */
  public assembleContext(options: ContextAssembleOptions): AssembledContextResult {
    const {
      conversationId,
      history,
      attachedDocs,
      systemInstruction,
      currentUserMessageText,
      contextLength = 4096,
      reservedOutputTokens = 512
    } = options;

    const availableInputBudget = Math.max(512, contextLength - reservedOutputTokens);
    const memory = conversationMemory.getMemory(conversationId);

    // 1. Build System Instruction with Chat Identity & Scoped Documents
    let enhancedSystemPrompt = systemInstruction.trim();

    if (attachedDocs.length > 0) {
      const docList = attachedDocs.map((d) => `• ${d.filename} (${(d.file_size / 1024).toFixed(0)} KB)`).join('\n');
      enhancedSystemPrompt += `\n\n[CURRENT CHAT ATTACHED DOCUMENTS (${attachedDocs.length})]:\n${docList}\nAll study answers must strictly prioritize and ground on these attached documents.`;
    } else {
      enhancedSystemPrompt += '\n\n[ATTACHED DOCUMENTS]: None. This is a general study chat session.';
    }

    if (memory.activeTopic) {
      enhancedSystemPrompt += `\n[ACTIVE TOPIC]: ${memory.activeTopic}`;
    }

    const systemMsg: ChatMessage = {
      id: 'sys_inst',
      conversationId,
      role: 'system',
      content: enhancedSystemPrompt,
      createdAt: new Date(0).toISOString()
    };

    let usedTokens = estimateMessageTokens(systemMsg);
    let remainingBudget = availableInputBudget - usedTokens;

    // 2. Prepare rolling summary if conversation has older history
    let summaryMsg: ChatMessage | null = null;
    let hasSummary = false;

    // Separate history excluding system messages
    const nonSystem = history.filter((m) => m.role !== 'system');

    // Keep the most recent 6 messages in full
    const RECENT_TURN_COUNT = 6;
    const recentMessages = nonSystem.slice(-RECENT_TURN_COUNT);
    const olderMessages = nonSystem.slice(0, Math.max(0, nonSystem.length - RECENT_TURN_COUNT));

    if (olderMessages.length > 0 || memory.rollingSummary) {
      const summaryText = memory.rollingSummary || 
        olderMessages.map((m) => `${m.role === 'user' ? 'User' : 'Assistant'}: ${m.content.slice(0, 80)}...`).join(' | ');

      summaryMsg = {
        id: 'conv_summary',
        conversationId,
        role: 'system',
        content: `[PRIOR CONVERSATION SUMMARY]:\n${summaryText}`,
        createdAt: new Date(1).toISOString()
      };

      const summaryTokens = estimateMessageTokens(summaryMsg);
      if (summaryTokens < remainingBudget * 0.25) {
        remainingBudget -= summaryTokens;
        hasSummary = true;
      } else {
        summaryMsg = null;
      }
    }

    // 3. Assemble Recent Messages backwards to fit remaining token budget
    const finalSelected: ChatMessage[] = [];

    // Ensure the latest user message is always preserved
    for (let i = recentMessages.length - 1; i >= 0; i--) {
      const msg = recentMessages[i];
      const msgTokens = estimateMessageTokens(msg);

      if (finalSelected.length === 0 || msgTokens <= remainingBudget) {
        finalSelected.unshift(msg);
        remainingBudget -= msgTokens;
      } else {
        // Exceeded budget, stop adding older messages
        break;
      }
    }

    // 4. Construct final message list
    const assembled: ChatMessage[] = [systemMsg];
    if (summaryMsg) {
      assembled.push(summaryMsg);
    }
    assembled.push(...finalSelected);

    const totalEstimatedTokens = assembled.reduce((sum, m) => sum + estimateMessageTokens(m), 0);

    return {
      messages: assembled,
      contextTokensEstimate: totalEstimatedTokens,
      hasSummary,
      attachedDocCount: attachedDocs.length
    };
  }
  public buildGenerationContext(options: {
    conversationId: string;
    userPrompt: string;
    attachedDocumentFilenames?: string[];
    maxContextTokens?: number;
  }): {
    systemPrompt: string;
    chatIdentity: string;
    recentMessages: ChatMessage[];
    tokenEstimate: number;
  } {
    const memory = conversationMemory.getMemory(options.conversationId);
    const conv = getConversationFromDB(options.conversationId);
    const chatTitle = conv?.title || options.conversationId;
    const docs = options.attachedDocumentFilenames || memory.recentDocReferences || [];

    let sysPrompt = 'You are an offline personal study assistant.';
    if (docs.length > 0) {
      sysPrompt += `\n[ATTACHED DOCUMENTS]: ${docs.join(', ')}`;
    }
    if (memory.activeTopic) {
      sysPrompt += `\n[ACTIVE TOPIC]: ${memory.activeTopic}`;
    }

    const messages = getMessagesByConversationIdFromDB(options.conversationId);
    let recent = messages.map(m => ({
      id: m.id,
      conversationId: m.conversation_id,
      role: m.role,
      content: m.content,
      createdAt: m.created_at
    })).slice(-6);

    if (recent.length === 0 && (memory.lastUserQuery || memory.lastAssistantAnswer)) {
      if (memory.lastUserQuery) {
        recent.push({
          id: 'mem_u1',
          conversationId: options.conversationId,
          role: 'user',
          content: memory.lastUserQuery,
          createdAt: new Date().toISOString()
        });
      }
      if (memory.lastAssistantAnswer) {
        recent.push({
          id: 'mem_a1',
          conversationId: options.conversationId,
          role: 'assistant',
          content: memory.lastAssistantAnswer,
          createdAt: new Date().toISOString()
        });
      }
    }

    const tokenEstimate = estimateTokens(sysPrompt) + 
      recent.reduce((sum, m) => sum + estimateMessageTokens(m), 0) + 
      estimateTokens(options.userPrompt);

    return {
      systemPrompt: sysPrompt,
      chatIdentity: chatTitle,
      recentMessages: recent,
      tokenEstimate
    };
  }
}

export const conversationContextManager = new ConversationContextManager();
export const contextManager = conversationContextManager;

// Offline Study AI - Real Inference Diagnostics & Observability (Phase 11 & 12)
import { getSetting, setSetting } from '../database/db';

export interface InferenceDiagnosticsData {
  timestamp: string;
  modelName: string;
  modelPath?: string;
  providerId: string;
  contextSize: number;
  maxTokens: number;
  temperature: number;
  historyTurnsCount: number;
  tokenEstimate: number;
  activeTopic: string | null;
  activeSubtopic: string | null;
  activeChapter: string | null;
  originalUserPrompt: string;
  resolvedQuery: string;
  resolvedContext?: string;
  intent: string;
  retrievedChunkCount: number;
  documentNames: string[];
  systemPromptPreview: string;
  generationSpeedTokPerSec?: number;
  firstTokenLatencyMs?: number;
  modelLoadTimeMs?: number;
  ramUsageBytes?: number | null;
  isFallback?: boolean;
  fallbackReason?: string | null;
}

export type IssueCategory = 
  | 'CONTEXT_FAILURE'
  | 'RAG_RETRIEVAL_FAILURE'
  | 'PROMPT_ASSEMBLY_FAILURE'
  | 'RESOURCE_PRESSURE'
  | 'MODEL_CAPABILITY_LIMITATION'
  | 'NONE';

export interface AnswerQualityDiagnosis {
  category: IssueCategory;
  explanation: string;
  recommendedAction: string;
}

/**
 * Phase 12 Section 18: Distinguishes between software/pipeline bugs and model reasoning limitations.
 */
export function diagnoseAnswerQuality(
  data: InferenceDiagnosticsData,
  responseContent: string = '',
  validationIssue?: string
): AnswerQualityDiagnosis {
  if (validationIssue) {
    if (validationIssue.includes('loop') || validationIssue.includes('repetition')) {
      return {
        category: 'MODEL_CAPABILITY_LIMITATION',
        explanation: 'Model produced repetitive token loops. Not a software context bug.',
        recommendedAction: 'Increase repeat penalty in Generation Presets or use higher parameter model.'
      };
    }
  }

  // 1. Hardware/Resource Pressure
  if (data.generationSpeedTokPerSec !== undefined && data.generationSpeedTokPerSec < 2.0 && data.generationSpeedTokPerSec > 0) {
    return {
      category: 'RESOURCE_PRESSURE',
      explanation: `Generation speed dropped to ${data.generationSpeedTokPerSec} tok/s due to CPU/RAM load.`,
      recommendedAction: 'Reduce CPU threads or close background applications.'
    };
  }

  // 2. RAG Retrieval Failure
  if (data.documentNames && data.documentNames.length > 0 && data.retrievedChunkCount === 0 && !data.resolvedQuery.toLowerCase().includes('what is')) {
    return {
      category: 'RAG_RETRIEVAL_FAILURE',
      explanation: 'Attached study documents are present but no relevant chunks were retrieved for the query.',
      recommendedAction: 'Rephrase query with document-specific terminology or check indexing.'
    };
  }

  // 3. Prompt Assembly Failure
  if (data.tokenEstimate > data.contextSize) {
    return {
      category: 'PROMPT_ASSEMBLY_FAILURE',
      explanation: `Prompt tokens (${data.tokenEstimate}) exceeded maximum context size (${data.contextSize}).`,
      recommendedAction: 'Context window truncation was applied; consider increasing context length.'
    };
  }

  // 4. Context System Failure
  if (data.historyTurnsCount > 1 && !data.activeTopic && !data.resolvedContext) {
    return {
      category: 'CONTEXT_FAILURE',
      explanation: 'Multi-turn conversation history is active but neither active topic nor context hint was captured.',
      recommendedAction: 'Check conversation memory state and query rewriter rules.'
    };
  }

  // 5. Default: Model Capability Limitation
  return {
    category: 'NONE',
    explanation: 'Context pipeline, RAG, and prompt assembly operated normally.',
    recommendedAction: 'If output is suboptimal, answer quality reflects model reasoning constraints.'
  };
}

class InferenceDiagnosticsService {
  private lastDiagnostics: InferenceDiagnosticsData | null = null;
  private readonly settingKey = 'debug_inference_context';

  public isEnabled(): boolean {
    try {
      return getSetting(this.settingKey) === 'true';
    } catch {
      return false;
    }
  }

  public setEnabled(enabled: boolean): void {
    try {
      setSetting(this.settingKey, enabled ? 'true' : 'false');
      if (!enabled) {
        this.clear();
      }
    } catch {
      // ignore
    }
  }

  public record(data: InferenceDiagnosticsData): void {
    // Only capture if debug inference context is explicitly enabled
    if (this.isEnabled()) {
      this.lastDiagnostics = data;
    }
  }

  public getLatest(): InferenceDiagnosticsData | null {
    if (!this.isEnabled()) {
      return null;
    }
    return this.lastDiagnostics;
  }

  public clear(): void {
    this.lastDiagnostics = null;
  }
}

export const inferenceDiagnostics = new InferenceDiagnosticsService();

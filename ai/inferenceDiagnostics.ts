// Offline Study AI - Real Inference Diagnostics & Observability (Phase 11)
import { getSetting, setSetting } from '../database/db';

export interface InferenceDiagnosticsData {
  timestamp: string;
  modelName: string;
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

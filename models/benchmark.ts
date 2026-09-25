// Offline Study AI - Local Model Benchmark Suite (Phase 10)
import { AIProvider, ChatMessage } from '../ai/provider';
import { getSetting, setSetting } from '../database/db';

export interface ModelBenchmarkResult {
  modelId: string;
  modelName: string;
  loadTimeMs: number;
  firstTokenLatencyMs: number;
  generationTokSec: number;
  totalTokens: number;
  totalDurationMs: number;
  approxRamBytes: number | null;
  timestamp: string;
  status: 'passed' | 'failed';
  error?: string;
}

export class ModelBenchmarkService {
  private benchmarksKey = 'model_benchmarks_json';

  /**
   * Retrieves all persisted local model benchmarks from SQLite.
   */
  public getBenchmarks(): Record<string, ModelBenchmarkResult> {
    try {
      const raw = getSetting(this.benchmarksKey);
      if (raw) {
        return JSON.parse(raw);
      }
    } catch {
      // fallback
    }
    return {};
  }

  public getBenchmarkForModel(modelId: string): ModelBenchmarkResult | null {
    const all = this.getBenchmarks();
    return all[modelId] || null;
  }

  public saveBenchmark(result: ModelBenchmarkResult): void {
    const all = this.getBenchmarks();
    all[result.modelId] = result;
    setSetting(this.benchmarksKey, JSON.stringify(all));
  }

  /**
   * Runs an actual local benchmark on the provided AIProvider.
   * Measures first-token latency, generation speed (tok/s), and total duration.
   */
  public async runBenchmark(
    provider: AIProvider,
    modelId: string,
    modelName: string
  ): Promise<ModelBenchmarkResult> {
    const testPrompt: ChatMessage[] = [
      {
        id: 'bench_sys',
        conversationId: 'benchmark',
        role: 'system',
        content: 'You are an offline personal study assistant. Answer concisely.',
        createdAt: new Date().toISOString()
      },
      {
        id: 'bench_user',
        conversationId: 'benchmark',
        role: 'user',
        content: 'Explain in two sentences what a CPU is.',
        createdAt: new Date().toISOString()
      }
    ];

    const startTime = performance.now();
    let firstTokenTime: number | null = null;
    let accumulatedText = '';
    let tokensGenerated = 0;

    try {
      const output = await provider.generateResponse(testPrompt, {
        temperature: 0.1,
        maxTokens: 64,
        callbacks: {
          onToken: (token: string) => {
            if (firstTokenTime === null) {
              firstTokenTime = performance.now();
            }
            accumulatedText += token;
            tokensGenerated++;
          }
        }
      });

      const endTime = performance.now();
      const totalDurationMs = Math.max(1, Math.round(endTime - startTime));
      const firstTokenLatencyMs = firstTokenTime ? Math.round(firstTokenTime - startTime) : totalDurationMs;
      
      const charCount = output.trim().length;
      const estimatedTokens = Math.max(tokensGenerated, Math.ceil(charCount / 3.5));
      const generationDurationSec = Math.max(0.1, (endTime - (firstTokenTime || startTime)) / 1000);
      const generationTokSec = parseFloat((estimatedTokens / generationDurationSec).toFixed(1));

      const result: ModelBenchmarkResult = {
        modelId,
        modelName,
        loadTimeMs: firstTokenLatencyMs,
        firstTokenLatencyMs,
        generationTokSec,
        totalTokens: estimatedTokens,
        totalDurationMs,
        approxRamBytes: null,
        timestamp: new Date().toISOString(),
        status: 'passed'
      };

      this.saveBenchmark(result);
      return result;
    } catch (err: any) {
      const result: ModelBenchmarkResult = {
        modelId,
        modelName,
        loadTimeMs: 0,
        firstTokenLatencyMs: 0,
        generationTokSec: 0,
        totalTokens: 0,
        totalDurationMs: 0,
        approxRamBytes: null,
        timestamp: new Date().toISOString(),
        status: 'failed',
        error: err.message || 'Benchmark inference failed'
      };
      this.saveBenchmark(result);
      return result;
    }
  }
}

export const modelBenchmarkService = new ModelBenchmarkService();

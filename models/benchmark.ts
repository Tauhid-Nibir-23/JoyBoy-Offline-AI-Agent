// Offline Study AI - Local Model Benchmark Suite (Phase 10 & 12)
import { AIProvider, ChatMessage } from '../ai/provider';
import { getSetting, setSetting } from '../database/db';
import { validateResponse } from '../ai/responseValidator';

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
  cpuModel?: string;
  osName?: string;
  threads?: number;
  contextSize?: number;
  modelFilename?: string;
  promptTokSec?: number;
}

export interface BenchmarkPromptItem {
  id: string;
  category: 'Basic Knowledge' | 'Reasoning' | 'Study';
  prompt: string;
  maxTokens?: number;
}

export const STUDY_BENCHMARK_PROMPTS: BenchmarkPromptItem[] = [
  // Basic Knowledge
  { id: 'bk_1', category: 'Basic Knowledge', prompt: 'What is an Operating System?' },
  { id: 'bk_2', category: 'Basic Knowledge', prompt: 'What is Deadlock?' },
  { id: 'bk_3', category: 'Basic Knowledge', prompt: 'What is Paging?' },
  { id: 'bk_4', category: 'Basic Knowledge', prompt: 'What is a Process?' },
  // Reasoning
  { id: 'rs_5', category: 'Reasoning', prompt: 'Explain the four necessary conditions of Deadlock.' },
  { id: 'rs_6', category: 'Reasoning', prompt: 'Explain Hold and Wait simply.' },
  { id: 'rs_7', category: 'Reasoning', prompt: 'Give a real-life example.' },
  // Study
  { id: 'st_8', category: 'Study', prompt: 'Explain this in exam-friendly language.' },
  { id: 'st_9', category: 'Study', prompt: 'Make 3 MCQs.' },
  { id: 'st_10', category: 'Study', prompt: 'Summarize this topic in 5 points.' }
];

export const PHASE13_STUDY_BENCHMARK_PROMPTS: BenchmarkPromptItem[] = [
  { id: 'p13_basic_1', category: 'Basic Knowledge', prompt: 'What is an Operating System?' },
  { id: 'p13_bengali_2', category: 'Basic Knowledge', prompt: 'ডেডলক কী? সহজ করে বুঝাও।' },
  { id: 'p13_banglish_3', category: 'Basic Knowledge', prompt: 'deadlock ki? eta easy kore bujhao' },
  { id: 'p13_followup_4', category: 'Reasoning', prompt: '4 ta condition bolo' },
  { id: 'p13_followup_5', category: 'Reasoning', prompt: '2 number ta easy kore bujhao' },
  { id: 'p13_followup_6', category: 'Reasoning', prompt: 'real life example daw' },
  { id: 'p13_followup_7', category: 'Study', prompt: 'exam e kivabe likhbo?' },
  { id: 'p13_reasoning_8', category: 'Reasoning', prompt: 'Why does deadlock happen?' },
  { id: 'p13_study_9', category: 'Study', prompt: 'এই topic থেকে 5টা MCQ বানাও' },
  { id: 'p13_short_10', category: 'Study', prompt: '2 marks er jonno short answer daw' },
  { id: 'p13_pdf_11', category: 'Study', prompt: 'ei PDF theke deadlock ta bujhao' },
  { id: 'p13_pdf_12', category: 'Study', prompt: 'ager point ta aro easy kore bolo' },
  { id: 'p13_pdf_13', category: 'Study', prompt: 'exam e kon part ta important?' }
];

export interface BenchmarkPromptResult {
  promptId: string;
  category: string;
  prompt: string;
  promptTokens: number;
  responseTokens: number;
  firstTokenLatencyMs: number;
  generationTokSec: number;
  durationMs: number;
  validationPassed: boolean;
  sampleOutput: string;
}

export interface ComprehensiveBenchmarkResult {
  modelId: string;
  modelName: string;
  timestamp: string;
  totalDurationMs: number;
  averageFirstTokenLatencyMs: number;
  averageGenerationTokSec: number;
  totalPromptTokens: number;
  totalResponseTokens: number;
  approxRamBytes: number | null;
  status: 'passed' | 'failed';
  results: BenchmarkPromptResult[];
  cpuModel?: string;
  osName?: string;
  threads?: number;
  contextSize?: number;
  modelFilename?: string;
  averagePromptTokSec?: number;
}

export interface ModelComparisonMetrics {
  modelA: string;
  modelB: string;
  speedRatio: number; // generation speed ratio
  latencyRatio: number; // first token latency ratio
  tokenEfficiency: number;
  summary: string;
}

export class ModelBenchmarkService {
  private benchmarksKey = 'model_benchmarks_json';
  private comprehensiveKey = 'model_comprehensive_benchmarks_json';

  /**
   * Retrieves all single-probe local model benchmarks from SQLite.
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
   * Retrieves all multi-prompt study benchmarks from SQLite.
   */
  public getComprehensiveBenchmarks(): Record<string, ComprehensiveBenchmarkResult> {
    try {
      const raw = getSetting(this.comprehensiveKey);
      if (raw) {
        return JSON.parse(raw);
      }
    } catch {
      // fallback
    }
    return {};
  }

  public getComprehensiveBenchmarkForModel(modelId: string): ComprehensiveBenchmarkResult | null {
    const all = this.getComprehensiveBenchmarks();
    return all[modelId] || null;
  }

  public saveComprehensiveBenchmark(result: ComprehensiveBenchmarkResult): void {
    const all = this.getComprehensiveBenchmarks();
    all[result.modelId] = result;
    setSetting(this.comprehensiveKey, JSON.stringify(all));
  }

  /**
   * Runs an actual local benchmark on the provided AIProvider (single probe).
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

      let approxRamBytes: number | null = null;
      let cpuModel: string = 'Unknown CPU';
      let osName: string = 'Unknown OS';
      if (typeof process !== 'undefined' && process.versions && process.versions.node) {
        try {
          const os = await import('os');
          cpuModel = os.cpus()?.[0]?.model || cpuModel;
          osName = `${os.type()} ${os.release()}`;
          approxRamBytes = process.memoryUsage ? process.memoryUsage().rss : null;
        } catch {
          // ignore
        }
      }

      const result: ModelBenchmarkResult = {
        modelId,
        modelName,
        loadTimeMs: firstTokenLatencyMs,
        firstTokenLatencyMs,
        generationTokSec,
        totalTokens: estimatedTokens,
        totalDurationMs,
        approxRamBytes,
        timestamp: new Date().toISOString(),
        status: 'passed',
        cpuModel,
        osName,
        threads: 4,
        contextSize: 2048,
        modelFilename: modelId.includes('3b') ? 'qwen2.5-3b-instruct-q4_k_m.gguf' : 'qwen2.5-0.5b-instruct-q4_k_m.gguf'
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

  /**
   * Phase 12 Section 20: Comprehensive 10-prompt study benchmark suite.
   * Runs Basic Knowledge, Reasoning, and Study prompts.
   */
  public async runComprehensiveBenchmark(
    provider: AIProvider,
    modelId: string,
    modelName: string,
    options?: { maxPrompts?: number }
  ): Promise<ComprehensiveBenchmarkResult> {
    const promptsToRun = options?.maxPrompts 
      ? STUDY_BENCHMARK_PROMPTS.slice(0, options.maxPrompts)
      : STUDY_BENCHMARK_PROMPTS;

    const results: BenchmarkPromptResult[] = [];
    const overallStartTime = performance.now();

    let totalPromptTokens = 0;
    let totalResponseTokens = 0;
    let latencySum = 0;
    let speedSum = 0;

    for (const item of promptsToRun) {
      const promptMsgs: ChatMessage[] = [
        {
          id: `bench_sys_${item.id}`,
          conversationId: 'comp_bench',
          role: 'system',
          content: 'You are JoyBoy, an offline personal study assistant. Be accurate, clear, and direct.',
          createdAt: new Date().toISOString()
        },
        {
          id: `bench_u_${item.id}`,
          conversationId: 'comp_bench',
          role: 'user',
          content: item.prompt,
          createdAt: new Date().toISOString()
        }
      ];

      const pTokens = Math.ceil(item.prompt.length / 3.5);
      totalPromptTokens += pTokens;

      const pStart = performance.now();
      let firstTokenTime: number | null = null;
      let streamedTokens = 0;

      try {
        const responseText = await provider.generateResponse(promptMsgs, {
          temperature: 0.3,
          maxTokens: item.maxTokens || 128,
          callbacks: {
            onToken: () => {
              if (firstTokenTime === null) {
                firstTokenTime = performance.now();
              }
              streamedTokens++;
            }
          }
        });

        const pEnd = performance.now();
        const durationMs = Math.max(1, Math.round(pEnd - pStart));
        const firstTokenLatencyMs = firstTokenTime ? Math.round(firstTokenTime - pStart) : durationMs;
        const respTokens = Math.max(streamedTokens, Math.ceil(responseText.trim().length / 3.5));
        totalResponseTokens += respTokens;

        const genSec = Math.max(0.05, (pEnd - (firstTokenTime || pStart)) / 1000);
        const tokSec = parseFloat((respTokens / genSec).toFixed(1));

        latencySum += firstTokenLatencyMs;
        speedSum += tokSec;

        const validation = validateResponse({ userQuery: item.prompt, assistantResponse: responseText });

        results.push({
          promptId: item.id,
          category: item.category,
          prompt: item.prompt,
          promptTokens: pTokens,
          responseTokens: respTokens,
          firstTokenLatencyMs,
          generationTokSec: tokSec,
          durationMs,
          validationPassed: validation.isValid,
          sampleOutput: responseText.slice(0, 120)
        });
      } catch (err: any) {
        results.push({
          promptId: item.id,
          category: item.category,
          prompt: item.prompt,
          promptTokens: pTokens,
          responseTokens: 0,
          firstTokenLatencyMs: 0,
          generationTokSec: 0,
          durationMs: 0,
          validationPassed: false,
          sampleOutput: `Error: ${err.message}`
        });
      }
    }

    const overallEndTime = performance.now();
    const count = Math.max(1, results.length);
    const avgLatency = Math.round(latencySum / count);
    const avgSpeed = parseFloat((speedSum / count).toFixed(1));

    let approxRamBytes: number | null = null;
    let cpuModel: string = 'Unknown CPU';
    let osName: string = 'Unknown OS';
    if (typeof process !== 'undefined' && process.versions && process.versions.node) {
      try {
        const os = await import('os');
        cpuModel = os.cpus()?.[0]?.model || cpuModel;
        osName = `${os.type()} ${os.release()}`;
        approxRamBytes = process.memoryUsage ? process.memoryUsage().rss : null;
      } catch {
        // ignore
      }
    }

    const compResult: ComprehensiveBenchmarkResult = {
      modelId,
      modelName,
      timestamp: new Date().toISOString(),
      totalDurationMs: Math.round(overallEndTime - overallStartTime),
      averageFirstTokenLatencyMs: avgLatency,
      averageGenerationTokSec: avgSpeed,
      totalPromptTokens,
      totalResponseTokens,
      approxRamBytes,
      status: results.every(r => r.validationPassed) ? 'passed' : 'failed',
      results,
      cpuModel,
      osName,
      threads: 4,
      contextSize: 2048,
      modelFilename: modelId.includes('3b') ? 'qwen2.5-3b-instruct-q4_k_m.gguf' : 'qwen2.5-0.5b-instruct-q4_k_m.gguf'
    };

    this.saveComprehensiveBenchmark(compResult);
    return compResult;
  }

  /**
   * Phase 12 Section 21: Factual comparison between two benchmarked models.
   */
  public compareModels(modelAId: string, modelBId: string): ModelComparisonMetrics | null {
    const a = this.getBenchmarkForModel(modelAId) || this.getComprehensiveBenchmarkForModel(modelAId);
    const b = this.getBenchmarkForModel(modelBId) || this.getComprehensiveBenchmarkForModel(modelBId);

    if (!a || !b) return null;

    const speedA = 'averageGenerationTokSec' in a ? a.averageGenerationTokSec : a.generationTokSec;
    const speedB = 'averageGenerationTokSec' in b ? b.averageGenerationTokSec : b.generationTokSec;
    const latA = 'averageFirstTokenLatencyMs' in a ? a.averageFirstTokenLatencyMs : a.firstTokenLatencyMs;
    const latB = 'averageFirstTokenLatencyMs' in b ? b.averageFirstTokenLatencyMs : b.firstTokenLatencyMs;

    const speedRatio = speedB > 0 ? parseFloat((speedA / speedB).toFixed(2)) : 1.0;
    const latencyRatio = latB > 0 ? parseFloat((latA / latB).toFixed(2)) : 1.0;

    return {
      modelA: a.modelName,
      modelB: b.modelName,
      speedRatio,
      latencyRatio,
      tokenEfficiency: parseFloat(((speedA / Math.max(1, latA)) * 100).toFixed(1)),
      summary: `${a.modelName} generates at ${speedA} tok/s (${speedRatio}x vs ${b.modelName} at ${speedB} tok/s) with ${latA}ms initial latency.`
    };
  }
}

export const modelBenchmarkService = new ModelBenchmarkService();

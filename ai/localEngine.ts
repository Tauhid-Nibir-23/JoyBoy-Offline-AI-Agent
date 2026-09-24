import { ChatMessage, GenerateOptions, GenerationMetrics } from './provider';
import { ModelProfile } from '../models/types';
import { modelManager } from '../models/manager';
import { buildContextWindow, formatToChatML, DEFAULT_SYSTEM_PROMPT } from './context';
import { getSetting, setSetting } from '../database/db';

export interface AIEngineConfig {
  modelPath: string;
  contextLength: number;
  temperature: number;
  maxTokens: number;
  topP: number;
  systemPrompt: string;
  gpuLayers: number;
  cpuThreads: number;
}

export interface EngineStatusInfo {
  initialized: boolean;
  available: boolean;
  busy: boolean;
  isServerRunning: boolean;
  serverPort: number | null;
  activeModel: ModelProfile | null;
  details: string;
}

async function tryTauriInvoke<T>(command: string, args?: Record<string, unknown>): Promise<T | null> {
  try {
    if (typeof window !== 'undefined') {
      const internals = (window as any).__TAURI_INTERNALS__;
      if (internals && typeof internals.invoke === 'function') {
        return await internals.invoke(command, args);
      }
      const tauriCore = await import('@tauri-apps/api/core').catch(() => null);
      if (tauriCore && typeof tauriCore.invoke === 'function') {
        return await tauriCore.invoke(command, args);
      }
    }
  } catch {
    // Tauri not available
  }
  return null;
}

export class LocalAIEngine {
  private isInitialized: boolean = false;
  private isBusy: boolean = false;
  private abortController: AbortController | null = null;
  private activeModel: ModelProfile | null = null;
  private serverPort: number | null = null;

  private config: AIEngineConfig = {
    modelPath: '',
    contextLength: 4096,
    temperature: 0.7,
    maxTokens: 512,
    topP: 0.9,
    systemPrompt: DEFAULT_SYSTEM_PROMPT,
    gpuLayers: 0,
    cpuThreads: 4
  };

  public async initialize(customConfig?: Partial<AIEngineConfig>): Promise<boolean> {
    // Load persisted settings if available
    const savedTemp = getSetting('temperature');
    if (savedTemp) this.config.temperature = parseFloat(savedTemp) || 0.7;

    const savedMaxTokens = getSetting('max_tokens');
    if (savedMaxTokens) this.config.maxTokens = parseInt(savedMaxTokens, 10) || 512;

    const savedCtx = getSetting('context_length');
    if (savedCtx) this.config.contextLength = parseInt(savedCtx, 10) || 4096;

    const savedPrompt = getSetting('system_prompt');
    if (savedPrompt) this.config.systemPrompt = savedPrompt;

    if (customConfig) {
      this.config = { ...this.config, ...customConfig };
    }

    await modelManager.initialize();
    this.activeModel = modelManager.getActiveModel();

    if (this.activeModel?.path) {
      this.config.modelPath = this.activeModel.path;
      this.config.contextLength = this.activeModel.contextLength || 4096;
      // Pre-load / start server once for memory persistence if model is valid
      await this.loadModel(this.activeModel.path);
    }

    this.isInitialized = true;
    return this.isAvailable();
  }

  public async loadModel(modelPath: string): Promise<boolean> {
    if (!modelPath) return false;

    // Check if server is already running
    const serverStatus = await tryTauriInvoke<{ isRunning: boolean; port: number; loadedModelPath: string | null }>(
      'get_local_llama_server_status'
    );

    if (serverStatus?.isRunning && serverStatus.loadedModelPath === modelPath) {
      this.serverPort = serverStatus.port;
      return true;
    }

    // Try starting llama-server once
    try {
      const port = await tryTauriInvoke<number>('start_local_llama_server', {
        modelPath,
        port: 8088,
        threads: this.config.cpuThreads,
        gpuLayers: this.config.gpuLayers
      });

      if (port) {
        this.serverPort = port;
        return true;
      }
    } catch {
      // llama-server not available; fallback to CLI mode
    }

    return false;
  }

  public async unloadModel(): Promise<void> {
    try {
      await tryTauriInvoke('stop_local_llama_server');
    } catch {
      // Ignore
    }
    this.serverPort = null;
  }

  public async isAvailable(): Promise<boolean> {
    this.activeModel = modelManager.getActiveModel();
    if (!this.activeModel || !this.activeModel.path) {
      return false;
    }

    const validation = await modelManager.validateModelFile(this.activeModel.path);
    if (!validation.isValid) {
      return false;
    }

    const engineInfo = await tryTauriInvoke<{ isAvailable: boolean }>('get_llama_engine_info');
    if (engineInfo) {
      return engineInfo.isAvailable;
    }

    return false;
  }

  public getModelInfo(): ModelProfile | null {
    return this.activeModel || modelManager.getActiveModel();
  }

  public getConfig(): AIEngineConfig {
    return { ...this.config };
  }

  public setConfig(update: Partial<AIEngineConfig>): void {
    this.config = { ...this.config, ...update };
    if (update.temperature !== undefined) setSetting('temperature', update.temperature.toString());
    if (update.maxTokens !== undefined) setSetting('max_tokens', update.maxTokens.toString());
    if (update.contextLength !== undefined) setSetting('context_length', update.contextLength.toString());
    if (update.systemPrompt !== undefined) setSetting('system_prompt', update.systemPrompt);
  }

  public getStatus(): EngineStatusInfo {
    const model = this.getModelInfo();
    const hasModel = !!(model && model.path && (model.status === 'Ready' || model.status === 'Installed'));

    return {
      initialized: this.isInitialized,
      available: hasModel,
      busy: this.isBusy,
      isServerRunning: this.serverPort !== null,
      serverPort: this.serverPort,
      activeModel: model,
      details: hasModel
        ? `Local model ${model?.name || ''} ready`
        : 'No local model installed or selected'
    };
  }

  public async generate(
    input: string | ChatMessage[],
    options?: GenerateOptions
  ): Promise<string> {
    const available = await this.isAvailable();
    if (!available) {
      const model = this.getModelInfo();
      if (!model || !model.path) {
        throw new Error('The local model could not be loaded. Check that the selected GGUF model exists and is compatible.');
      }
      throw new Error('Local llama.cpp inference engine is not installed or available on this system.');
    }

    this.isBusy = true;
    this.abortController = new AbortController();

    // Link optional external signal to internal abortController
    if (options?.signal) {
      options.signal.addEventListener('abort', () => this.stop());
    }

    const startTime = performance.now();
    let firstTokenTime: number | null = null;
    let accumulatedText = '';
    let tokenCount = 0;

    options?.callbacks?.onStart?.();

    try {
      // 1. Build bounded context window
      const messages: ChatMessage[] = Array.isArray(input)
        ? buildContextWindow(input, {
            systemPrompt: options?.systemPrompt || this.config.systemPrompt,
            contextLength: this.config.contextLength,
            reservedOutputTokens: options?.maxTokens || this.config.maxTokens
          })
        : [
            {
              id: 'sys',
              conversationId: 'c1',
              role: 'system',
              content: options?.systemPrompt || this.config.systemPrompt,
              createdAt: new Date().toISOString()
            },
            {
              id: 'user_single',
              conversationId: 'c1',
              role: 'user',
              content: input,
              createdAt: new Date().toISOString()
            }
          ];

      const modelPath = this.activeModel!.path!;
      const maxTokens = options?.maxTokens ?? this.config.maxTokens;
      const temperature = options?.temperature ?? this.config.temperature;

      // 2. If persistent local server is running, use SSE streaming on 127.0.0.1
      if (this.serverPort) {
        try {
          accumulatedText = await this.streamFromServer(
            this.serverPort,
            messages,
            maxTokens,
            temperature,
            options?.callbacks?.onToken,
            this.abortController.signal,
            () => {
              if (!firstTokenTime) firstTokenTime = performance.now();
              tokenCount++;
            }
          );
        } catch (serverErr: any) {
          if (serverErr.name === 'AbortError') {
            throw new Error('Inference was cancelled by user.');
          }
          // Server failed or crashed, fallback to one-shot CLI execution
          console.warn('Local server query failed, attempting CLI fallback:', serverErr);
          accumulatedText = '';
        }
      }

      // 3. Fallback: One-shot CLI inference via Tauri if server streaming wasn't used
      if (!accumulatedText) {
        const prompt = formatToChatML(messages);
        const cliResult = await tryTauriInvoke<string>('run_local_inference', {
          modelPath,
          prompt,
          maxTokens,
          temperature
        });

        if (cliResult === null) {
          throw new Error('Local inference invocation failed or Tauri runtime unavailable.');
        }

        accumulatedText = cliResult;
        tokenCount = Math.ceil(accumulatedText.length / 3.5);
        if (options?.callbacks?.onToken) {
          options.callbacks.onToken(accumulatedText);
        }
      }

      const endTime = performance.now();
      const totalDurationMs = Math.max(1, Math.round(endTime - startTime));
      const firstTokenLatencyMs = firstTokenTime ? Math.round(firstTokenTime - startTime) : undefined;
      const tokensPerSecond = tokenCount > 0 ? parseFloat(((tokenCount / totalDurationMs) * 1000).toFixed(1)) : undefined;

      const metrics: GenerationMetrics = {
        providerId: 'llamacpp',
        providerName: 'Local AI',
        modelName: this.activeModel?.name || 'Local GGUF',
        totalDurationMs,
        tokenCount,
        tokensPerSecond,
        firstTokenLatencyMs
      };

      options?.callbacks?.onComplete?.(accumulatedText, metrics);
      return accumulatedText;

    } catch (err: any) {
      options?.callbacks?.onError?.(err);
      throw err;
    } finally {
      this.isBusy = false;
      this.abortController = null;
    }
  }

  public stop(): void {
    if (this.abortController) {
      this.abortController.abort();
      this.abortController = null;
    }
    this.isBusy = false;
  }

  public dispose(): void {
    this.stop();
    this.unloadModel();
    this.isInitialized = false;
    this.activeModel = null;
  }

  private async streamFromServer(
    port: number,
    messages: ChatMessage[],
    maxTokens: number,
    temperature: number,
    onToken?: (token: string) => void,
    signal?: AbortSignal,
    onChunkReceived?: () => void
  ): Promise<string> {
    const response = await fetch(`http://127.0.0.1:${port}/v1/chat/completions`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        messages: messages.map((m) => ({ role: m.role, content: m.content })),
        max_tokens: maxTokens,
        temperature,
        stream: true
      }),
      signal
    });

    if (!response.ok) {
      throw new Error(`Local llama-server HTTP error: ${response.status} ${response.statusText}`);
    }

    if (!response.body) {
      throw new Error('Local llama-server returned no readable stream body.');
    }

    const reader = response.body.getReader();
    const decoder = new TextDecoder('utf-8');
    let fullOutput = '';
    let buffer = '';

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split('\n');
      buffer = lines.pop() || '';

      for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed || trimmed === 'data: [DONE]') continue;
        if (trimmed.startsWith('data: ')) {
          try {
            const data = JSON.parse(trimmed.slice(6));
            const delta = data.choices?.[0]?.delta?.content || '';
            if (delta) {
              fullOutput += delta;
              onToken?.(delta);
              onChunkReceived?.();
            }
          } catch {
            // Partial JSON chunk
          }
        }
      }
    }

    return fullOutput.trim();
  }
}

export const localAIEngine = new LocalAIEngine();

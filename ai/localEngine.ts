import { ChatMessage, GenerateOptions } from './provider';
import { ModelProfile } from '../models/types';
import { modelManager } from '../models/manager';

export interface AIEngineConfig {
  modelPath: string;
  contextLength: number;
  temperature: number;
  maxTokens: number;
  gpuLayers: number;
  cpuThreads: number;
}

export interface EngineStatusInfo {
  initialized: boolean;
  available: boolean;
  busy: boolean;
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
  private config: AIEngineConfig = {
    modelPath: '',
    contextLength: 4096,
    temperature: 0.7,
    maxTokens: 512,
    gpuLayers: 0,
    cpuThreads: 4
  };

  public async initialize(customConfig?: Partial<AIEngineConfig>): Promise<boolean> {
    if (customConfig) {
      this.config = { ...this.config, ...customConfig };
    }

    await modelManager.initialize();
    this.activeModel = modelManager.getActiveModel();

    if (this.activeModel?.path) {
      this.config.modelPath = this.activeModel.path;
      this.config.contextLength = this.activeModel.contextLength || 4096;
    }

    this.isInitialized = true;
    return this.isAvailable();
  }

  public async isAvailable(): Promise<boolean> {
    // 1. Must have an active model with valid path
    this.activeModel = modelManager.getActiveModel();
    if (!this.activeModel || !this.activeModel.path) {
      return false;
    }

    // 2. Validate model file existence & header
    const validation = await modelManager.validateModelFile(this.activeModel.path);
    if (!validation.isValid) {
      return false;
    }

    // 3. Check if local inference engine (llama.cpp) is available in Tauri backend
    const engineInfo = await tryTauriInvoke<{ isAvailable: boolean }>('get_llama_engine_info');
    if (engineInfo) {
      return engineInfo.isAvailable;
    }

    return false;
  }

  public getModelInfo(): ModelProfile | null {
    return this.activeModel || modelManager.getActiveModel();
  }

  public getStatus(): EngineStatusInfo {
    const model = this.getModelInfo();
    const hasModel = !!(model && model.path && (model.status === 'Ready' || model.status === 'Installed'));

    return {
      initialized: this.isInitialized,
      available: hasModel,
      busy: this.isBusy,
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
        throw new Error('Local AI Engine is unavailable: No valid GGUF model is selected. Please select a model in Settings.');
      }
      throw new Error('Local AI Engine is unavailable: llama.cpp engine binary is not detected on this system.');
    }

    this.isBusy = true;
    this.abortController = new AbortController();

    try {
      const prompt = typeof input === 'string' ? input : this.formatHistoryToPrompt(input);
      const maxTokens = options?.maxTokens ?? this.config.maxTokens;
      const temperature = options?.temperature ?? this.config.temperature;

      const modelPath = this.activeModel!.path!;

      const result = await tryTauriInvoke<string>('run_local_inference', {
        modelPath,
        prompt,
        maxTokens,
        temperature
      });

      if (result === null) {
        throw new Error('Local inference invocation failed or Tauri runtime unavailable.');
      }

      return result;
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
    this.isInitialized = false;
    this.activeModel = null;
  }

  private formatHistoryToPrompt(history: ChatMessage[]): string {
    // Formats ChatMessage array into standard ChatML or instruction prompt
    let formatted = '<|im_start|>system\nYou are Offline Study AI, a private and helpful personal study assistant.<|im_end|>\n';
    for (const msg of history) {
      formatted += `<|im_start|>${msg.role}\n${msg.content}<|im_end|>\n`;
    }
    formatted += '<|im_start|>assistant\n';
    return formatted;
  }
}

export const localAIEngine = new LocalAIEngine();

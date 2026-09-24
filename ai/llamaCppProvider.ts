import { AIProvider, ChatMessage, GenerateOptions } from './provider';
import { localAIEngine, LocalAIEngine } from './localEngine';

export class LlamaCppProvider implements AIProvider {
  public id = 'llamacpp';
  public name = 'Local llama.cpp (GGUF)';
  private engine: LocalAIEngine;

  constructor(engine?: LocalAIEngine) {
    this.engine = engine || localAIEngine;
  }

  public async isAvailable(): Promise<boolean> {
    return await this.engine.isAvailable();
  }

  public async generateResponse(
    history: ChatMessage[],
    options?: GenerateOptions
  ): Promise<string> {
    return await this.engine.generate(history, options);
  }

  public stop(): void {
    this.engine.stop();
  }

  public dispose(): void {
    this.engine.dispose();
  }
}

export const llamaCppProvider = new LlamaCppProvider();

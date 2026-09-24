export interface AIEngineConfig {
  modelPath: string;
  modelName: string;
  contextLength: number;
  gpuLayers: number;
  cpuThreads: number;
}

export class LocalAIEngine {
  private status: 'uninitialized' | 'stopped' | 'running' = 'uninitialized';

  public getStatus() {
    return this.status;
  }

  public async initialize(): Promise<void> {
    console.log('[AI Engine Stub] Prepared for Phase 2 integration');
    this.status = 'stopped';
  }
}

export const aiEngine = new LocalAIEngine();

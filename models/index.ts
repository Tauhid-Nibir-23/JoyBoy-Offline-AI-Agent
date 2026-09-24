export interface ModelProfile {
  id: string;
  name: string;
  recommendedRamGb: number;
  sizeGb: number;
  format: 'GGUF';
}

export const RECOMMENDED_BASELINE_MODELS: ModelProfile[] = [
  {
    id: 'qwen3-4b',
    name: 'Qwen3-4B-GGUF (Q4_K_M)',
    recommendedRamGb: 8,
    sizeGb: 2.5,
    format: 'GGUF'
  }
];

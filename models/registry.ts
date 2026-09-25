import { ModelProfile, PerformancePreset, GenerationPresetConfig } from './types';

export const BASELINE_MODEL: ModelProfile = {
  id: 'qwen3-4b-q4_k_m',
  name: 'Qwen3 4B',
  provider: 'Qwen',
  format: 'GGUF',
  quantization: 'Q4_K_M',
  fileName: 'qwen3-4b-q4_k_m.gguf',
  expectedSize: 2_600_000_000,
  contextLength: 4096,
  status: 'Not Installed',
  recommendedRamGb: 8,
  description: 'Baseline offline model for personal study, technical explanations, and code review.'
};

export const RECOMMENDED_3B_MODEL: ModelProfile = {
  id: 'qwen2.5-3b-instruct-q4_k_m',
  name: 'Qwen 2.5 3B Instruct',
  provider: 'Qwen',
  format: 'GGUF',
  quantization: 'Q4_K_M',
  fileName: 'qwen2.5-3b-instruct-q4_k_m.gguf',
  expectedSize: 2_000_000_000,
  contextLength: 4096,
  status: 'Not Installed',
  recommendedRamGb: 8,
  isRecommended: true,
  description: 'Recommended for this PC (AMD Ryzen 5 5600G, ~14 GB RAM). High-quality reasoning, follow-ups, and Bengali/Banglish comprehension.'
};

export const FALLBACK_05B_MODEL: ModelProfile = {
  id: 'qwen2.5-0.5b-instruct-q4_k_m',
  name: 'Qwen 2.5 0.5B Instruct',
  provider: 'Qwen',
  format: 'GGUF',
  quantization: 'Q4_K_M',
  fileName: 'qwen2.5-0.5b-instruct-q4_k_m.gguf',
  expectedSize: 491_400_032,
  contextLength: 4096,
  status: 'Not Installed',
  recommendedRamGb: 4,
  isFallback: true,
  description: 'Ultra-fast lightweight fallback model currently installed on disk.'
};

export const HEAVY_7B_MODEL: ModelProfile = {
  id: 'qwen2.5-7b-instruct-q4_k_m',
  name: 'Qwen 2.5 7B Instruct',
  provider: 'Qwen',
  format: 'GGUF',
  quantization: 'Q4_K_M',
  fileName: 'qwen2.5-7b-instruct-q4_k_m.gguf',
  expectedSize: 4_700_000_000,
  contextLength: 4096,
  status: 'Not Installed',
  recommendedRamGb: 16,
  isHeavy: true,
  description: 'Heavy — not recommended as default for this hardware (~14 GB RAM). High resource usage.'
};

export const INITIAL_REGISTERED_MODELS: ModelProfile[] = [
  RECOMMENDED_3B_MODEL,
  FALLBACK_05B_MODEL,
  BASELINE_MODEL,
  HEAVY_7B_MODEL,
  {
    id: 'llama-3.2-3b-q4_k_m',
    name: 'Llama 3.2 3B',
    provider: 'Meta',
    format: 'GGUF',
    quantization: 'Q4_K_M',
    fileName: 'llama-3.2-3b-instruct-q4_k_m.gguf',
    expectedSize: 2_000_000_000,
    contextLength: 4096,
    status: 'Not Installed',
    recommendedRamGb: 8,
    description: 'Compact reasoning model suitable for lower-spec desktop setups.'
  },
  {
    id: 'phi-3.5-mini-q4_k_m',
    name: 'Phi 3.5 Mini',
    provider: 'Microsoft',
    format: 'GGUF',
    quantization: 'Q4_K_M',
    fileName: 'phi-3.5-mini-instruct-q4_k_m.gguf',
    expectedSize: 2_400_000_000,
    contextLength: 4096,
    status: 'Not Installed',
    recommendedRamGb: 8,
    description: 'Fast lightweight model optimized for math, logic, and synthesis.'
  }
];

export const GENERATION_PRESETS: Record<PerformancePreset, GenerationPresetConfig> = {
  balanced: {
    name: 'Study / Balanced (Default)',
    preset: 'balanced',
    temperature: 0.7,
    topP: 0.9,
    repeatPenalty: 1.1,
    maxTokens: 512,
    contextLength: 4096
  },
  precise: {
    name: 'Precise (Facts & Exams)',
    preset: 'precise',
    temperature: 0.2,
    topP: 0.85,
    repeatPenalty: 1.15,
    maxTokens: 512,
    contextLength: 4096
  },
  creative: {
    name: 'Creative (Brainstorming)',
    preset: 'creative',
    temperature: 0.9,
    topP: 0.95,
    repeatPenalty: 1.05,
    maxTokens: 768,
    contextLength: 4096
  }
};

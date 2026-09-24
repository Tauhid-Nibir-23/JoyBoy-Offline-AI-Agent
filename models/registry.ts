import { ModelProfile } from './types';

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
  description: 'Recommended baseline offline model for personal study, technical explanations, and code review.'
};

export const INITIAL_REGISTERED_MODELS: ModelProfile[] = [
  BASELINE_MODEL,
  {
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
    description: 'Ultra-fast lightweight official Qwen model for local inference and study verification.'
  },
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

// JoyBoy / Offline Study AI - Generation Presets (Phase 9 - Part 13)

export type GenerationPresetMode = 'study' | 'precise' | 'creative';

export interface GenerationParameters {
  mode: GenerationPresetMode;
  name: string;
  description: string;
  temperature: number;
  top_p: number;
  repeat_penalty: number;
  max_tokens: number;
  context_length: number;
  threads: number;
}

export const GENERATION_PRESETS: Record<GenerationPresetMode, GenerationParameters> = {
  study: {
    mode: 'study',
    name: 'Study / Balanced (Default)',
    description: 'Prioritizes accuracy, instruction following, document grounding, and conversation continuity over creativity.',
    temperature: 0.4,
    top_p: 0.9,
    repeat_penalty: 1.15,
    max_tokens: 1024,
    context_length: 2048,
    threads: 4 // Conservative default suitable for quad-core and multi-threaded desktop/laptop CPUs
  },
  precise: {
    mode: 'precise',
    name: 'Precise / Deterministic',
    description: 'Strict factual accuracy, minimal randomness, ideal for formulas, definitions, and code syntax.',
    temperature: 0.2,
    top_p: 0.85,
    repeat_penalty: 1.2,
    max_tokens: 1024,
    context_length: 2048,
    threads: 4
  },
  creative: {
    mode: 'creative',
    name: 'Creative / Brainstorming',
    description: 'Higher variance for analogies, open-ended question generation, and alternative explanations.',
    temperature: 0.8,
    top_p: 0.95,
    repeat_penalty: 1.1,
    max_tokens: 1024,
    context_length: 2048,
    threads: 6
  }
};

/**
 * Returns generation parameters for a given preset mode, defaulting to Study / Balanced.
 */
export function getGenerationParameters(mode?: string | null): GenerationParameters {
  if (mode === 'precise') return GENERATION_PRESETS.precise;
  if (mode === 'creative') return GENERATION_PRESETS.creative;
  return GENERATION_PRESETS.study;
}

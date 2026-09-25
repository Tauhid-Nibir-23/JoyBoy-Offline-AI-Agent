// Offline Study AI - Model Management Types (Phase 8 & 9)

export type ModelStatus = 
  | 'Active'
  | 'Installed'
  | 'Not Installed'
  | 'Missing'
  | 'Unsupported'
  | 'Ready'
  | 'Error'
  | 'Unavailable'
  | 'Fallback'
  | 'Failed';

export type PerformancePreset = 'balanced' | 'precise' | 'creative';

export interface GenerationPresetConfig {
  name: string;
  preset: PerformancePreset;
  temperature: number;
  topP: number;
  repeatPenalty: number;
  maxTokens: number;
  contextLength: number;
}

export interface ModelHardwareEstimation {
  fileSizeBytes: number;
  expectedRamBytes: number;
  availableRamBytes: number;
  isSafeToLoad: boolean;
  warningMessage?: string;
  recommendedThreads: number;
  contextLength: number;
}

export interface ModelProfile {
  id: string;
  name: string;
  provider: string;
  format: 'GGUF';
  quantization: string;
  fileName: string;
  expectedSize: number; // in bytes
  contextLength: number;
  status: ModelStatus;
  path?: string;
  description?: string;
  recommendedRamGb?: number;
  isRecommended?: boolean;
  isFallback?: boolean;
  isHeavy?: boolean;
}

export interface DiscoveredModelFile {
  fileName: string;
  path: string;
  sizeBytes: number;
  isValidGguf: boolean;
  lastModified?: string;
}

export interface ModelValidationResult {
  isValid: boolean;
  fileSizeBytes: number;
  format: string;
  error?: string;
}

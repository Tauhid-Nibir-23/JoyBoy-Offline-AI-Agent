export type ModelStatus = 'Not Installed' | 'Installed' | 'Ready' | 'Unavailable' | 'Error';

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

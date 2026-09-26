// Offline Study AI - Model Hardware Profiler & Memory Safety (Phase 9)
import { ModelProfile, ModelHardwareEstimation } from './types';
import { detectHardware } from '../core/environment/hardware';

export class ModelHardwareEstimator {
  /**
   * Estimates model runtime memory footprint and verifies if it is safe to load on this machine.
   * Model runtime RAM ≈ file_size * 1.2 (weights + KV cache overhead) + 500MB runtime safety margin.
   */
  public async estimateModelSafety(
    model: ModelProfile,
    customAvailableRamBytes?: number
  ): Promise<ModelHardwareEstimation> {
    const hw = await detectHardware();
    const effectiveAvailableRam = hw.totalRamBytes
      ? Math.max(hw.availableRamBytes || 0, hw.totalRamBytes * 0.5)
      : (hw.availableRamBytes || 8 * 1024 * 1024 * 1024);
    const availableRam = customAvailableRamBytes !== undefined 
      ? customAvailableRamBytes 
      : effectiveAvailableRam;

    const fileSizeBytes = model.expectedSize || (model.path ? 2_000_000_000 : 0);
    // Estimated RAM needed: weights + KV buffer + execution overhead
    const expectedRamBytes = Math.round(fileSizeBytes * 1.25 + 512 * 1024 * 1024);

    const isSafeToLoad = expectedRamBytes <= availableRam;
    let warningMessage: string | undefined = undefined;

    if (!isSafeToLoad) {
      const neededGb = (expectedRamBytes / (1024 * 1024 * 1024)).toFixed(1);
      const availGb = (availableRam / (1024 * 1024 * 1024)).toFixed(1);
      warningMessage = `High RAM danger: Model requires ~${neededGb} GB RAM, but only ~${availGb} GB is currently available. Loading this model may cause system thrashing or crash.`;
    } else if (model.isHeavy) {
      warningMessage = 'Heavy model: high resource usage on integrated graphics. Recommended only if extra RAM is available.';
    }

    const recommendedThreads = Math.min(6, Math.max(1, (hw.logicalCores || 6) - 2));

    return {
      fileSizeBytes,
      expectedRamBytes,
      availableRamBytes: availableRam,
      isSafeToLoad,
      warningMessage,
      recommendedThreads,
      contextLength: model.contextLength || 4096
    };
  }
}

export const modelHardwareEstimator = new ModelHardwareEstimator();

export function getHardwareAwareRecommendation(ramGb: number = 14): {
  recommendedModelId: string;
  fallbackModelId: string;
  warnings: string[];
} {
  const warnings: string[] = [];
  if (ramGb >= 12) {
    warnings.push('7B models are Heavy — not recommended as default for this hardware.');
    return {
      recommendedModelId: 'qwen2.5-3b',
      fallbackModelId: 'qwen2.5-0.5b',
      warnings
    };
  }
  warnings.push('Low RAM: 0.5B model strongly recommended.');
  return {
    recommendedModelId: 'qwen2.5-0.5b',
    fallbackModelId: 'qwen2.5-0.5b',
    warnings
  };
}

export function assessModelLoadSafety(modelId: string, ramGb: number = 14): {
  isSafe: boolean;
  warning?: string;
} {
  if (modelId.includes('7b')) {
    return {
      isSafe: ramGb >= 16,
      warning: 'Heavy — not recommended as default for this hardware.'
    };
  }
  return { isSafe: true };
}

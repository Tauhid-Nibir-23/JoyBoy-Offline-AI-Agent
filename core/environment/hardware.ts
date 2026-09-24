export * from './types';
import { HardwareProfile } from './types';
import { windowsHardwareAdapter } from './windows';
import { linuxHardwareAdapter } from './linux';

// Safely attempt Tauri invoke if available
async function tryTauriInvoke<T>(command: string, args?: Record<string, unknown>): Promise<T | null> {
  try {
    if (typeof window !== 'undefined') {
      const internals = (window as any).__TAURI_INTERNALS__;
      if (internals && typeof internals.invoke === 'function') {
        return await internals.invoke(command, args);
      }
      // Also check standard @tauri-apps/api/core if bundled
      const tauriCore = await import('@tauri-apps/api/core').catch(() => null);
      if (tauriCore && typeof tauriCore.invoke === 'function') {
        return await tauriCore.invoke(command, args);
      }
    }
  } catch {
    // Tauri not available or invocation failed
  }
  return null;
}

export function formatBytes(bytes: number | null | undefined): string {
  if (bytes === null || bytes === undefined || isNaN(bytes) || bytes <= 0) {
    return 'Unknown';
  }
  const gb = bytes / (1024 * 1024 * 1024);
  if (gb >= 1) {
    return `${gb.toFixed(1)} GB`;
  }
  const mb = bytes / (1024 * 1024);
  return `${mb.toFixed(0)} MB`;
}

export function getRecommendedThreadCount(logicalCores: number): number {
  if (logicalCores <= 1) return 1;
  if (logicalCores <= 4) return Math.max(1, logicalCores - 1);
  return Math.min(logicalCores - 2, 8);
}

export async function detectHardware(): Promise<HardwareProfile> {
  // 1. Try native Tauri backend first (most accurate, native Windows/Linux system calls)
  const tauriProfile = await tryTauriInvoke<HardwareProfile>('get_hardware_profile');
  if (tauriProfile && tauriProfile.cpu && tauriProfile.os) {
    return tauriProfile;
  }

  // 2. Fall back to platform-specific adapters for browser/Node test environments
  const isWindows = typeof process !== 'undefined'
    ? process.platform === 'win32'
    : typeof navigator !== 'undefined' && /Windows/i.test(navigator.userAgent);

  const isLinux = typeof process !== 'undefined'
    ? process.platform === 'linux'
    : typeof navigator !== 'undefined' && /Linux/i.test(navigator.userAgent);

  if (isWindows) {
    return await windowsHardwareAdapter.detect();
  }

  if (isLinux) {
    return await linuxHardwareAdapter.detect();
  }

  // Generic fallback
  return {
    os: 'Unknown',
    architecture: 'Unknown',
    cpu: 'Unknown CPU',
    logicalCores: typeof navigator !== 'undefined' ? navigator.hardwareConcurrency || 4 : 4,
    physicalCores: null,
    totalRamBytes: 0,
    availableRamBytes: null,
    gpu: 'Unknown',
    gpuVendor: null,
    vramBytes: null,
  };
}

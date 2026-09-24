import { HardwareProfile, HardwareAdapter } from './hardware';

export class WindowsHardwareAdapter implements HardwareAdapter {
  public async detect(): Promise<HardwareProfile> {
    let logicalCores = 4;
    let physicalCores: number | null = null;
    let totalRamBytes = 0;
    let availableRamBytes: number | null = null;
    let cpu = 'Unknown CPU';
    let architecture = 'x64';
    let os = 'Windows';
    let gpu = 'Unknown';
    let gpuVendor: string | null = null;
    let vramBytes: number | null = null;

    // Node.js environment (e.g. Vitest tests)
    if (typeof process !== 'undefined' && process.versions && process.versions.node) {
      try {
        const nodeOs = await import('os');
        os = `Windows (${nodeOs.release ? nodeOs.release() : 'NT'})`;
        architecture = nodeOs.arch ? nodeOs.arch() : 'x64';
        const cpus = nodeOs.cpus ? nodeOs.cpus() : [];
        logicalCores = cpus.length || 4;
        if (cpus.length > 0 && cpus[0].model) {
          cpu = cpus[0].model.trim();
        }
        totalRamBytes = nodeOs.totalmem ? nodeOs.totalmem() : 0;
        availableRamBytes = nodeOs.freemem ? nodeOs.freemem() : null;
      } catch {
        // Fallback if os module import fails
      }
    } else if (typeof navigator !== 'undefined') {
      // Browser environment
      logicalCores = navigator.hardwareConcurrency || 4;
      if ((navigator as any).deviceMemory) {
        totalRamBytes = (navigator as any).deviceMemory * 1024 * 1024 * 1024;
      }
      os = 'Windows';
    }

    // Try detecting GPU via WebGL if in browser context
    if (typeof document !== 'undefined') {
      try {
        const canvas = document.createElement('canvas');
        const gl = canvas.getContext('webgl') || canvas.getContext('experimental-webgl');
        if (gl) {
          const debugInfo = (gl as any).getExtension('WEBGL_debug_renderer_info');
          if (debugInfo) {
            const renderer = (gl as any).getParameter(debugInfo.UNMASKED_RENDERER_WEBGL);
            const vendor = (gl as any).getParameter(debugInfo.UNMASKED_VENDOR_WEBGL);
            if (renderer && typeof renderer === 'string') {
              gpu = renderer;
            }
            if (vendor && typeof vendor === 'string') {
              gpuVendor = vendor;
            }
          }
        }
      } catch {
        // WebGL not available or blocked
      }
    }

    return {
      os,
      architecture,
      cpu,
      logicalCores,
      physicalCores,
      totalRamBytes,
      availableRamBytes,
      gpu,
      gpuVendor,
      vramBytes,
    };
  }
}

export const windowsHardwareAdapter = new WindowsHardwareAdapter();

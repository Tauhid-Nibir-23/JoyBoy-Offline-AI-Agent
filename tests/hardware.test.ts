import { describe, it, expect } from 'vitest';
import { 
  detectHardware, 
  formatBytes, 
  getRecommendedThreadCount, 
  HardwareProfile 
} from '../core/environment/hardware';
import { WindowsHardwareAdapter } from '../core/environment/windows';
import { LinuxHardwareAdapter } from '../core/environment/linux';

describe('Phase 2A Hardware Detection & Profile Tests', () => {
  it('returns a normalized hardware profile structure', async () => {
    const profile: HardwareProfile = await detectHardware();

    expect(profile).toBeDefined();
    expect(typeof profile.os).toBe('string');
    expect(typeof profile.architecture).toBe('string');
    expect(typeof profile.cpu).toBe('string');
    expect(typeof profile.logicalCores).toBe('number');
    expect(profile.logicalCores).toBeGreaterThanOrEqual(1);
    expect(typeof profile.totalRamBytes).toBe('number');
    expect(profile.totalRamBytes).toBeGreaterThanOrEqual(0);
    expect(typeof profile.gpu).toBe('string');
  });

  it('handles unknown hardware attributes gracefully without crashing', () => {
    expect(formatBytes(null)).toBe('Unknown');
    expect(formatBytes(undefined)).toBe('Unknown');
    expect(formatBytes(0)).toBe('Unknown');
    expect(formatBytes(-100)).toBe('Unknown');

    // Valid byte conversions
    expect(formatBytes(1024 * 1024 * 512)).toBe('512 MB');
    expect(formatBytes(1024 * 1024 * 1024 * 8)).toBe('8.0 GB');
    expect(formatBytes(1024 * 1024 * 1024 * 16)).toBe('16.0 GB');
  });

  it('calculates conservative recommended CPU thread count', () => {
    expect(getRecommendedThreadCount(1)).toBe(1);
    expect(getRecommendedThreadCount(2)).toBe(1);
    expect(getRecommendedThreadCount(4)).toBe(3);
    expect(getRecommendedThreadCount(8)).toBe(6);
    expect(getRecommendedThreadCount(16)).toBe(8); // capped at 8 to prevent UI freezing
  });

  it('windows hardware adapter returns normalized profile', async () => {
    const winAdapter = new WindowsHardwareAdapter();
    const profile = await winAdapter.detect();

    expect(profile.os).toContain('Windows');
    expect(profile.logicalCores).toBeGreaterThanOrEqual(1);
    expect(profile.cpu).toBeDefined();
  });

  it('linux hardware adapter returns normalized profile', async () => {
    const linuxAdapter = new LinuxHardwareAdapter();
    const profile = await linuxAdapter.detect();

    expect(profile.os).toContain('Linux');
    expect(profile.logicalCores).toBeGreaterThanOrEqual(1);
    expect(profile.cpu).toBeDefined();
  });
});

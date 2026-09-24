import { describe, it, expect } from 'vitest';
import { detectEnvironment } from '../core/environment';

describe('Phase 0 Foundation Tests', () => {
  it('detects OS and default environment settings correctly', () => {
    const sys = detectEnvironment();
    expect(sys.os).toBeDefined();
    expect(sys.aiStatus).toBe('Offline/Unavailable for now');
    expect(sys.dbStatus).toBe('Initialized');
  });
});

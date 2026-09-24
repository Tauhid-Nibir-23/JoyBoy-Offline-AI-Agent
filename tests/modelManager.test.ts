import { describe, it, expect, beforeEach, afterAll } from 'vitest';
import fs from 'fs';
import path from 'path';
import os from 'os';
import { ModelManager } from '../models/manager';
import { ModelProfile } from '../models/types';
import { initDatabase } from '../database/db';

describe('Phase 2A Model Manager Tests', () => {
  let manager: ModelManager;
  let tempDir: string;
  let validGgufPath: string;
  let corruptFilePath: string;

  beforeEach(async () => {
    await initDatabase();
    manager = new ModelManager();
    await manager.initialize();

    // Create a temporary sandbox directory for test models
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'luffy_models_test_'));
    
    // Create a mock valid GGUF file (starts with 'GGUF' magic bytes)
    validGgufPath = path.join(tempDir, 'test-model-q4_k_m.gguf');
    const validHeader = Buffer.from([0x47, 0x47, 0x55, 0x46, 0x03, 0x00, 0x00, 0x00]); // 'GGUF' + version 3
    fs.writeFileSync(validGgufPath, validHeader);

    // Create a corrupt non-GGUF file
    corruptFilePath = path.join(tempDir, 'corrupt-model.gguf');
    fs.writeFileSync(corruptFilePath, Buffer.from('NOT_GGUF_DATA'));
  });

  afterAll(() => {
    // Cleanup temporary files
    try {
      if (tempDir && fs.existsSync(tempDir)) {
        fs.rmSync(tempDir, { recursive: true, force: true });
      }
    } catch {
      // Ignore cleanup error
    }
  });

  it('registers baseline models by default with Not Installed status', () => {
    const models = manager.getRegisteredModels();
    expect(models.length).toBeGreaterThan(0);

    const baseline = models.find((m) => m.id === 'qwen3-4b-q4_k_m');
    expect(baseline).toBeDefined();
    expect(baseline?.name).toBe('Qwen3 4B');
    expect(baseline?.format).toBe('GGUF');
    expect(baseline?.quantization).toBe('Q4_K_M');
    expect(baseline?.status).toBe('Not Installed');
    expect(baseline?.path).toBeUndefined();
  });

  it('supports custom model registration and unregistration', () => {
    const customModel: ModelProfile = {
      id: 'custom-phi-model',
      name: 'Custom Phi Model',
      provider: 'Test',
      format: 'GGUF',
      quantization: 'Q8_0',
      fileName: 'custom-phi.gguf',
      expectedSize: 1500000000,
      contextLength: 2048,
      status: 'Not Installed'
    };

    manager.registerModel(customModel);
    expect(manager.getModelById('custom-phi-model')).toBeDefined();

    manager.unregisterModel('custom-phi-model');
    expect(manager.getModelById('custom-phi-model')).toBeUndefined();
  });

  it('validates a valid GGUF file path', async () => {
    const res = await manager.validateModelFile(validGgufPath);
    expect(res.isValid).toBe(true);
    expect(res.format).toBe('GGUF');
    expect(res.fileSizeBytes).toBeGreaterThanOrEqual(4);
    expect(res.error).toBeUndefined();
  });

  it('rejects an invalid non-GGUF file path', async () => {
    const res = await manager.validateModelFile(corruptFilePath);
    expect(res.isValid).toBe(false);
    expect(res.format).toBe('Invalid');
    expect(res.error).toContain('Magic header');
  });

  it('rejects a missing model file path', async () => {
    const missingPath = path.join(tempDir, 'does-not-exist.gguf');
    const res = await manager.validateModelFile(missingPath);
    expect(res.isValid).toBe(false);
    expect(res.error).toContain('does not exist');
  });

  it('scans model directory and discovers local GGUF models', async () => {
    await manager.setModelDirectory(tempDir);
    const discovered = await manager.scanModels();

    const validDiscovered = discovered.find((m) => m.fileName === 'test-model-q4_k_m.gguf');
    expect(validDiscovered).toBeDefined();
    expect(validDiscovered?.status).toBe('Installed');
    expect(validDiscovered?.path).toBe(validGgufPath);

    const corruptDiscovered = discovered.find((m) => m.fileName === 'corrupt-model.gguf');
    expect(corruptDiscovered).toBeDefined();
    expect(corruptDiscovered?.status).toBe('Error');
  });

  it('selects active model and updates status to Ready', async () => {
    await manager.setModelDirectory(tempDir);
    await manager.scanModels();

    const targetModel = manager.getRegisteredModels().find((m) => m.fileName === 'test-model-q4_k_m.gguf');
    expect(targetModel).toBeDefined();

    const success = await manager.selectActiveModel(targetModel!.id);
    expect(success).toBe(true);

    const active = manager.getActiveModel();
    expect(active?.id).toBe(targetModel!.id);
    expect(active?.status).toBe('Ready');
  });

  it('refuses to select a missing or uninstalled model', async () => {
    const baseline = manager.getModelById('qwen3-4b-q4_k_m');
    expect(baseline?.status).toBe('Not Installed');

    const success = await manager.selectActiveModel('qwen3-4b-q4_k_m');
    expect(success).toBe(false);
  });
});

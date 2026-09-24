import { ModelProfile, DiscoveredModelFile, ModelValidationResult } from './types';
import { INITIAL_REGISTERED_MODELS, BASELINE_MODEL } from './registry';
import { getSetting, setSetting } from '../database/db';

async function tryTauriInvoke<T>(command: string, args?: Record<string, unknown>): Promise<T | null> {
  try {
    if (typeof window !== 'undefined') {
      const internals = (window as any).__TAURI_INTERNALS__;
      if (internals && typeof internals.invoke === 'function') {
        return await internals.invoke(command, args);
      }
      const tauriCore = await import('@tauri-apps/api/core').catch(() => null);
      if (tauriCore && typeof tauriCore.invoke === 'function') {
        return await tauriCore.invoke(command, args);
      }
    }
  } catch {
    // Tauri not available
  }
  return null;
}

export class ModelManager {
  private registeredModels: Map<string, ModelProfile> = new Map();
  private defaultDirectory: string = './models';
  private activeModelId: string | null = null;

  constructor() {
    for (const m of INITIAL_REGISTERED_MODELS) {
      this.registeredModels.set(m.id, { ...m });
    }
  }

  public async initialize(): Promise<void> {
    const savedDir = getSetting('model_directory');
    if (savedDir) {
      this.defaultDirectory = savedDir;
    } else {
      setSetting('model_directory', this.defaultDirectory);
    }

    const savedModelId = getSetting('model_id');
    if (savedModelId && this.registeredModels.has(savedModelId)) {
      this.activeModelId = savedModelId;
    }

    await this.scanModels();
  }

  public getModelDirectory(): string {
    const saved = getSetting('model_directory');
    return saved || this.defaultDirectory;
  }

  public async setModelDirectory(dirPath: string): Promise<void> {
    const trimmed = dirPath.trim();
    if (!trimmed) throw new Error('Model directory cannot be empty');
    this.defaultDirectory = trimmed;
    setSetting('model_directory', trimmed);
    await this.scanModels();
  }

  public registerModel(profile: ModelProfile): void {
    this.registeredModels.set(profile.id, { ...profile });
  }

  public unregisterModel(modelId: string): void {
    if (modelId === BASELINE_MODEL.id) {
      // Baseline model can be reset to Not Installed, not completely purged
      const baseline = this.registeredModels.get(modelId);
      if (baseline) {
        baseline.status = 'Not Installed';
        baseline.path = undefined;
      }
      return;
    }
    this.registeredModels.delete(modelId);
    if (this.activeModelId === modelId) {
      this.activeModelId = null;
      setSetting('model_id', '');
      setSetting('model_path', '');
    }
  }

  public getRegisteredModels(): ModelProfile[] {
    return Array.from(this.registeredModels.values());
  }

  public getModelById(id: string): ModelProfile | undefined {
    return this.registeredModels.get(id);
  }

  public getActiveModel(): ModelProfile | null {
    if (!this.activeModelId) {
      const savedId = getSetting('model_id');
      if (savedId && this.registeredModels.has(savedId)) {
        this.activeModelId = savedId;
      }
    }
    return this.activeModelId ? this.registeredModels.get(this.activeModelId) || null : null;
  }

  public async validateModelFile(filePath: string): Promise<ModelValidationResult> {
    if (!filePath || !filePath.trim()) {
      return { isValid: false, fileSizeBytes: 0, format: 'Unknown', error: 'No path provided' };
    }

    // Try Tauri backend validator first
    const tauriRes = await tryTauriInvoke<ModelValidationResult>('validate_model_file', { filePath });
    if (tauriRes) {
      return tauriRes;
    }

    // Node.js fallback (for vitest/scripts)
    if (typeof process !== 'undefined' && process.versions && process.versions.node) {
      try {
        const fs = await import('fs');
        if (!fs.existsSync(filePath)) {
          return { isValid: false, fileSizeBytes: 0, format: 'Unknown', error: 'File does not exist' };
        }
        const stat = fs.statSync(filePath);
        if (!stat.isFile()) {
          return { isValid: false, fileSizeBytes: 0, format: 'Unknown', error: 'Path is not a file' };
        }
        if (stat.size < 4) {
          return { isValid: false, fileSizeBytes: stat.size, format: 'Unknown', error: 'File too small' };
        }

        const fd = fs.openSync(filePath, 'r');
        const buffer = Buffer.alloc(4);
        fs.readSync(fd, buffer, 0, 4, 0);
        fs.closeSync(fd);

        if (buffer.toString('ascii') === 'GGUF') {
          return { isValid: true, fileSizeBytes: stat.size, format: 'GGUF' };
        } else {
          return {
            isValid: false,
            fileSizeBytes: stat.size,
            format: 'Invalid',
            error: 'Magic header does not match GGUF'
          };
        }
      } catch (err: any) {
        return { isValid: false, fileSizeBytes: 0, format: 'Unknown', error: err.message };
      }
    }

    // Mock or web preview fallback
    return { isValid: false, fileSizeBytes: 0, format: 'Unknown', error: 'Validation not supported in web browser mode' };
  }

  public async scanModels(): Promise<ModelProfile[]> {
    const dir = this.getModelDirectory();
    let discoveredFiles: DiscoveredModelFile[] = [];

    // 1. Scan directory via Tauri if available
    const tauriDiscovered = await tryTauriInvoke<DiscoveredModelFile[]>('scan_model_directory', { directoryPath: dir });
    if (tauriDiscovered) {
      discoveredFiles = tauriDiscovered;
    } else if (typeof process !== 'undefined' && process.versions && process.versions.node) {
      // Node.js environment fallback
      try {
        const fs = await import('fs');
        const path = await import('path');
        const resolved = path.resolve(process.cwd(), dir);
        if (fs.existsSync(resolved) && fs.statSync(resolved).isDirectory()) {
          const files = fs.readdirSync(resolved);
          for (const f of files) {
            if (f.toLowerCase().endsWith('.gguf')) {
              const fullPath = path.join(resolved, f);
              const stat = fs.statSync(fullPath);
              let isValidGguf = false;
              if (stat.size >= 4) {
                const fd = fs.openSync(fullPath, 'r');
                const buf = Buffer.alloc(4);
                fs.readSync(fd, buf, 0, 4, 0);
                fs.closeSync(fd);
                isValidGguf = buf.toString('ascii') === 'GGUF';
              }
              discoveredFiles.push({
                fileName: f,
                path: fullPath,
                sizeBytes: stat.size,
                isValidGguf,
                lastModified: stat.mtime.toISOString()
              });
            }
          }
        }
      } catch {
        // Directory does not exist or unreadable
      }
    }

    // 2. Update statuses of registered models
    const activeId = getSetting('model_id');
    for (const [id, model] of this.registeredModels.entries()) {
      const match = discoveredFiles.find(
        (d) => d.fileName.toLowerCase() === model.fileName.toLowerCase()
      );

      if (match) {
        if (match.isValidGguf && match.sizeBytes > 0) {
          model.path = match.path;
          model.status = (activeId === id) ? 'Ready' : 'Installed';
        } else {
          model.path = match.path;
          model.status = 'Error';
        }
      } else {
        model.path = undefined;
        model.status = 'Not Installed';
      }
    }

    // 3. Register any extra detected GGUF files that aren't yet in the registry
    for (const file of discoveredFiles) {
      const alreadyRegistered = Array.from(this.registeredModels.values()).some(
        (m) => m.fileName.toLowerCase() === file.fileName.toLowerCase()
      );

      if (!alreadyRegistered) {
        const customId = 'custom_' + file.fileName.replace(/\.gguf$/i, '').toLowerCase().replace(/[^a-z0-9_-]/g, '_');
        this.registeredModels.set(customId, {
          id: customId,
          name: file.fileName.replace(/\.gguf$/i, ''),
          provider: 'Local File',
          format: 'GGUF',
          quantization: 'Detected',
          fileName: file.fileName,
          expectedSize: file.sizeBytes,
          contextLength: 4096,
          status: file.isValidGguf ? (activeId === customId ? 'Ready' : 'Installed') : 'Error',
          path: file.path,
          description: `Locally discovered GGUF model in ${dir}`
        });
      }
    }

    // 4. Validate active model if one was selected
    const active = this.getActiveModel();
    if (active) {
      if (active.status === 'Installed' || active.status === 'Ready') {
        active.status = 'Ready';
      } else {
        // If active model is no longer installed or has error, clear active
        this.activeModelId = null;
        setSetting('model_id', '');
        setSetting('model_path', '');
      }
    }

    return this.getRegisteredModels();
  }

  public async selectActiveModel(modelId: string): Promise<boolean> {
    const model = this.registeredModels.get(modelId);
    if (!model) {
      return false;
    }

    if (!model.path) {
      return false;
    }

    const validation = await this.validateModelFile(model.path);
    if (!validation.isValid) {
      model.status = 'Error';
      return false;
    }

    // Model exists and is valid GGUF
    this.activeModelId = model.id;
    model.status = 'Ready';

    // Update other models to Installed if they were Ready
    for (const [id, m] of this.registeredModels.entries()) {
      if (id !== modelId && m.status === 'Ready') {
        m.status = 'Installed';
      }
    }

    // Persist in settings
    setSetting('model_id', model.id);
    setSetting('model_path', model.path);
    setSetting('model_name', model.name);

    return true;
  }
}

export const modelManager = new ModelManager();

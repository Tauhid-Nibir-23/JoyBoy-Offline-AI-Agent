export interface SyncSource {
  id: string;
  name: string;
  category: 'Programming' | 'Study' | 'Linux' | 'Custom';
  url: string;
  enabled: boolean;
  lastSync?: string;
}

export class SyncEngine {
  private isSyncing: boolean = false;

  public async syncSources(sources: SyncSource[]): Promise<{ updated: number; failed: number }> {
    console.log('[Sync Engine Stub] Allowlist-based sync called for', sources.length, 'sources');
    return { updated: 0, failed: 0 };
  }
}

export const syncEngine = new SyncEngine();

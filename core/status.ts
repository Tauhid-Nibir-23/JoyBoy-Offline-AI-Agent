// Global Application Status Store (Phase 4 Section 6)
import { useState, useEffect } from 'react';

export type AIStatus = 'Ready' | 'Loading' | 'Generating' | 'Error';
export type DBStatus = 'Ready' | 'Connecting' | 'Error';
export type RAGStatus = 'Ready' | 'Indexing' | 'Error';
export type ModelStatus = 'Loaded' | 'Not Loaded';

export interface AppGlobalStatus {
  ai: AIStatus;
  aiMessage?: string;
  db: DBStatus;
  dbMessage?: string;
  rag: RAGStatus;
  ragMessage?: string;
  model: ModelStatus;
  modelName?: string;
}

type StatusListener = (status: AppGlobalStatus) => void;

class GlobalStatusManager {
  private currentStatus: AppGlobalStatus = {
    ai: 'Ready',
    db: 'Ready',
    rag: 'Ready',
    model: 'Not Loaded'
  };

  private listeners: Set<StatusListener> = new Set();

  public getStatus(): AppGlobalStatus {
    return { ...this.currentStatus };
  }

  public update(partial: Partial<AppGlobalStatus>): void {
    this.currentStatus = { ...this.currentStatus, ...partial };
    this.notify();
  }

  public setAIStatus(status: AIStatus, message?: string): void {
    this.update({ ai: status, aiMessage: message });
  }

  public setDBStatus(status: DBStatus, message?: string): void {
    this.update({ db: status, dbMessage: message });
  }

  public setRAGStatus(status: RAGStatus, message?: string): void {
    this.update({ rag: status, ragMessage: message });
  }

  public setModelStatus(status: ModelStatus, modelName?: string): void {
    this.update({ model: status, modelName });
  }

  public subscribe(listener: StatusListener): () => void {
    this.listeners.add(listener);
    listener(this.getStatus());
    return () => {
      this.listeners.delete(listener);
    };
  }

  private notify(): void {
    const snapshot = this.getStatus();
    for (const listener of this.listeners) {
      try {
        listener(snapshot);
      } catch (err) {
        console.error('Status listener error:', err);
      }
    }
  }
}

export const globalStatus = new GlobalStatusManager();

export function useGlobalStatus(): AppGlobalStatus {
  const [status, setStatus] = useState<AppGlobalStatus>(globalStatus.getStatus());

  useEffect(() => {
    return globalStatus.subscribe((newStatus) => {
      setStatus(newStatus);
    });
  }, []);

  return status;
}

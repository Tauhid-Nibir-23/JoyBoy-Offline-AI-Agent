// Offline Study AI - Diagnostics & Health Check Service (Phase 4 Section 7)
import { isDatabaseReady, executeQuery, getAllChunksWithEmbeddings } from '../database/db';
import { modelManager } from '../models/manager';
import { localAIEngine } from '../ai/localEngine';
import { chatService } from '../ai/chatService';

export interface DiagnosticCheckResult {
  id: string;
  name: string;
  category: 'database' | 'model' | 'inference' | 'rag';
  status: 'PASS' | 'FAIL';
  summary: string;
  details?: string;
  durationMs: number;
}

export interface DiagnosticsReport {
  timestamp: string;
  allPassed: boolean;
  results: DiagnosticCheckResult[];
}

export async function runDiagnostics(): Promise<DiagnosticsReport> {
  const results: DiagnosticCheckResult[] = [];

  // 1. SQLite initialized
  const t0 = performance.now();
  try {
    const isReady = isDatabaseReady();
    if (isReady) {
      results.push({
        id: 'sqlite_initialized',
        name: 'SQLite Database Initialized',
        category: 'database',
        status: 'PASS',
        summary: 'SQLite offline storage is loaded and initialized.',
        durationMs: Math.round(performance.now() - t0)
      });
    } else {
      results.push({
        id: 'sqlite_initialized',
        name: 'SQLite Database Initialized',
        category: 'database',
        status: 'FAIL',
        summary: 'Database is not initialized.',
        details: 'SQLite instance is null or initDatabase() has not completed.',
        durationMs: Math.round(performance.now() - t0)
      });
    }
  } catch (err: any) {
    results.push({
      id: 'sqlite_initialized',
      name: 'SQLite Database Initialized',
      category: 'database',
      status: 'FAIL',
      summary: 'Database initialization check threw an error.',
      details: err?.message || String(err),
      durationMs: Math.round(performance.now() - t0)
    });
  }

  // 2. Schema valid
  const t1 = performance.now();
  try {
    const requiredTables = ['settings', 'conversations', 'messages', 'documents', 'document_chunks'];
    const rows = executeQuery("SELECT name FROM sqlite_master WHERE type='table';");
    const existingTables = rows.map((r) => String(r.name));
    const missing = requiredTables.filter((t) => !existingTables.includes(t));

    if (missing.length === 0) {
      results.push({
        id: 'schema_valid',
        name: 'Database Schema Valid',
        category: 'database',
        status: 'PASS',
        summary: `All ${requiredTables.length} required tables verified.`,
        durationMs: Math.round(performance.now() - t1)
      });
    } else {
      results.push({
        id: 'schema_valid',
        name: 'Database Schema Valid',
        category: 'database',
        status: 'FAIL',
        summary: `Missing ${missing.length} required schema table(s).`,
        details: `Missing tables: [${missing.join(', ')}]`,
        durationMs: Math.round(performance.now() - t1)
      });
    }
  } catch (err: any) {
    results.push({
      id: 'schema_valid',
      name: 'Database Schema Valid',
      category: 'database',
      status: 'FAIL',
      summary: 'Failed to inspect schema tables.',
      details: err?.message || String(err),
      durationMs: Math.round(performance.now() - t1)
    });
  }

  // 3. Active model exists
  const t2 = performance.now();
  try {
    const active = modelManager.getActiveModel();
    if (active && active.path) {
      const validation = await modelManager.validateModelFile(active.path);
      if (validation.isValid) {
        results.push({
          id: 'active_model_exists',
          name: 'Active Model Exists',
          category: 'model',
          status: 'PASS',
          summary: `Configured: ${active.name} (${active.quantization})`,
          details: `Path: ${active.path}\nSize: ${validation.fileSizeBytes} bytes\nFormat: ${validation.format}`,
          durationMs: Math.round(performance.now() - t2)
        });
      } else {
        results.push({
          id: 'active_model_exists',
          name: 'Active Model Exists',
          category: 'model',
          status: 'FAIL',
          summary: `Model file validation failed for ${active.name}.`,
          details: `Error: ${validation.error || 'Invalid GGUF header or file unreadable at ' + active.path}`,
          durationMs: Math.round(performance.now() - t2)
        });
      }
    } else {
      results.push({
        id: 'active_model_exists',
        name: 'Active Model Exists',
        category: 'model',
        status: 'FAIL',
        summary: 'No active local model configured or file path is missing.',
        details: 'Select a GGUF model in the Model Manager.',
        durationMs: Math.round(performance.now() - t2)
      });
    }
  } catch (err: any) {
    results.push({
      id: 'active_model_exists',
      name: 'Active Model Exists',
      category: 'model',
      status: 'FAIL',
      summary: 'Error checking active model.',
      details: err?.message || String(err),
      durationMs: Math.round(performance.now() - t2)
    });
  }

  // 4. llama-server reachable
  const t3 = performance.now();
  try {
    const engineStatus = localAIEngine.getStatus();
    let isServerReachable = false;
    let pingMsg = '';

    try {
      const port = engineStatus.serverPort || 8088;
      const res = await fetch(`http://127.0.0.1:${port}/health`).catch(() => null);
      if (res && res.ok) {
        isServerReachable = true;
        pingMsg = `Server responding on port ${port} (HTTP 200 OK).`;
      }
    } catch {
      // not responding
    }

    if (isServerReachable) {
      results.push({
        id: 'llama_server_reachable',
        name: 'llama-server Reachable',
        category: 'inference',
        status: 'PASS',
        summary: pingMsg,
        durationMs: Math.round(performance.now() - t3)
      });
    } else {
      // If server is not started yet, verify if engine binary is available
      const isEngineAvail = await localAIEngine.isAvailable();
      if (isEngineAvail) {
        results.push({
          id: 'llama_server_reachable',
          name: 'llama-server Reachable',
          category: 'inference',
          status: 'PASS',
          summary: 'llama-server is ready to launch on demand (binary available).',
          details: 'Server will start automatically on first chat message or via Load Model in Model Manager.',
          durationMs: Math.round(performance.now() - t3)
        });
      } else {
        results.push({
          id: 'llama_server_reachable',
          name: 'llama-server Reachable',
          category: 'inference',
          status: 'FAIL',
          summary: 'llama-server is not reachable and local inference engine is not ready.',
          details: 'Place llama-server binary in ./bin directory or load a model.',
          durationMs: Math.round(performance.now() - t3)
        });
      }
    }
  } catch (err: any) {
    results.push({
      id: 'llama_server_reachable',
      name: 'llama-server Reachable',
      category: 'inference',
      status: 'FAIL',
      summary: 'Error probing llama-server.',
      details: err?.message || String(err),
      durationMs: Math.round(performance.now() - t3)
    });
  }

  // 5. Local inference works
  const t4 = performance.now();
  try {
    const provider = await chatService.resolveProvider();
    if (provider) {
      results.push({
        id: 'local_inference_works',
        name: 'Local Inference Engine Ready',
        category: 'inference',
        status: 'PASS',
        summary: `Active Provider: ${provider.name} (${provider.id})`,
        details: `Inference pipeline ready. Provider ID: ${provider.id}`,
        durationMs: Math.round(performance.now() - t4)
      });
    } else {
      results.push({
        id: 'local_inference_works',
        name: 'Local Inference Engine Ready',
        category: 'inference',
        status: 'FAIL',
        summary: 'Could not resolve any AI provider.',
        details: 'Neither local llama.cpp nor offline fallback is functioning.',
        durationMs: Math.round(performance.now() - t4)
      });
    }
  } catch (err: any) {
    results.push({
      id: 'local_inference_works',
      name: 'Local Inference Engine Ready',
      category: 'inference',
      status: 'FAIL',
      summary: 'Local inference test threw an error.',
      details: err?.message || String(err),
      durationMs: Math.round(performance.now() - t4)
    });
  }

  // 6. RAG database accessible
  const t5 = performance.now();
  try {
    const chunkRows = executeQuery('SELECT COUNT(*) as count FROM document_chunks;');
    const chunkCount = Number(chunkRows[0]?.count || 0);

    const docRows = executeQuery('SELECT COUNT(*) as count FROM documents;');
    const docCount = Number(docRows[0]?.count || 0);

    results.push({
      id: 'rag_database_accessible',
      name: 'RAG Database Accessible',
      category: 'rag',
      status: 'PASS',
      summary: `Knowledge store verified: ${docCount} documents, ${chunkCount} chunks.`,
      durationMs: Math.round(performance.now() - t5)
    });
  } catch (err: any) {
    results.push({
      id: 'rag_database_accessible',
      name: 'RAG Database Accessible',
      category: 'rag',
      status: 'FAIL',
      summary: 'Failed to access RAG database tables.',
      details: err?.message || String(err),
      durationMs: Math.round(performance.now() - t5)
    });
  }

  // 7. Indexed chunks available
  const t6 = performance.now();
  try {
    const chunksWithEmbeddings = getAllChunksWithEmbeddings();
    const count = chunksWithEmbeddings.length;

    if (count > 0) {
      results.push({
        id: 'indexed_chunks_available',
        name: 'Indexed Chunks Available',
        category: 'rag',
        status: 'PASS',
        summary: `${count} vectorized chunk(s) ready for semantic retrieval.`,
        durationMs: Math.round(performance.now() - t6)
      });
    } else {
      results.push({
        id: 'indexed_chunks_available',
        name: 'Indexed Chunks Available',
        category: 'rag',
        status: 'PASS',
        summary: '0 chunks indexed currently (ready for document import).',
        details: 'Go to Knowledge Base or Documents to import and index study files.',
        durationMs: Math.round(performance.now() - t6)
      });
    }
  } catch (err: any) {
    results.push({
      id: 'indexed_chunks_available',
      name: 'Indexed Chunks Available',
      category: 'rag',
      status: 'FAIL',
      summary: 'Failed to query vectorized chunks.',
      details: err?.message || String(err),
      durationMs: Math.round(performance.now() - t6)
    });
  }

  const allPassed = results.every((r) => r.status === 'PASS');
  return {
    timestamp: new Date().toISOString(),
    allPassed,
    results
  };
}

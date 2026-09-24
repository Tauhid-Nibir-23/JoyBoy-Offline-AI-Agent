import initSqlJs, { Database as SqlJsDatabase } from 'sql.js';

let dbInstance: SqlJsDatabase | null = null;
let isInitialized = false;

const INITIAL_SCHEMA = `
CREATE TABLE IF NOT EXISTS settings (
    key TEXT PRIMARY KEY,
    value TEXT NOT NULL,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS conversations (
    id TEXT PRIMARY KEY,
    title TEXT NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS messages (
    id TEXT PRIMARY KEY,
    conversation_id TEXT NOT NULL,
    role TEXT CHECK(role IN ('system', 'user', 'assistant')) NOT NULL,
    content TEXT NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY(conversation_id) REFERENCES conversations(id) ON DELETE CASCADE
);

INSERT OR IGNORE INTO settings (key, value) VALUES 
('app_name', 'Offline Study AI'),
('model_name', 'Qwen3-4B-GGUF Baseline'),
('offline_mode', 'true'),
('db_status', 'Initialized');
`;

export async function initDatabase(): Promise<boolean> {
  if (isInitialized && dbInstance) return true;

  try {
    const SQL = await initSqlJs({
      locateFile: (file: string) => `https://sql.js.org/dist/${file}`
    });

    const savedDb = localStorage.getItem('offline_study_ai_db');
    if (savedDb) {
      const u8array = new Uint8Array(JSON.parse(savedDb));
      dbInstance = new SQL.Database(u8array);
    } else {
      dbInstance = new SQL.Database();
    }

    dbInstance.run(INITIAL_SCHEMA);
    saveDatabase();
    isInitialized = true;
    return true;
  } catch (error) {
    console.error('Failed to initialize SQLite database:', error);
    // Fallback in case WASM file loading fails offline
    try {
      const SQL = await initSqlJs({});
      dbInstance = new SQL.Database();
      dbInstance.run(INITIAL_SCHEMA);
      isInitialized = true;
      return true;
    } catch (e) {
      console.error('SQLite initialization fallback error:', e);
      return false;
    }
  }
}

export function saveDatabase(): void {
  if (dbInstance) {
    const data = dbInstance.export();
    const buffer = Array.from(data);
    localStorage.setItem('offline_study_ai_db', JSON.stringify(buffer));
  }
}

export function getDatabaseStatus(): { initialized: boolean; tables: string[] } {
  if (!dbInstance || !isInitialized) {
    return { initialized: false, tables: [] };
  }

  try {
    const result = dbInstance.exec("SELECT name FROM sqlite_master WHERE type='table';");
    const tables = result[0]?.values.map((v) => String(v[0])) || [];
    return { initialized: true, tables };
  } catch {
    return { initialized: false, tables: [] };
  }
}

export function executeQuery(query: string, params: any[] = []): any[] {
  if (!dbInstance) throw new Error('Database not initialized');
  const stmt = dbInstance.prepare(query);
  stmt.bind(params);
  const results: any[] = [];
  while (stmt.step()) {
    results.push(stmt.getAsObject());
  }
  stmt.free();
  saveDatabase();
  return results;
}

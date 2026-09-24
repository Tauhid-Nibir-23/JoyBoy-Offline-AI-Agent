import initSqlJs, { Database as SqlJsDatabase } from 'sql.js';

let dbInstance: SqlJsDatabase | null = null;
let isInitialized = false;

export interface DBConversation {
  id: string;
  title: string;
  created_at: string;
  updated_at: string;
}

export interface DBMessage {
  id: string;
  conversation_id: string;
  role: 'system' | 'user' | 'assistant';
  content: string;
  created_at: string;
}

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
    const isNodeEnv = typeof window === 'undefined';
    let locateFn: ((file: string) => string) | undefined;

    if (isNodeEnv) {
      try {
        const pathModule = await import('path');
        const fsModule = await import('fs');
        locateFn = (file: string) => {
          const localWasm = pathModule.resolve(process.cwd(), 'node_modules/sql.js/dist', file);
          if (fsModule.existsSync(localWasm)) {
            return localWasm;
          }
          return file;
        };
      } catch {
        locateFn = (file: string) => file;
      }
    } else {
      locateFn = (file: string) => `https://sql.js.org/dist/${file}`;
    }

    const SQL = await initSqlJs({
      locateFile: locateFn
    });

    if (typeof localStorage !== 'undefined') {
      const savedDb = localStorage.getItem('offline_study_ai_db');
      if (savedDb) {
        const u8array = new Uint8Array(JSON.parse(savedDb));
        dbInstance = new SQL.Database(u8array);
      } else {
        dbInstance = new SQL.Database();
      }
    } else {
      dbInstance = new SQL.Database();
    }

    dbInstance.run(INITIAL_SCHEMA);
    saveDatabase();
    isInitialized = true;
    return true;
  } catch (error) {
    console.warn('Network locateFile failed for sql.js, attempting offline WASM initialization:', error);
    try {
      const SQL = await initSqlJs({});
      dbInstance = new SQL.Database();
      dbInstance.run(INITIAL_SCHEMA);
      saveDatabase();
      isInitialized = true;
      return true;
    } catch (e) {
      console.error('SQLite initialization failed completely:', e);
      return false;
    }
  }
}

export function saveDatabase(): void {
  if (dbInstance && typeof localStorage !== 'undefined') {
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

// Conversation Queries
export function getAllConversations(): DBConversation[] {
  if (!dbInstance) return [];
  const rows = executeQuery('SELECT * FROM conversations ORDER BY updated_at DESC');
  return rows.map((r) => ({
    id: String(r.id),
    title: String(r.title),
    created_at: String(r.created_at),
    updated_at: String(r.updated_at)
  }));
}

export function createConversationInDB(id: string, title: string): DBConversation {
  const now = new Date().toISOString();
  executeQuery(
    'INSERT INTO conversations (id, title, created_at, updated_at) VALUES (?, ?, ?, ?)',
    [id, title, now, now]
  );
  return { id, title, created_at: now, updated_at: now };
}

export function updateConversationTitleInDB(id: string, title: string): void {
  const now = new Date().toISOString();
  executeQuery(
    'UPDATE conversations SET title = ?, updated_at = ? WHERE id = ?',
    [title, now, id]
  );
}

export function deleteConversationFromDB(id: string): void {
  executeQuery('DELETE FROM messages WHERE conversation_id = ?', [id]);
  executeQuery('DELETE FROM conversations WHERE id = ?', [id]);
}

// Message Queries
export function getMessagesByConversationId(conversationId: string): DBMessage[] {
  if (!dbInstance) return [];
  const rows = executeQuery(
    'SELECT * FROM messages WHERE conversation_id = ? ORDER BY created_at ASC',
    [conversationId]
  );
  return rows.map((r) => ({
    id: String(r.id),
    conversation_id: String(r.conversation_id),
    role: r.role as 'system' | 'user' | 'assistant',
    content: String(r.content),
    created_at: String(r.created_at)
  }));
}

export function insertMessageInDB(msg: DBMessage): DBMessage {
  executeQuery(
    'INSERT INTO messages (id, conversation_id, role, content, created_at) VALUES (?, ?, ?, ?, ?)',
    [msg.id, msg.conversation_id, msg.role, msg.content, msg.created_at]
  );
  // Touch conversation updated_at
  executeQuery('UPDATE conversations SET updated_at = ? WHERE id = ?', [msg.created_at, msg.conversation_id]);
  return msg;
}

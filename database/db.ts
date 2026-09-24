import initSqlJs, { Database as SqlJsDatabase } from 'sql.js';

let dbInstance: SqlJsDatabase | null = null;
let isInitialized = false;
let initPromise: Promise<boolean> | null = null;
let lastInitError: string | null = null;

export function isDatabaseReady(): boolean {
  return isInitialized && dbInstance !== null;
}

export function resetDatabaseStateForTesting(): void {
  dbInstance = null;
  isInitialized = false;
  initPromise = null;
  lastInitError = null;
}

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

export interface DBDocument {
  id: string;
  filename: string;
  original_path: string | null;
  file_type: string;
  file_size: number;
  file_hash: string;
  imported_at: string;
  modified_at: string | null;
  extraction_status: 'Imported' | 'Processing' | 'Ready' | 'Failed';
  extracted_text: string | null;
  character_count: number;
  error_message: string | null;
}

export interface DBDocumentChunk {
  id: string;
  document_id: string;
  chunk_index: number;
  text: string;
  start_offset: number;
  end_offset: number;
  character_count: number;
  token_estimate: number;
  heading: string | null;
  page_number: number | null;
  metadata_json: string | null;
  created_at?: string;
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

CREATE TABLE IF NOT EXISTS documents (
    id TEXT PRIMARY KEY,
    filename TEXT NOT NULL,
    original_path TEXT,
    file_type TEXT NOT NULL,
    file_size INTEGER NOT NULL,
    file_hash TEXT NOT NULL UNIQUE,
    imported_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    modified_at TIMESTAMP,
    extraction_status TEXT CHECK(extraction_status IN ('Imported', 'Processing', 'Ready', 'Failed')) NOT NULL DEFAULT 'Imported',
    extracted_text TEXT,
    character_count INTEGER DEFAULT 0,
    error_message TEXT
);

CREATE TABLE IF NOT EXISTS document_chunks (
    id TEXT PRIMARY KEY,
    document_id TEXT NOT NULL,
    chunk_index INTEGER NOT NULL,
    text TEXT NOT NULL,
    start_offset INTEGER NOT NULL,
    end_offset INTEGER NOT NULL,
    character_count INTEGER NOT NULL,
    token_estimate INTEGER NOT NULL,
    heading TEXT,
    page_number INTEGER,
    metadata_json TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY(document_id) REFERENCES documents(id) ON DELETE CASCADE,
    UNIQUE(document_id, chunk_index)
);

CREATE INDEX IF NOT EXISTS idx_chunks_document_id ON document_chunks(document_id);
CREATE INDEX IF NOT EXISTS idx_chunks_doc_chunk_idx ON document_chunks(document_id, chunk_index);

INSERT OR IGNORE INTO settings (key, value) VALUES 
('app_name', 'Offline Study AI'),
('model_name', 'Qwen3-4B-GGUF Baseline'),
('offline_mode', 'true'),
('db_status', 'Initialized');
`;

export async function initDatabase(): Promise<boolean> {
  if (isInitialized && dbInstance) return true;
  if (initPromise) return initPromise;

  initPromise = (async () => {
    try {
      lastInitError = null;
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
        // Pure local offline WASM loading from local origin assets (public/ folder)
        const meta = import.meta as any;
        const base = (typeof meta !== 'undefined' && meta.env?.BASE_URL) ? meta.env.BASE_URL : '/';
        const cleanBase = base.endsWith('/') ? base : `${base}/`;
        locateFn = (file: string) => `${cleanBase}${file}`;
      }

      const SQL = await initSqlJs({
        locateFile: locateFn
      });

      let loadedExisting = false;
      if (typeof localStorage !== 'undefined') {
        try {
          const savedDb = localStorage.getItem('offline_study_ai_db');
          if (savedDb) {
            const u8array = new Uint8Array(JSON.parse(savedDb));
            dbInstance = new SQL.Database(u8array);
            loadedExisting = true;
          }
        } catch (storageReadErr) {
          console.warn('Could not read existing database from localStorage:', storageReadErr);
        }
      }

      if (!loadedExisting || !dbInstance) {
        dbInstance = new SQL.Database();
      }

      if (!dbInstance) {
        throw new Error('Failed to allocate SQLite database instance');
      }

      // Execute schema to ensure all tables exist
      dbInstance.run(INITIAL_SCHEMA);

      // Verify schema: ensure required tables exist
      const checkResult = dbInstance.exec("SELECT name FROM sqlite_master WHERE type='table';");
      const tables = checkResult[0]?.values.map((v) => String(v[0])) || [];
      const requiredTables = ['settings', 'conversations', 'messages', 'documents', 'document_chunks'];
      const missing = requiredTables.filter((t) => !tables.includes(t));
      if (missing.length > 0) {
        throw new Error(`Schema verification failed: missing tables [${missing.join(', ')}]`);
      }

      saveDatabase();
      isInitialized = true;
      return true;
    } catch (error: any) {
      const msg = error?.message || String(error);
      lastInitError = msg;
      console.error('SQLite initialization failed:', error);
      isInitialized = false;
      dbInstance = null;
      return false;
    } finally {
      initPromise = null;
    }
  })();

  return initPromise;
}

export function saveDatabase(): void {
  if (dbInstance && typeof localStorage !== 'undefined') {
    try {
      const data = dbInstance.export();
      const buffer = Array.from(data);
      localStorage.setItem('offline_study_ai_db', JSON.stringify(buffer));
    } catch (storageWriteErr) {
      console.warn('Could not persist database to localStorage:', storageWriteErr);
    }
  }
}

export function getDatabaseStatus(): { initialized: boolean; tables: string[]; error: string | null } {
  if (!dbInstance || !isInitialized) {
    return { initialized: false, tables: [], error: lastInitError || 'Database not initialized' };
  }

  try {
    const result = dbInstance.exec("SELECT name FROM sqlite_master WHERE type='table';");
    const tables = result[0]?.values.map((v) => String(v[0])) || [];
    return { initialized: true, tables, error: null };
  } catch (err: any) {
    return { initialized: false, tables: [], error: err?.message || 'Database error' };
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

// Settings Queries
export function getSetting(key: string): string | null {
  if (!dbInstance) return null;
  const rows = executeQuery('SELECT value FROM settings WHERE key = ?', [key]);
  if (rows.length > 0 && rows[0].value !== undefined) {
    return String(rows[0].value);
  }
  return null;
}

export function setSetting(key: string, value: string): void {
  if (!dbInstance) return;
  executeQuery(
    'INSERT INTO settings (key, value, updated_at) VALUES (?, ?, CURRENT_TIMESTAMP) ' +
    'ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = CURRENT_TIMESTAMP',
    [key, value]
  );
}

export function getAllSettings(): Record<string, string> {
  if (!dbInstance) return {};
  const rows = executeQuery('SELECT key, value FROM settings');
  const result: Record<string, string> = {};
  for (const row of rows) {
    if (row.key) {
      result[String(row.key)] = String(row.value);
    }
  }
  return result;
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

// Document Queries
export function getAllDocuments(): DBDocument[] {
  if (!dbInstance) return [];
  const rows = executeQuery('SELECT * FROM documents ORDER BY imported_at DESC');
  return rows.map((r) => ({
    id: String(r.id),
    filename: String(r.filename),
    original_path: r.original_path ? String(r.original_path) : null,
    file_type: String(r.file_type),
    file_size: Number(r.file_size || 0),
    file_hash: String(r.file_hash),
    imported_at: String(r.imported_at),
    modified_at: r.modified_at ? String(r.modified_at) : null,
    extraction_status: r.extraction_status as DBDocument['extraction_status'],
    extracted_text: r.extracted_text !== null && r.extracted_text !== undefined ? String(r.extracted_text) : null,
    character_count: Number(r.character_count || 0),
    error_message: r.error_message ? String(r.error_message) : null
  }));
}

export function getDocumentById(id: string): DBDocument | null {
  if (!dbInstance) return null;
  const rows = executeQuery('SELECT * FROM documents WHERE id = ?', [id]);
  if (rows.length === 0) return null;
  const r = rows[0];
  return {
    id: String(r.id),
    filename: String(r.filename),
    original_path: r.original_path ? String(r.original_path) : null,
    file_type: String(r.file_type),
    file_size: Number(r.file_size || 0),
    file_hash: String(r.file_hash),
    imported_at: String(r.imported_at),
    modified_at: r.modified_at ? String(r.modified_at) : null,
    extraction_status: r.extraction_status as DBDocument['extraction_status'],
    extracted_text: r.extracted_text !== null && r.extracted_text !== undefined ? String(r.extracted_text) : null,
    character_count: Number(r.character_count || 0),
    error_message: r.error_message ? String(r.error_message) : null
  };
}

export function getDocumentByHash(fileHash: string): DBDocument | null {
  if (!dbInstance) return null;
  const rows = executeQuery('SELECT * FROM documents WHERE file_hash = ?', [fileHash]);
  if (rows.length === 0) return null;
  const r = rows[0];
  return {
    id: String(r.id),
    filename: String(r.filename),
    original_path: r.original_path ? String(r.original_path) : null,
    file_type: String(r.file_type),
    file_size: Number(r.file_size || 0),
    file_hash: String(r.file_hash),
    imported_at: String(r.imported_at),
    modified_at: r.modified_at ? String(r.modified_at) : null,
    extraction_status: r.extraction_status as DBDocument['extraction_status'],
    extracted_text: r.extracted_text !== null && r.extracted_text !== undefined ? String(r.extracted_text) : null,
    character_count: Number(r.character_count || 0),
    error_message: r.error_message ? String(r.error_message) : null
  };
}

export function insertDocumentInDB(doc: DBDocument): DBDocument {
  executeQuery(
    `INSERT INTO documents (
      id, filename, original_path, file_type, file_size, file_hash,
      imported_at, modified_at, extraction_status, extracted_text,
      character_count, error_message
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      doc.id,
      doc.filename,
      doc.original_path,
      doc.file_type,
      doc.file_size,
      doc.file_hash,
      doc.imported_at,
      doc.modified_at,
      doc.extraction_status,
      doc.extracted_text,
      doc.character_count,
      doc.error_message
    ]
  );
  return doc;
}

export function updateDocumentInDB(id: string, updates: Partial<DBDocument>): void {
  const fields: string[] = [];
  const values: any[] = [];

  for (const [key, val] of Object.entries(updates)) {
    if (key === 'id') continue;
    fields.push(`${key} = ?`);
    values.push(val);
  }

  if (fields.length === 0) return;

  values.push(id);
  executeQuery(`UPDATE documents SET ${fields.join(', ')} WHERE id = ?`, values);
}

export function deleteDocumentFromDB(id: string): void {
  executeQuery('DELETE FROM document_chunks WHERE document_id = ?', [id]);
  executeQuery('DELETE FROM documents WHERE id = ?', [id]);
}

// Document Chunk Queries
export function getChunksByDocumentId(documentId: string): DBDocumentChunk[] {
  if (!dbInstance) return [];
  const rows = executeQuery(
    'SELECT * FROM document_chunks WHERE document_id = ? ORDER BY chunk_index ASC',
    [documentId]
  );
  return rows.map((r) => ({
    id: String(r.id),
    document_id: String(r.document_id),
    chunk_index: Number(r.chunk_index),
    text: String(r.text),
    start_offset: Number(r.start_offset),
    end_offset: Number(r.end_offset),
    character_count: Number(r.character_count),
    token_estimate: Number(r.token_estimate),
    heading: r.heading !== null && r.heading !== undefined ? String(r.heading) : null,
    page_number: r.page_number !== null && r.page_number !== undefined ? Number(r.page_number) : null,
    metadata_json: r.metadata_json !== null && r.metadata_json !== undefined ? String(r.metadata_json) : null,
    created_at: r.created_at ? String(r.created_at) : undefined
  }));
}

export function getChunkById(chunkId: string): DBDocumentChunk | null {
  if (!dbInstance) return null;
  const rows = executeQuery('SELECT * FROM document_chunks WHERE id = ?', [chunkId]);
  if (rows.length === 0) return null;
  const r = rows[0];
  return {
    id: String(r.id),
    document_id: String(r.document_id),
    chunk_index: Number(r.chunk_index),
    text: String(r.text),
    start_offset: Number(r.start_offset),
    end_offset: Number(r.end_offset),
    character_count: Number(r.character_count),
    token_estimate: Number(r.token_estimate),
    heading: r.heading !== null && r.heading !== undefined ? String(r.heading) : null,
    page_number: r.page_number !== null && r.page_number !== undefined ? Number(r.page_number) : null,
    metadata_json: r.metadata_json !== null && r.metadata_json !== undefined ? String(r.metadata_json) : null,
    created_at: r.created_at ? String(r.created_at) : undefined
  };
}

export function insertChunkInDB(chunk: DBDocumentChunk): DBDocumentChunk {
  executeQuery(
    `INSERT INTO document_chunks (
      id, document_id, chunk_index, text, start_offset, end_offset,
      character_count, token_estimate, heading, page_number, metadata_json
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      chunk.id,
      chunk.document_id,
      chunk.chunk_index,
      chunk.text,
      chunk.start_offset,
      chunk.end_offset,
      chunk.character_count,
      chunk.token_estimate,
      chunk.heading,
      chunk.page_number,
      chunk.metadata_json
    ]
  );
  return chunk;
}

export function insertChunksInDB(chunks: DBDocumentChunk[]): void {
  if (!dbInstance || chunks.length === 0) return;
  for (const chunk of chunks) {
    insertChunkInDB(chunk);
  }
}

export function deleteChunksByDocumentId(documentId: string): void {
  executeQuery('DELETE FROM document_chunks WHERE document_id = ?', [documentId]);
}



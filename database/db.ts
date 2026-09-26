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
  provider_id?: string | null;
  sources_json?: string | null;
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
  indexing_status?: 'Ready' | 'Indexing' | 'Indexed' | 'Index Failed' | null;
  indexed_at?: string | null;
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
  embedding_json?: string | null;
  created_at?: string;
}

export interface DBStudySession {
  id: string;
  session_type: string;
  title: string;
  topic: string;
  document_id: string | null;
  document_name: string | null;
  data_json: string;
  created_at: string;
  updated_at: string;
}

export interface DBStudyItem {
  id: string;
  session_id: string;
  item_type: string;
  content_json: string;
  metadata_json?: string | null;
  created_at: string;
}

export interface DBQuiz {
  id: string;
  session_id: string | null;
  topic: string;
  difficulty: string;
  question_count: number;
  questions_json: string;
  created_at: string;
}

export interface DBFlashcard {
  id: string;
  session_id: string | null;
  topic: string;
  card_count: number;
  cards_json: string;
  created_at: string;
}

export interface DBStudyPlan {
  id: string;
  session_id: string | null;
  subject: string;
  days: number;
  hours_per_day: number;
  plan_json: string;
  created_at: string;
}

export interface DBConversationMemory {
  conversation_id: string;
  active_topic: string | null;
  summary: string | null;
  recent_entities_json: string | null;
  recent_doc_references_json: string | null;
  last_qa_snippet: string | null;
  updated_at: string;
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
    role CHECK(role IN ('system', 'user', 'assistant')) NOT NULL,
    content TEXT NOT NULL,
    provider_id TEXT,
    sources_json TEXT,
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
    indexing_status TEXT CHECK(indexing_status IN ('Pending', 'Indexing', 'Indexed', 'Index Failed', 'Ready')) DEFAULT 'Ready',
    indexed_at TIMESTAMP,
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
    embedding_json TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY(document_id) REFERENCES documents(id) ON DELETE CASCADE,
    UNIQUE(document_id, chunk_index)
);

CREATE INDEX IF NOT EXISTS idx_chunks_document_id ON document_chunks(document_id);
CREATE INDEX IF NOT EXISTS idx_chunks_doc_chunk_idx ON document_chunks(document_id, chunk_index);

-- Phase 8 Chat-Scoped Document Relationship
CREATE TABLE IF NOT EXISTS conversation_documents (
    conversation_id TEXT NOT NULL,
    document_id TEXT NOT NULL,
    attached_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (conversation_id, document_id),
    FOREIGN KEY(conversation_id) REFERENCES conversations(id) ON DELETE CASCADE,
    FOREIGN KEY(document_id) REFERENCES documents(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_conv_docs_conv ON conversation_documents(conversation_id);
CREATE INDEX IF NOT EXISTS idx_conv_docs_doc ON conversation_documents(document_id);

-- Phase 9 Conversation Context Memory
CREATE TABLE IF NOT EXISTS conversation_memories (
    conversation_id TEXT PRIMARY KEY,
    active_topic TEXT,
    summary TEXT,
    recent_entities_json TEXT,
    recent_doc_references_json TEXT,
    last_qa_snippet TEXT,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY(conversation_id) REFERENCES conversations(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS study_sessions (
    id TEXT PRIMARY KEY,
    session_type TEXT NOT NULL,
    title TEXT NOT NULL,
    topic TEXT NOT NULL,
    document_id TEXT,
    document_name TEXT,
    data_json TEXT NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS study_items (
    id TEXT PRIMARY KEY,
    session_id TEXT NOT NULL,
    item_type TEXT NOT NULL,
    content_json TEXT NOT NULL,
    metadata_json TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY(session_id) REFERENCES study_sessions(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS quizzes (
    id TEXT PRIMARY KEY,
    session_id TEXT,
    topic TEXT NOT NULL,
    difficulty TEXT NOT NULL,
    question_count INTEGER NOT NULL,
    questions_json TEXT NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS flashcards (
    id TEXT PRIMARY KEY,
    session_id TEXT,
    topic TEXT NOT NULL,
    card_count INTEGER NOT NULL,
    cards_json TEXT NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS study_plans (
    id TEXT PRIMARY KEY,
    session_id TEXT,
    subject TEXT NOT NULL,
    days INTEGER NOT NULL,
    hours_per_day REAL NOT NULL,
    plan_json TEXT NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_study_sessions_type ON study_sessions(session_type);
CREATE INDEX IF NOT EXISTS idx_study_sessions_created ON study_sessions(created_at);
CREATE INDEX IF NOT EXISTS idx_quizzes_session ON quizzes(session_id);
CREATE INDEX IF NOT EXISTS idx_flashcards_session ON flashcards(session_id);
CREATE INDEX IF NOT EXISTS idx_study_plans_session ON study_plans(session_id);

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
            try {
              const u8array = new Uint8Array(JSON.parse(savedDb));
              dbInstance = new SQL.Database(u8array);
              loadedExisting = true;
            } catch (corruptErr) {
              console.warn('Existing SQLite database in storage was corrupted. Backing up and resetting clean database:', corruptErr);
              try {
                localStorage.setItem(`offline_study_ai_db_corrupt_${Date.now()}`, savedDb);
              } catch (_) {}
              localStorage.removeItem('offline_study_ai_db');
              dbInstance = new SQL.Database();
              loadedExisting = true;
            }
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

      // Safe schema migrations for existing SQLite databases
      try { dbInstance.run('ALTER TABLE messages ADD COLUMN sources_json TEXT;'); } catch (_) {}
      try { dbInstance.run("ALTER TABLE documents ADD COLUMN indexing_status TEXT DEFAULT 'Ready';"); } catch (_) {}
      try { dbInstance.run('ALTER TABLE documents ADD COLUMN indexed_at TIMESTAMP;'); } catch (_) {}
      try { dbInstance.run('ALTER TABLE document_chunks ADD COLUMN embedding_json TEXT;'); } catch (_) {}
      try {
        dbInstance.run(`
          CREATE TABLE IF NOT EXISTS study_sessions (
              id TEXT PRIMARY KEY,
              session_type TEXT NOT NULL,
              title TEXT NOT NULL,
              topic TEXT NOT NULL,
              document_id TEXT,
              document_name TEXT,
              data_json TEXT NOT NULL,
              created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
              updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
          );
          CREATE TABLE IF NOT EXISTS study_items (
              id TEXT PRIMARY KEY,
              session_id TEXT NOT NULL,
              item_type TEXT NOT NULL,
              content_json TEXT NOT NULL,
              metadata_json TEXT,
              created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
              FOREIGN KEY(session_id) REFERENCES study_sessions(id) ON DELETE CASCADE
          );
          CREATE TABLE IF NOT EXISTS quizzes (
              id TEXT PRIMARY KEY,
              session_id TEXT,
              topic TEXT NOT NULL,
              difficulty TEXT NOT NULL,
              question_count INTEGER NOT NULL,
              questions_json TEXT NOT NULL,
              created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
          );
          CREATE TABLE IF NOT EXISTS flashcards (
              id TEXT PRIMARY KEY,
              session_id TEXT,
              topic TEXT NOT NULL,
              card_count INTEGER NOT NULL,
              cards_json TEXT NOT NULL,
              created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
          );
          CREATE TABLE IF NOT EXISTS study_plans (
              id TEXT PRIMARY KEY,
              session_id TEXT,
              subject TEXT NOT NULL,
              days INTEGER NOT NULL,
              hours_per_day REAL NOT NULL,
              plan_json TEXT NOT NULL,
              created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
          );
          CREATE INDEX IF NOT EXISTS idx_study_sessions_type ON study_sessions(session_type);
          CREATE INDEX IF NOT EXISTS idx_study_sessions_created ON study_sessions(created_at);
        `);
      } catch (_) {}

      // Phase 8 & 9: Ensure conversation_documents & conversation_memories exist
      try {
        dbInstance.run(`
          CREATE TABLE IF NOT EXISTS conversation_documents (
              conversation_id TEXT NOT NULL,
              document_id TEXT NOT NULL,
              attached_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
              PRIMARY KEY (conversation_id, document_id),
              FOREIGN KEY(conversation_id) REFERENCES conversations(id) ON DELETE CASCADE,
              FOREIGN KEY(document_id) REFERENCES documents(id) ON DELETE CASCADE
          );
          CREATE INDEX IF NOT EXISTS idx_conv_docs_conv ON conversation_documents(conversation_id);
          CREATE INDEX IF NOT EXISTS idx_conv_docs_doc ON conversation_documents(document_id);

          CREATE TABLE IF NOT EXISTS conversation_memories (
              conversation_id TEXT PRIMARY KEY,
              active_topic TEXT,
              summary TEXT,
              recent_entities_json TEXT,
              recent_doc_references_json TEXT,
              last_qa_snippet TEXT,
              updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
              FOREIGN KEY(conversation_id) REFERENCES conversations(id) ON DELETE CASCADE
          );
        `);
      } catch (_) {}

      // Phase 15: Ensure provider_id column exists on messages
      try {
        dbInstance.run('ALTER TABLE messages ADD COLUMN provider_id TEXT;');
      } catch (_) {}

      // Verify schema: ensure required tables exist
      const checkResult = dbInstance.exec("SELECT name FROM sqlite_master WHERE type='table';");
      const tables = checkResult[0]?.values.map((v) => String(v[0])) || [];
      const requiredTables = ['settings', 'conversations', 'messages', 'documents', 'document_chunks', 'study_sessions', 'conversation_documents', 'conversation_memories'];
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

export function getConversationFromDB(id: string): DBConversation | null {
  if (!dbInstance) return null;
  const rows = executeQuery('SELECT * FROM conversations WHERE id = ?', [id]);
  if (!rows || rows.length === 0) return null;
  const r = rows[0];
  return {
    id: String(r.id),
    title: String(r.title),
    created_at: String(r.created_at),
    updated_at: String(r.updated_at)
  };
}

export function deleteConversationFromDB(id: string): void {
  executeQuery('DELETE FROM conversation_memories WHERE conversation_id = ?', [id]);
  executeQuery('DELETE FROM conversation_documents WHERE conversation_id = ?', [id]);
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
    provider_id: r.provider_id ? String(r.provider_id) : null,
    sources_json: r.sources_json ? String(r.sources_json) : null,
    created_at: String(r.created_at)
  }));
}

export const getMessagesByConversationIdFromDB = getMessagesByConversationId;

export function insertMessageInDB(msg: DBMessage): DBMessage {
  executeQuery(
    'INSERT INTO messages (id, conversation_id, role, content, provider_id, sources_json, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)',
    [msg.id, msg.conversation_id, msg.role, msg.content, msg.provider_id || null, msg.sources_json || null, msg.created_at]
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
    indexing_status: (r.indexing_status ? String(r.indexing_status) : 'Ready') as DBDocument['indexing_status'],
    indexed_at: r.indexed_at ? String(r.indexed_at) : null,
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
    indexing_status: (r.indexing_status ? String(r.indexing_status) : 'Ready') as DBDocument['indexing_status'],
    indexed_at: r.indexed_at ? String(r.indexed_at) : null,
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
    indexing_status: (r.indexing_status ? String(r.indexing_status) : 'Ready') as DBDocument['indexing_status'],
    indexed_at: r.indexed_at ? String(r.indexed_at) : null,
    error_message: r.error_message ? String(r.error_message) : null
  };
}

export function insertDocumentInDB(doc: Partial<DBDocument> & { id: string; filename: string }): DBDocument {
  executeQuery(
    `INSERT INTO documents (
      id, filename, original_path, file_type, file_size, file_hash,
      imported_at, modified_at, extraction_status, extracted_text,
      character_count, indexing_status, indexed_at, error_message
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      doc.id,
      doc.filename,
      doc.original_path || null,
      doc.file_type || 'txt',
      doc.file_size || 0,
      doc.file_hash || ('hash_' + Date.now()),
      doc.imported_at || new Date().toISOString(),
      doc.modified_at || null,
      doc.extraction_status || 'Ready',
      doc.extracted_text || null,
      doc.character_count || 0,
      doc.indexing_status || 'Ready',
      doc.indexed_at || null,
      doc.error_message || null
    ]
  );
  return doc as DBDocument;
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
  executeQuery('DELETE FROM conversation_documents WHERE document_id = ?', [id]);
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
    embedding_json: r.embedding_json !== null && r.embedding_json !== undefined ? String(r.embedding_json) : null,
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
    embedding_json: r.embedding_json !== null && r.embedding_json !== undefined ? String(r.embedding_json) : null,
    created_at: r.created_at ? String(r.created_at) : undefined
  };
}

export function insertChunkInDB(chunk: DBDocumentChunk): DBDocumentChunk {
  executeQuery(
    `INSERT INTO document_chunks (
      id, document_id, chunk_index, text, start_offset, end_offset,
      character_count, token_estimate, heading, page_number, metadata_json, embedding_json
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      chunk.id,
      chunk.document_id,
      chunk.chunk_index,
      chunk.text,
      chunk.start_offset,
      chunk.end_offset,
      chunk.character_count,
      chunk.token_estimate,
      chunk.heading || null,
      chunk.page_number || null,
      chunk.metadata_json || null,
      chunk.embedding_json || null
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

export function updateChunkEmbedding(chunkId: string, embeddingJson: string): void {
  executeQuery('UPDATE document_chunks SET embedding_json = ? WHERE id = ?', [embeddingJson, chunkId]);
}

export function updateDocumentIndexingStatus(
  documentId: string,
  status: 'Ready' | 'Indexing' | 'Indexed' | 'Index Failed',
  error?: string
): void {
  const now = new Date().toISOString();
  if (status === 'Indexed') {
    executeQuery(
      'UPDATE documents SET indexing_status = ?, indexed_at = ?, modified_at = ? WHERE id = ?',
      [status, now, now, documentId]
    );
  } else if (status === 'Index Failed') {
    executeQuery(
      'UPDATE documents SET indexing_status = ?, error_message = ?, modified_at = ? WHERE id = ?',
      [status, error || 'Indexing failed', now, documentId]
    );
  } else {
    executeQuery(
      'UPDATE documents SET indexing_status = ?, modified_at = ? WHERE id = ?',
      [status, now, documentId]
    );
  }
}

export function getAllChunksWithEmbeddings(): Array<DBDocumentChunk & { filename: string; file_type: string }> {
  if (!dbInstance) return [];
  const rows = executeQuery(`
    SELECT c.*, d.filename, d.file_type 
    FROM document_chunks c
    JOIN documents d ON c.document_id = d.id
    WHERE c.embedding_json IS NOT NULL
  `);
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
    embedding_json: r.embedding_json !== null && r.embedding_json !== undefined ? String(r.embedding_json) : null,
    created_at: r.created_at ? String(r.created_at) : undefined,
    filename: String(r.filename),
    file_type: String(r.file_type)
  }));
}

export function deleteChunksByDocumentId(documentId: string): void {
  executeQuery('DELETE FROM document_chunks WHERE document_id = ?', [documentId]);
}

export interface DatabaseStats {
  conversationsCount: number;
  messagesCount: number;
  documentsCount: number;
  chunksCount: number;
  databaseSizeBytes: number;
}

export function getDatabaseStats(): DatabaseStats {
  if (!dbInstance) {
    return {
      conversationsCount: 0,
      messagesCount: 0,
      documentsCount: 0,
      chunksCount: 0,
      databaseSizeBytes: 0
    };
  }

  let conversationsCount = 0;
  let messagesCount = 0;
  let documentsCount = 0;
  let chunksCount = 0;
  let databaseSizeBytes = 0;

  try {
    const cRes = executeQuery('SELECT COUNT(*) as count FROM conversations');
    conversationsCount = Number(cRes[0]?.count || 0);

    const mRes = executeQuery('SELECT COUNT(*) as count FROM messages');
    messagesCount = Number(mRes[0]?.count || 0);

    const dRes = executeQuery('SELECT COUNT(*) as count FROM documents');
    documentsCount = Number(dRes[0]?.count || 0);

    const chRes = executeQuery('SELECT COUNT(*) as count FROM document_chunks');
    chunksCount = Number(chRes[0]?.count || 0);

    if (typeof localStorage !== 'undefined') {
      const raw = localStorage.getItem('offline_study_ai_db');
      if (raw) databaseSizeBytes = raw.length;
    }
    if (databaseSizeBytes === 0 && dbInstance) {
      try {
        const exported = dbInstance.export();
        databaseSizeBytes = exported.length;
      } catch (_) {}
    }
  } catch (err) {
    console.warn('Failed to calculate database stats:', err);
  }

  return {
    conversationsCount,
    messagesCount,
    documentsCount,
    chunksCount,
    databaseSizeBytes
  };
}

export function deleteMessageFromDB(id: string): void {
  executeQuery('DELETE FROM messages WHERE id = ?', [id]);
}

export function clearMessagesByConversationId(conversationId: string): void {
  executeQuery('DELETE FROM messages WHERE conversation_id = ?', [conversationId]);
}

export function clearAllConversations(): void {
  executeQuery('DELETE FROM conversation_memories');
  executeQuery('DELETE FROM conversation_documents');
  executeQuery('DELETE FROM messages');
  executeQuery('DELETE FROM conversations');
}

export function clearAllDocuments(): void {
  executeQuery('DELETE FROM conversation_documents');
  executeQuery('DELETE FROM document_chunks');
  executeQuery('DELETE FROM documents');
}

export function clearEntireDatabase(): void {
  if (!dbInstance) return;
  executeQuery('DELETE FROM conversation_memories');
  executeQuery('DELETE FROM conversation_documents');
  executeQuery('DELETE FROM messages');
  executeQuery('DELETE FROM conversations');
  executeQuery('DELETE FROM document_chunks');
  executeQuery('DELETE FROM documents');
  executeQuery('DELETE FROM settings');
  dbInstance.run(INITIAL_SCHEMA);
  saveDatabase();
}

// ==========================================
// Phase 8 Chat-Scoped Document Associations
// ==========================================

export function attachDocumentToConversation(conversationId: string, documentId: string): void {
  if (!dbInstance) return;
  const now = new Date().toISOString();
  executeQuery(
    'INSERT OR IGNORE INTO conversation_documents (conversation_id, document_id, attached_at) VALUES (?, ?, ?)',
    [conversationId, documentId, now]
  );
}

export function detachDocumentFromConversation(conversationId: string, documentId: string): void {
  if (!dbInstance) return;
  executeQuery(
    'DELETE FROM conversation_documents WHERE conversation_id = ? AND document_id = ?',
    [conversationId, documentId]
  );
}

export function isDocumentAttachedToConversation(conversationId: string, documentId: string): boolean {
  if (!dbInstance) return false;
  const rows = executeQuery(
    'SELECT 1 FROM conversation_documents WHERE conversation_id = ? AND document_id = ? LIMIT 1',
    [conversationId, documentId]
  );
  return rows.length > 0;
}

export function getDocumentIdsForConversation(conversationId: string): string[] {
  if (!dbInstance) return [];
  const rows = executeQuery(
    'SELECT document_id FROM conversation_documents WHERE conversation_id = ? ORDER BY attached_at ASC',
    [conversationId]
  );
  return rows.map((r) => String(r.document_id));
}

export function getAllAttachedDocumentIds(): string[] {
  if (!dbInstance) return [];
  const rows = executeQuery('SELECT DISTINCT document_id FROM conversation_documents');
  return rows.map((r) => String(r.document_id));
}

export function getDocumentsForConversation(conversationId: string): DBDocument[] {
  if (!dbInstance) return [];
  const rows = executeQuery(
    `SELECT d.* FROM documents d
     INNER JOIN conversation_documents cd ON cd.document_id = d.id
     WHERE cd.conversation_id = ?
     ORDER BY cd.attached_at ASC`,
    [conversationId]
  );
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
    indexing_status: (r.indexing_status ? String(r.indexing_status) : 'Ready') as DBDocument['indexing_status'],
    indexed_at: r.indexed_at ? String(r.indexed_at) : null,
    error_message: r.error_message ? String(r.error_message) : null
  }));
}

export function getChunkCountByDocumentId(documentId: string): number {
  if (!dbInstance) return 0;
  try {
    const res = executeQuery('SELECT COUNT(*) as count FROM document_chunks WHERE document_id = ?', [documentId]);
    return Number(res[0]?.count || 0);
  } catch {
    return 0;
  }
}

// ==========================================
// Phase 5 Study Features SQLite Helpers
// ==========================================

export function saveStudySessionInDB(session: DBStudySession): void {
  const now = new Date().toISOString();
  executeQuery(
    `INSERT INTO study_sessions (id, session_type, title, topic, document_id, document_name, data_json, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
     ON CONFLICT(id) DO UPDATE SET 
       title = excluded.title,
       topic = excluded.topic,
       document_id = excluded.document_id,
       document_name = excluded.document_name,
       data_json = excluded.data_json,
       updated_at = excluded.updated_at`,
    [
      session.id,
      session.session_type,
      session.title || 'Untitled Session',
      session.topic || 'General Topic',
      session.document_id || null,
      session.document_name || null,
      session.data_json || '{}',
      session.created_at || now,
      session.updated_at || now
    ]
  );
}

export function getAllStudySessionsFromDB(): DBStudySession[] {
  if (!dbInstance) return [];
  const rows = executeQuery('SELECT * FROM study_sessions ORDER BY created_at DESC');
  return rows.map((r) => ({
    id: String(r.id),
    session_type: String(r.session_type),
    title: String(r.title),
    topic: String(r.topic),
    document_id: r.document_id ? String(r.document_id) : null,
    document_name: r.document_name ? String(r.document_name) : null,
    data_json: String(r.data_json),
    created_at: String(r.created_at),
    updated_at: String(r.updated_at)
  }));
}

export function getStudySessionByIdFromDB(id: string): DBStudySession | null {
  if (!dbInstance) return null;
  const rows = executeQuery('SELECT * FROM study_sessions WHERE id = ?', [id]);
  if (rows.length === 0) return null;
  const r = rows[0];
  return {
    id: String(r.id),
    session_type: String(r.session_type),
    title: String(r.title),
    topic: String(r.topic),
    document_id: r.document_id ? String(r.document_id) : null,
    document_name: r.document_name ? String(r.document_name) : null,
    data_json: String(r.data_json),
    created_at: String(r.created_at),
    updated_at: String(r.updated_at)
  };
}

export function deleteStudySessionFromDB(id: string): void {
  executeQuery('DELETE FROM study_items WHERE session_id = ?', [id]);
  executeQuery('DELETE FROM quizzes WHERE session_id = ?', [id]);
  executeQuery('DELETE FROM flashcards WHERE session_id = ?', [id]);
  executeQuery('DELETE FROM study_plans WHERE session_id = ?', [id]);
  executeQuery('DELETE FROM study_sessions WHERE id = ?', [id]);
}

export function clearAllStudySessionsFromDB(): void {
  executeQuery('DELETE FROM study_items');
  executeQuery('DELETE FROM quizzes');
  executeQuery('DELETE FROM flashcards');
  executeQuery('DELETE FROM study_plans');
  executeQuery('DELETE FROM study_sessions');
}

export function saveQuizInDB(quiz: DBQuiz): void {
  const now = new Date().toISOString();
  executeQuery(
    `INSERT INTO quizzes (id, session_id, topic, difficulty, question_count, questions_json, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?)
     ON CONFLICT(id) DO UPDATE SET
       questions_json = excluded.questions_json,
       question_count = excluded.question_count`,
    [
      quiz.id,
      quiz.session_id || null,
      quiz.topic,
      quiz.difficulty,
      quiz.question_count,
      quiz.questions_json,
      quiz.created_at || now
    ]
  );
}

export function getQuizBySessionIdFromDB(sessionId: string): DBQuiz | null {
  if (!dbInstance) return null;
  const rows = executeQuery('SELECT * FROM quizzes WHERE session_id = ?', [sessionId]);
  if (rows.length === 0) return null;
  const r = rows[0];
  return {
    id: String(r.id),
    session_id: r.session_id ? String(r.session_id) : null,
    topic: String(r.topic),
    difficulty: String(r.difficulty),
    question_count: Number(r.question_count),
    questions_json: String(r.questions_json),
    created_at: String(r.created_at)
  };
}

export function saveFlashcardDeckInDB(deck: DBFlashcard): void {
  const now = new Date().toISOString();
  executeQuery(
    `INSERT INTO flashcards (id, session_id, topic, card_count, cards_json, created_at)
     VALUES (?, ?, ?, ?, ?, ?)
     ON CONFLICT(id) DO UPDATE SET
       cards_json = excluded.cards_json,
       card_count = excluded.card_count`,
    [
      deck.id,
      deck.session_id || null,
      deck.topic,
      deck.card_count,
      deck.cards_json,
      deck.created_at || now
    ]
  );
}

export function getFlashcardDeckBySessionIdFromDB(sessionId: string): DBFlashcard | null {
  if (!dbInstance) return null;
  const rows = executeQuery('SELECT * FROM flashcards WHERE session_id = ?', [sessionId]);
  if (rows.length === 0) return null;
  const r = rows[0];
  return {
    id: String(r.id),
    session_id: r.session_id ? String(r.session_id) : null,
    topic: String(r.topic),
    card_count: Number(r.card_count),
    cards_json: String(r.cards_json),
    created_at: String(r.created_at)
  };
}

export function saveStudyPlanInDB(plan: DBStudyPlan): void {
  const now = new Date().toISOString();
  executeQuery(
    `INSERT INTO study_plans (id, session_id, subject, days, hours_per_day, plan_json, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?)
     ON CONFLICT(id) DO UPDATE SET
       plan_json = excluded.plan_json,
       days = excluded.days,
       hours_per_day = excluded.hours_per_day`,
    [
      plan.id,
      plan.session_id || null,
      plan.subject,
      plan.days,
      plan.hours_per_day,
      plan.plan_json,
      plan.created_at || now
    ]
  );
}

export function getStudyPlanBySessionIdFromDB(sessionId: string): DBStudyPlan | null {
  if (!dbInstance) return null;
  const rows = executeQuery('SELECT * FROM study_plans WHERE session_id = ?', [sessionId]);
  if (rows.length === 0) return null;
  const r = rows[0];
  return {
    id: String(r.id),
    session_id: r.session_id ? String(r.session_id) : null,
    subject: String(r.subject),
    days: Number(r.days),
    hours_per_day: Number(r.hours_per_day),
    plan_json: String(r.plan_json),
    created_at: String(r.created_at)
  };
}

// ==========================================
// Phase 9 Conversation Memory Operations
// ==========================================

export function getConversationMemoryFromDB(conversationId: string): DBConversationMemory | null {
  if (!dbInstance) return null;
  const rows = executeQuery('SELECT * FROM conversation_memories WHERE conversation_id = ?', [conversationId]);
  if (rows.length === 0) return null;
  const r = rows[0];
  return {
    conversation_id: String(r.conversation_id),
    active_topic: r.active_topic ? String(r.active_topic) : null,
    summary: r.summary ? String(r.summary) : null,
    recent_entities_json: r.recent_entities_json ? String(r.recent_entities_json) : null,
    recent_doc_references_json: r.recent_doc_references_json ? String(r.recent_doc_references_json) : null,
    last_qa_snippet: r.last_qa_snippet ? String(r.last_qa_snippet) : null,
    updated_at: String(r.updated_at)
  };
}

export function upsertConversationMemoryInDB(memory: DBConversationMemory): void {
  if (!dbInstance) return;
  const now = new Date().toISOString();
  executeQuery(
    `INSERT INTO conversation_memories (
      conversation_id, active_topic, summary, recent_entities_json,
      recent_doc_references_json, last_qa_snippet, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(conversation_id) DO UPDATE SET
      active_topic = excluded.active_topic,
      summary = excluded.summary,
      recent_entities_json = excluded.recent_entities_json,
      recent_doc_references_json = excluded.recent_doc_references_json,
      last_qa_snippet = excluded.last_qa_snippet,
      updated_at = excluded.updated_at`,
    [
      memory.conversation_id,
      memory.active_topic,
      memory.summary,
      memory.recent_entities_json,
      memory.recent_doc_references_json,
      memory.last_qa_snippet,
      now
    ]
  );
}

export function deleteConversationMemoryFromDB(conversationId: string): void {
  if (!dbInstance) return;
  executeQuery('DELETE FROM conversation_memories WHERE conversation_id = ?', [conversationId]);
}





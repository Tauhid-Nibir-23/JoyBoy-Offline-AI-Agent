-- Offline Study AI - SQLite Database Schema (Phase 0)

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

-- Phase 5 Study Features Tables
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

-- Default Settings Insertions
INSERT OR IGNORE INTO settings (key, value) VALUES 
('app_name', 'Offline Study AI'),
('model_path', ''),
('model_name', 'Qwen3-4B-GGUF (Baseline)'),
('context_length', '4096'),
('gpu_layers', '0'),
('cpu_threads', '4'),
('theme', 'dark'),
('offline_mode', 'true');


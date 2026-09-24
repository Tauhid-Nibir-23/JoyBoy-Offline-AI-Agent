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
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY(conversation_id) REFERENCES conversations(id) ON DELETE CASCADE
);

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

# Offline Study AI — Architecture Overview

## Overview
Offline Study AI is an offline-first desktop application engineered for zero-cloud dependency personal study, document analysis, local RAG, and selective internet synchronization.

## System Components
```
┌─────────────────────────────────────────────────────────────┐
│                    Offline Study AI Desktop                 │
├─────────────────────────────────────────────────────────────┤
│  Frontend: Tauri 2 + React + TypeScript                     │
│  Navigation Views: Chat | Study | Knowledge | Docs | Sync   │
├─────────────────────────────────────────────────────────────┤
│  Local AI Engine: llama.cpp (OpenAI-compatible local server) │
├─────────────────────────────────────────────────────────────┤
│  Local Storage & RAG: SQLite FTS5 + Vector Embeddings       │
├─────────────────────────────────────────────────────────────┤
│  Sync Engine: Allowlist-based incremental sync (Network-aware)│
└─────────────────────────────────────────────────────────────┘
```

## Directory Structure
- `app/` — React UI components, section views, status indicators, styling.
- `src-tauri/` — Tauri 2 desktop native rust host application and system capabilities.
- `core/` — Environment detection, hardware inspection, system state primitives.
- `ai/` — Local AI engine interfaces and llama.cpp bridge.
- `rag/` — Vector search, FTS5 document chunk indexing, citations generator.
- `sync/` — Allowlist network sync manager, storage limit enforcement, hash deduplication.
- `database/` — SQLite schema migrations, initialization, and query execution engine.
- `documents/` — Local document parser and chunking pipelines (PDF, TXT, MD, DOCX, Code).
- `models/` — Local model profile manager (Qwen3-4B baseline, small/coding model options).
- `tests/` — Automated unit, integration, and golden offline verification tests.
- `docs/` — Architecture specifications and developer guides.
- `scripts/` — Automated build, check, and verification scripts.

## Phase 0 Status
- Cross-platform foundation established for Windows and Manjaro/Linux.
- SQLite database schema defined and auto-initialized (`conversations`, `messages`, `settings`).
- Section view placeholders complete.
- Live environment status indicators active (AI status, Internet status, DB status).

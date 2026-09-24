# Offline Study AI — Development Rules

## Project Goal
Build a Windows + Linux desktop application called "Offline Study AI".
The application is an offline-first personal study assistant.

Primary priorities:
- Offline reliability
- Low storage usage
- Low RAM/CPU usage where practical
- Local privacy
- Cross-platform support
- Maintainability
- Safe incremental development

## Mandatory Architecture
- **Frontend:** Tauri 2, React, TypeScript
- **Backend/Core:** Rust where system-level functionality is required
- **AI:** llama.cpp, GGUF local models
- **Database:** SQLite
- **Knowledge:** Local document ingestion, RAG, Local search/index
- **Sync:** User-controlled allowlist, Network-aware, Incremental sync, No unrestricted web crawling

## Offline-First Rule
The application must remain useful with zero internet connectivity.
Never make chat, local model inference, local document reading, local RAG, history, or settings depend on internet access.

## Privacy Rule
Do not upload user chats, documents, notes, or memory to cloud services by default.
Do not add telemetry unless explicitly requested.
Do not add hidden network requests.

## Incremental Development Rule
Before modifying code:
1. Inspect the existing implementation.
2. Understand the architecture.
3. Preserve working functionality.
4. Make the smallest reasonable change.
5. Run relevant tests.
6. Run/build the application.
7. Report changed files.
8. Report verification results.

Never rewrite working modules without a clear technical reason.

## Git Rule
Before major feature work: ensure the working tree is clean and create a checkpoint commit.
After successful implementation: run tests and create a new checkpoint commit.
Never destroy previous working versions.

## Cross-Platform Rule
Core logic must remain platform-independent.
Windows-specific behavior belongs in Windows adapters.
Linux-specific behavior belongs in Linux adapters.
Do not put Windows paths or commands into shared business logic.

## Storage Rule
Avoid duplicate cached documents.
Use content hashes, ETags, and Last-Modified metadata where available for deduplication. Never continuously cache the same content.

## Model Rule
Do not hard-code one specific model into the application architecture.
The user must be able to configure the model path.
The AI engine must support model replacement without redesigning the UI.

## RAG Rule
Every indexed document should have metadata: `id`, `source`, `title`, `path_or_url`, `content_hash`, `created_time`, `updated_time`, `indexed_time`.
When possible, AI answers based on retrieved documents should expose source information.

## Sync Rule
Internet synchronization must be optional.
Support automatic sync, manual sync, pause sync, source enable/disable, cache size limit, last sync info, sync error history.
Never crawl the whole internet.

## Safety Rule
File/system tools must use least privilege.
Destructive operations require explicit confirmation.

## UI Rule
Keep the interface clean and functional.
Avoid unnecessary animations.
Prioritize readability, keyboard usability, responsive desktop layout, clear status indicators.

## AI Agent Rule
Do not claim a feature works without verification.
After each task report:
- **Changed:** Files/modules changed.
- **Tested:** Commands/tests executed.
- **Verified:** What was successfully confirmed.
- **Remaining:** Any known limitation or unfinished part.

## Stop Condition
If implementation would require changing a previous architectural decision, stop and explain the conflict before performing a large rewrite.

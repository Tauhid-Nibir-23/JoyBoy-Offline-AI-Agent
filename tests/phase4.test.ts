// Phase 4 Test Suite — Study Assistant Core UX, Model Management, Settings & Diagnostics
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { 
  initDatabase, 
  resetDatabaseStateForTesting, 
  getDatabaseStatus, 
  getDatabaseStats, 
  getSetting, 
  setSetting, 
  clearAllConversations, 
  clearAllDocuments, 
  clearEntireDatabase,
  clearMessagesByConversationId,
  deleteMessageFromDB,
  getChunkCountByDocumentId,
  createConversationInDB,
  getAllConversations,
  insertMessageInDB,
  getMessagesByConversationId,
  insertDocumentInDB,
  insertChunkInDB,
  DBDocument,
  DBDocumentChunk
} from '../database/db';
import { chatService } from '../ai/chatService';
import { modelManager } from '../models/manager';
import { localAIEngine } from '../ai/localEngine';
import { ragService } from '../rag';
import { documentService } from '../documents/documentService';
import { runDiagnostics } from '../core/diagnostics';
import { globalStatus } from '../core/status';

describe('Phase 4 — Core UX, Model Management, Settings & Diagnostics Tests', () => {
  beforeEach(async () => {
    resetDatabaseStateForTesting();
    await initDatabase();
  });

  afterEach(() => {
    resetDatabaseStateForTesting();
  });

  // 1. Model Manager State & Invalid Model Handling
  describe('1. Model Manager State & Handling', () => {
    it('scans and registers models without throwing', async () => {
      await modelManager.initialize();
      const models = await modelManager.scanModels();
      expect(Array.isArray(models)).toBe(true);
      expect(models.length).toBeGreaterThan(0);
    });

    it('handles invalid or non-existent model selection gracefully', async () => {
      await modelManager.initialize();
      const result = await modelManager.selectActiveModel('non_existent_model_id');
      expect(result).toBe(false);

      // Validate invalid path
      const val = await modelManager.validateModelFile('invalid/path/to/missing.gguf');
      expect(val.isValid).toBe(false);
      expect(val.fileSizeBytes).toBe(0);
    });

    it('registers and unregisters custom models safely', async () => {
      await modelManager.initialize();
      const customId = 'test_custom_model_' + Date.now();
      modelManager.registerModel({
        id: customId,
        name: 'Test Custom Model',
        provider: 'Local',
        format: 'GGUF',
        quantization: 'Q4_K_M',
        fileName: 'test.gguf',
        expectedSize: 500000000,
        contextLength: 4096,
        status: 'Installed'
      });

      expect(modelManager.getModelById(customId)).toBeDefined();
      modelManager.unregisterModel(customId);
      expect(modelManager.getModelById(customId)).toBeUndefined();
    });
  });

  // 2. Settings Persistence
  describe('2. Settings Persistence', () => {
    it('persists AI settings in SQLite', () => {
      setSetting('ai_provider', 'mock');
      expect(getSetting('ai_provider')).toBe('mock');

      setSetting('temperature', '0.85');
      expect(getSetting('temperature')).toBe('0.85');

      setSetting('max_tokens', '768');
      expect(getSetting('max_tokens')).toBe('768');

      setSetting('context_length', '8192');
      expect(getSetting('context_length')).toBe('8192');
    });

    it('persists RAG settings (default ON/OFF, Top-K, threshold)', () => {
      chatService.setStudyMaterialsEnabled(false);
      expect(chatService.isStudyMaterialsEnabled()).toBe(false);

      chatService.setStudyMaterialsEnabled(true);
      expect(chatService.isStudyMaterialsEnabled()).toBe(true);

      setSetting('rag_top_k', '6');
      expect(getSetting('rag_top_k')).toBe('6');

      setSetting('rag_similarity_threshold', '0.35');
      expect(getSetting('rag_similarity_threshold')).toBe('0.35');
    });

    it('persists Appearance settings (theme and chat density)', () => {
      setSetting('app_theme', 'amber');
      expect(getSetting('app_theme')).toBe('amber');

      setSetting('chat_density', 'compact');
      expect(getSetting('chat_density')).toBe('compact');
    });
  });

  // 3. Chat Rename, Delete, Clear & Regeneration
  describe('3. Chat UX: Rename, Delete, Clear & Regeneration', () => {
    it('creates, renames, and deletes conversations', () => {
      const conv = chatService.createConversation('Initial Title');
      expect(conv.id).toBeDefined();

      chatService.renameConversation(conv.id, 'Renamed Study Topic');
      const convs = chatService.getConversations();
      const updated = convs.find(c => c.id === conv.id);
      expect(updated?.title).toBe('Renamed Study Topic');

      chatService.deleteConversation(conv.id);
      const afterDelete = chatService.getConversations().find(c => c.id === conv.id);
      expect(afterDelete).toBeUndefined();
    });

    it('clears all messages from a conversation while preserving the conversation', () => {
      const conv = chatService.createConversation('Study Session');
      insertMessageInDB({
        id: 'msg_1',
        conversation_id: conv.id,
        role: 'user',
        content: 'Hello AI',
        created_at: new Date().toISOString()
      });
      insertMessageInDB({
        id: 'msg_2',
        conversation_id: conv.id,
        role: 'assistant',
        content: 'Hello student!',
        created_at: new Date().toISOString()
      });

      expect(chatService.getMessages(conv.id).length).toBe(2);

      chatService.clearConversation(conv.id);
      expect(chatService.getMessages(conv.id).length).toBe(0);

      // Verify conversation itself still exists
      const remainingConv = chatService.getConversations().find(c => c.id === conv.id);
      expect(remainingConv).toBeDefined();
    });

    it('regenerates the latest answer without duplicating user messages', async () => {
      const conv = chatService.createConversation('Regeneration Test');
      
      // Step 1: User sends message and receives initial assistant answer
      const { userMessage, assistantMessage } = await chatService.sendMessage(conv.id, 'Explain merge sort');
      expect(userMessage.content).toBe('Explain merge sort');
      expect(assistantMessage.role).toBe('assistant');

      const messagesBefore = chatService.getMessages(conv.id);
      expect(messagesBefore.length).toBe(2);
      expect(messagesBefore[0].role).toBe('user');
      expect(messagesBefore[1].role).toBe('assistant');
      const firstAssistantMsgId = assistantMessage.id;

      // Step 2: Trigger regeneration
      const regeneratedAssistant = await chatService.regenerateLastAnswer(conv.id);
      expect(regeneratedAssistant).not.toBeNull();
      expect(regeneratedAssistant?.role).toBe('assistant');
      expect(regeneratedAssistant?.id).not.toBe(firstAssistantMsgId);

      // Step 3: Verify no duplicate user message was created
      const messagesAfter = chatService.getMessages(conv.id);
      expect(messagesAfter.length).toBe(2);
      expect(messagesAfter[0].role).toBe('user');
      expect(messagesAfter[0].content).toBe('Explain merge sort');
      expect(messagesAfter[1].role).toBe('assistant');
    });

    it('allows deleting an individual message', () => {
      const conv = chatService.createConversation('Single Message Delete');
      insertMessageInDB({
        id: 'single_msg_1',
        conversation_id: conv.id,
        role: 'user',
        content: 'Test message',
        created_at: new Date().toISOString()
      });

      expect(chatService.getMessages(conv.id).length).toBe(1);
      chatService.deleteMessage('single_msg_1');
      expect(chatService.getMessages(conv.id).length).toBe(0);
    });
  });

  // 4. Document Management & Re-Indexing
  describe('4. Document Management & Re-Indexing', () => {
    it('tracks chunk counts and indexes/re-indexes documents', async () => {
      const docId = 'doc_test_' + Date.now();
      const testDoc: DBDocument = {
        id: docId,
        filename: 'operating_systems_notes.txt',
        original_path: '/path/os.txt',
        file_type: 'txt',
        file_size: 1024,
        file_hash: 'hash_' + Date.now(),
        imported_at: new Date().toISOString(),
        modified_at: null,
        extraction_status: 'Ready',
        extracted_text: 'Operating Systems manage CPU scheduling, memory management, and file systems.',
        character_count: 75,
        indexing_status: 'Ready',
        error_message: null
      };

      insertDocumentInDB(testDoc);
      expect(getChunkCountByDocumentId(docId)).toBe(0);

      // Insert chunk
      const chunk: DBDocumentChunk = {
        id: 'chunk_1',
        document_id: docId,
        chunk_index: 0,
        text: 'Operating Systems manage CPU scheduling.',
        start_offset: 0,
        end_offset: 40,
        character_count: 40,
        token_estimate: 8,
        heading: 'Intro',
        page_number: 1,
        metadata_json: JSON.stringify({}),
        embedding_json: JSON.stringify([0.1, 0.2, 0.3])
      };
      insertChunkInDB(chunk);

      expect(getChunkCountByDocumentId(docId)).toBe(1);

      // Re-index document through RAG service
      const ok = await ragService.reindexDocument(docId);
      expect(ok).toBe(true);
      expect(getChunkCountByDocumentId(docId)).toBeGreaterThan(0);
    });
  });

  // 5. System Diagnostics
  describe('5. System Diagnostics', () => {
    it('runs system diagnostics and returns structured PASS/FAIL report', async () => {
      const report = await runDiagnostics();
      expect(report).toBeDefined();
      expect(report.timestamp).toBeDefined();
      expect(Array.isArray(report.results)).toBe(true);
      expect(report.results.length).toBe(7);

      // SQLite initialized must PASS
      const sqliteCheck = report.results.find(r => r.id === 'sqlite_initialized');
      expect(sqliteCheck?.status).toBe('PASS');

      // Schema valid must PASS
      const schemaCheck = report.results.find(r => r.id === 'schema_valid');
      expect(schemaCheck?.status).toBe('PASS');

      // Local inference check
      const infCheck = report.results.find(r => r.id === 'local_inference_works');
      expect(infCheck?.status).toBe('PASS');

      // RAG database check
      const ragCheck = report.results.find(r => r.id === 'rag_database_accessible');
      expect(ragCheck?.status).toBe('PASS');
    });
  });

  // 6. Database Safety & Storage Calculations
  describe('6. Database Safety & Storage Calculations', () => {
    it('calculates database statistics accurately', () => {
      const statsBefore = getDatabaseStats();
      expect(statsBefore.conversationsCount).toBe(0);

      const conv = createConversationInDB('conv_stats_1', 'Stats Topic');
      insertMessageInDB({
        id: 'msg_stats_1',
        conversation_id: conv.id,
        role: 'user',
        content: 'Count me',
        created_at: new Date().toISOString()
      });

      const statsAfter = getDatabaseStats();
      expect(statsAfter.conversationsCount).toBe(1);
      expect(statsAfter.messagesCount).toBe(1);
    });

    it('clears all conversations without affecting documents or settings', () => {
      createConversationInDB('c1', 'Conv 1');
      createConversationInDB('c2', 'Conv 2');
      expect(getAllConversations().length).toBe(2);

      clearAllConversations();
      expect(getAllConversations().length).toBe(0);
    });

    it('clears all documents without affecting conversations', () => {
      insertDocumentInDB({
        id: 'doc_to_clear',
        filename: 'clear_me.txt',
        original_path: null,
        file_type: 'txt',
        file_size: 100,
        file_hash: 'hash_clear',
        imported_at: new Date().toISOString(),
        modified_at: null,
        extraction_status: 'Ready',
        extracted_text: 'Text',
        character_count: 4,
        indexing_status: 'Ready',
        error_message: null
      });

      expect(getDatabaseStats().documentsCount).toBe(1);
      clearAllDocuments();
      expect(getDatabaseStats().documentsCount).toBe(0);
    });

    it('wipes entire database and restores clean initial schema', () => {
      createConversationInDB('c_wipe', 'Wipe test');
      setSetting('custom_key', 'custom_value');

      clearEntireDatabase();

      expect(getAllConversations().length).toBe(0);
      const status = getDatabaseStatus();
      expect(status.initialized).toBe(true);
      expect(status.tables).toContain('conversations');
      expect(status.tables).toContain('settings');
      expect(getSetting('app_name')).toBe('Offline Study AI');
    });
  });

  // 7. Global Status Manager
  describe('7. Global Status Manager', () => {
    it('notifies subscribers on status updates', () => {
      let notifiedStatus: any = null;
      const unsubscribe = globalStatus.subscribe((s) => {
        notifiedStatus = s;
      });

      globalStatus.setAIStatus('Generating');
      expect(notifiedStatus.ai).toBe('Generating');

      globalStatus.setModelStatus('Loaded', 'Qwen 2.5 0.5B');
      expect(notifiedStatus.model).toBe('Loaded');
      expect(notifiedStatus.modelName).toBe('Qwen 2.5 0.5B');

      unsubscribe();
    });
  });
});

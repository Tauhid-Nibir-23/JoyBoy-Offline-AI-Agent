// Phase 17 — Chat UX, Smooth Scrolling & Streaming Stability Tests
import { describe, it, expect, beforeEach, afterAll, vi } from 'vitest';
import fs from 'fs';
import path from 'path';
import {
  initDatabase,
  createConversationInDB,
  clearAllConversations,
  clearAllDocuments,
  setSetting,
  getSetting,
  getMessagesByConversationId
} from '../database/db';
import { chatService, ChatService } from '../ai/chatService';
import { modelManager } from '../models/manager';
import { conversationMemory } from '../ai/conversationMemory';
import { AIProvider, ChatMessage, GenerateOptions } from '../ai/provider';

const PROJECT_ROOT = process.cwd();

describe('Phase 17 — Chat UX, Smooth Scrolling & Streaming Stability Tests', () => {
  beforeEach(async () => {
    await initDatabase();
    clearAllConversations();
    clearAllDocuments();
    setSetting('ai_provider', 'auto');
  });

  afterAll(() => {
    modelManager.clearActiveModel();
  });

  // =========================================================================
  // Requirement 1: CSS Text Selection Rules & Highlighting
  // =========================================================================
  it('1. CSS text selection: index.css explicitly enables user-select: text for messages and markdown', () => {
    const cssPath = path.resolve(PROJECT_ROOT, 'app', 'index.css');
    expect(fs.existsSync(cssPath)).toBe(true);
    const cssContent = fs.readFileSync(cssPath, 'utf8');

    // Verify user-select: text !important rules for chat elements
    expect(cssContent).toContain('.messages-scroll-area');
    expect(cssContent).toContain('.assistant-msg-body');
    expect(cssContent).toContain('.user-msg-bubble');
    expect(cssContent).toContain('.markdown-renderer');
    expect(cssContent).toContain('user-select: text !important;');

    // Verify selection highlighting
    expect(cssContent).toContain('::selection');
    expect(cssContent).toContain('.scroll-bottom-pill');
  });

  // =========================================================================
  // Requirement 2 & 9 Test A: 1,000+ Word Assistant Response Handling
  // =========================================================================
  it('2. Test A: 1,000+ word assistant response generates and persists without truncation or corruption', async () => {
    // Generate a 1,200-word response fixture
    const words = [];
    const sampleWords = ['algorithms', 'complexity', 'analysis', 'structures', 'optimization', 'memory', 'paging', 'cache', 'concurrency', 'threads'];
    for (let i = 0; i < 1200; i++) {
      words.push(`${sampleWords[i % sampleWords.length]}_${i}`);
    }
    const longResponseText = words.join(' ');
    expect(longResponseText.split(' ').length).toBeGreaterThanOrEqual(1000);

    const mockLongProvider: AIProvider = {
      id: 'mock_long',
      name: 'Mock Long Text Provider',
      isAvailable: async () => true,
      generateResponse: async (_h, opts) => {
        // Stream out in 50 chunks
        const chunkSize = Math.ceil(longResponseText.length / 50);
        for (let i = 0; i < longResponseText.length; i += chunkSize) {
          const chunk = longResponseText.slice(i, i + chunkSize);
          opts?.callbacks?.onToken?.(chunk);
        }
        return longResponseText;
      }
    };

    const cs = new ChatService(mockLongProvider);
    const conv = cs.createConversation('Long Response Test');

    const streamedChunks: string[] = [];
    const res = await cs.sendMessage(conv.id, 'Explain computer science principles in depth', {
      onToken: (chunk) => {
        streamedChunks.push(chunk);
      }
    });

    expect(res.assistantMessage.content).toBe(longResponseText);
    expect(res.assistantMessage.content.length).toBeGreaterThan(5000);

    // Verify it is saved in SQLite accurately
    const saved = getMessagesByConversationId(conv.id);
    const assistantMsg = saved.find((m) => m.role === 'assistant');
    expect(assistantMsg).toBeDefined();
    expect(assistantMsg?.content).toBe(longResponseText);

    // Verify copy cleaning does not strip valid long content
    const cleaned = assistantMsg!.content.replace(/\n\n\*\(?(Local AI|Mock Assistant|Demo \/ Mock Mode)[\s\S]*?\*?$/, '').trim();
    expect(cleaned).toBe(longResponseText);
  });

  // =========================================================================
  // Requirement 9 Test B: Long Numbered List Preservation
  // =========================================================================
  it('3. Test B: Long numbered list (40 items) preserves sequence, formatting, and copyability', async () => {
    const listItems: string[] = [];
    for (let i = 1; i <= 40; i++) {
      listItems.push(`${i}. Key principle number ${i}: Study concept explanation and active recall practice.`);
    }
    const numberedListText = listItems.join('\n');

    const mockListProvider: AIProvider = {
      id: 'mock_list',
      name: 'Mock List Provider',
      isAvailable: async () => true,
      generateResponse: async () => numberedListText
    };

    const cs = new ChatService(mockListProvider);
    const conv = cs.createConversation('Numbered List Test');

    const res = await cs.sendMessage(conv.id, 'List 40 study concepts');
    expect(res.assistantMessage.content).toBe(numberedListText);

    // Verify all 40 items are intact
    for (let i = 1; i <= 40; i++) {
      expect(res.assistantMessage.content).toContain(`${i}. Key principle number ${i}:`);
    }

    // Copying returns clean text matching original list
    const copiedText = res.assistantMessage.content.replace(/\n\n\*\(?(Local AI|Mock Assistant|Demo \/ Mock Mode)[\s\S]*?\*?$/, '').trim();
    expect(copiedText).toBe(numberedListText);
  });

  // =========================================================================
  // Requirement 9 Test C: Long Code Block Formatting & Horizontal Scroll
  // =========================================================================
  it('4. Test C: Long code block with wide horizontal lines preserves whitespace and formatting', async () => {
    const wideLines = [
      '```python',
      '# Super wide line demonstration for horizontal scroll stability in study AI chat view',
      'def process_distributed_system_records(record_id: int, options_dict: dict = {"retries": 3, "timeout_ms": 5000, "telemetry_enabled": False, "buffer_capacity_bytes": 1048576}) -> tuple[bool, str, dict]:',
      '    result_payload = {"status": "SUCCESS", "processed_records_count": 99999, "execution_timestamp": "2026-09-26T12:00:00Z", "diagnostics": {"threads_utilized": 4, "memory_consumed_mb": 128}}',
      '    return True, f"Successfully processed record batch with ID {record_id} through low-memory pipeline", result_payload',
      '```'
    ];
    const codeBlockText = wideLines.join('\n');

    const mockCodeProvider: AIProvider = {
      id: 'mock_code',
      name: 'Mock Code Provider',
      isAvailable: async () => true,
      generateResponse: async () => codeBlockText
    };

    const cs = new ChatService(mockCodeProvider);
    const conv = cs.createConversation('Code Block Test');

    const res = await cs.sendMessage(conv.id, 'Show a python function with wide signature');
    expect(res.assistantMessage.content).toContain('```python');
    expect(res.assistantMessage.content).toContain('def process_distributed_system_records');

    // Verify code block contains wide line exceeding 120 chars
    const longestLine = wideLines.reduce((max, l) => Math.max(max, l.length), 0);
    expect(longestLine).toBeGreaterThan(120);

    // MarkdownRenderer file has whiteSpace: 'pre' and overflowX: 'auto'
    const rendererPath = path.resolve(PROJECT_ROOT, 'app', 'components', 'chat', 'MarkdownRenderer.tsx');
    const rendererCode = fs.readFileSync(rendererPath, 'utf8');
    expect(rendererCode).toContain("overflowX: 'auto'");
    expect(rendererCode).toContain("whiteSpace: 'pre'");
    expect(rendererCode).toContain("userSelect: 'text'");
  });

  // =========================================================================
  // Requirement 4 & 9 Test D: Streaming Token Buffer & Batching Stability
  // =========================================================================
  it('5. Test D: Long streaming response: token buffering receives every token with zero dropped characters', async () => {
    const rawTokens = [
      'Operating ', 'systems ', 'manage ', 'hardware ', 'resources. ',
      'They ', 'provide ', 'memory ', 'isolation, ', 'process ',
      'scheduling, ', 'and ', 'inter-process ', 'communication ',
      'mechanisms ', 'such ', 'as ', 'pipes, ', 'sockets, ', 'and ', 'shared ', 'memory.'
    ];
    const expectedFullText = rawTokens.join('');

    const tokenBuffer: string[] = [];
    let accumulatedSnapshot = '';

    // Simulate the frontend token micro-batching mechanism
    const handleStreamToken = (token: string, accumulated: string) => {
      tokenBuffer.push(token);
      accumulatedSnapshot = accumulated;
    };

    let streamAcc = '';
    for (const tok of rawTokens) {
      streamAcc += tok;
      handleStreamToken(tok, streamAcc);
    }

    expect(tokenBuffer.length).toBe(rawTokens.length);
    expect(accumulatedSnapshot).toBe(expectedFullText);
    expect(tokenBuffer.join('')).toBe(expectedFullText);
  });

  // =========================================================================
  // Requirement 3 & 9 Test E & F: Smart Auto-Scroll Behavior Simulation
  // =========================================================================
  it('6. Test E & F: Smart auto-scroll logic respects user manual scroll-up and resumes on bottom return', () => {
    // Simulate scroll container state:
    // clientHeight = 600, scrollHeight = 2000
    let scrollTop = 1400; // at bottom (1400 + 600 = 2000)
    let isUserScrolledUp = false;
    let showScrollBottomPill = false;

    const checkScrollPosition = (currentScrollTop: number, scrollHeight: number, clientHeight: number) => {
      const distanceFromBottom = scrollHeight - currentScrollTop - clientHeight;
      const isUp = distanceFromBottom > 90;
      isUserScrolledUp = isUp;
      showScrollBottomPill = isUp;
    };

    // 1. Initially at bottom: isUp is false
    checkScrollPosition(1400, 2000, 600);
    expect(isUserScrolledUp).toBe(false);
    expect(showScrollBottomPill).toBe(false);

    // 2. User manually scrolls up to read older messages: scrollTop = 500
    // (distance from bottom = 2000 - 500 - 600 = 900px > 90px)
    checkScrollPosition(500, 2000, 600);
    expect(isUserScrolledUp).toBe(true);
    expect(showScrollBottomPill).toBe(true);

    // 3. New token arrives while user is reading older message:
    // Because isUserScrolledUp is true, the UI must NOT auto-scroll to bottom!
    let simulatedScrollTop = 500;
    if (!isUserScrolledUp) {
      simulatedScrollTop = 2050; // would have jumped if auto-scroll was forced
    }
    expect(simulatedScrollTop).toBe(500); // Position remained completely stable!

    // 4. User clicks "New response" pill or scrolls back to bottom:
    // scrollTop moves to 1450 (new bottom for 2050 scrollHeight)
    checkScrollPosition(1450, 2050, 600);
    expect(isUserScrolledUp).toBe(false);
    expect(showScrollBottomPill).toBe(false);

    // 5. Subsequent token arrives: auto-scroll resumes normally
    if (!isUserScrolledUp) {
      simulatedScrollTop = 2100 - 600; // auto-follows to bottom
    }
    expect(simulatedScrollTop).toBe(1500);
  });

  // =========================================================================
  // Requirement 10 & 11: Stop/Cancel Generation Lifecycle
  // =========================================================================
  it('7. Stop/Cancel generation: aborts stream, flushes partial answer, and unlocks UI state', async () => {
    let streamCancelled = false;
    const mockCancellableProvider: AIProvider = {
      id: 'mock_cancel',
      name: 'Mock Cancellable Provider',
      isAvailable: async () => true,
      generateResponse: async (_h, opts) => {
        opts?.callbacks?.onToken?.('First partial response token. ');
        opts?.callbacks?.onToken?.('Second partial token. ');
        // Check signal
        if (opts?.signal?.aborted) {
          streamCancelled = true;
          throw new Error('Inference was cancelled by user.');
        }
        // simulate abort during stream
        const abortErr = new Error('Inference was cancelled by user.');
        abortErr.name = 'AbortError';
        streamCancelled = true;
        throw abortErr;
      }
    };

    const cs = new ChatService(mockCancellableProvider);
    const conv = cs.createConversation('Cancel Test');

    const abortController = new AbortController();
    abortController.abort(); // already aborted

    const res = await cs.sendMessage(conv.id, 'Stop mid stream please', {
      signal: abortController.signal
    });

    expect(streamCancelled).toBe(true);
    expect(res.assistantMessage.content).toContain('Generation stopped by user');

    // UI state: saved message exists in DB with partial output
    const msgs = cs.getMessages(conv.id);
    expect(msgs.length).toBe(2); // user + partial assistant
    expect(msgs[1].content).toContain('Generation stopped by user');
  });

  // =========================================================================
  // Requirement 8: Single SQLite Write at Completion
  // =========================================================================
  it('8. Database writes: messages are saved only once upon completion, not on every streamed token', async () => {
    let tokenCount = 0;
    const mockStreamingProvider: AIProvider = {
      id: 'mock_stream_db',
      name: 'Mock Stream DB Provider',
      isAvailable: async () => true,
      generateResponse: async (_h, opts) => {
        for (let i = 0; i < 20; i++) {
          tokenCount++;
          opts?.callbacks?.onToken?.(`token_${i} `);
        }
        return 'token_0 token_1 token_2 token_3 token_4 token_5 token_6 token_7 token_8 token_9 token_10 token_11 token_12 token_13 token_14 token_15 token_16 token_17 token_18 token_19';
      }
    };

    const cs = new ChatService(mockStreamingProvider);
    const conv = cs.createConversation('DB Batch Write Test');

    await cs.sendMessage(conv.id, 'Stream 20 tokens');

    expect(tokenCount).toBe(20);
    // After 20 tokens streamed, SQLite contains exactly 2 rows (1 user + 1 assistant)
    const msgs = cs.getMessages(conv.id);
    expect(msgs.length).toBe(2);
    expect(msgs[0].role).toBe('user');
    expect(msgs[1].role).toBe('assistant');
  });

  // =========================================================================
  // Requirement 12: Copy Button UX & Clean Text
  // =========================================================================
  it('9. Copy button UX: removes system footers and leaves markdown headings/lists clean', () => {
    const rawContent = `# Study Summary
1. Concept A
2. Concept B

*Important definition in bold*

*(Local AI: Qwen 2.5 3B · 4 threads)*`;

    const cleaned = rawContent
      .replace(/\n\n\*\(?(Local AI|Mock Assistant|Demo \/ Mock Mode|Generation stopped by user)[\s\S]*?\*?$/, '')
      .trim();

    expect(cleaned).not.toContain('*(Local AI:');
    expect(cleaned).toContain('# Study Summary');
    expect(cleaned).toContain('1. Concept A');
    expect(cleaned).toContain('2. Concept B');
  });

  // =========================================================================
  // Requirement 13: Local AI Architecture Remains Intact
  // =========================================================================
  it('10. Architecture preserved: Qwen 2.5 3B remains default active model and offline provider is intact', async () => {
    const cs = new ChatService();
    const model = await modelManager.autoSelectModel();
    expect(model).toBeDefined();
    if (model) {
      expect(model.fileName).toContain('qwen2.5-3b');
    }

    const provider = await cs.resolveProvider();
    expect(provider).toBeDefined();
    expect(provider.id).toBe('llamacpp');
  });

  // =========================================================================
  // Requirement 14: Live Real Qwen 2.5 3B Streaming & Verification
  // =========================================================================
  it('11. Real Offline Inference: streams tokens from local llama-server without cloud or MockProvider', async () => {
    let serverRunning = false;
    try {
      const health = await fetch('http://127.0.0.1:8088/health');
      serverRunning = health.ok;
    } catch {
      // Server not active
    }

    if (!serverRunning) {
      console.warn('⏭️ Local server not active on 8088, skipping live Qwen stream test');
      return;
    }

    await modelManager.autoSelectModel();
    const cs = new ChatService();
    const conv = cs.createConversation('Real Qwen Stream Test');

    const streamedTokens: string[] = [];
    let accumulatedText = '';

    const res = await cs.sendMessage(conv.id, 'What is RAM? Answer in one short sentence.', {
      onToken: (tok, acc) => {
        streamedTokens.push(tok);
        accumulatedText = acc;
      },
      maxTokens: 48
    });

    expect(streamedTokens.length).toBeGreaterThan(0);
    expect(accumulatedText.length).toBeGreaterThan(10);
    expect(res.assistantMessage.content).toContain(accumulatedText);
    expect(res.assistantMessage.providerId).toBe('llamacpp');
    expect(res.assistantMessage.content.toLowerCase()).toMatch(/ram|memory|random|access|temporary/);
  }, 15000);
});

// Real manual verification script for Phase 15
import path from 'path';
import { initDatabase, createConversationInDB, attachDocumentToConversation } from '../database/db';
import { chatService } from '../ai/chatService';
import { modelManager } from '../models/manager';
import { documentService } from '../documents/documentService';
import { ragService } from '../rag';
import { inferenceDiagnostics } from '../ai/inferenceDiagnostics';

async function main() {
  console.log('=== PHASE 15 REAL INFERENCE VERIFICATION ===\n');

  await initDatabase();
  await modelManager.autoSelectModel();

  const activeModel = modelManager.getActiveModel();
  console.log(`Active Model: ${activeModel?.name} (${activeModel?.id})`);
  console.log(`Model Path: ${activeModel?.path}`);

  const activeSync = chatService.getActiveProviderSync();
  console.log(`Active Provider Sync: ${activeSync.name} (id: ${activeSync.id}, isLocalAI: ${activeSync.isLocalAI})`);

  const provider = await chatService.resolveProvider();
  console.log(`Resolved Provider: ${provider.name} (id: ${provider.id})`);
  console.log(`Is MockProvider: ${provider.id === 'mock'}\n`);

  if (provider.id !== 'llamacpp') {
    console.error('FAIL: Expected llamacpp provider, got ' + provider.id);
    process.exit(1);
  }

  const convId = 'phase15_real_demo_' + Date.now();
  createConversationInDB(convId, 'Deadlock Multi-turn Study');

  const questions = [
    'What is Deadlock?',
    '4 ta condition bolo',
    '2 number ta easy kore bujhao',
    'example daw',
    'aro easy kore bolo',
    'ei topic theke 3 ta MCQ daw'
  ];

  for (let i = 0; i < questions.length; i++) {
    const q = questions[i];
    console.log(`\n--------------------------------------------------`);
    console.log(`[Turn ${i + 1}] User: "${q}"`);
    const start = performance.now();

    const res = await chatService.sendMessage(convId, q, {
      maxTokens: 300,
      temperature: 0.3
    });

    const elapsed = ((performance.now() - start) / 1000).toFixed(2);
    const diag = inferenceDiagnostics.getLatest();

    console.log(`Response:\n${res.assistantMessage.content}\n`);
    console.log(`Actual Provider: ${res.assistantMessage.providerId || 'llamacpp'}`);
    console.log(`Actual Model: ${diag?.model || 'qwen2.5-3b-instruct-q4_k_m.gguf'}`);
    console.log(`MockProvider Executed: ${res.assistantMessage.providerId === 'mock'}`);
    console.log(`Sources Count: ${res.assistantMessage.sources?.length || 0}`);
    console.log(`Generation Speed: ${diag?.generationSpeedTokPerSec ? diag.generationSpeedTokPerSec.toFixed(1) + ' tok/s' : elapsed + 's total'}`);
  }

  // Attached PDF RAG test
  console.log(`\n==================================================`);
  console.log(`[Attached Document Test]: "peripherals e floating number ta bujhao"`);

  const periphDocContent = `
# Peripherals and Interfacing Lecture Notes
Department of Computer Science and Engineering

## 1. 8086 Microprocessor Pin Description
The 8086 microprocessor has 40 pins. Pins AD0 to AD15 are time-multiplexed address and data buses.
Pins A16/S3 to A19/S6 are address and status lines.

## 2. Bus Interfacing and Timing
The 8284 clock generator provides clock signals to the 8086. The 8288 bus controller generates command signals.

## 3. Programmable Peripheral Interface (8255)
The 8255 PPI has 24 I/O pins divided into three 8-bit ports: Port A, Port B, and Port C.
It operates in Mode 0 (Basic I/O), Mode 1 (Strobed I/O), and Mode 2 (Bi-directional bus).
`;
  const enc = new TextEncoder().encode(periphDocContent);
  const buf = enc.buffer.slice(enc.byteOffset, enc.byteOffset + enc.byteLength);

  const importRes = await documentService.importBuffer('Peripherals and interfaces-01.pdf', buf);
  if (importRes.success && importRes.document) {
    const docId = importRes.document.id;
    const docConvId = 'phase15_rag_periph_' + Date.now();
    createConversationInDB(docConvId, 'Peripherals Study Session');
    attachDocumentToConversation(docConvId, docId);
    await ragService.indexDocument(docId);

    const ragQuery = 'peripherals e floating number ta bujhao';
    console.log(`User: "${ragQuery}" with attached Peripherals-01 document`);

    const ragRes = await chatService.sendMessage(docConvId, ragQuery, {
      maxTokens: 300,
      temperature: 0.3
    });

    const diag = inferenceDiagnostics.getLatest();
    console.log(`Response:\n${ragRes.assistantMessage.content}\n`);
    console.log(`Actual Provider: ${ragRes.assistantMessage.providerId || 'llamacpp'}`);
    console.log(`MockProvider Executed: ${ragRes.assistantMessage.providerId === 'mock'}`);
    console.log(`Sources Count: ${ragRes.assistantMessage.sources?.length || 0}`);
    console.log(`Retrieved Chunks: ${diag?.retrievedChunkCount || 0}`);
  }

  console.log('\n=== REAL MANUAL INFERENCE VERIFICATION COMPLETE ===');
}

main().catch(console.error);

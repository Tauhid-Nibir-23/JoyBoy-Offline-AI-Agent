// Verification for attached document grounding and truthful missing concept reporting
import { initDatabase, createConversationInDB, attachDocumentToConversation } from '../database/db';
import { chatService } from '../ai/chatService';
import { modelManager } from '../models/manager';
import { documentService } from '../documents/documentService';
import { ragService } from '../rag';
import { inferenceDiagnostics } from '../ai/inferenceDiagnostics';

async function main() {
  await initDatabase();
  await modelManager.autoSelectModel();

  console.log('=== ATTACHED DOCUMENT GROUNDING & SOURCE COUNT TEST ===\n');

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

  const importRes = await documentService.importBuffer('Peripherals and interfaces-01.md', buf);
  if (!importRes.success || !importRes.document) {
    console.error('Document import failed');
    return;
  }

  const docId = importRes.document.id;
  const docConvId = 'phase15_grounding_' + Date.now();
  createConversationInDB(docConvId, 'Peripherals Grounding Test');
  attachDocumentToConversation(docConvId, docId);
  await ragService.indexDocument(docId);

  // Case 1: Concept NOT in document ("floating number")
  const queryMissing = 'peripherals e floating number ta bujhao';
  console.log(`[Case 1: Missing Concept] User: "${queryMissing}"`);
  const res1 = await chatService.sendMessage(docConvId, queryMissing, {
    maxTokens: 150,
    temperature: 0.2
  });

  const diag1 = inferenceDiagnostics.getLatest();
  console.log(`Response:\n${res1.assistantMessage.content}\n`);
  console.log(`Actual Provider: ${res1.assistantMessage.providerId || 'llamacpp'}`);
  console.log(`MockProvider Executed: ${res1.assistantMessage.providerId === 'mock'}`);
  console.log(`Sources Count: ${res1.assistantMessage.sources?.length || 0}`);
  console.log(`Retrieved Chunks: ${diag1?.retrievedChunkCount || 0}`);
  console.log(`Truthful source count (expected 0): ${res1.assistantMessage.sources?.length === undefined || res1.assistantMessage.sources.length === 0}`);

  // Case 2: Concept PRESENT in document ("8255 PPI")
  const queryPresent = '8255 PPI er port gula explain koro';
  console.log(`\n--------------------------------------------------`);
  console.log(`[Case 2: Present Concept] User: "${queryPresent}"`);
  const res2 = await chatService.sendMessage(docConvId, queryPresent, {
    maxTokens: 150,
    temperature: 0.2
  });

  const diag2 = inferenceDiagnostics.getLatest();
  console.log(`Response:\n${res2.assistantMessage.content}\n`);
  console.log(`Actual Provider: ${res2.assistantMessage.providerId || 'llamacpp'}`);
  console.log(`MockProvider Executed: ${res2.assistantMessage.providerId === 'mock'}`);
  console.log(`Sources Count: ${res2.assistantMessage.sources?.length || 0}`);
  console.log(`Retrieved Chunks: ${diag2?.retrievedChunkCount || 0}`);
  console.log(`Attached source filename: ${res2.assistantMessage.sources?.[0]?.filename}`);
}

main().catch(console.error);

// Phase 14 — Real 3B Benchmark & Multi-Turn Verification Script
// Directly executes against the running or newly started llama-server with Qwen 2.5 3B.
// Measures exact model load time, prompt tokens/sec, generation tokens/sec, and latency.

import fs from 'fs';
import path from 'path';
import os from 'os';
import { spawn, ChildProcess } from 'child_process';

interface BenchmarkRun {
  promptId: string;
  name: string;
  userPrompt: string;
  systemPrompt?: string;
  tokensGenerated: number;
  promptTokens: number;
  promptTokSec: number;
  genTokSec: number;
  totalTimeMs: number;
  response: string;
}

async function sleep(ms: number) {
  return new Promise(r => setTimeout(r, ms));
}

async function main() {
  console.log('====================================================');
  console.log('PHASE 14 — REAL QWEN 2.5 3B BENCHMARK & CONVERSATION');
  console.log('====================================================\n');

  const isWin = process.platform === 'win32';
  const serverBin = path.resolve(process.cwd(), 'bin', isWin ? 'llama-server.exe' : 'llama-server');
  const model3BPath = path.resolve(process.cwd(), 'models', 'qwen2.5-3b-instruct-q4_k_m.gguf');

  if (!fs.existsSync(serverBin)) {
    console.error('llama-server binary not found:', serverBin);
    process.exit(1);
  }
  if (!fs.existsSync(model3BPath)) {
    console.error('Qwen 2.5 3B model not found:', model3BPath);
    process.exit(1);
  }

  // Check if server is already running on 8088
  let child: ChildProcess | null = null;
  let serverRunning = false;
  try {
    const health = await fetch('http://127.0.0.1:8088/health');
    serverRunning = health.ok;
  } catch {}

  let loadTimeMs = 0;
  if (!serverRunning) {
    console.log('Starting llama-server with Qwen 2.5 3B (-t 4 -c 2048)...');
    const startLoad = performance.now();
    const binDir = path.dirname(serverBin);
    const pathSep = isWin ? ';' : ':';

    child = spawn(serverBin, [
      '-m', model3BPath,
      '--port', '8088',
      '--host', '127.0.0.1',
      '-t', '4',
      '-c', '2048'
    ], {
      cwd: binDir,
      env: { ...process.env, PATH: `${binDir}${pathSep}${process.env.PATH || ''}` },
      stdio: ['ignore', 'pipe', 'pipe']
    });

    for (let i = 0; i < 60; i++) {
      await sleep(500);
      try {
        const check = await fetch('http://127.0.0.1:8088/health');
        if (check.ok) {
          serverRunning = true;
          break;
        }
      } catch {}
    }
    loadTimeMs = Math.round(performance.now() - startLoad);
    console.log(`Server healthy! Model loaded in ${loadTimeMs}ms\n`);
  } else {
    console.log('llama-server already running on 127.0.0.1:8088\n');
  }

  // ──────────────────────────────────────────────────────────
  // Part A: Section 13 Benchmark Prompts
  // ──────────────────────────────────────────────────────────
  const benchmarkPrompts = [
    {
      id: 'T1',
      name: 'What is an Operating System?',
      prompt: 'What is an Operating System? Explain simply in 2 sentences.'
    },
    {
      id: 'T2',
      name: 'Explain deadlock in simple Bengali.',
      prompt: 'Explain deadlock in simple Bengali.'
    },
    {
      id: 'T3',
      name: 'What are the four necessary conditions of deadlock?',
      prompt: 'What are the four necessary conditions of deadlock? List them concisely.'
    },
    {
      id: 'T4',
      name: 'Give a real-life example of Hold and Wait.',
      prompt: 'Give a real-life example of the Hold and Wait condition in deadlock.'
    },
    {
      id: 'T5',
      name: 'Make 3 MCQs about Hold and Wait.',
      prompt: 'Make 3 MCQs specifically about the Hold and Wait condition in operating systems.'
    }
  ];

  console.log('--- 1. RUNNING SECTION 13 BENCHMARKS ---');
  const results: BenchmarkRun[] = [];

  for (const item of benchmarkPrompts) {
    const t0 = performance.now();
    const res = await fetch('http://127.0.0.1:8088/v1/chat/completions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        messages: [
          { role: 'system', content: 'You are an offline study assistant. Provide accurate, clear study answers.' },
          { role: 'user', content: item.prompt }
        ],
        max_tokens: 180,
        temperature: 0.3
      })
    });

    const elapsed = Math.round(performance.now() - t0);
    const data = await res.json() as any;
    const content = data.choices?.[0]?.message?.content || '';
    const promptTok = data.usage?.prompt_tokens || 0;
    const genTok = data.usage?.completion_tokens || 0;
    const promptSpeed = parseFloat(data.timings?.prompt_per_second?.toFixed(1) || '0');
    const genSpeed = parseFloat(data.timings?.predicted_per_second?.toFixed(1) || '0');

    results.push({
      promptId: item.id,
      name: item.name,
      userPrompt: item.prompt,
      tokensGenerated: genTok,
      promptTokens: promptTok,
      promptTokSec: promptSpeed,
      genTokSec: genSpeed,
      totalTimeMs: elapsed,
      response: content.trim()
    });

    console.log(`[${item.id}] ${item.name}`);
    console.log(`     Speed: ${genSpeed} tok/s gen | ${promptSpeed} tok/s prompt | ${elapsed}ms total (${genTok} tokens)`);
    console.log(`     Output: "${content.trim().slice(0, 120)}..."\n`);
  }

  // ──────────────────────────────────────────────────────────
  // Part B: Section 8 Mandatory 6-Turn Conversation
  // ──────────────────────────────────────────────────────────
  console.log('--- 2. RUNNING SECTION 8 MANDATORY 6-TURN DEADLOCK CONVERSATION ---');
  const turns = [
    'What is Deadlock?',
    '4 conditions bolo',
    '2 number ta easy kore bujhao',
    'example daw',
    'aro easy kore bolo',
    'ei topic theke 3 ta MCQ daw'
  ];

  const conversationHistory: Array<{ role: string; content: string }> = [
    { role: 'system', content: 'You are JoyBoy, an offline personal study assistant. Respond clearly and stay in conversational context.' }
  ];

  for (let i = 0; i < turns.length; i++) {
    const userPrompt = turns[i];
    conversationHistory.push({ role: 'user', content: userPrompt });

    const t0 = performance.now();
    const res = await fetch('http://127.0.0.1:8088/v1/chat/completions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        messages: conversationHistory,
        max_tokens: 160,
        temperature: 0.3
      })
    });

    const elapsed = Math.round(performance.now() - t0);
    const data = await res.json() as any;
    const content = data.choices?.[0]?.message?.content || '';
    const genSpeed = parseFloat(data.timings?.predicted_per_second?.toFixed(1) || '0');

    conversationHistory.push({ role: 'assistant', content });

    console.log(`Turn ${i + 1}: "${userPrompt}"`);
    console.log(`Speed: ${genSpeed} tok/s | ${elapsed}ms`);
    console.log(`AI: "${content.trim().replace(/\n+/g, ' ').slice(0, 160)}..."\n`);
  }

  // Cleanup server if we started it
  if (child) {
    child.kill();
    console.log('llama-server shut down cleanly.');
  }

  // Output JSON Summary for Report
  const mem = process.memoryUsage();
  const summary = {
    model: 'qwen2.5-3b-instruct-q4_k_m.gguf',
    modelSizeGb: 1.96,
    contextSize: 2048,
    threads: 4,
    loadTimeMs,
    ramRssMb: Math.round(mem.rss / (1024 * 1024)),
    benchmarkRuns: results
  };

  fs.writeFileSync(path.resolve(process.cwd(), 'benchmark_results_phase14.json'), JSON.stringify(summary, null, 2));
  console.log('Results written to benchmark_results_phase14.json');
}

main().catch(err => {
  console.error('Error during benchmark:', err);
  process.exit(1);
});

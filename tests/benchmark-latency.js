'use strict';

/**
 * Benchmark 3-Question Odia and English Quizzes
 * Measures TTFT, generation time, tokens/sec, prompt length, retries, parse, validation, and total latency.
 */

const assert = require('assert');

async function login() {
  const loginRes = await fetch('http://localhost:3000/auth/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ pin: '1234', studentName: 'Rohan' })
  });
  assert(loginRes.ok, `Login failed: ${loginRes.status}`);
  return loginRes.headers.get('set-cookie');
}

async function runQuiz(cookie, { topic, language, level = 'beginner', numQuestions = 3 }) {
  console.log(`\n======================================================`);
  console.log(`BENCHMARKING: topic="${topic}", lang="${language}", qCount=${numQuestions}`);
  console.log(`======================================================`);

  const start = Date.now();
  const res = await fetch('http://localhost:3000/quiz', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Cookie': cookie
    },
    body: JSON.stringify({ topic, level, numQuestions, language })
  });

  const wallClockMs = Date.now() - start;
  assert(res.ok, `Request failed with status ${res.status}`);
  const data = await res.json();

  console.log(`HTTP Status: ${res.status}`);
  console.log(`Generated Questions: ${data.questions?.length}`);
  console.log(`Telemetry Report:`);
  console.log(JSON.stringify(data.telemetry, null, 2));

  assert(Array.isArray(data.questions), 'Expected questions array');
  assert.strictEqual(data.questions.length, numQuestions, `Expected ${numQuestions} questions, got ${data.questions.length}`);

  data.questions.forEach((q, idx) => {
    console.log(`\n  Q${idx + 1}: ${q.question}`);
    console.log(`    Options: ${q.options.join(' | ')}`);
    console.log(`    Answer: ${q.answer}`);
    console.log(`    Explanation: ${q.explanation}`);
  });

  return {
    wallClockMs,
    questionsCount: data.questions.length,
    telemetry: data.telemetry
  };
}

async function main() {
  const cookie = await login();

  // 1. Benchmark 3-question Odia Quiz
  const odiaResult = await runQuiz(cookie, {
    topic: 'ଆଲୋକ ସଂଶ୍ଳେଷଣ',
    language: 'Odia',
    level: 'beginner',
    numQuestions: 3
  });

  // 2. Benchmark 3-question English Quiz
  const englishResult = await runQuiz(cookie, {
    topic: "Newton's Laws of Motion",
    language: 'English',
    level: 'intermediate',
    numQuestions: 3
  });

  console.log(`\n======================================================`);
  console.log(`FINAL BENCHMARK SUMMARY`);
  console.log(`======================================================`);
  console.log(`Odia 3-Question Quiz:`);
  console.log(`  Total Wall-Clock:   ${(odiaResult.wallClockMs / 1000).toFixed(2)}s (${odiaResult.telemetry.totalMs} ms)`);
  console.log(`  Model Latency:      ${(odiaResult.telemetry.modelLatencyMs / 1000).toFixed(2)}s`);
  console.log(`  TTFT (Prompt Eval): ${odiaResult.telemetry.ttftMs} ms`);
  console.log(`  Generation Time:    ${(odiaResult.telemetry.generationMs / 1000).toFixed(2)}s`);
  console.log(`  Prompt Length:      ${odiaResult.telemetry.promptLength} chars (${odiaResult.telemetry.promptTokens} tokens)`);
  console.log(`  Output Tokens:      ${odiaResult.telemetry.outputTokens} tokens`);
  console.log(`  Tokens / Second:    ${odiaResult.telemetry.tokensPerSec} tps`);
  console.log(`  Retries:            ${odiaResult.telemetry.retries}`);
  console.log(`  Parse Time:         ${odiaResult.telemetry.parseTimeMs} ms`);
  console.log(`  Validation Time:    ${odiaResult.telemetry.validationTimeMs} ms`);

  console.log(`\nEnglish 3-Question Quiz:`);
  console.log(`  Total Wall-Clock:   ${(englishResult.wallClockMs / 1000).toFixed(2)}s (${englishResult.telemetry.totalMs} ms)`);
  console.log(`  Model Latency:      ${(englishResult.telemetry.modelLatencyMs / 1000).toFixed(2)}s`);
  console.log(`  TTFT (Prompt Eval): ${englishResult.telemetry.ttftMs} ms`);
  console.log(`  Generation Time:    ${(englishResult.telemetry.generationMs / 1000).toFixed(2)}s`);
  console.log(`  Prompt Length:      ${englishResult.telemetry.promptLength} chars (${englishResult.telemetry.promptTokens} tokens)`);
  console.log(`  Output Tokens:      ${englishResult.telemetry.outputTokens} tokens`);
  console.log(`  Tokens / Second:    ${englishResult.telemetry.tokensPerSec} tps`);
  console.log(`  Retries:            ${englishResult.telemetry.retries}`);
  console.log(`  Parse Time:         ${englishResult.telemetry.parseTimeMs} ms`);
  console.log(`  Validation Time:    ${englishResult.telemetry.validationTimeMs} ms`);
}

main().catch(err => {
  console.error('Benchmark failed:', err);
  process.exit(1);
});

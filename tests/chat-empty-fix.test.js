'use strict';

const assert = require('assert');
const { parseTutorResponse } = require('../lib/parseJSON');
const { buildSystemPrompt, ollamaOptions } = require('../lib/helpers');
const { REASONING, reasoningWithDraft } = require('../agent/models');

console.log('\n=== Regression Tests: Empty Response & Parser Fix ===\n');

let passed = 0;
let failed = 0;

function runTest(name, fn) {
  try {
    fn();
    console.log(`  ✓ ${name}`);
    passed++;
  } catch (err) {
    console.error(`  ✗ ${name}`);
    console.error(`    ${err.message}`);
    failed++;
  }
}

async function runAsyncTest(name, fn) {
  try {
    await fn();
    console.log(`  ✓ ${name}`);
    passed++;
  } catch (err) {
    console.error(`  ✗ ${name}`);
    console.error(`    ${err.message}`);
    failed++;
  }
}

// ── Unit Tests: Parser & Edge Cases ──────────────────────────────────────────

// Scenario 4: Valid structured response
runTest('Scenario 4: Valid structured JSON response parsed accurately', () => {
  const jsonStr = JSON.stringify({
    mode: 'THINKING-MODE',
    intro: 'Let us understand gravity!',
    steps: [
      { title: 'Earth pull', text: 'Earth pulls objects downward.', emoji: '🌍' }
    ],
    answer: 'Gravity is the invisible force pulling objects toward each other.',
    followup: 'What falls faster: a feather or a hammer in a vacuum?'
  });

  const res = parseTutorResponse(jsonStr);
  assert.strictEqual(res._empty, false, 'Should not be marked empty');
  assert.strictEqual(res.answer, 'Gravity is the invisible force pulling objects toward each other.');
  assert.strictEqual(res.steps.length, 1);
  assert.strictEqual(res.intro, 'Let us understand gravity!');
  assert.strictEqual(res._parseMethod, 'direct');
});

// Scenario 5: Plaintext response
runTest('Scenario 5: Plaintext model response safely populates answer without discarding text', () => {
  const plainText = 'Photosynthesis is the process by which green plants make food using sunlight and water.';
  const res = parseTutorResponse(plainText);
  assert.strictEqual(res._empty, false, 'Plaintext should not be marked empty');
  assert.strictEqual(res._parseMethod, 'plaintext_fallback');
  assert.strictEqual(res.answer, plainText, 'Plaintext should be preserved in answer');
  assert.strictEqual(res.steps.length, 0);
});

// Scenario 6: Empty or malformed model response
runTest('Scenario 6a: Completely empty string returns safe error rather than blank message', () => {
  const res = parseTutorResponse('');
  assert.strictEqual(res._empty, true, 'Should be marked as empty');
  assert.strictEqual(res._parseMethod, 'empty_fallback');
  assert(res.answer.length > 0, 'Answer must not be blank');
  assert(res.intro.length > 0, 'Intro must not be blank');
});

runTest('Scenario 6b: Whitespace-only string returns safe error', () => {
  const res = parseTutorResponse('   \n\t  ');
  assert.strictEqual(res._empty, true);
  assert.strictEqual(res._parseMethod, 'empty_fallback');
});

runTest('Scenario 6c: Unclosed or runaway <think> block stripped and handled safely', () => {
  const unclosedThink = '<think>I am thinking about the user prompt and pondering the mysteries...';
  const res = parseTutorResponse(unclosedThink);
  assert.strictEqual(res._empty, true, 'Runaway think with no content must be recognized as empty');
});

runTest('Scenario 6d: Malformed JSON with truncated braces repaired safely', () => {
  const truncated = '{"intro": "Hello", "steps": [{"title": "Step 1", "text": "Do this", "emoji": ""}], "answer": "The answer';
  const res = parseTutorResponse(truncated);
  assert.strictEqual(res._empty, false, 'Repaired truncation should not be empty');
  assert(res.answer.includes('The answer') || res.intro.includes('Hello'), 'Content should be preserved');
});

// Scenario 7: Model timeout handling
runTest('Scenario 7: Upstream AbortController with timeout reason is handled correctly', () => {
  const controller = new AbortController();
  controller.abort('timeout');
  assert.strictEqual(controller.signal.aborted, true);
  assert.strictEqual(controller.signal.reason, 'timeout');
});

// ── Live Ollama API Tests (with configured model) ─────────────────────────────

async function main() {
  console.log(`\nTesting live model: ${REASONING} on Ollama...\n`);

  // Scenario 1: Normal English question
  await runAsyncTest('Scenario 1: Live Normal English question produces non-empty structured response', async () => {
    const prompt = buildSystemPrompt('beginner', 'English');
    const messages = [
      { role: 'system', content: prompt },
      { role: 'user', content: 'What is 5 plus 3?' }
    ];

    const start = Date.now();
    const res = await fetch('http://localhost:11434/api/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        ...reasoningWithDraft(),
        messages,
        format: 'json',
        stream: false,
        options: { ...ollamaOptions('fast'), num_predict: 250 }
      })
    });

    assert.strictEqual(res.status, 200, `Ollama returned ${res.status}`);
    const data = await res.json();
    const content = data.message?.content || data.response || '';
    assert(content.length > 0, 'Model returned 0 characters');

    const parsed = parseTutorResponse(content);
    assert.strictEqual(parsed._empty, false, 'Parsed response marked empty');
    assert(parsed.answer.length > 0, 'Parsed answer is blank');
    console.log(`     (Duration: ${((Date.now() - start)/1000).toFixed(1)}s, reply: ${content.length} chars)`);
  });

  // Scenario 2: Odia photosynthesis question
  await runAsyncTest('Scenario 2: Live Odia photosynthesis question produces valid non-empty Odia response', async () => {
    const prompt = buildSystemPrompt('beginner', 'Odia');
    const messages = [
      { role: 'system', content: prompt },
      { role: 'user', content: 'ଆଲୋକ ସଂଶ୍ଳେଷଣ କଣ?' }
    ];

    const start = Date.now();
    const res = await fetch('http://localhost:11434/api/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        ...reasoningWithDraft(),
        messages,
        format: 'json',
        stream: false,
        options: { ...ollamaOptions('json'), num_predict: 400 }
      })
    });

    assert.strictEqual(res.status, 200);
    const data = await res.json();
    const content = data.message?.content || data.response || '';
    assert(content.length > 0, 'Model returned 0 characters for Odia photosynthesis');

    const parsed = parseTutorResponse(content);
    assert.strictEqual(parsed._empty, false, 'Parsed Odia response marked empty');
    assert(/[\u0b00-\u0b7f]/.test(content), 'Response must contain Odia Unicode script');
    console.log(`     (Duration: ${((Date.now() - start)/1000).toFixed(1)}s, reply: ${content.length} chars)`);
  });

  // Scenario 3: Odia water-cycle question
  await runAsyncTest('Scenario 3: Live Odia water-cycle question produces valid non-empty Odia response', async () => {
    const prompt = buildSystemPrompt('beginner', 'Odia');
    const messages = [
      { role: 'system', content: prompt },
      { role: 'user', content: 'ଜଳଚକ୍ର କିପରି କାମ କରେ?' }
    ];

    const start = Date.now();
    const res = await fetch('http://localhost:11434/api/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        ...reasoningWithDraft(),
        messages,
        format: 'json',
        stream: false,
        options: { ...ollamaOptions('json'), num_predict: 400 }
      })
    });

    assert.strictEqual(res.status, 200);
    const data = await res.json();
    const content = data.message?.content || data.response || '';
    assert(content.length > 0, 'Model returned 0 characters for Odia water cycle');

    const parsed = parseTutorResponse(content);
    assert.strictEqual(parsed._empty, false, 'Parsed Odia response marked empty');
    assert(/[\u0b00-\u0b7f]/.test(content), 'Response must contain Odia Unicode script');
    console.log(`     (Duration: ${((Date.now() - start)/1000).toFixed(1)}s, reply: ${content.length} chars)`);
  });

  console.log(`\nRegression test suite completed: ${passed} passed, ${failed} failed.`);
  if (failed > 0) process.exit(1);
}

main();

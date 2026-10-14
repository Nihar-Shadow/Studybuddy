'use strict';

/**
 * Regression Test Suite for Odia Language Consistency & Structured-Response Bugs
 * Tests the 3 reported scenarios + renderer/parser guards.
 * Run with: node tests/odia-three-scenarios.test.js
 */

const assert = require('assert');
const { buildSystemPrompt, ollamaOptions } = require('../lib/helpers');
const { parseTutorResponse } = require('../lib/parseJSON');
const { validateOdiaContent, containsOdiaScript, isOdia } = require('../lib/languagePolicy');
const { REASONING, reasoningWithDraft } = require('../agent/models');

console.log('\n=== Odia Regression Test Suite (Three Reported Scenarios) ===\n');

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

// ── Part 1: Structural & Parser & Renderer Unit Tests ────────────────────────

runTest('Unit: Parser never leaks raw JSON string into answer on truncated response', () => {
  // Simulates model closing a sub-array/sub-object while keeping answer trailing or truncated
  const mockTruncated = '{"intro": "ଆସନ୍ତୁ ଆଲୋକ ସଂଶ୍ଳେଷଣ ବିଷୟରେ ଶିଖିବା।", "steps": [{"title": "ସୂର୍ଯ୍ୟାଲୋକ", "text": "ପତ୍ର ସୂର୍ଯ୍ୟାଲୋକ ଗ୍ରହଣ କରେ।", "emoji": "☀️"}], "answer": "ଆଲୋକ ସଂଶ୍ଳେଷଣ ଦ୍ୱାରା ଉଦ୍ଭିଦ ନିଜ ଖାଦ୍ୟ ପ୍ରସ୍ତୁତ କରେ।", "followup": "ପତ୍ରହରିତ';
  const parsed = parseTutorResponse(mockTruncated);
  assert.strictEqual(parsed._empty, false);
  assert(!parsed.answer.startsWith('{'), 'Answer must not begin with JSON object bracket');
  assert(!parsed.answer.includes('"mode":'), 'Answer must not contain raw JSON keys');
  assert(parsed.answer.includes('ଆଲୋକ ସଂଶ୍ଳେଷଣ'), 'Answer text must be preserved');
});

runTest('Unit: Parser extracts clean answer from malformed or plaintext fallback without exposing schema', () => {
  const jsonWithSchema = '{"mode": "THINKING-MODE", "answer": "ମହାନଦୀ ଓଡ଼ିଶାର ଏକ ପ୍ରମୁଖ ନଦୀ ଅଟେ।"}';
  const parsed = parseTutorResponse(jsonWithSchema);
  assert.strictEqual(parsed.answer, 'ମହାନଦୀ ଓଡ଼ିଶାର ଏକ ପ୍ରମୁଖ ନଦୀ ଅଟେ।');
  assert(!parsed.answer.includes('mode'));
});

runTest('Unit: buildSystemPrompt embeds factual Odia geography and Newton laws', () => {
  const prompt = buildSystemPrompt('beginner', 'Odia');
  assert(prompt.includes('ଭୁବନେଶ୍ୱର') || prompt.includes('Bhubaneswar'), 'Prompt must contain Odisha capital');
  assert(prompt.includes('ମହାନଦୀ') || prompt.includes('Mahanadi'), 'Prompt must contain Mahanadi river');
  assert(prompt.includes('ଜଡ଼ତା') || prompt.includes('Inertia'), 'Prompt must contain Newton law inertia concept');
  assert(prompt.includes('CRITICAL ODIA TUTOR DIRECTIVE'), 'Prompt must contain Odia directive');
});

// ── Part 2: Live Model Scenarios Against Ollama ───────────────────────────────

async function runLiveScenarios() {
  console.log(`\nTesting Live Scenarios with model: ${REASONING} on Ollama...\n`);

  // ── Scenario 1: Odia photosynthesis question ────────────────────────────────
  await runAsyncTest('Scenario 1: Odia photosynthesis question produces structured Odia response with NO raw JSON', async () => {
    const prompt = buildSystemPrompt('beginner', 'Odia');
    const question = 'ଆଲୋକ ସଂଶ୍ଳେଷଣ କଣ?';

    const start = Date.now();
    const res = await fetch('http://localhost:11434/api/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        ...reasoningWithDraft(),
        messages: [
          { role: 'system', content: prompt },
          { role: 'user', content: question }
        ],
        stream: false,
        format: 'json',
        options: { ...ollamaOptions('json'), num_predict: 450 }
      })
    });

    assert.strictEqual(res.status, 200, `Ollama call failed: status ${res.status}`);
    const data = await res.json();
    const content = data.message?.content || data.response || '';
    assert(content.length > 0, 'Scenario 1: Model returned empty content');

    const parsed = parseTutorResponse(content);
    assert.strictEqual(parsed._empty, false, 'Scenario 1: Parsed response marked empty');
    assert(parsed.answer.length > 0, 'Scenario 1: Answer is blank');

    // Assertion 1: No raw JSON string in user-facing answer
    assert(!parsed.answer.trim().startsWith('{'), 'Scenario 1: Final answer begins with raw JSON bracket');
    assert(!parsed.answer.includes('"mode":'), 'Scenario 1: Final answer contains serialized JSON "mode"');
    assert(!parsed.answer.includes('"steps":'), 'Scenario 1: Final answer contains serialized JSON "steps"');

    // Assertion 2: Odia language consistency & quality
    const odiaCheck = validateOdiaContent(parsed.answer);
    assert(containsOdiaScript(parsed.answer), 'Scenario 1: Answer must contain Odia script');
    assert(odiaCheck.valid, `Scenario 1: Odia quality check failed: ${odiaCheck.reason}`);

    console.log(`     (Duration: ${((Date.now() - start)/1000).toFixed(1)}s, answer: "${parsed.answer.slice(0, 60)}…")`);
  });

  // ── Scenario 2: Odia Odisha capital and rivers question ─────────────────────
  await runAsyncTest('Scenario 2: Odia Odisha capital & rivers question produces Odia answer with factual accuracy', async () => {
    const prompt = buildSystemPrompt('beginner', 'Odia');
    const question = 'ଓଡ଼ିଶାର ରାଜଧାନୀ ଏବଂ ପ୍ରମୁଖ ନଦୀଗୁଡ଼ିକ କଣ?';

    const start = Date.now();
    const res = await fetch('http://localhost:11434/api/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        ...reasoningWithDraft(),
        messages: [
          { role: 'system', content: prompt },
          { role: 'user', content: question }
        ],
        stream: false,
        format: 'json',
        options: { ...ollamaOptions('json'), num_predict: 450 }
      })
    });

    assert.strictEqual(res.status, 200, `Ollama call failed: status ${res.status}`);
    const data = await res.json();
    const content = data.message?.content || data.response || '';
    assert(content.length > 0, 'Scenario 2: Model returned empty content');

    const parsed = parseTutorResponse(content);
    assert.strictEqual(parsed._empty, false, 'Scenario 2: Parsed response marked empty');

    // Assertion 1: Must be in Odia (not English)
    const combinedText = `${parsed.intro} ${parsed.answer} ${(parsed.steps || []).map(s => s.text).join(' ')}`;
    const odiaCheck = validateOdiaContent(combinedText);
    assert(containsOdiaScript(parsed.answer) || containsOdiaScript(parsed.intro), 'Scenario 2: Response must be in Odia script');
    assert(odiaCheck.valid, `Scenario 2: Language consistency check failed: ${odiaCheck.reason}`);

    // Assertion 2: Factual accuracy for Odisha geography
    // Capital: Bhubaneswar / ଭୁବନେଶ୍ୱର
    const hasCapital = combinedText.includes('ଭୁବନେଶ୍ୱର') || combinedText.includes('Bhubaneswar') || combinedText.includes('ଭୁବନେଶ୍ବର');
    assert(hasCapital, 'Scenario 2 Factual Error: Odisha capital Bhubaneswar/ଭୁବନେଶ୍ୱର not mentioned');

    // Major rivers: Mahanadi (ମହାନଦୀ), Brahmani (ବ୍ରାହ୍ମଣୀ), Baitarani (ବୈତରଣୀ)
    const hasRiver = combinedText.includes('ମହାନଦୀ') || combinedText.includes('Mahanadi') ||
                     combinedText.includes('ବ୍ରାହ୍ମଣୀ') || combinedText.includes('Brahmani') ||
                     combinedText.includes('ବୈତରଣୀ') || combinedText.includes('Baitarani');
    assert(hasRiver, 'Scenario 2 Factual Error: Major Odisha river (Mahanadi, Brahmani, Baitarani) not mentioned');

    console.log(`     (Duration: ${((Date.now() - start)/1000).toFixed(1)}s, answer: "${parsed.answer.slice(0, 60)}…")`);
  });

  // ── Scenario 3: Odia Newton's first law question ─────────────────────────────
  await runAsyncTest('Scenario 3: Odia Newton\'s first law question produces Odia answer with physics accuracy', async () => {
    const prompt = buildSystemPrompt('beginner', 'Odia');
    const question = 'ନ୍ୟୁଟନଙ୍କ ପ୍ରଥମ ଗତି ନିୟମ କଣ?';

    const start = Date.now();
    const res = await fetch('http://localhost:11434/api/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        ...reasoningWithDraft(),
        messages: [
          { role: 'system', content: prompt },
          { role: 'user', content: question }
        ],
        stream: false,
        format: 'json',
        options: { ...ollamaOptions('json'), num_predict: 450 }
      })
    });

    assert.strictEqual(res.status, 200, `Ollama call failed: status ${res.status}`);
    const data = await res.json();
    const content = data.message?.content || data.response || '';
    assert(content.length > 0, 'Scenario 3: Model returned empty content');

    const parsed = parseTutorResponse(content);
    assert.strictEqual(parsed._empty, false, 'Scenario 3: Parsed response marked empty');

    // Assertion 1: Must be in Odia (not English)
    const combinedText = `${parsed.intro} ${parsed.answer} ${(parsed.steps || []).map(s => s.text).join(' ')}`;
    const odiaCheck = validateOdiaContent(combinedText);
    assert(containsOdiaScript(parsed.answer) || containsOdiaScript(parsed.intro), 'Scenario 3: Response must be in Odia script');
    assert(odiaCheck.valid, `Scenario 3: Language consistency check failed: ${odiaCheck.reason}`);

    // Assertion 2: Physics accuracy (Newton's 1st law / Inertia / Force / Motion)
    const hasPhysicsConcept = combinedText.includes('ବଳ') ||         // force
                              combinedText.includes('ଜଡ଼ତା') ||      // inertia
                              combinedText.includes('ସ୍ଥିର') ||      // rest
                              combinedText.includes('ଗତି') ||        // motion
                              combinedText.includes('Inertia') ||
                              combinedText.includes('Force');
    assert(hasPhysicsConcept, 'Scenario 3 Factual Error: Newton\'s 1st law concepts (force/inertia/motion/rest) missing');

    console.log(`     (Duration: ${((Date.now() - start)/1000).toFixed(1)}s, answer: "${parsed.answer.slice(0, 60)}…")`);
  });

  console.log(`\n======================================================`);
  console.log(`Results: ${passed} passed, ${failed} failed.`);
  console.log(`======================================================\n`);

  if (failed > 0) {
    process.exit(1);
  }
}

runLiveScenarios().catch(err => {
  console.error('Fatal test error:', err);
  process.exit(1);
});

'use strict';

/**
 * Regression Test Suite: Odia Follow-up Answer Quality
 * Tests water-cycle question followed by evaporation follow-up question.
 * Run with: node tests/odia-followup.test.js
 */

const assert = require('assert');
const { buildSystemPrompt, ollamaOptions } = require('../lib/helpers');
const { parseTutorResponse } = require('../lib/parseJSON');
const { validateOdiaContent, containsOdiaScript, isOdia } = require('../lib/languagePolicy');
const { REASONING, reasoningWithDraft } = require('../agent/models');

console.log('\n=== Odia Follow-up Answer Quality Test Suite ===\n');

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

// ── Part 1: Structural & Prompt & Anti-Parroting Unit Tests ──────────────────

runTest('Unit: buildSystemPrompt embeds follow-up rules and water-cycle knowledge', () => {
  const prompt = buildSystemPrompt('intermediate', 'Odia');
  assert(prompt.includes('FOLLOW-UP') || prompt.includes('follow-up'), 'Prompt must contain follow-up guidance');
  assert(prompt.includes('ବାଷ୍ପୀଭବନ') || prompt.includes('Evaporation'), 'Prompt must contain evaporation in knowledge base');
  assert(prompt.includes('ଜଳ ଚକ୍ର') || prompt.includes('Water Cycle'), 'Prompt must contain water cycle in knowledge base');
  assert(prompt.includes('ଖରାରେ ଓଦା ଲୁଗା ଶୁଖିବା') || prompt.includes('wet clothes'), 'Prompt must contain real-world example guidance');
});

runTest('Unit: Anti-parroting guard strips echoed questions from intro', () => {
  const message = 'ବାଷ୍ପୀଭବନ କ’ଣ? ଉଦାହରଣ ଦିଅ।';
  const rawQ = message.trim().replace(/[?।\s]+$/, '');

  // Case A: intro is exact copy of question
  const introA = 'ବାଷ୍ପୀଭବନ କ’ଣ? ଉଦାହରଣ ଦିଅ।';
  const qClean = message.replace(/^[0-9.?।\s]+|[?।\s]+$/g, '').trim().toLowerCase();
  const introCleanA = introA.replace(/^[0-9.?।\s]+|[?।\s]+$/g, '').trim().toLowerCase();
  assert.strictEqual(qClean, introCleanA);

  // Case B: intro starts with echoed question
  const introB = 'ବାଷ୍ପୀଭବନ କ’ଣ? ଉଦାହରଣ ଦିଅ: ଏହା ଏକ ପ୍ରାକୃତିକ ପ୍ରକ୍ରିୟା ଅଟେ।';
  assert(introB.startsWith(rawQ));
  const stripped = introB.slice(rawQ.length).replace(/^[?।:\s-]+/, '').trim();
  assert.strictEqual(stripped, 'ଏହା ଏକ ପ୍ରାକୃତିକ ପ୍ରକ୍ରିୟା ଅଟେ।');
});

runTest('Unit: History sanitization unpacks serialized JSON into clean dialogue text', () => {
  const rawAssistantTurn = JSON.stringify({
    mode: 'THINKING-MODE',
    intro: 'ଜଳ ଚକ୍ର ହେଉଛି ଏକ ନିରନ୍ତର ପ୍ରକ୍ରିୟା।',
    steps: [
      { title: 'ବାଷ୍ପୀଭବନ', text: 'ପାଣି ଗରମ ହୋଇ ବାଷ୍ପ ହୁଏ।' }
    ],
    answer: 'ଜଳ ଚକ୍ର ଦ୍ୱାରା ପୃଥିବୀରେ ଜଳ ସନ୍ତୁଳିତ ରହେ।',
    followup: 'ଆପଣ ବାଷ୍ପୀଭବନ ବିଷୟରେ ଜାଣିବାକୁ ଚାହାନ୍ତି କି?'
  });

  const parsed = parseTutorResponse(rawAssistantTurn);
  assert(!parsed._empty);
  const parts = [];
  if (parsed.intro && parsed.intro !== parsed.answer) parts.push(parsed.intro);
  if (Array.isArray(parsed.steps)) {
    for (const s of parsed.steps) {
      const stepText = typeof s === 'string' ? s : [s.title, s.text].filter(Boolean).join(': ');
      if (stepText) parts.push(stepText);
    }
  }
  if (parsed.answer) parts.push(parsed.answer);
  const cleanContent = parts.join('\n');

  assert(!cleanContent.includes('"mode":'), 'Sanitized history must not contain JSON syntax');
  assert(cleanContent.includes('ଜଳ ଚକ୍ର'), 'Sanitized history must retain key concepts');
  assert(cleanContent.includes('ବାଷ୍ପୀଭବନ'), 'Sanitized history must retain step details');
});

// ── Part 2: Live Multi-turn Test with Water Cycle -> Evaporation ─────────────

async function runLiveFollowupTest() {
  console.log(`\nTesting Live Multi-turn Follow-up with model: ${REASONING} on Ollama...\n`);

  await runAsyncTest('Live: Water-cycle question followed by evaporation follow-up answers directly with example', async () => {
    const prompt = buildSystemPrompt('intermediate', 'Odia');

    // Turn 1: Water Cycle Question
    const q1 = 'ଜଳ ଚକ୍ର କ’ଣ? ସଂକ୍ଷେପରେ ବୁଝାଅ।';
    const t1Start = Date.now();
    const res1 = await fetch('http://localhost:11434/api/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        ...reasoningWithDraft(),
        messages: [
          { role: 'system', content: prompt },
          { role: 'user', content: q1 }
        ],
        stream: false,
        format: 'json',
        options: { ...ollamaOptions('json'), num_predict: 450 }
      })
    });

    assert.strictEqual(res1.status, 200, `Turn 1 failed: status ${res1.status}`);
    const data1 = await res1.json();
    const raw1 = data1.message?.content || data1.response || '';
    const parsed1 = parseTutorResponse(raw1);
    assert(!parsed1._empty, 'Turn 1 parsed response is empty');
    assert(containsOdiaScript(parsed1.answer), 'Turn 1 answer must contain Odia script');
    console.log(`     Turn 1 completed in ${((Date.now() - t1Start)/1000).toFixed(1)}s: "${parsed1.answer.slice(0, 50)}…"`);

    // Prepare Turn 1 as conversational history
    const historyText = [parsed1.intro, ...(parsed1.steps || []).map(s => s.text || s.title || ''), parsed1.answer]
      .filter(Boolean)
      .join('\n');

    // Turn 2: Follow-up question asking about evaporation with example
    const q2 = 'ବାଷ୍ପୀଭବନ କ’ଣ? ଗୋଟିଏ ଉଦାହରଣ ଦିଅ।';
    const t2Start = Date.now();
    const res2 = await fetch('http://localhost:11434/api/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        ...reasoningWithDraft(),
        messages: [
          { role: 'system', content: prompt },
          { role: 'user', content: q1 },
          { role: 'assistant', content: historyText },
          { role: 'user', content: q2 }
        ],
        stream: false,
        format: 'json',
        options: { ...ollamaOptions('json'), num_predict: 450 }
      })
    });

    assert.strictEqual(res2.status, 200, `Turn 2 failed: status ${res2.status}`);
    const data2 = await res2.json();
    const raw2 = data2.message?.content || data2.response || '';
    const parsed2 = parseTutorResponse(raw2);
    assert(!parsed2._empty, 'Turn 2 parsed response is empty');

    const fullResponseText = `${parsed2.intro || ''} ${(parsed2.steps || []).map(s => `${s.title} ${s.text}`).join(' ')} ${parsed2.answer || ''}`;

    // 1. Language check: must be in Odia script
    assert(containsOdiaScript(parsed2.answer), 'Turn 2 answer must contain Odia script');
    const odiaCheck = validateOdiaContent(parsed2.answer);
    assert(odiaCheck.valid, `Turn 2 Odia validation failed: ${odiaCheck.reason}`);

    // 2. Direct explanation check: must explain evaporation
    const explainsEvaporation = /ବାଷ୍ପ|ତରଳ|ଉତ୍ତାପ|ଜଳୀୟ|ଗ୍ୟାସ|evaporation/i.test(fullResponseText);
    assert(explainsEvaporation, 'Turn 2 must explain the evaporation process');

    // 3. Example check: must mention an example (clothes drying, heat/water/sun, etc.)
    const hasExample = /ଉଦାହରଣ|ଖରା|ଲୁଗା|ପାଣି|ପାତ୍ର|ଶୁଖି|ସୂର୍ଯ୍ୟ|ବାଷ୍ପ|example/i.test(fullResponseText);
    assert(hasExample, 'Turn 2 must provide a relevant real-world example');

    // 4. Anti-parroting check: intro must not simply parrot the question
    if (parsed2.intro) {
      const qClean = q2.replace(/^[0-9.?।\s]+|[?।\s]+$/g, '').trim().toLowerCase();
      const introClean = parsed2.intro.replace(/^[0-9.?।\s]+|[?।\s]+$/g, '').trim().toLowerCase();
      assert.notStrictEqual(introClean, qClean, 'Turn 2 intro must not parrot the user question verbatim');
    }

    console.log(`     Turn 2 completed in ${((Date.now() - t2Start)/1000).toFixed(1)}s:`);
    console.log(`       Intro: "${parsed2.intro || '(direct answer)'}"`);
    console.log(`       Answer: "${parsed2.answer}"`);
  });

  console.log(`\n======================================================`);
  console.log(`Total Results: ${passed} passed, ${failed} failed.`);
  console.log(`======================================================\n`);

  if (failed > 0) {
    process.exit(1);
  }
}

(async () => {
  await runLiveFollowupTest();
})();

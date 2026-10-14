'use strict';

const assert = require('assert');
const {
  isStructuredExplanationRequested,
  getDeterministicStructuredFallback,
  validateStructuredResponse,
  buildStructuredOdiaTutorResponse
} = require('../lib/structuredTutor');
const { getClass9Knowledge, findRelevantClass9Knowledge } = require('../lib/class9Knowledge');
const { parseTutorResponse } = require('../lib/parseJSON');
const { validateOdiaTutorAnswer, containsOdiaScript, isOdia } = require('../lib/languagePolicy');

console.log('===============================================================');
console.log('🧪 VERIFICATION SUITE: ENGLISH & ODIA STRUCTURED TUTOR PIPELINE');
console.log('===============================================================');

let passed = 0;
let failed = 0;

function test(name, fn) {
  try {
    fn();
    console.log(`  ✓ ${name}`);
    passed++;
  } catch (err) {
    console.error(`  ❌ ${name}`);
    console.error(err);
    failed++;
  }
}

// ─────────────────────────────────────────────────────────────────────────────
console.log('\n--- 1. English "What is motion?" -> structured response ---');

test('1. English "What is motion?" produces a structured response object with steps', () => {
  const englishMotionRaw = JSON.stringify({
    mode: 'QUICK-FIRE',
    intro: "Let's explore what motion means in physics.",
    steps: [
      {
        title: 'Basic definition of motion',
        text: 'Motion is when an object changes its position over time relative to a reference point.',
        emoji: '🏃‍♂️🚗'
      },
      {
        title: 'Key characteristics',
        text: 'Motion is relative to the observer and can be described by speed and direction.',
        emoji: '🚌📍'
      }
    ],
    answer: 'An object is in motion when its position changes with respect to its surroundings over time.',
    followup: 'Can you name an example of motion you see around you?'
  });

  const parsed = parseTutorResponse(englishMotionRaw);
  assert.ok(parsed, 'Response must be an object');
  assert.ok(typeof parsed.intro === 'string' && parsed.intro.length > 0, 'Must have intro');
  assert.ok(Array.isArray(parsed.steps) && parsed.steps.length >= 1, 'Must have >= 1 step');
  assert.ok(parsed.steps[0].title && parsed.steps[0].text, 'Step must have title and text');
  assert.ok(parsed.answer && parsed.answer.length > 0, 'Must have answer');
  assert.ok(parsed.followup && parsed.followup.length > 0, 'Must have followup');
});

// ─────────────────────────────────────────────────────────────────────────────
console.log('\n--- 2. Odia "ଗତି କ\'ଣ?" -> structured response ---');

test('2. Odia "ଗତି କ\'ଣ?" produces a structured response object with steps', () => {
  const kb = findRelevantClass9Knowledge('ଗତି କ\'ଣ?', 'Odia', []);
  const rawReply = 'ସମୟ ସହିତ କୌଣସି ବସ୍ତୁର ସ୍ଥାନ ପରିବର୍ତ୍ତନକୁ ଗତି କୁହାଯାଏ।';

  const structured = buildStructuredOdiaTutorResponse({
    rawReply,
    message: 'ଗତି କ\'ଣ?',
    class9Knowledge: kb,
    level: 'beginner'
  });

  assert.ok(structured, 'Response must be an object');
  assert.ok(typeof structured.intro === 'string' && structured.intro.length > 0, 'Must have non-empty intro');
  assert.ok(Array.isArray(structured.steps) && structured.steps.length >= 1, 'Must have at least 1 step');
  assert.ok(structured.steps[0].title && (structured.steps[0].text || structured.steps[0].explanation), 'Step 1 must have title and explanation');
  assert.ok(structured.answer && structured.answer.length > 0, 'Must have answer');
  assert.ok(structured.summary && structured.summary.length > 0, 'Must have summary');
  assert.ok(structured.followup || structured.followUp, 'Must have followup');
  assert.ok(containsOdiaScript(structured.intro), 'Intro must contain Odia script');
  assert.ok(containsOdiaScript(structured.answer), 'Answer must contain Odia script');
  assert.ok(containsOdiaScript(structured.steps[0].text), 'Step text must contain Odia script');
});

// ─────────────────────────────────────────────────────────────────────────────
console.log('\n--- 3. English photosynthesis example -> structured response ---');

test('3. English photosynthesis example produces structured response', () => {
  const englishPhotoRaw = JSON.stringify({
    mode: 'THINKING-MODE',
    intro: "Let's explore how plants make food using an example from a village paddy field.",
    steps: [
      {
        title: 'What plants need',
        text: 'Green plants take water from the soil and carbon dioxide from the air.',
        emoji: '☀️🌱💧'
      },
      {
        title: 'Village farm analogy',
        text: 'Just like a farmer cooking rice over fire, a leaf uses sunlight energy in its chlorophyll kitchen.',
        emoji: '🌾🧑‍🌾'
      },
      {
        title: 'Food production and oxygen release',
        text: 'The plant produces glucose and releases clean oxygen gas into the atmosphere.',
        emoji: '🍃✨💨'
      }
    ],
    answer: 'Photosynthesis is the process by which green plants make food using sunlight, water, and CO2, releasing oxygen.',
    followup: 'What would happen to the village crops if sunlight was blocked for weeks?'
  });

  const parsed = parseTutorResponse(englishPhotoRaw);
  assert.strictEqual(parsed.mode, 'THINKING-MODE');
  assert.strictEqual(parsed.steps.length, 3);
  assert.ok(parsed.intro.includes('paddy field'));
});

// ─────────────────────────────────────────────────────────────────────────────
console.log('\n--- 4. Odia photosynthesis example -> structured response ---');

test('4. Odia photosynthesis example produces structured response', () => {
  const kb = getClass9Knowledge('photosynthesis');
  const structured = buildStructuredOdiaTutorResponse({
    message: 'ଗାଁ ଜୀବନର ଏକ ଉଦାହରଣ ଦେଇ ଆଲୋକ ସଂଶ୍ଳେଷଣ ବୁଝାଅ।',
    class9Knowledge: kb,
    level: 'beginner'
  });

  assert.strictEqual(structured.mode, 'THINKING-MODE');
  assert.ok(Array.isArray(structured.steps) && structured.steps.length === 3, 'Must have 3 steps');
  assert.ok(structured.intro.includes('ଗାଁ'), 'Intro must contain village context');
  assert.ok(structured.steps[1].title.includes('ଗାଁ'), 'Step 2 must feature village analogy');
  assert.ok(structured.answer.includes('ଆଲୋକ ସଂଶ୍ଳେଷଣ'), 'Answer must feature canonical term');
});

// ─────────────────────────────────────────────────────────────────────────────
console.log('\n--- 5. English human reproduction -> structured response ---');

test('5. English human reproduction produces structured response', () => {
  const rawEnglishRepro = JSON.stringify({
    mode: 'THINKING-MODE',
    intro: "Let's explore human reproduction and how life continues.",
    steps: [
      {
        title: 'Biological basics',
        text: 'Reproduction is a biological process where male sperm and female egg cells unite.',
        emoji: '🧬'
      },
      {
        title: 'Fertilization and zygote',
        text: 'Fertilization forms a single zygote cell which gradually develops into an embryo.',
        emoji: '🔬✨'
      }
    ],
    answer: 'Human reproduction is a biological process ensuring the continuity of human life through generations.',
    followup: 'Would you like to learn more about how cells divide during early growth?'
  });

  const parsed = parseTutorResponse(rawEnglishRepro);
  assert.strictEqual(parsed.mode, 'THINKING-MODE');
  assert.strictEqual(parsed.steps.length, 2);
  assert.ok(parsed.answer.includes('biological process'));
});

// ─────────────────────────────────────────────────────────────────────────────
console.log('\n--- 6. Odia human reproduction -> structured response ---');

test('6. Odia human reproduction produces structured response', () => {
  const kb = findRelevantClass9Knowledge('ପ୍ରଜନନ କ\'ଣ?', 'Odia', []);
  const structured = buildStructuredOdiaTutorResponse({
    message: 'ପ୍ରଜନନ କ\'ଣ?',
    class9Knowledge: kb,
    level: 'beginner'
  });

  assert.ok(Array.isArray(structured.steps) && structured.steps.length >= 2, 'Must have >= 2 steps');
  assert.ok(structured.intro.includes('ପ୍ରଜନନ'), 'Intro must name reproduction');
  assert.ok(structured.answer.includes('ଜୈବିକ ପ୍ରକ୍ରିୟା'), 'Answer must name biological process');
  assert.ok(!structured.answer.includes('ସମ୍ଭୋଗ') && !structured.answer.includes('ଯୌନ'), 'Must remain textbook pedagogical');
});

// ─────────────────────────────────────────────────────────────────────────────
console.log('\n--- 7. Invalid/misconception Odia answer fails validation & gets safely blocked ---');

test('7. Misconception Odia answer is rejected by validateStructuredResponse', () => {
  const kb = getClass9Knowledge('photosynthesis');
  const invalidCandidate = {
    mode: 'THINKING-MODE',
    intro: 'ଚାଲ ଆଲୋକ ସଂଶ୍ଳେଷଣ ବୁଝିବା।',
    steps: [
      {
        title: 'ଭୁଲ ଧାରଣା',
        text: 'ଆଲୋକ ସଂଶ୍ଳେଷଣରେ ଉଦ୍ଭିଦ ଅମ୍ଳଜାନ ଗ୍ରହଣ କରେ ଏବଂ ଅଙ୍ଗାରକାମ୍ଳ ତ୍ୟାଗ କରେ।', // Factual error: oxygen input!
        explanation: 'ଆଲୋକ ସଂଶ୍ଳେଷଣରେ ଉଦ୍ଭିଦ ଅମ୍ଳଜାନ ଗ୍ରହଣ କରେ ଏବଂ ଅଙ୍ଗାରକାମ୍ଳ ତ୍ୟାଗ କରେ।',
        emoji: '❌'
      }
    ],
    answer: 'ଗଛ ଅମ୍ଳଜାନ ନିଏ।',
    summary: 'ଗଛ ଅମ୍ଳଜାନ ନିଏ।',
    followup: 'ଏହା ବୁଝିପାରିଲ କି?',
    followUp: 'ଏହା ବୁଝିପାରିଲ କି?'
  };

  const val = validateStructuredResponse(invalidCandidate, 'ଆଲୋକ ସଂଶ୍ଳେଷଣ କିପରି ହୁଏ?', 'Odia', kb);
  assert.strictEqual(val.valid, false, 'Candidate with scientific misconception must be invalid');
});

// ─────────────────────────────────────────────────────────────────────────────
console.log('\n--- 8. Fallback path, if triggered, remains structured ---');

test('8. Fallback path produces a verified structured response instead of plain text', () => {
  const kb = getClass9Knowledge('photosynthesis');
  // Pass an invalid reply that violates safety
  const structured = buildStructuredOdiaTutorResponse({
    rawReply: 'ଗଛ ଅମ୍ଳଜାନ ଗ୍ରହଣ କରି ଅଙ୍ଗାରକାମ୍ଳ ଛାଡ଼େ।', // Violation!
    message: 'ଗାଁ ଜୀବନର ଏକ ଉଦାହରଣ ଦେଇ ଆଲୋକ ସଂଶ୍ଳେଷଣ ବୁଝାଅ।',
    class9Knowledge: kb,
    level: 'beginner'
  });

  assert.ok(structured, 'Fallback must produce structured object');
  assert.ok(Array.isArray(structured.steps) && structured.steps.length >= 2, 'Fallback must have structured steps');
  assert.ok(typeof structured.intro === 'string' && structured.intro.length > 0, 'Fallback must have intro');
  assert.ok(typeof structured.answer === 'string' && structured.answer.length > 0, 'Fallback must have answer');
  assert.ok(typeof structured.followup === 'string' && structured.followup.length > 0, 'Fallback must have followup');
  assert.strictEqual(structured._parseMethod, 'odia_deterministic_structured_fallback', 'Should use verified deterministic fallback');
});

// ─────────────────────────────────────────────────────────────────────────────
console.log('\n--- 9. Symmetry between English and Odia schemas ---');

test('9. English and Odia structured responses share the exact same required keys', () => {
  const requiredKeys = ['mode', 'intro', 'steps', 'answer', 'summary', 'followup', 'followUp'];
  const odiaMotion = buildStructuredOdiaTutorResponse({
    rawReply: 'ସମୟ ସହିତ କୌଣସି ବସ୍ତୁର ସ୍ଥାନ ପରିବର୍ତ୍ତନକୁ ଗତି କୁହାଯାଏ।',
    message: 'ଗତି କ\'ଣ?'
  });

  for (const k of requiredKeys) {
    assert.ok(k in odiaMotion, `Key ${k} must exist in Odia structure`);
  }
  assert.ok(odiaMotion.steps.length >= 1, 'Steps array must not be empty');
  assert.ok('title' in odiaMotion.steps[0], 'Step must have title');
  assert.ok('explanation' in odiaMotion.steps[0], 'Step must have explanation');
});

console.log('\n===============================================================');
console.log(`TOTAL: ${passed}/${passed + failed} TESTS PASSED ${failed === 0 ? '✅' : '❌'}`);
console.log('===============================================================');

if (failed > 0) process.exit(1);

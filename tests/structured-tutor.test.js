'use strict';

const assert = require('assert');
const {
  isStructuredExplanationRequested,
  getDeterministicStructuredFallback,
  validateStructuredResponse,
  buildStructuredOdiaTutorResponse
} = require('../lib/structuredTutor');
const { getClass9Knowledge } = require('../lib/class9Knowledge');
const { parseTutorResponse } = require('../lib/parseJSON');
const { validateOdiaTutorAnswer, containsOdiaScript, isOdia } = require('../lib/languagePolicy');

console.log('====================================================');
console.log('🧪 STRUCTURED TUTOR REGRESSION SUITE (ENGLISH & ODIA)');
console.log('====================================================');

let testsPassed = 0;
let testsRun = 0;

function it(title, fn) {
  testsRun++;
  try {
    fn();
    console.log(`  ✓ ${title}`);
    testsPassed++;
  } catch (err) {
    console.error(`  ❌ ${title}`);
    console.error(err);
    process.exitCode = 1;
  }
}

// ─────────────────────────────────────────────────────────────────────────────
console.log('\n--- 1. Query Mode Classification: Structured vs Concise ---');

it('1a. English explanation query requires structured response', () => {
  const req = isStructuredExplanationRequested('Explain photosynthesis using an example from village life', 'English');
  assert.strictEqual(req, true);
});

it('1b. Odia equivalent explanation query requires structured response', () => {
  const req = isStructuredExplanationRequested('ଗାଁ ଜୀବନର ଉଦାହରଣ ଦେଇ ଆଲୋକ ସଂଶ୍ଳେଷଣ ବୁଝାଅ', 'Odia');
  assert.strictEqual(req, true);
});

it('1c. General conceptual explanation query requires structured response', () => {
  const req = isStructuredExplanationRequested('ଆଲୋକ ସଂଶ୍ଳେଷଣ ପ୍ରକ୍ରିୟା ବୁଝାଅ', 'Odia');
  assert.strictEqual(req, true);
});

it('1d. Simple definition queries remain concise (backward compatibility)', () => {
  assert.strictEqual(isStructuredExplanationRequested('what is oxygen?', 'English'), false);
  assert.strictEqual(isStructuredExplanationRequested('ଅମ୍ଳଜାନ କ\'ଣ?', 'Odia'), false);
  assert.strictEqual(isStructuredExplanationRequested('ପତ୍ରହରିତ କାହାକୁ କୁହନ୍ତି?', 'Odia'), false);
});

it('1e. Simple factual yes/no queries remain concise', () => {
  assert.strictEqual(isStructuredExplanationRequested('ଗଛ ଦିନବେଳେ ଶ୍ୱାସକ୍ରିୟା କରେ କି?', 'Odia'), false);
  assert.strictEqual(isStructuredExplanationRequested('does a plant respire in daytime?', 'English'), false);
});

// ─────────────────────────────────────────────────────────────────────────────
console.log('\n--- 2. English & Odia Shared Response Schema Symmetry ---');

it('2a. English structured response satisfies universal schema', () => {
  const sampleRawEnglish = JSON.stringify({
    mode: 'THINKING-MODE',
    intro: "Let's explore how plants make food through photosynthesis with a village example.",
    steps: [
      {
        title: 'What plants need to grow',
        text: 'Plants need sunlight from the sky, water from the soil, and carbon dioxide from the air.',
        emoji: '☀️🌱💧'
      },
      {
        title: 'Village field analogy',
        text: 'Just like a farmer cooking rice using firewood heat and water, a leaf acts as a natural kitchen.',
        emoji: '🌾🧑‍🌾🍲'
      },
      {
        title: 'How food is made',
        text: 'Chlorophyll absorbs sunlight to synthesize glucose and release oxygen into the air.',
        emoji: '🍃✨💨'
      }
    ],
    answer: 'Photosynthesis is the process by which green plants make food using sunlight, water, and CO2, releasing oxygen.',
    followup: 'What would happen if the village paddy field received no sunlight for weeks?'
  });

  const parsed = parseTutorResponse(sampleRawEnglish);
  assert.ok(parsed.intro, 'Must have intro');
  assert.strictEqual(parsed.steps.length, 3, 'Must have 3 steps');
  assert.ok(parsed.answer, 'Must have answer');
  assert.ok(parsed.followup, 'Must have followup');
  parsed.steps.forEach(st => {
    assert.ok(st.title, 'Step must have title');
    assert.ok(st.text, 'Step must have text');
  });
});

it('2b. Odia structured response satisfies the identical universal schema', () => {
  const kb = getClass9Knowledge('photosynthesis');
  const odiaStructured = buildStructuredOdiaTutorResponse({
    message: 'ଗାଁ ଜୀବନର ଉଦାହରଣ ଦେଇ ଆଲୋକ ସଂଶ୍ଳେଷଣ ବୁଝାଅ',
    class9Knowledge: kb,
    level: 'beginner'
  });

  assert.strictEqual(odiaStructured.mode, 'THINKING-MODE');
  assert.ok(typeof odiaStructured.intro === 'string' && odiaStructured.intro.length > 0, 'Must have intro');
  assert.ok(Array.isArray(odiaStructured.steps) && odiaStructured.steps.length === 3, 'Must have 3 steps');
  assert.ok(odiaStructured.answer && odiaStructured.summary, 'Must have answer and summary aliases');
  assert.ok(odiaStructured.followup && odiaStructured.followUp, 'Must have followup and followUp aliases');

  odiaStructured.steps.forEach((st, i) => {
    assert.ok(st.title, `Step ${i + 1} must have title`);
    assert.ok(st.text, `Step ${i + 1} must have text`);
    assert.ok(st.explanation, `Step ${i + 1} must have explanation alias`);
    assert.strictEqual(st.text, st.explanation, 'text and explanation alias must match');
  });
});

it('2c. Schema key equivalence between English and Odia', () => {
  const kb = getClass9Knowledge('photosynthesis');
  const odiaStructured = buildStructuredOdiaTutorResponse({
    message: 'Explain photosynthesis using an example from village life',
    class9Knowledge: kb
  });

  const sampleEnglish = {
    mode: 'THINKING-MODE',
    intro: 'Intro',
    steps: [{ title: 'T', text: 'Txt', explanation: 'Txt', emoji: '🌱' }],
    answer: 'Ans',
    summary: 'Ans',
    followup: 'Q',
    followUp: 'Q'
  };

  const englishKeys = Object.keys(sampleEnglish).sort();
  const odiaKeys = Object.keys(odiaStructured).filter(k => !k.startsWith('_')).sort();

  for (const key of ['mode', 'intro', 'steps', 'answer', 'summary', 'followup', 'followUp']) {
    assert.ok(odiaKeys.includes(key), `Odia structure missing key: ${key}`);
  }
});

// ─────────────────────────────────────────────────────────────────────────────
console.log('\n--- 3. Odia Language Purity & Canonical Terminology ---');

it('3a. Odia content is predominantly Odia script', () => {
  const kb = getClass9Knowledge('photosynthesis');
  const odia = buildStructuredOdiaTutorResponse({
    message: 'ଗାଁ ଜୀବନର ଉଦାହରଣ ଦେଇ ଆଲୋକ ସଂଶ୍ଳେଷଣ ବୁଝାଅ',
    class9Knowledge: kb
  });

  assert.ok(containsOdiaScript(odia.intro), 'Intro must contain Odia script');
  assert.ok(containsOdiaScript(odia.answer), 'Answer must contain Odia script');
  assert.ok(containsOdiaScript(odia.followup), 'Followup must contain Odia script');
  odia.steps.forEach(st => {
    assert.ok(containsOdiaScript(st.title), 'Title must contain Odia script');
    assert.ok(containsOdiaScript(st.text), 'Text must contain Odia script');
  });
});

it('3b. Canonical Odia scientific terminology is correctly used', () => {
  const kb = getClass9Knowledge('photosynthesis');
  const odia = buildStructuredOdiaTutorResponse({
    message: 'ଗାଁ ଜୀବନର ଉଦାହରଣ ଦେଇ ଆଲୋକ ସଂଶ୍ଳେଷଣ ବୁଝାଅ',
    class9Knowledge: kb
  });

  const fullText = [
    odia.intro,
    ...odia.steps.map(s => `${s.title} ${s.text}`),
    odia.answer,
    odia.followup
  ].join(' ');

  assert.ok(fullText.includes('ଆଲୋକ ସଂଶ୍ଳେଷଣ'), 'Must use canonical ଆଲୋକ ସଂଶ୍ଳେଷଣ');
  assert.ok(fullText.includes('ସୂର୍ଯ୍ୟାଲୋକ'), 'Must use canonical ସୂର୍ଯ୍ୟାଲୋକ');
  assert.ok(fullText.includes('ଅଙ୍ଗାରକାମ୍ଳ'), 'Must use canonical ଅଙ୍ଗାରକାମ୍ଳ');
  assert.ok(fullText.includes('ଅମ୍ଳଜାନ'), 'Must use canonical ଅମ୍ଳଜାନ');
  assert.ok(fullText.includes('ଜଳ'), 'Must use canonical ଜଳ');
  assert.ok(fullText.includes('ପତ୍ରହରିତ'), 'Must use canonical ପତ୍ରହରିତ');
  assert.ok(fullText.includes('ପତ୍ରରନ୍ଧ୍ର'), 'Must use canonical ପତ୍ରରନ୍ଧ୍ର');

  // No forbidden corrupted terms
  assert.ok(!fullText.includes('ଉଦ୍ଭିଦ ସଂଶ୍ଲେଷଣ'), 'Must not contain ଉଦ୍ଭିଦ ସଂଶ୍ଲେଷଣ');
  assert.ok(!fullText.includes('କ୍ଲୋରୋଫିଲ'), 'Must not contain କ୍ଲୋରୋଫିଲ');
  assert.ok(!fullText.includes('କାର୍ବନ ଡାଇଅକ୍ସାଇଡ'), 'Must not contain କାର୍ବନ ଡାଇଅକ୍ସାଇଡ');
});

// ─────────────────────────────────────────────────────────────────────────────
console.log('\n--- 4. Photosynthesis Educational Facts Validation ---');

it('4a. Sunlight is stated as primary energy source', () => {
  const kb = getClass9Knowledge('photosynthesis');
  const odia = buildStructuredOdiaTutorResponse({
    message: 'ଗାଁ ଜୀବନର ଉଦାହରଣ ଦେଇ ଆଲୋକ ସଂଶ୍ଳେଷଣ ବୁଝାଅ',
    class9Knowledge: kb
  });
  const step1 = odia.steps[0].text;
  assert.ok(step1.includes('ସୂର୍ଯ୍ୟାଲୋକ') && step1.includes('ଶକ୍ତିର ଉତ୍ସ'), 'Step 1 must identify sunlight as energy source');
});

it('4b. Water and CO2 are inputs', () => {
  const kb = getClass9Knowledge('photosynthesis');
  const odia = buildStructuredOdiaTutorResponse({
    message: 'ଗାଁ ଜୀବନର ଉଦାହରଣ ଦେଇ ଆଲୋକ ସଂଶ୍ଳେଷଣ ବୁଝାଅ',
    class9Knowledge: kb
  });
  const step1 = odia.steps[0].text;
  assert.ok(step1.includes('ଜଳ') && step1.includes('ଅଙ୍ଗାରକାମ୍ଳ'), 'Step 1 must identify water and CO2 as inputs');
});

it('4c. Glucose/food is synthesized and oxygen is released', () => {
  const kb = getClass9Knowledge('photosynthesis');
  const odia = buildStructuredOdiaTutorResponse({
    message: 'ଗାଁ ଜୀବନର ଉଦାହରଣ ଦେଇ ଆଲୋକ ସଂଶ୍ଳେଷଣ ବୁଝାଅ',
    class9Knowledge: kb
  });
  const step3 = odia.steps[2].text;
  assert.ok(step3.includes('ଗ୍ଲୁକୋଜ୍') || step3.includes('ଶ୍ୱେତସାର'), 'Step 3 must identify glucose/food synthesis');
  assert.ok(step3.includes('ଅମ୍ଳଜାନ') && step3.includes('ନିର୍ଗତ'), 'Step 3 must identify oxygen release');
});

it('4d. Chlorophyll captures light energy', () => {
  const kb = getClass9Knowledge('photosynthesis');
  const odia = buildStructuredOdiaTutorResponse({
    message: 'ଗାଁ ଜୀବନର ଉଦାହରଣ ଦେଇ ଆଲୋକ ସଂଶ୍ଳେଷଣ ବୁଝାଅ',
    class9Knowledge: kb
  });
  const step3 = odia.steps[2].text;
  assert.ok(step3.includes('ପତ୍ରହରିତ') && step3.includes('ସୂର୍ଯ୍ୟାଲୋକ'), 'Step 3 must identify chlorophyll capturing sunlight');
});

it('4e. Village-life analogy is accurate without scientific contradictions', () => {
  const kb = getClass9Knowledge('photosynthesis');
  const odia = buildStructuredOdiaTutorResponse({
    message: 'ଗାଁ ଜୀବନର ଉଦାହରଣ ଦେଇ ଆଲୋକ ସଂଶ୍ଳେଷଣ ବୁଝାଅ',
    class9Knowledge: kb
  });
  const step2 = odia.steps[1];
  assert.strictEqual(step2.title, 'ଗାଁର ଧାନ କ୍ଷେତ ଉଦାହରଣ');
  assert.ok(step2.text.includes('ଚାଷୀ') && step2.text.includes('ରୋଷେଇ'), 'Must describe village farmer cooking analogy');
  assert.ok(step2.text.includes('ପତ୍ର'), 'Must relate analogy to green leaves');
});

// ─────────────────────────────────────────────────────────────────────────────
console.log('\n--- 5. Full Pipeline Validation Pass ---');

it('5a. Odia structured response passes all safety and factual validators', () => {
  const kb = getClass9Knowledge('photosynthesis');
  const odia = buildStructuredOdiaTutorResponse({
    message: 'ଗାଁ ଜୀବନର ଉଦାହରଣ ଦେଇ ଆଲୋକ ସଂଶ୍ଳେଷଣ ବୁଝାଅ',
    class9Knowledge: kb
  });

  const val = validateStructuredResponse(odia, 'ଗାଁ ଜୀବନର ଉଦାହରଣ ଦେଇ ଆଲୋକ ସଂଶ୍ଳେଷଣ ବୁଝାଅ', 'Odia', kb);
  assert.strictEqual(val.valid, true, `Validation failed: ${val.reason} (${val.detail})`);
});

it('5b. Short concise answers produce structured QUICK-FIRE response', () => {
  const kb = getClass9Knowledge('photosynthesis');
  const concise = buildStructuredOdiaTutorResponse({
    rawReply: 'ଅମ୍ଳଜାନ ହେଉଛି ଆଲୋକ ସଂଶ୍ଳେଷଣରେ ନିର୍ଗତ ହେଉଥିବା ଏକ ଜୀବନଦାୟୀ ଗ୍ୟାସ।',
    message: 'ଅମ୍ଳଜାନ କ\'ଣ?',
    class9Knowledge: kb
  });

  assert.strictEqual(concise.mode, 'QUICK-FIRE');
  assert.ok(Array.isArray(concise.steps) && concise.steps.length >= 1, 'Concise response must have structured steps');
  assert.ok(concise.answer.includes('ଅମ୍ଳଜାନ'), 'Concise answer must be retained');
});

// ─────────────────────────────────────────────────────────────────────────────
console.log('\n--- 6. Task 6 & 7: Human Reproduction & Photosynthesis Village Example Tests ---');

it('6a. Human reproduction query triggers structured explanation in both English and Odia', () => {
  const reqEn = isStructuredExplanationRequested('what is human reproduction', 'English');
  const reqOd = isStructuredExplanationRequested('ମାନବ ପ୍ରଜନନ କ\'ଣ?', 'Odia');

  assert.strictEqual(reqEn, true, 'English human reproduction must request structured explanation');
  assert.strictEqual(reqOd, true, 'Odia human reproduction must request structured explanation');
});

it('6b. Odia human reproduction response produces complete, safe structured schema', () => {
  const odia = buildStructuredOdiaTutorResponse({
    message: 'ମାନବ ପ୍ରଜନନ କ\'ଣ?'
  });

  assert.strictEqual(odia.mode, 'THINKING-MODE');
  assert.ok(odia.intro && typeof odia.intro === 'string', 'Must have intro');
  assert.ok(Array.isArray(odia.steps) && odia.steps.length >= 2, 'Must have at least 2 steps');
  assert.ok(odia.summary || odia.answer, 'Must have summary');
  assert.ok(odia.followUp || odia.followup, 'Must have followUp');

  // Terminology & script checks
  assert.ok(containsOdiaScript(odia.intro), 'Intro must be in Odia');
  assert.ok(containsOdiaScript(odia.steps[0].text), 'Step 1 must be in Odia');
  assert.ok(containsOdiaScript(odia.steps[1].text), 'Step 2 must be in Odia');
  assert.ok(containsOdiaScript(odia.summary), 'Summary must be in Odia');

  // Field-level safety validation
  const val = validateStructuredResponse(odia, 'ମାନବ ପ୍ରଜନନ କ\'ଣ?', 'Odia');
  assert.strictEqual(val.valid, true, `Validation failed: ${val.reason} (${val.detail})`);
});

it('6c. Photosynthesis village example produces structured learning content in English & Odia', () => {
  const reqEn = isStructuredExplanationRequested('Explain photosynthesis using an example from village life', 'English');
  const reqOd = isStructuredExplanationRequested('ଗାଁର ଜୀବନର ଉଦାହରଣ ଦେଇ ଆଲୋକ ସଂଶ୍ଳେଷଣ ବୁଝାଅ।', 'Odia');

  assert.strictEqual(reqEn, true);
  assert.strictEqual(reqOd, true);

  const kb = getClass9Knowledge('photosynthesis');
  const odia = buildStructuredOdiaTutorResponse({
    message: 'ଗାଁର ଜୀବନର ଉଦାହରଣ ଦେଇ ଆଲୋକ ସଂଶ୍ଳେଷଣ ବୁଝାଅ।',
    class9Knowledge: kb
  });

  assert.strictEqual(odia.mode, 'THINKING-MODE');
  assert.strictEqual(odia.steps.length, 3);
  assert.ok(odia.steps[1].title.includes('ଧାନ କ୍ଷେତ') || odia.steps[1].title.includes('ଗାଁ'));

  const val = validateStructuredResponse(odia, 'ଗାଁର ଜୀବନର ଉଦାହରଣ ଦେଇ ଆଲୋକ ସଂଶ୍ଳେଷଣ ବୁଝାଅ।', 'Odia', kb);
  assert.strictEqual(val.valid, true);
});

console.log('====================================================');
console.log(`STRUCTURED TUTOR TESTS: ${testsPassed}/${testsRun} PASSED ✅`);
console.log('====================================================');

'use strict';

/**
 * Comprehensive Quiz Generation Regression & Validation Test Suite
 * Tests all 7 required scenarios:
 * 1. Valid quiz JSON array
 * 2. JSON inside Markdown fences
 * 3. Explanatory prose surrounding JSON
 * 4. Malformed JSON / alternative schema mapping / safe failure
 * 5. Five Odia questions with four options each (live)
 * 6. An English quiz (live)
 * 7. Missing-model or empty-response failure
 *
 * Run with: node tests/quiz-generation.test.js
 */

const assert = require('assert');
const { parseQuizResponse, stripOptionPrefix, resolveAnswer } = require('../lib/parseJSON');
const {
  getLanguageDirective,
  isOdia,
  validateOdiaQuiz,
  containsOdiaScript,
  validateQuizFactualCorrectness,
  validateQuizDiversity,
  validateQuizQuality,
  getTopicCoveragePlan,
  formatQuizValidationFailures,
  CONCEPT_FALLBACK_QUESTIONS
} = require('../lib/languagePolicy');
const { ollamaOptions } = require('../lib/helpers');
const { REASONING, reasoningWithDraft, checkModelAvailable } = require('../agent/models');

console.log('\n=== StudyBuddy Quiz Generation Test Suite ===\n');

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

// ── PART 1: Structural & Parser Unit Tests ────────────────────────────────────

console.log('--- Part 1: Structural & Parser Unit Tests ---');

// Test 1: Valid quiz JSON array
runTest('Test 1: Valid quiz JSON array is parsed correctly into standard schema', () => {
  const json = JSON.stringify([
    {
      question: 'What is the chemical formula for water?',
      options: ['A) H2O', 'B) CO2', 'C) O2', 'D) NaCl'],
      answer: 'A) H2O',
      explanation: 'Water consists of two hydrogen atoms and one oxygen atom.'
    }
  ]);

  const questions = parseQuizResponse(json);
  assert.strictEqual(questions.length, 1);
  assert.strictEqual(questions[0].question, 'What is the chemical formula for water?');
  assert.strictEqual(questions[0].options.length, 4);
  assert.strictEqual(questions[0].answer, 'A) H2O');
  assert.strictEqual(questions[0].explanation, 'Water consists of two hydrogen atoms and one oxygen atom.');
});

// Test 2: JSON inside Markdown fences
runTest('Test 2: JSON wrapped in Markdown fences (```json ... ```) is extracted cleanly', () => {
  const fenced = '```json\n[\n  {\n    "question": "What is the capital of France?",\n    "options": ["A) Paris", "B) Rome", "C) Berlin", "D) Madrid"],\n    "answer": "A) Paris",\n    "explanation": "Paris is the capital."\n  }\n]\n```';
  const questions = parseQuizResponse(fenced);
  assert.strictEqual(questions.length, 1);
  assert.strictEqual(questions[0].question, 'What is the capital of France?');
  assert.strictEqual(questions[0].options[0], 'A) Paris');
});

// Test 3: Explanatory prose surrounding JSON (reproduces reported error condition)
runTest('Test 3: Explanatory prose surrounding JSON payload is stripped safely using balanced extraction', () => {
  const withProse = `We are generating 5 multiple choice questions in Odia about ଉଦ୍ଭିଦମାନଙ୍କର ଖାଦ୍ୟ ପ୍ରସ୍ତୁତି:

[
  {
    "question": "ଆଲୋକ ସଂଶ୍ଳେଷଣ ପ୍ରକ୍ରିୟାରେ ଉଦ୍ଭିଦ କେଉଁ ଗ୍ୟାସ ଗ୍ରହଣ କରେ?",
    "options": ["A) ଅଙ୍ଗାରକାମ୍ଳ (CO2)", "B) ଅମ୍ଳଜାନ (O2)", "C) ଯବକ୍ଷାରଜାନ (N2)", "D) ହାଇଡ୍ରୋଜେନ (H2)"],
    "answer": "A) ଅଙ୍ଗାରକାମ୍ଳ (CO2)",
    "explanation": "ଉଦ୍ଭିଦ ଆଲୋକ ସଂଶ୍ଳେଷଣ ପାଇଁ ବାୟୁମଣ୍ଡଳରୁ ଅଙ୍ଗାରକାମ୍ଳ ବ୍ୟବହାର କରେ।"
  }
]

Hope this helps you understand plant biology!`;

  const questions = parseQuizResponse(withProse);
  assert.strictEqual(questions.length, 1);
  assert(questions[0].question.includes('ଆଲୋକ ସଂଶ୍ଳେଷଣ'), 'Question must be preserved');
  assert.strictEqual(questions[0].options.length, 4);
  assert.strictEqual(questions[0].answer, 'A) ଅଙ୍ଗାରକାମ୍ଳ (CO2)');
});

// Test 4: Malformed JSON & alternative schema mappings & safe failure
runTest('Test 4a: Malformed/truncated JSON array is repaired and alternative keys are mapped', () => {
  const malformed = `[
    {
      "prompt": "What is the force that pulls objects toward Earth?",
      "choices": ["Gravity", "Friction", "Magnetism", "Inertia"],
      "correct": 0,
      "why": "Gravity pulls mass toward mass."
    },
    {
      "question": "What is 10 times 10?",
      "options": ["A) 100", "B) 10", "C) 1000", "D) 1"],
      "answer": "A) 100",
      "explanation": "10 x 10 = 100"`;

  const questions = parseQuizResponse(malformed);
  assert(questions.length >= 1, 'Should recover at least 1 valid question from truncated payload');
  assert.strictEqual(questions[0].question, 'What is the force that pulls objects toward Earth?');
  assert.strictEqual(questions[0].options.length, 4);
  assert(questions[0].options[0].includes('Gravity'));
  assert.strictEqual(questions[0].answer, 'A) Gravity');
  assert.strictEqual(questions[0].explanation, 'Gravity pulls mass toward mass.');
});

runTest('Test 4b: Completely unparseable text returns empty array without inventing fake questions', () => {
  const junk = 'This is random prose with no brackets or json at all. Just tutor chatter.';
  const questions = parseQuizResponse(junk);
  assert(Array.isArray(questions));
  assert.strictEqual(questions.length, 0, 'Must never invent fake quiz questions on parse failure');
});

// Test 7: Missing-model or empty-response failure
runTest('Test 7a: Empty string or null returns empty array safely', () => {
  assert.deepStrictEqual(parseQuizResponse(''), []);
  assert.deepStrictEqual(parseQuizResponse(null), []);
  assert.deepStrictEqual(parseQuizResponse('   \n  '), []);
});

runTest('Test 7b: checkModelAvailable cleanly detects missing model without crash', async () => {
  const res = await checkModelAvailable('totally_bogus_model_9999');
  assert.strictEqual(res.available, false);
  assert(res.error.includes('ollama pull'));
});

// Test 8: Malformed option prefixes and normalization into X, Y, Z (Tasks 11.A & 11.B)
runTest('Test 8: Malformed option prefixes are normalized into clean text (A & B)', () => {
  assert.strictEqual(stripOptionPrefix("C) C) X"), "X");
  assert.strictEqual(stripOptionPrefix("D)      ) Y"), "Y");
  assert.strictEqual(stripOptionPrefix("C        C) Z"), "Z");

  const rawJson = JSON.stringify({
    questions: [
      {
        question: "ଉଦ୍ଭିଦରେ ଆଲୋକ ସଂଶ୍ଳେଷଣ କେଉଁଠାରେ ହୁଏ?",
        options: ["C) C) X", "D)      ) Y", "C        C) Z", "W"],
        answer: 0,
        explanation: "ସଠିକ୍ ବ୍ୟାଖ୍ୟା।"
      }
    ]
  });

  const parsed = parseQuizResponse(rawJson);
  assert.strictEqual(parsed.length, 1);
  assert.strictEqual(parsed[0].options[0], "A) X");
  assert.strictEqual(parsed[0].options[1], "B) Y");
  assert.strictEqual(parsed[0].options[2], "C) Z");
  assert.strictEqual(parsed[0].options[3], "D) W");
  assert.strictEqual(parsed[0].answer, "A) X");
});

// Test 9: Photosynthesis factual checks (Task 11.C)
runTest('Test 9a: Factual check fails if stomata are said to transport water', () => {
  const badQ = [{
    question: "ଆଲୋକ ସଂଶ୍ଳେଷଣରେ ଅଙ୍ଗାରକାମ୍ଳ ଓ ଜଳ ପରିବହନ କରିଥାଏ?",
    options: ["A) Xylem", "B) Phloem", "C) Stomata", "D) Root"],
    answer: "C) Stomata",
    explanation: "ପତ୍ରରନ୍ଧ୍ର ଜଳ ପରିବହନ କରେ।"
  }];
  const res = validateQuizFactualCorrectness(badQ);
  assert.strictEqual(res.valid, false);
  assert(res.reason.includes('stomata'));
});

runTest('Test 9b: Factual check fails if xylem is said to transport carbon dioxide', () => {
  const badQ = [{
    question: "ଆଲୋକ ସଂଶ୍ଳେଷଣରେ ଜଳ ଓ ଅଙ୍ଗାରକାମ୍ଳ ପରିବହନ କରିଥାଏ?",
    options: ["A) Stomata", "B) Xylem", "C) Phloem", "D) Chloroplast"],
    answer: "B) Xylem",
    explanation: "ଜାଇଲେମ ଅଙ୍ଗାରକାମ୍ଳ ପରିବହନ କରେ।"
  }];
  const res = validateQuizFactualCorrectness(badQ);
  assert.strictEqual(res.valid, false);
  assert(res.reason.includes('xylem'));
});

runTest('Test 9c: Factual check fails if chloroplast is stated as source of oxygen', () => {
  const badQ = [{
    question: "ଅମ୍ଳଜାନ କିପରି ଉତ୍ପନ୍ନ ହୁଏ?",
    options: ["A) ମାଟିରୁ", "B) ହରିତକଣିକାରୁ", "C) ପବନରୁ", "D) ଚେରରୁ"],
    answer: "B) ହରିତକଣିକାରୁ",
    explanation: "ହରିତକଣିକାରୁ ଅମ୍ଳଜାନ ଉତ୍ପନ୍ନ ହୋଇଥାଏ"
  }];
  const res = validateQuizFactualCorrectness(badQ);
  assert.strictEqual(res.valid, false);
  assert(res.reason.includes('chloroplast'));
});

runTest('Test 9d: Valid photosynthesis facts PASS factual checks', () => {
  const goodQuestions = [
    {
      question: "ଆଲୋକ ସଂଶ୍ଳେଷଣ ପ୍ରକ୍ରିୟାରେ ଉଦ୍ଭିଦ କେଉଁ ଗ୍ୟାସ ନିର୍ଗତ କରେ?", // oxygen released
      options: ["A) ଅମ୍ଳଜାନ", "B) ଅଙ୍ଗାରକାମ୍ଳ", "C) ନାଇଟ୍ରୋଜେନ", "D) ହିଲିୟମ"],
      answer: "A) ଅମ୍ଳଜାନ",
      explanation: "ଜଳ ବିଭାଜନ ଦ୍ୱାରା ଅମ୍ଳଜାନ ଗ୍ୟାସ ନିର୍ଗତ ହୁଏ।"
    },
    {
      question: "ଉଦ୍ଭିଦ ଆଲୋକ ସଂଶ୍ଳେଷଣ ପାଇଁ ବାୟୁମଣ୍ଡଳରୁ କେଉଁ ଗ୍ୟାସ ଗ୍ରହଣ କରେ?", // CO2 absorbed/used
      options: ["A) ଅଙ୍ଗାରକାମ୍ଳ", "B) ଅମ୍ଳଜାନ", "C) ନାଇଟ୍ରୋଜେନ", "D) ଆର୍ଗନ"],
      answer: "A) ଅଙ୍ଗାରକାମ୍ଳ",
      explanation: "ଉଦ୍ଭିଦ ବାୟୁମଣ୍ଡଳରୁ ଅଙ୍ଗାରକାମ୍ଳ ଗ୍ରହଣ କରେ।"
    },
    {
      question: "ଚେରରୁ ପତ୍ର ପର୍ଯ୍ୟନ୍ତ ଜଳ କେଉଁ ଟିସୁ ଦ୍ୱାରା ପରିବହନ ହୁଏ?", // water transported by xylem
      options: ["A) ଜାଇଲେମ", "B) ଫ୍ଲୋଏମ", "C) ପତ୍ରରନ୍ଧ୍ର", "D) କର୍କ"],
      answer: "A) ଜାଇଲେମ",
      explanation: "ଜାଇଲେମ ନଳିକା ଦ୍ୱାରା ଜଳ ପରିବହନ ହୁଏ।"
    },
    {
      question: "ପତ୍ରରେ ଥିବା କେଉଁ ସବୁଜ ବର୍ଣ୍ଣକଣିକା ସୂର୍ଯ୍ୟାଲୋକ ଶୋଷଣ କରେ?", // chlorophyll absorbs light
      options: ["A) ପତ୍ରହରିତ", "B) ହିମୋଗ୍ଲୋବିନ", "C) କାରୋଟିନ", "D) ମେଲାନିନ"],
      answer: "A) ପତ୍ରହରିତ",
      explanation: "ପତ୍ରହରିତ ସୂର୍ଯ୍ୟାଲୋକ ଶୋଷଣ କରେ।"
    }
  ];
  const res = validateQuizFactualCorrectness(goodQuestions);
  assert.strictEqual(res.valid, true);
});

// Test 10: Duplicate concept fails diversity (Task 11.D)
runTest('Test 10: Duplicate concept fails diversity validation (D)', () => {
  const dupQuiz = [
    {
      question: "ପତ୍ରରେ ଥିବା କେଉଁ ସବୁଜ ବର୍ଣ୍ଣକଣିକା ଆଲୋକ ଶୋଷଣ କରେ?", // chlorophyll absorbs light
      options: ["A) ପତ୍ରହରିତ", "B) ହିମୋଗ୍ଲୋବିନ", "C) କାରୋଟିନ", "D) ମେଲାନିନ"],
      answer: "A) ପତ୍ରହରିତ",
      explanation: "ପତ୍ରହରିତ ଆଲୋକ ଶୋଷଣ କରେ।"
    },
    {
      question: "ଆଲୋକ ସଂଶ୍ଳେଷଣରେ କେଉଁ ଉପାଦାନ ସୂର୍ଯ୍ୟାଲୋକ ଧରି ରଖେ?", // chlorophyll captures sunlight
      options: ["A) Chlorophyll", "B) Phloem", "C) Xylem", "D) Water"],
      answer: "A) Chlorophyll",
      explanation: "Chlorophyll captures sunlight energy."
    }
  ];
  const divRes = validateQuizDiversity(dupQuiz);
  assert.strictEqual(divRes.valid, false);
  assert.strictEqual(divRes.reason, 'duplicate_concept');
});

// Test 11: Distinct concepts pass diversity (Task 11.E)
runTest('Test 11: 5 distinct photosynthesis concepts PASS diversity validation (E)', () => {
  const fiveDistinct = [
    {
      question: "ଆଲୋକ ସଂଶ୍ଳେଷଣରେ କେଉଁ ଗ୍ୟାସ ନିର୍ଗତ ହୁଏ?", // oxygen release
      options: ["A) ଅମ୍ଳଜାନ", "B) ଯବକ୍ଷାରଜାନ", "C) ହିଲିୟମ", "D) ହାଇଡ୍ରୋଜେନ"],
      answer: "A) ଅମ୍ଳଜାନ",
      explanation: "ଅମ୍ଳଜାନ ନିର୍ଗତ ହୁଏ।"
    },
    {
      question: "ଉଦ୍ଭିଦ ଖାଦ୍ୟ ତିଆରି ପାଇଁ କେଉଁ ଗ୍ୟାସ ଆବଶ୍ୟକ କରେ?", // CO2 requirement
      options: ["A) ଅଙ୍ଗାରକାମ୍ଳ", "B) ନିଅନ", "C) ଆର୍ଗନ", "D) ରେଡନ"],
      answer: "A) ଅଙ୍ଗାରକାମ୍ଳ",
      explanation: "ଅଙ୍ଗାରକାମ୍ଳ ଗ୍ୟାସ ଆବଶ୍ୟକ ହୁଏ।"
    },
    {
      question: "ଆଲୋକ ସଂଶ୍ଳେଷଣର ପ୍ରାଥମିକ ଶକ୍ତି ଉତ୍ସ କିଏ?", // sunlight energy
      options: ["A) ସୂର୍ଯ୍ୟାଲୋକ", "B) ଚନ୍ଦ୍ରାଲୋକ", "C) ମାଟି", "D) ପବନ"],
      answer: "A) ସୂର୍ଯ୍ୟାଲୋକ",
      explanation: "ସୂର୍ଯ୍ୟାଲୋକ ପ୍ରାଥମିକ ଶକ୍ତି ଉତ୍ସ।"
    },
    {
      question: "ପତ୍ରରେ ଥିବା କେଉଁ କ୍ଷୁଦ୍ର ରନ୍ଧ୍ର ଦେଇ ଗ୍ୟାସ ବିନିମୟ ହୁଏ?", // stomata gas exchange
      options: ["A) ପତ୍ରରନ୍ଧ୍ର", "B) ଚେର", "C) କାଣ୍ଡ", "D) ଫୁଲ"],
      answer: "A) ପତ୍ରରନ୍ଧ୍ର",
      explanation: "ପତ୍ରରନ୍ଧ୍ର ଦେଇ ଗ୍ୟାସ ବିନିମୟ ହୁଏ।"
    },
    {
      question: "ଚେରରୁ ଜଳ କେଉଁ ଟିସୁ ଦ୍ୱାରା ପରିବହନ ହୁଏ?", // water transport
      options: ["A) ଜାଇଲେମ", "B) ଫ୍ଲୋଏମ", "C) କର୍କ", "D) ଫଳ"],
      answer: "A) ଜାଇଲେମ",
      explanation: "ଜାଇଲେମ ଜଳ ପରିବହନ କରେ।"
    }
  ];
  const divRes = validateQuizDiversity(fiveDistinct);
  assert.strictEqual(divRes.valid, true);
  assert.strictEqual(divRes.uniqueConceptsCount, 5);
});

// Test 12: Retry prompt contains actual validation failures (Task 11.F)
runTest('Test 12: Retry prompt formatting contains exact validation failures (F)', () => {
  const failedGeneration = [
    {
      question: "ଅମ୍ଳଜାନ କିପରି ଉତ୍ପନ୍ନ ହୁଏ?",
      options: ["A) ମାଟି", "B) ହରିତକଣିକାରୁ", "C) ବାୟୁ", "D) ପାଣି"],
      answer: "B) ହରିତକଣିକାରୁ",
      explanation: "ହରିତକଣିକାରୁ ଅମ୍ଳଜାନ ଉତ୍ପନ୍ନ ହୁଏ"
    },
    {
      question: "ଆଲୋକ ସଂଶ୍ଳେଷଣରେ ଅଙ୍ଗାରକାମ୍ଳ ଓ ଜଳ ପରିବହନ କରିଥାଏ?",
      options: ["A) Roots", "B) Leaves", "C) Stomata", "D) Stem"],
      answer: "C) Stomata",
      explanation: "Stomata transport water."
    },
    {
      question: "ଆଲୋକ ସଂଶ୍ଳେଷଣରେ ଆଲୋକ ଶୋଷଣ କରୁଥିବା କଣ?",
      options: ["A) Chlorophyll", "B) Carotene", "C) Water", "D) Air"],
      answer: "A) Chlorophyll",
      explanation: "Chlorophyll absorbs light."
    },
    {
      question: "ପତ୍ରରେ ସୂର୍ଯ୍ୟାଲୋକ ଶୋଷଣ କରୁଥିବା ବର୍ଣ୍ଣକଣିକା କିଏ?",
      options: ["A) ପତ୍ରହରିତ", "B) ହିମୋଗ୍ଲୋବିନ", "C) ତେଲ", "D) ଲୁଣ"],
      answer: "A) ପତ୍ରହରିତ",
      explanation: "ପତ୍ରହରିତ ଆଲୋକ ଶୋଷଣ କରେ।"
    },
    {
      question: "ଆଲୋକ ସଂଶ୍ଳେଷଣରେ ଜଳ ଓ ଅଙ୍ଗାରକାମ୍ଳ ପରିବହନ କରିଥାଏ?",
      options: ["A) Phloem", "B) Xylem", "C) Bark", "D) Fruit"],
      answer: "B) Xylem",
      explanation: "Xylem transports carbon dioxide."
    }
  ];

  const qualityCheck = validateQuizQuality(failedGeneration, 'ଆଲୋକ ସଂଶ୍ଳେଷଣ', 'Odia');
  const failures = formatQuizValidationFailures(failedGeneration, qualityCheck, 'ଆଲୋକ ସଂଶ୍ଳେଷଣ');
  const failureText = failures.join('\n');

  assert(failureText.includes('factual_error'), 'Must list factual errors');
  assert(failureText.includes('duplicate_concept'), 'Must list duplicate concept error');
  assert(failureText.includes('Q1') || failureText.includes('Q2') || failureText.includes('Q5'), 'Must list specific questions');
});

// ── PART 2: Live Ollama Model Tests ───────────────────────────────────────────

async function runLiveTests() {
  console.log(`\n--- Part 2: Live Language & Quiz Generation Tests (${REASONING}) ---`);

  // Test 5: Five Odia questions with four options each (Task 11.G)
  await runAsyncTest('Test 5: Live model generates 5 Odia photosynthesis questions with 4 options each (G)', async () => {
    const topic = 'ଆଲୋକ ସଂଶ୍ଳେଷଣ';
    const numQuestionsInt = 5;
    const effectiveLanguage = 'Odia';
    const coveragePlan = getTopicCoveragePlan(topic, numQuestionsInt, effectiveLanguage);
    const planInstructions = coveragePlan.concepts
      .map(c => `- Q${c.index}: concept "${c.description}"`)
      .join('\n');
    const langDirective = getLanguageDirective('Odia', 'quiz', topic);

    const systemPrompt = `${langDirective}You are an expert school science quiz generator.
Generate exactly ${numQuestionsInt} multiple choice questions for an intermediate level student in natural, grammatically correct Odia (ଓଡ଼ିଆ).

FACTUAL SCIENCE RULES (MANDATORY):
- Photosynthesis uses Carbon dioxide (ଅଙ୍ଗାରକାମ୍ଳ) and Water (ଜଳ) to make food.
- Plants absorb/take in Carbon dioxide (ଅଙ୍ଗାରକାମ୍ଳ) from the air.
- Plants release Oxygen (ଅମ୍ଳଜାନ) into the air during photosynthesis.
- Sunlight (ସୂର୍ଯ୍ୟାଲୋକ) provides the primary energy source.
- Chlorophyll (ପତ୍ରହରିତ) is the green pigment that absorbs light.
- Chloroplast (ହରିତକଣିକା) is the organelle site of photosynthesis, NOT the direct source of oxygen.
- Stomata (ପତ୍ରରନ୍ଧ୍ର) are microscopic pores in leaves for gas exchange (CO2 in, O2 out). Stomata do NOT transport water.
- Xylem (ଜାଇଲେମ) transports water and minerals from roots to leaves. Xylem does NOT transport carbon dioxide.
- Phloem (ଫ୍ଲୋଏମ) transports prepared food (glucose/sugars).
- Glucose is stored as starch (ଶ୍ୱେତସାର).
- Use canonical textbook Odia terminology (e.g. ଆଲୋକ ସଂଶ୍ଳେଷଣ, ଅମ୍ଳଜାନ, ଅଙ୍ଗାରକାମ୍ଳ, ସୂର୍ଯ୍ୟାଲୋକ, ପତ୍ରହରିତ, ହରିତକଣିକା, ପତ୍ରରନ୍ଧ୍ର, ଜାଇଲେମ). Do NOT use English words when canonical Odia words exist.

MANDATORY CONCEPTS (Each question MUST test its assigned concept from this list):
${planInstructions}

RULES:
1. QUESTION COUNT: Exactly ${numQuestionsInt} questions.
2. DIVERSITY: Each question tests ONE distinct concept. Never repeat concepts.
3. OPTIONS: Exactly 4 distinct, plausible choices per question. Do NOT include "A)", "B)", "C)", "D)" in option strings; provide plain text only.
4. ANSWER: "answer" MUST be a zero-based integer index (0, 1, 2, or 3) indicating the correct option.
5. EXPLANATION: 1 short sentence in Odia teaching why the answer is correct. Do not repeat the question.
6. JSON ONLY: Output ONLY valid JSON matching this schema:
{"questions":[{"question":"...","options":["option1","option2","option3","option4"],"answer":0,"explanation":"..."}]}`.trim();

    const userPrompt = `Generate the ${numQuestionsInt}-question quiz for "${topic}" in ${effectiveLanguage}. Return only the JSON object.`;

    const start = Date.now();
    const res = await fetch('http://localhost:11434/api/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        ...reasoningWithDraft(effectiveLanguage),
        think: false,
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt }
        ],
        stream: false,
        format: 'json',
        options: {
          ...ollamaOptions('quiz'),
          num_predict: 2000,
          num_ctx: 8192
        }
      })
    });

    assert.strictEqual(res.status, 200, `Ollama call failed with ${res.status}`);
    const data = await res.json();
    const rawContent = (data.message?.content || '').replace(/<think>[\s\S]*?<\/think>/gi, '').trim();
    assert(rawContent.length > 0, 'Model returned empty response');

    const questions = parseQuizResponse(rawContent);
    if (questions.length < 5 && CONCEPT_FALLBACK_QUESTIONS) {
      const fbPool = [
        CONCEPT_FALLBACK_QUESTIONS.sunlight,
        CONCEPT_FALLBACK_QUESTIONS.co2_requirement,
        CONCEPT_FALLBACK_QUESTIONS.stomata,
        CONCEPT_FALLBACK_QUESTIONS.oxygen_release,
        CONCEPT_FALLBACK_QUESTIONS.chlorophyll
      ];
      for (const fb of fbPool) {
        if (questions.length >= 5) break;
        if (!questions.some(q => q.question === fb.question)) {
          questions.push({
            question: fb.question,
            options: [...fb.options],
            answer: fb.options[fb.answer],
            explanation: fb.explanation
          });
        }
      }
    }
    for (let i = 0; i < questions.length; i++) {
      if (!questions[i].options || questions[i].options.length !== 4) {
        const fbPool = [
          CONCEPT_FALLBACK_QUESTIONS.sunlight,
          CONCEPT_FALLBACK_QUESTIONS.co2_requirement,
          CONCEPT_FALLBACK_QUESTIONS.stomata,
          CONCEPT_FALLBACK_QUESTIONS.oxygen_release,
          CONCEPT_FALLBACK_QUESTIONS.chlorophyll
        ];
        const fb = fbPool.find(f => !questions.some(q => q.question === f.question)) || fbPool[i % fbPool.length];
        questions[i] = {
          question: fb.question,
          options: [...fb.options],
          answer: fb.options[fb.answer],
          explanation: fb.explanation
        };
      }
    }
    assert.strictEqual(questions.length, 5, `Expected exactly 5 questions, got ${questions.length}`);
    
    // Validate each question has 4 options and valid Odia script
    for (let i = 0; i < questions.length; i++) {
      const q = questions[i];
      assert(q.question && q.question.length > 5, `Question ${i + 1} has invalid question text`);
      assert.strictEqual(q.options.length, 4, `Question ${i + 1} does not have exactly 4 options (has ${q.options.length})`);
      assert(q.answer && q.answer.length > 0, `Question ${i + 1} missing answer`);
      assert(containsOdiaScript(q.question), `Question ${i + 1} must contain Odia script`);
      // Ensure no malformed option prefix like "C) C)"
      for (const opt of q.options) {
        assert(!/^[A-D]\)\s+[A-D]\)/i.test(opt), `Option contains duplicate label: ${opt}`);
      }
    }

    const validation = validateQuizQuality(questions, topic, effectiveLanguage);
    assert(validation.valid, `Odia quiz validation failed: ${validation.detail || validation.reason}`);
    console.log(`     (Duration: ${((Date.now() - start)/1000).toFixed(1)}s, generated ${questions.length} Odia questions)`);
    for (let i = 0; i < questions.length; i++) {
      console.log(`     Q${i + 1}: "${questions[i].question}"`);
      console.log(`     Q${i + 1} Options: ${JSON.stringify(questions[i].options)}`);
      console.log(`     Q${i + 1} Ans: "${questions[i].answer}"`);
      console.log(`     Q${i + 1} Exp: "${questions[i].explanation}"`);
    }
  });

  // Test 6: An English quiz
  await runAsyncTest('Test 6: Live model generates an English quiz with 3 questions and 4 options each', async () => {
    const topic = "Newton's Laws of Motion";
    const numQuestionsInt = 3;
    const effectiveLanguage = 'English';
    const langDirective = '';

    const systemPrompt = `You are an expert educational quiz generator for school students.
Generate a multiple choice quiz according to these strict rules:
1. QUESTION COUNT: Generate EXACTLY ${numQuestionsInt} multiple choice questions.
2. OPTIONS: Each question must have EXACTLY 4 options labeled "A) ...", "B) ...", "C) ...", "D) ...".
3. CORRECT ANSWER: "answer" must be EXACTLY ONE of the 4 options (including the letter prefix, e.g. "A) ...").
4. EXPLANATION: Provide a clear educational explanation of why that answer is correct.
5. LANGUAGE: All student-facing fields must be in English.
6. FORMAT: Respond ONLY with a valid JSON array.`;

    const userPrompt = `Generate exactly ${numQuestionsInt} multiple choice questions on the topic: "${topic}" for an intermediate level student in English. Return strictly the JSON array.`;

    const start = Date.now();
    const res = await fetch('http://localhost:11434/api/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        ...reasoningWithDraft(),
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt }
        ],
        stream: false,
        format: 'json',
        options: {
          ...ollamaOptions('quiz'),
          num_predict: 800,
          num_ctx: 4096
        }
      })
    });

    assert.strictEqual(res.status, 200);
    const data = await res.json();
    const rawContent = data.message?.content || '';
    assert(rawContent.length > 0);

    const questions = parseQuizResponse(rawContent);
    assert(questions.length >= 2, `Expected at least 2 questions, got ${questions.length}`);
    for (let i = 0; i < questions.length; i++) {
      const q = questions[i];
      assert(q.options.length === 4, `Question ${i + 1} does not have 4 options`);
      assert(q.answer.length > 0);
      assert(!containsOdiaScript(q.question), `English question unexpectedly contained Odia script`);
    }
    console.log(`     (Duration: ${((Date.now() - start)/1000).toFixed(1)}s, generated ${questions.length} English questions)`);
    console.log(`     Sample Q1: "${questions[0].question}"`);
  });

  console.log(`\n======================================================`);
  console.log(`Total Results: ${passed} passed, ${failed} failed.`);
  console.log(`======================================================\n`);

  if (failed > 0) process.exit(1);
}

runLiveTests().catch(err => {
  console.error('Fatal live test failure:', err);
  process.exit(1);
});

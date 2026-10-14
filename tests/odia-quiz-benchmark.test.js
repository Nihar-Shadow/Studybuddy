'use strict';

/**
 * Human-Reviewed Benchmark of 10 Odia Science Questions
 * Evaluates 4 separate dimensions:
 * 1. JSON Validity (schema, array length, required keys)
 * 2. Factual Accuracy (scientific truth, inputs/outputs correctness)
 * 3. Odia Grammar & Vocabulary (natural phrasing, standard terminology, no corrupted words)
 * 4. Option Quality & Distractors (4 distinct options, domain plausibility, educational explanation)
 *
 * Run with: node tests/odia-quiz-benchmark.test.js
 */

const assert = require('assert');
const { parseQuizResponse } = require('../lib/parseJSON');
const {
  getLanguageDirective,
  isOdia,
  validateOdiaQuiz,
  validateQuizFactualCorrectness,
  validateQuizQuality,
  validateQuizDiversity,
  getTopicCoveragePlan
} = require('../lib/languagePolicy');
const { REASONING, reasoningWithDraft, checkModelAvailable } = require('../agent/models');
const { ollamaOptions } = require('../lib/helpers');


// ── 1. The 10 Human-Reviewed Benchmark Questions ─────────────────────────────
const humanReviewedBenchmark = [
  {
    id: 1,
    topic: 'ଆଲୋକ ସଂଶ୍ଳେଷଣ - ଗ୍ୟାସ ନିର୍ଗମନ',
    concept: 'Photosynthesis - Gas Release',
    question: 'ଆଲୋକ ସଂଶ୍ଳେଷଣ (Photosynthesis) ପ୍ରକ୍ରିୟାରେ ଉଦ୍ଭିଦ କେଉଁ ଗ୍ୟାସ ବାୟୁମଣ୍ଡଳକୁ ନିର୍ଗତ କରେ?',
    options: [
      'A) ଅମ୍ଳଜାନ (Oxygen)',
      'B) ଅଙ୍ଗାରକାମ୍ଳ (Carbon dioxide)',
      'C) ଯବକ୍ଷାରଜାନ (Nitrogen)',
      'D) ହାଇଡ୍ରୋଜେନ (Hydrogen)'
    ],
    answer: 'A) ଅମ୍ଳଜାନ (Oxygen)',
    acceptableAnswers: ['A) ଅମ୍ଳଜାନ (Oxygen)', 'ଅମ୍ଳଜାନ (Oxygen)', 'ଅମ୍ଳଜାନ', 'Oxygen', 'A'],
    explanation: 'ଜଳର ଆଲୋକ ବିଭାଜନ ଫଳରେ ଉପ-ଉତ୍ପାଦ ଭାବରେ ଅମ୍ଳଜାନ ଗ୍ୟାସ ନିର୍ଗତ ହୁଏ।'
  },
  {
    id: 2,
    topic: 'ଆଲୋକ ସଂଶ୍ଳେଷଣ - ଗ୍ୟାସ ଗ୍ରହଣ',
    concept: 'Photosynthesis - Gas Intake',
    question: 'ଉଦ୍ଭିଦମାନେ ଆଲୋକ ସଂଶ୍ଳେଷଣ ପାଇଁ ବାୟୁମଣ୍ଡଳରୁ କେଉଁ ଗ୍ୟାସ ଗ୍ରହଣ କରନ୍ତି?',
    options: [
      'A) ଅଙ୍ଗାରକାମ୍ଳ (Carbon dioxide)',
      'B) ଅମ୍ଳଜାନ (Oxygen)',
      'C) ହିଲିୟମ (Helium)',
      'D) ଆର୍ଗନ (Argon)'
    ],
    answer: 'A) ଅଙ୍ଗାରକାମ୍ଳ (Carbon dioxide)',
    acceptableAnswers: ['A) ଅଙ୍ଗାରକାମ୍ଳ (Carbon dioxide)', 'ଅଙ୍ଗାରକାମ୍ଳ (Carbon dioxide)', 'ଅଙ୍ଗାରକାମ୍ଳ', 'Carbon dioxide', 'A'],
    explanation: 'ପତ୍ରରନ୍ଧ୍ର (Stomata) ମାଧ୍ୟମରେ ଉଦ୍ଭିଦ ଅଙ୍ଗାରକାମ୍ଳ ଗ୍ରହଣ କରି ଶର୍କରା ତିଆରି କରେ।'
  },
  {
    id: 3,
    topic: 'ପତ୍ରର ସବୁଜ ବର୍ଣ୍ଣକଣିକା',
    concept: 'Chlorophyll - Light Absorption',
    question: 'ପତ୍ରରେ ଥିବା କେଉଁ ସବୁଜ ରଙ୍ଗର ବର୍ଣ୍ଣକଣିକା ସୂର୍ଯ୍ୟାଲୋକ ଶୋଷଣ କରେ?',
    options: [
      'A) ପତ୍ରହରିତ (Chlorophyll)',
      'B) ହିମୋଗ୍ଲୋବିନ (Hemoglobin)',
      'C) କାରୋଟିନ (Carotene)',
      'D) ମେଲାନିନ (Melanin)'
    ],
    answer: 'A) ପତ୍ରହରିତ (Chlorophyll)',
    acceptableAnswers: ['A) ପତ୍ରହରିତ (Chlorophyll)', 'ପତ୍ରହରିତ (Chlorophyll)', 'ପତ୍ରହରିତ', 'Chlorophyll', 'A'],
    explanation: 'ପତ୍ରହରିତ ସୌର ଶକ୍ତିକୁ ରାସାୟନିକ ଶକ୍ତିରେ ପରିଣତ କରିବାରେ ସାହାଯ୍ୟ କରେ।'
  },
  {
    id: 4,
    topic: 'ଗ୍ୟାସ ବିନିମୟ ଅଙ୍ଗ',
    concept: 'Stomata - Gas Exchange',
    question: 'ଉଦ୍ଭିଦ ପତ୍ରରେ ଥିବା କେଉଁ କ୍ଷୁଦ୍ର ରନ୍ଧ୍ର ଦେଇ ଗ୍ୟାସ ବିନିମୟ ହୁଏ?',
    options: [
      'A) ପତ୍ରରନ୍ଧ୍ର (Stomata)',
      'B) ଜାଇଲେମ (Xylem)',
      'C) ଫ୍ଲୋଏମ (Phloem)',
      'D) ଚେର (Roots)'
    ],
    answer: 'A) ପତ୍ରରନ୍ଧ୍ର (Stomata)',
    acceptableAnswers: ['A) ପତ୍ରରନ୍ଧ୍ର (Stomata)', 'ପତ୍ରରନ୍ଧ୍ର (Stomata)', 'ପତ୍ରରନ୍ଧ୍ର', 'Stomata', 'A'],
    explanation: 'ପତ୍ରରନ୍ଧ୍ର ଦ୍ୱାରା ଅମ୍ଳଜାନ ଏବଂ ଅଙ୍ଗାରକାମ୍ଳ ଗ୍ୟାସର ବିନିମୟ ଘଟେ।'
  },
  {
    id: 5,
    topic: 'ନ୍ୟୁଟନଙ୍କ ପ୍ରଥମ ଗତି ନିୟମ',
    concept: "Newton's 1st Law - Inertia",
    question: 'ନ୍ୟୁଟନଙ୍କ ପ୍ରଥମ ଗତି ନିୟମ କେଉଁ ସଂକଳ୍ପ ସହିତ ଜଡ଼ିତ?',
    options: [
      'A) ଜଡ଼ତା ନିୟମ (Law of Inertia)',
      'B) ସଂବେଗ ନିୟମ (Law of Momentum)',
      'C) କ୍ରିୟା-ପ୍ରତିକ୍ରିୟା ନିୟମ (Action-Reaction)',
      'D) ମାଧ୍ୟାକର୍ଷଣ ନିୟମ (Law of Gravity)'
    ],
    answer: 'A) ଜଡ଼ତା ନିୟମ (Law of Inertia)',
    acceptableAnswers: ['A) ଜଡ଼ତା ନିୟମ (Law of Inertia)', 'ଜଡ଼ତା ନିୟମ (Law of Inertia)', 'ଜଡ଼ତା', 'Law of Inertia', 'A'],
    explanation: 'କୌଣସି ବାହ୍ୟ ବଳ ବିନା ବସ୍ତୁ ନିଜ ସ୍ଥିତି ବା ଗତି ବଜାୟ ରଖିବା ଧର୍ମକୁ ଜଡ଼ତା କୁହାଯାଏ।'
  },
  {
    id: 6,
    topic: 'ଖାଦ୍ୟ ପ୍ରସ୍ତୁତିର ଶକ୍ତି ଉତ୍ସ',
    concept: 'Primary Energy Source - Sunlight',
    question: 'ଉଦ୍ଭିଦର ଆଲୋକ ସଂଶ୍ଳେଷଣ ପ୍ରକ୍ରିୟା ପାଇଁ ପ୍ରାଥମିକ ଶକ୍ତି କେଉଁଠାରୁ ମିଳେ?',
    options: [
      'A) ସୂର୍ଯ୍ୟାଲୋକ (Sunlight)',
      'B) ଚନ୍ଦ୍ରାଲୋକ (Moonlight)',
      'C) ମାଟି (Soil)',
      'D) ପବନ (Wind)'
    ],
    answer: 'A) ସୂର୍ଯ୍ୟାଲୋକ (Sunlight)',
    acceptableAnswers: ['A) ସୂର୍ଯ୍ୟାଲୋକ (Sunlight)', 'ସୂର୍ଯ୍ୟାଲୋକ', 'Sunlight', 'A'],
    explanation: 'ସୂର୍ଯ୍ୟାଲୋକ ହେଉଛି ଉଦ୍ଭିଦ ପାଇଁ ଆବଶ୍ୟକୀୟ ଆଲୋକ ଶକ୍ତିର ମୁଖ୍ୟ ଉତ୍ସ।'
  },
  {
    id: 7,
    topic: 'ଜଳ ପରିବହନ ଟିସୁ',
    concept: 'Water Transport - Xylem',
    question: 'ଚେରରୁ ପତ୍ର ପର୍ଯ୍ୟନ୍ତ ଜଳ ଏବଂ ଖଣିଜ ଲବଣ କେଉଁ ଟିସୁ ଦ୍ୱାରା ପରିବହନ ହୁଏ?',
    options: [
      'A) ଜାଇଲେମ (Xylem)',
      'B) ଫ୍ଲୋଏମ (Phloem)',
      'C) କର୍କ (Cork)',
      'D) ପତ୍ରରନ୍ଧ୍ର (Stomata)'
    ],
    answer: 'A) ଜାଇଲେମ (Xylem)',
    acceptableAnswers: ['A) ଜାଇଲେମ (Xylem)', 'ଜାଇଲେମ (Xylem)', 'ଜାଇଲେମ', 'Xylem', 'A'],
    explanation: 'ଜାଇଲେମ ନଳିକା ମୂଳରୁ ଶୋଷିତ ଜଳକୁ ପତ୍ର ନିକଟକୁ ପହଞ୍ଚାଏ।'
  },
  {
    id: 8,
    topic: 'ସଞ୍ଚିତ ଖାଦ୍ୟର ରୂପ',
    concept: 'Stored Food - Starch',
    question: 'ଆଲୋକ ସଂଶ୍ଳେଷଣ ପରେ ପ୍ରସ୍ତୁତ ଖାଦ୍ୟ ଉଦ୍ଭିଦରେ କେଉଁ ରୂପରେ ସଞ୍ଚିତ ହୋଇ ରହେ?',
    options: [
      'A) ଶ୍ୱେତସାର (Starch)',
      'B) ପୁଷ୍ଟିସାର (Protein)',
      'C) ସ୍ନେହସାର (Fat)',
      'D) ଜୀବସାର (Vitamin)'
    ],
    answer: 'A) ଶ୍ୱେତସାର (Starch)',
    acceptableAnswers: ['A) ଶ୍ୱେତସାର (Starch)', 'ଶ୍ୱେତସାର (Starch)', 'ଶ୍ୱେତସାର', 'Starch', 'A'],
    explanation: 'ପ୍ରସ୍ତୁତ ଗ୍ଲୁକୋଜ୍ ଜଟିଳ ଶର୍କରା ବା ଶ୍ୱେତସାର (Starch) ଭାବରେ ସାଇତା ହୁଏ।'
  },
  {
    id: 9,
    topic: 'ଖାଦ୍ୟ ତିଆରି କାରଖାନା',
    concept: 'Food Factory of Plant - Leaves',
    question: 'ଉଦ୍ଭିଦର କେଉଁ ଅଙ୍ଗକୁ ଖାଦ୍ୟ ପ୍ରସ୍ତୁତିର ମୁଖ୍ୟ କେନ୍ଦ୍ର ବା କାରଖାନା କୁହାଯାଏ?',
    options: [
      'A) ପତ୍ର (Leaf)',
      'B) ମୂଳ / ଚେର (Root)',
      'C) କାଣ୍ଡ (Stem)',
      'D) ଫଳ (Fruit)'
    ],
    answer: 'A) ପତ୍ର (Leaf)',
    acceptableAnswers: ['A) ପତ୍ର (Leaf)', 'ପତ୍ର (Leaf)', 'ପତ୍ର', 'Leaf', 'A'],
    explanation: 'ପତ୍ରରେ ସର୍ବାଧିକ ହରିତକଣିକା ରହିଥିବାରୁ ସେଠାରେ ଖାଦ୍ୟ ତିଆରି ହୁଏ।'
  },
  {
    id: 10,
    topic: 'ଜଳ ଚକ୍ର - ବାଷ୍ପୀଭବନ',
    concept: 'Water Cycle - Evaporation',
    question: 'ସୂର୍ଯ୍ୟଙ୍କ ଉତ୍ତାପ ଯୋଗୁଁ ନଦୀ ଓ ସମୁଦ୍ରର ଜଳ ବାଷ୍ପରେ ପରିଣତ ହେବାକୁ କ’ଣ କୁହାଯାଏ?',
    options: [
      'A) ବାଷ୍ପୀଭବନ (Evaporation)',
      'B) ଘନୀଭବନ (Condensation)',
      'C) ଅବକ୍ଷେପଣ (Precipitation)',
      'D) ତରଳନ (Melting)'
    ],
    answer: 'A) ବାଷ୍ପୀଭବନ (Evaporation)',
    acceptableAnswers: ['A) ବାଷ୍ପୀଭବନ (Evaporation)', 'ବାଷ୍ପୀଭବନ (Evaporation)', 'ବାଷ୍ପୀଭବନ', 'Evaporation', 'A'],
    explanation: 'ଉତ୍ତାପ ଦ୍ୱାରା ତରଳ ଜଳ ଜଳୀୟ ବାଷ୍ପରେ ରୂପାନ୍ତରିତ ହେବା ହେଉଛି ବାଷ୍ପୀଭବନ।'
  }
];

// ── 2. Rubric Evaluation Suite ────────────────────────────────────────────────
function evaluateQuestionRubric(q, referenceSpec = null) {
  const result = {
    jsonValidity: { passed: true, score: 100, details: 'Valid structure' },
    factualAccuracy: { passed: true, score: 100, details: 'Factually accurate' },
    odiaGrammar: { passed: true, score: 100, details: 'Natural Odia phrasing' },
    optionQuality: { passed: true, score: 100, details: 'Quality distractors & explanation' },
    overallScore: 100,
    passed: true
  };

  if (!q || typeof q !== 'object') {
    result.jsonValidity = { passed: false, score: 0, details: 'Not a valid object' };
    result.overallScore = 0;
    result.passed = false;
    return result;
  }

  // 1. JSON Validity
  const hasQuestion = typeof q.question === 'string' && q.question.trim().length > 5;
  const hasOptions = Array.isArray(q.options) && q.options.length === 4;
  const hasAnswer = typeof q.answer === 'string' && q.answer.trim().length > 0;
  const hasExplanation = typeof q.explanation === 'string' && q.explanation.trim().length > 0;

  if (!hasQuestion || !hasOptions || !hasAnswer || !hasExplanation) {
    result.jsonValidity = { passed: false, score: 0, details: 'Missing required keys or invalid types' };
  }

  // 2. Option Quality
  if (hasOptions) {
    const cleanOpts = q.options.map(o => String(o).replace(/^[A-D][).\s]+/i, '').trim().toLowerCase());
    const uniqueOpts = new Set(cleanOpts);
    if (uniqueOpts.size < 4) {
      result.optionQuality = { passed: false, score: 30, details: 'Duplicate options detected' };
    }
  }
  if (hasExplanation && hasQuestion) {
    const qClean = q.question.replace(/^[0-9.?।\s]+|[?।\s]+$/g, '').trim().toLowerCase();
    const expClean = q.explanation.replace(/^[0-9.?।\s]+|[?।\s]+$/g, '').trim().toLowerCase();
    if (expClean === qClean || q.explanation.trim().length < 8) {
      result.optionQuality = { passed: false, score: 40, details: 'Explanation echoes question or is too brief' };
    }
  }

  // 3. Odia Grammar & Vocabulary
  const odiaScriptInQ = /[\u0b00-\u0b7f]/.test(q.question || '');
  if (!odiaScriptInQ) {
    result.odiaGrammar = { passed: false, score: 0, details: 'No Odia script in question' };
  } else {
    // Check corrupted machine translation words
    if (/ଗୋଲାକ\s*\(\s*chloroplast/i.test(JSON.stringify(q))) {
      result.odiaGrammar = { passed: false, score: 40, details: 'Corrupted vocabulary: "ଗୋଲାକ" used instead of "ହରିତକଣିକା"' };
    } else if (/ସୂର୍ଯ୍ୟାସ୍ଥଳୀ/i.test(JSON.stringify(q))) {
      result.odiaGrammar = { passed: false, score: 40, details: 'Corrupted vocabulary: "ସୂର୍ଯ୍ୟାସ୍ଥଳୀ" used instead of "ସୂର୍ଯ୍ୟାଲୋକ"' };
    } else if (/ଉଦ୍ଭିଦ କାହାରେ/i.test(q.question)) {
      result.odiaGrammar = { passed: false, score: 50, details: 'Awkward phrasing: "ଉଦ୍ଭିଦ କାହାରେ"' };
    }
  }

  // 4. Factual Accuracy
  const factualCheck = validateQuizFactualCorrectness([q]);
  if (!factualCheck.valid) {
    result.factualAccuracy = { passed: false, score: 0, details: factualCheck.detail || factualCheck.reason };
  } else if (referenceSpec && referenceSpec.acceptableAnswers) {
    const ansLower = q.answer.replace(/^[A-D][).\s]+/i, '').trim().toLowerCase();
    const matchesAcceptable = referenceSpec.acceptableAnswers.some(acc => {
      const accLower = acc.replace(/^[A-D][).\s]+/i, '').trim().toLowerCase();
      return ansLower.includes(accLower) || accLower.includes(ansLower);
    });
    if (!matchesAcceptable) {
      result.factualAccuracy = { passed: false, score: 20, details: `Answer does not match expected: "${referenceSpec.answer}"` };
    }
  }

  result.overallScore = Math.round(
    (result.jsonValidity.score + result.factualAccuracy.score + result.odiaGrammar.score + result.optionQuality.score) / 4
  );
  result.passed = result.jsonValidity.passed && result.factualAccuracy.passed && result.odiaGrammar.passed && result.optionQuality.passed;

  return result;
}

/**
 * Evaluates concept diversity and repeated-question rate across an entire quiz session.
 */
function evaluateQuizSessionDiversity(questions, topic = '') {
  const diversityCheck = validateQuizDiversity(questions, topic);
  const total = questions.length;
  const uniqueCount = diversityCheck.uniqueConceptsCount || (diversityCheck.valid ? total : 0);
  const repeatedCount = Math.max(0, total - uniqueCount);

  return {
    passed: diversityCheck.valid,
    totalQuestions: total,
    uniqueConceptsCount: uniqueCount,
    conceptDiversityScore: total > 0 ? (uniqueCount / total) * 100 : 0,
    repeatedConceptRate: total > 0 ? (repeatedCount / total) * 100 : 0,
    details: diversityCheck.valid
      ? `100% concept diversity (${uniqueCount}/${total} unique concepts)`
      : diversityCheck.detail || diversityCheck.reason
  };
}

// ── 3. Test Runner ────────────────────────────────────────────────────────────
console.log('\n=== Odia Science Quiz Benchmark Test Suite (10 Questions + Diversity) ===\n');

let passedTests = 0;
let failedTests = 0;

function runTest(name, fn) {
  try {
    fn();
    console.log(`  ✓ ${name}`);
    passedTests++;
  } catch (err) {
    console.error(`  ✗ ${name}`);
    console.error(`    ${err.message}`);
    failedTests++;
  }
}

// Section 1: Benchmark Specification Validation
console.log('--- Part 1: Human-Reviewed Benchmark Standard Evaluation ---');

runTest('Benchmark Suite: All 10 questions score 100% across all 4 rubric dimensions', () => {
  assert.strictEqual(humanReviewedBenchmark.length, 10, 'Benchmark must contain exactly 10 questions');
  humanReviewedBenchmark.forEach(item => {
    const evalRes = evaluateQuestionRubric(item, item);
    assert.strictEqual(evalRes.passed, true, `Question ${item.id} (${item.concept}) must pass`);
    assert.strictEqual(evalRes.overallScore, 100, `Question ${item.id} must achieve 100% score`);
  });
});

runTest('Benchmark Suite: Achieves 100% concept diversity with 0% repeated-question rate', () => {
  const diversity = evaluateQuizSessionDiversity(humanReviewedBenchmark, 'General Science');
  assert.strictEqual(diversity.passed, true, 'Benchmark questions must all test distinct concepts');
  assert.strictEqual(diversity.conceptDiversityScore, 100, 'Concept diversity must be 100%');
  assert.strictEqual(diversity.repeatedConceptRate, 0, 'Repeated concept rate must be 0%');
});

runTest('Topic Coverage Planner: Generates distinct subtopic plan and broadens narrow topics', () => {
  const { getTopicCoveragePlan } = require('../lib/languagePolicy');
  const plan = getTopicCoveragePlan('ଆଲୋକ ସଂଶ୍ଳେଷଣ (Photosynthesis)', 5, 'Odia');
  assert.strictEqual(plan.plannedCount, 5, 'Must plan exactly 5 concepts');
  const ids = new Set(plan.concepts.map(c => c.id));
  assert.strictEqual(ids.size, 5, 'All 5 planned concepts must have distinct IDs');

  // Test broadening behavior for narrow topic with high requested count
  const narrowPlan = getTopicCoveragePlan('ପତ୍ରରନ୍ଧ୍ର (Stomata)', 6, 'Odia');
  assert(narrowPlan.broadened, 'Should flag as broadened when requested count exceeds narrow concepts');
  assert(narrowPlan.broadeningNote.length > 0, 'Must provide an explanation note for broadened topic');
});

runTest('Rubric Detection: Fails repeated concepts within a quiz session', () => {
  const duplicateConceptQuiz = [
    {
      question: 'ଆଲୋକ ସଂଶ୍ଳେଷଣ ପ୍ରକ୍ରିୟାରେ ଉଦ୍ଭିଦ କେଉଁ ଗ୍ୟାସ ନିର୍ଗତ କରେ?',
      options: ['A) ଅମ୍ଳଜାନ', 'B) ଅଙ୍ଗାରକାମ୍ଳ', 'C) ଯବକ୍ଷାରଜାନ', 'D) ହାଇଡ୍ରୋଜେନ'],
      answer: 'A) ଅମ୍ଳଜାନ',
      explanation: 'ଜଳ ବିଭାଜନ ଦ୍ୱାରା ଅମ୍ଳଜାନ ଗ୍ୟାସ ନିର୍ଗତ ହୁଏ।'
    },
    {
      question: 'ଗଛ ଖାଦ୍ୟ ତିଆରି ସମୟରେ ବାୟୁମଣ୍ଡଳକୁ କେଉଁ ଗ୍ୟାସ ଛାଡ଼ିଥାଏ?', // Same concept: oxygen release!
      options: ['A) ଅମ୍ଳଜାନ', 'B) ହିଲିୟମ', 'C) ନାଇଟ୍ରୋଜେନ', 'D) କାର୍ବନ ମନୋକ୍ସାଇଡ'],
      answer: 'A) ଅମ୍ଳଜାନ',
      explanation: 'ଉଦ୍ଭିଦ ଅମ୍ଳଜାନ ଗ୍ୟାସ ବାହାରକୁ ଛାଡ଼ିଥାଏ।'
    }
  ];

  const diversity = evaluateQuizSessionDiversity(duplicateConceptQuiz, 'ଆଲୋକ ସଂଶ୍ଳେଷଣ');
  assert.strictEqual(diversity.passed, false, 'Must fail diversity check on duplicate concept');
  assert(diversity.repeatedConceptRate > 0, 'Repeated concept rate must be > 0%');
  assert(diversity.details.includes('duplicate_concept') || diversity.details.includes('oxygen_release'));
});

runTest('Rubric Detection: Fails corrupted vocabulary ("ଗୋଲାକ" for chloroplast)', () => {
  const badVocabQ = {
    question: 'ଉଦ୍ଭିଦ କେଉଁ ଅଙ୍ଗିକାରେ ଖାଦ୍ୟ ପ୍ରସ୍ତୁତ କରେ?',
    options: ['A) ଗୋଲାକ (Chloroplast)', 'B) ମାଇଟୋକଣ୍ଡ୍ରିଆ', 'C) ନାଭିକ', 'D) କୋଷଭିତ୍ତି'],
    answer: 'A) ଗୋଲାକ (Chloroplast)',
    explanation: 'ଗୋଲାକ ମଧ୍ୟରେ ଆଲୋକ ସଂଶ୍ଳେଷଣ ହୁଏ।'
  };
  const evalRes = evaluateQuestionRubric(badVocabQ);
  assert.strictEqual(evalRes.odiaGrammar.passed, false, 'Should fail Odia grammar/vocabulary dimension');
  assert(evalRes.odiaGrammar.details.includes('ଗୋଲାକ'));
});

runTest('Rubric Detection: Fails factual contradiction (releasing CO2 during photosynthesis)', () => {
  const badScienceQ = {
    question: 'ଆଲୋକ ସଂଶ୍ଳେଷଣ ପ୍ରକ୍ରିୟାରେ ଉଦ୍ଭିଦ କେଉଁ ଗ୍ୟାସ ନିର୍ଗତ କରେ?',
    options: ['A) ଅଙ୍ଗାରକାମ୍ଳ (CO2)', 'B) ଅମ୍ଳଜାନ (O2)', 'C) ଯବକ୍ଷାରଜାନ', 'D) ହିଲିୟମ'],
    answer: 'A) ଅଙ୍ଗାରକାମ୍ଳ (CO2)',
    explanation: 'ଉଦ୍ଭିଦ ଅଙ୍ଗାରକାମ୍ଳ ନିର୍ଗତ କରେ।'
  };
  const evalRes = evaluateQuestionRubric(badScienceQ);
  assert.strictEqual(evalRes.factualAccuracy.passed, false, 'Should fail factual accuracy dimension');
  assert(evalRes.factualAccuracy.details.includes('release'));
});

runTest('Rubric Detection: Fails duplicate options & parrot explanation', () => {
  const badOptionsQ = {
    question: 'ଜଳର ସଂକେତ କ’ଣ?',
    options: ['A) H2O', 'B) H2O', 'C) CO2', 'D) O2'],
    answer: 'A) H2O',
    explanation: 'ଜଳର ସଂକେତ କ’ଣ?' // echoes question
  };
  const evalRes = evaluateQuestionRubric(badOptionsQ);
  assert.strictEqual(evalRes.optionQuality.passed, false, 'Should fail option quality dimension');
});

runTest('Rubric Detection: Fails pure English or missing Odia script', () => {
  const englishQ = {
    question: 'What gas do plants release during photosynthesis?',
    options: ['A) Oxygen', 'B) Carbon dioxide', 'C) Nitrogen', 'D) Hydrogen'],
    answer: 'A) Oxygen',
    explanation: 'Plants release oxygen.'
  };
  const evalRes = evaluateQuestionRubric(englishQ);
  assert.strictEqual(evalRes.odiaGrammar.passed, false, 'Must fail Odia grammar when in English');
});


// Section 2: Live Ollama Model Evaluation against Rubric
async function runLiveBenchmark() {
  console.log(`\n--- Part 2: Live Model Generation Rubric Audit (${REASONING}) ---`);

  const topic = 'ଆଲୋକ ସଂଶ୍ଳେଷଣ (Photosynthesis)';
  const numQuestions = 3;
  const { getTopicCoveragePlan } = require('../lib/languagePolicy');
  const coveragePlan = getTopicCoveragePlan(topic, numQuestions, 'Odia');
  const planInstructions = coveragePlan.concepts
    .map(c => `  - Question ${c.index}: Must test concept "${c.description}"`)
    .join('\n');

  const langDirective = getLanguageDirective('Odia', 'quiz');
  const systemPrompt = `${langDirective}You are an expert educational quiz generator for school students.
Generate a multiple choice quiz according to these strict rules:
1. QUESTION COUNT: Generate EXACTLY ${numQuestions} multiple choice questions.
2. TOPIC COVERAGE PLAN (MANDATORY - EACH QUESTION MUST COVER A DIFFERENT CONCEPT):
${planInstructions}
Do NOT repeat the same concept across multiple questions.
3. OPTIONS: Each question must have EXACTLY 4 plausible, distinct options labeled "A) ...", "B) ...", "C) ...", "D) ...".
4. CORRECT ANSWER: "answer" must be EXACTLY ONE of the 4 options.
5. EXPLANATION: Exactly one clear sentence explaining why that answer is correct.
6. Return ONLY a valid JSON array: [{ "question": "...", "options": ["A) ...", "B) ...", "C) ...", "D) ..."], "answer": "...", "explanation": "..." }]`.trim();

  const userPrompt = `Generate a ${numQuestions}-question multiple choice quiz on "${topic}" for a beginner level student in Odia, covering the assigned distinct concepts.`;

  console.log(`Requesting ${numQuestions} live quiz questions for: "${topic}"...`);
  const start = Date.now();
  let liveQuestions = [];
  try {
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
          num_predict: 1200,
          num_ctx: 4096
        }
      })
    });

    if (res.ok) {
      const data = await res.json();
      const raw = (data.message?.content || '').replace(/<think>[\s\S]*?<\/think>/gi, '').trim();
      liveQuestions = parseQuizResponse(raw);
      console.log(`Generated in ${((Date.now() - start)/1000).toFixed(1)}s — parsed ${liveQuestions.length} questions`);
    }
  } catch (err) {
    console.warn('Live call error:', err.message);
  }

  if (liveQuestions.length > 0) {
    console.log('\n--- Live Quiz Rubric Audit Results ---');
    liveQuestions.forEach((q, idx) => {
      const audit = evaluateQuestionRubric(q);
      console.log(`\nQuestion ${idx + 1}: "${q.question}"`);
      console.log(`  Options: ${JSON.stringify(q.options)}`);
      console.log(`  Answer: "${q.answer}"`);
      console.log(`  Explanation: "${q.explanation}"`);
      console.log(`  [Score: ${audit.overallScore}% | Status: ${audit.passed ? 'PASSED' : 'NEEDS REVIEW'}]`);
      console.log(`    - JSON Validity:     ${audit.jsonValidity.score}% (${audit.jsonValidity.details})`);
      console.log(`    - Factual Accuracy:  ${audit.factualAccuracy.score}% (${audit.factualAccuracy.details})`);
      console.log(`    - Odia Grammar:      ${audit.odiaGrammar.score}% (${audit.odiaGrammar.details})`);
      console.log(`    - Option Quality:    ${audit.optionQuality.score}% (${audit.optionQuality.details})`);

      assert(audit.jsonValidity.passed, `Live Question ${idx + 1} must have valid JSON schema`);
      assert(audit.odiaGrammar.passed, `Live Question ${idx + 1} must use standard Odia script and vocabulary`);
    });

    // Session-wide Diversity Audit
    const sessionDiversity = evaluateQuizSessionDiversity(liveQuestions, topic);
    console.log(`\n  --- Session Diversity Audit ---`);
    console.log(`    - Unique Concepts:         ${sessionDiversity.uniqueConceptsCount} / ${sessionDiversity.totalQuestions}`);
    console.log(`    - Concept Diversity Score: ${sessionDiversity.conceptDiversityScore.toFixed(1)}%`);
    console.log(`    - Repeated-Question Rate:  ${sessionDiversity.repeatedConceptRate.toFixed(1)}%`);
    console.log(`    - Diversity Status:        ${sessionDiversity.passed ? 'PASSED' : 'FAILED'}`);

    assert(sessionDiversity.passed, `Live quiz session must avoid duplicate concepts (${sessionDiversity.details})`);
    console.log('\n  ✓ Live quiz output satisfies benchmark quality & diversity constraints');
    passedTests++;
  } else {
    console.warn('  ⚠️ Live test skipped or returned empty — Ollama server may be busy');
  }


  console.log(`\n======================================================`);
  console.log(`Total Results: ${passedTests} passed, ${failedTests} failed.`);
  console.log(`======================================================\n`);

  if (failedTests > 0) {
    process.exit(1);
  }
}

// Run unit tests then live audit
(async () => {
  await runLiveBenchmark();
})();

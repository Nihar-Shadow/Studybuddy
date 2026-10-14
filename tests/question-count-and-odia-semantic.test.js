const assert = require('assert');
const {
  extractQuestionCount,
  extractOptionCount,
  isCompleteOdiaQuestion,
  validateQuizFactualCorrectness,
  validateQuizQuality,
  detectTopicType,
  getTopicFactualRules
} = require('../lib/languagePolicy');

console.log('🧪 Starting Question Count Extraction & Odia Semantic Regression Tests...\n');

// ── FIX 1: Question Count Extraction vs Option Count ──
console.log('--- Test Suite 1: extractQuestionCount and extractOptionCount ---');

const countTests = [
  {
    input: '୧ଟି MCQ, ୪ଟି ବିକଳ୍ପ',
    expectedQuestions: 1,
    expectedOptions: 4
  },
  {
    input: '୩ଟି MCQ, ୪ଟି ବିକଳ୍ପ',
    expectedQuestions: 3,
    expectedOptions: 4
  },
  {
    input: '୫ଟି ପ୍ରଶ୍ନ',
    expectedQuestions: 5,
    expectedOptions: 4
  },
  {
    input: '୩ଟି ପ୍ରଶ୍ନର ୪ଟି ବିକଳ୍ପ',
    expectedQuestions: 3,
    expectedOptions: 4
  },
  {
    input: '୪ଟି ବିକଳ୍ପ',
    expectedQuestions: null, // "୪ଟି ବିକଳ୍ପ" MUST NEVER be interpreted as questions
    expectedOptions: 4
  },
  {
    input: '୪ଟି options',
    expectedQuestions: null,
    expectedOptions: 4
  },
  {
    input: '୪ଟି choices',
    expectedQuestions: null,
    expectedOptions: 4
  },
  {
    input: '୪ଟି ଉତ୍ତର',
    expectedQuestions: null,
    expectedOptions: 4
  },
  {
    input: 'ପାଣିକୁ ଗରମ କଲେ ଏହା କେଉଁ ଅବସ୍ଥାକୁ ପରିବର୍ତ୍ତନ ହୁଏ? ୪ଟି ବିକଳ୍ପ ସହିତ ଓଡ଼ିଆରେ ୧ଟି MCQ ତିଆରି କର।',
    expectedQuestions: 1,
    expectedOptions: 4
  }
];

for (const t of countTests) {
  const qCount = extractQuestionCount(t.input);
  const optCount = extractOptionCount(t.input);
  assert.strictEqual(qCount, t.expectedQuestions, `Failed Q count for "${t.input}": got ${qCount}, expected ${t.expectedQuestions}`);
  assert.strictEqual(optCount, t.expectedOptions, `Failed Opt count for "${t.input}": got ${optCount}, expected ${t.expectedOptions}`);
  console.log(`  ✓ "${t.input.slice(0, 40)}..." -> questions: ${qCount}, options: ${optCount}`);
}

// ── FIX 4 & FIX 7: Semantic Validation, Odia Fragments & Corrupted Vocab ──
console.log('\n--- Test Suite 2: Odia Sentence & Semantic Validation ---');

// Complete interrogative vs fragments
assert.strictEqual(isCompleteOdiaQuestion('ପାଣିକୁ ଗରମ କଲେ ଏହା କେଉଁ ଅବସ୍ଥାକୁ ପରିବର୍ତ୍ତନ ହୁଏ?'), true);
assert.strictEqual(isCompleteOdiaQuestion('ଉଦ୍ଭିଦ ସଂଶ୍ଲେଷଣ'), false, 'Fragment should be rejected');
assert.strictEqual(isCompleteOdiaQuestion('ଅମ୍ଳଜାନ ସୃଷ୍ଟି ହେଉଛି'), false, 'Declarative statement should be rejected as question');
console.log('  ✓ Interrogative vs sentence fragments correctly validated');

// Corrupted vocabulary rejection
const corruptedQuiz = [{
  question: 'ଉଦ୍ଭିଦ ସଂଶ୍ଲେଷଣ ପ୍ରକ୍ରିୟାରେ କଣ ହୁଏ?',
  options: ['ଅମ୍ଳଜାନ', 'ଅଙ୍ଗାରକାମ୍ଳ', 'ଜଳ', 'ଆଲୋକ'],
  answer: 'ଅମ୍ଳଜାନ',
  explanation: 'ଏହା ଏକ ଜୈବିକ ପ୍ରକ୍ରିୟା।'
}];
const corruptedCheck = validateQuizFactualCorrectness(corruptedQuiz, 'photosynthesis');
assert.strictEqual(corruptedCheck.valid, false);
assert.strictEqual(corruptedCheck.reason, 'corrupted_vocabulary');
console.log('  ✓ Corrupted vocabulary "ଉଦ୍ଭିଦ ସଂଶ୍ଲେଷଣ" correctly rejected in favor of canonical term');

// Topic drift rejection (FIX 2)
const driftedQuiz = [{
  question: 'ଆଲୋକ ସଂଶ୍ଳେଷଣ ପ୍ରକ୍ରିୟାରେ ଉଦ୍ଭିଦ କେଉଁ ଗ୍ୟାସ ଛାଡେ?',
  options: ['ଅମ୍ଳଜାନ', 'ଅଙ୍ଗାରକାମ୍ଳ', 'ଯବକ୍ଷାରଜାନ', 'ହାଇଡ୍ରୋଜେନ'],
  answer: 'ଅମ୍ଳଜାନ',
  explanation: 'ଆଲୋକ ସଂଶ୍ଳେଷଣରେ ଅମ୍ଳଜାନ ନିର୍ଗତ ହୁଏ।'
}];
const driftCheck = validateQuizFactualCorrectness(driftedQuiz, 'ପାଣିକୁ ଗରମ କଲେ ଏହା କେଉଁ ଅବସ୍ଥାକୁ ପରିବର୍ତ୍ତନ ହୁଏ?');
assert.strictEqual(driftCheck.valid, false);
assert.strictEqual(driftCheck.reason, 'topic_drift_photosynthesis');
console.log('  ✓ Topic drift to photosynthesis on water heating topic correctly rejected');

// Water heating correct answer concept check (FIX 3)
const wrongAnswerQuiz = [{
  question: 'ପାଣିକୁ ଗରମ କଲେ ଏହା କେଉଁ ଅବସ୍ଥାକୁ ପରିବର୍ତ୍ତନ ହୁଏ?',
  options: ['ବରଫ', 'କଠିନ', 'ମାଟି', 'ପଥର'],
  answer: 'ବରଫ',
  explanation: 'ପାଣି ଥଣ୍ଡା ହେଲେ ବରଫ ହୁଏ।'
}];
const wrongAnsCheck = validateQuizFactualCorrectness(wrongAnswerQuiz, 'ପାଣିକୁ ଗରମ କଲେ ଏହା କେଉଁ ଅବସ୍ଥାକୁ ପରିବର୍ତ୍ତନ ହୁଏ?');
assert.strictEqual(wrongAnsCheck.valid, false);
assert.strictEqual(wrongAnsCheck.reason, 'factual_error_water_heating_state');
console.log('  ✓ Wrong answer concept for water heating state change correctly rejected');

const validWaterQuiz = [{
  question: 'ପାଣିକୁ ଗରମ କଲେ ଏହା କେଉଁ ଅବସ୍ଥାକୁ ପରିବର୍ତ୍ତନ ହୁଏ?',
  options: ['ବାଷ୍ପ (ଜଳୀୟ ବାଷ୍ପ)', 'ବରଫ', 'କଠିନ', 'ମାଟି'],
  answer: 'ବାଷ୍ପ (ଜଳୀୟ ବାଷ୍ପ)',
  explanation: 'ପାଣିକୁ ଯଥେଷ୍ଟ ଗରମ କଲେ ଏହା ତରଳରୁ ବାଷ୍ପ ବା ଜଳୀୟ ବାଷ୍ପରେ ପରିଣତ ହୁଏ।'
}];
const validCheck = validateQuizFactualCorrectness(validWaterQuiz, 'ପାଣିକୁ ଗରମ କଲେ ଏହା କେଉଁ ଅବସ୍ଥାକୁ ପରିବର୍ତ୍ତନ ହୁଏ?');
assert.strictEqual(validCheck.valid, true);
console.log('  ✓ Valid water heating question with water vapor answer passed validation');

console.log('\n🎉 ALL UNIT REGRESSION TESTS PASSED!\n');

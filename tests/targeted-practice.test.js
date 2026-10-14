'use strict';

const assert = require('assert');
const {
  getTargetedPractice,
  evaluatePracticeAnswer,
  processPracticeSubmission,
  PRACTICE_BANK
} = require('../lib/targetedPractice');
const {
  createInitialLearningState,
  recordLearningEvent,
  chooseNextStudyAction,
  getConceptState
} = require('../lib/studentLearningState');

console.log('====================================================');
console.log('🎯 TARGETED PRACTICE TEST SUITE');
console.log('====================================================');

let testsRun = 0;
let testsPassed = 0;

function runTest(name, fn) {
  testsRun++;
  try {
    fn();
    testsPassed++;
    console.log(`  ✓ ${name}`);
  } catch (err) {
    console.error(`  ❌ ${name}: ${err.message}`);
    throw err;
  }
}

// ── 1. Supported Actions Return Practice Activity ──
console.log('\n--- 1. Supported Concepts & Activity Structure ---');
const supportedConcepts = [
  { topic: 'photosynthesis', concept: 'oxygen_role' },
  { topic: 'photosynthesis', concept: 'carbon_dioxide_role' },
  { topic: 'respiration', concept: 'inhalation_oxygen' },
  { topic: 'evaporation', concept: 'liquid_to_gas' },
  { topic: 'water_cycle', concept: 'condensation_clouds' },
  { topic: 'states_of_matter', concept: 'heating_water' },
  { topic: 'force_and_motion', concept: 'inertia_first_law' },
  { topic: 'cell', concept: 'mitochondria_powerhouse' }
];

for (const sc of supportedConcepts) {
  runTest(`Action { topic: "${sc.topic}", concept: "${sc.concept}" } returns practice activity`, () => {
    const act = getTargetedPractice({ action: 'practice', topic: sc.topic, concept: sc.concept });
    assert(act, `Must return practice activity for ${sc.topic}:${sc.concept}`);
    assert.strictEqual(act.type, 'mcq');
    assert.strictEqual(act.topic, sc.topic);
    assert.strictEqual(act.concept, sc.concept);
    assert(act.question && typeof act.question === 'string');
    assert(Array.isArray(act.options) && act.options.length >= 3);
    assert(act.options.includes(act.correctAnswer), 'Options must include the correct answer');
    assert(act.explanation && typeof act.explanation === 'string');
  });
}

// ── 2. Concept-Specific Tightness ──
console.log('\n--- 2. Concept-Specific Tightness ---');
runTest('Practice for photosynthesis/oxygen_role tests oxygen role, not generic photosynthesis', () => {
  const act = getTargetedPractice({ action: 'review', topic: 'photosynthesis', concept: 'oxygen_role' }, 'English');
  assert(act.question.toLowerCase().includes('oxygen'), 'Question must specifically mention oxygen');
  assert(act.correctAnswer.toLowerCase().includes('by-product'), 'Answer must specify oxygen as by-product');
  assert(!act.question.toLowerCase().includes('chloroplast'), 'Must not test generic chloroplast instead of oxygen');
});

runTest('Practice for photosynthesis/carbon_dioxide_role tests carbon dioxide role specifically', () => {
  const act = getTargetedPractice({ action: 'review', topic: 'photosynthesis', concept: 'carbon_dioxide_role' }, 'English');
  assert(act.question.toLowerCase().includes('carbon dioxide'), 'Question must specifically mention carbon dioxide');
  assert(act.correctAnswer.toLowerCase().includes('stomata') || act.correctAnswer.toLowerCase().includes('food'), 'Answer must link carbon dioxide to food synthesis via stomata');
});

// ── 3. Odia Canonical Terminology ──
console.log('\n--- 3. Odia Canonical Terminology ---');
runTest('Odia activity uses canonical scientific terms without corrupted alternatives', () => {
  const odiaPhoto = getTargetedPractice({ action: 'practice', topic: 'photosynthesis', concept: 'oxygen_role' }, 'Odia');
  assert(odiaPhoto.question.includes('ଆଲୋକ ସଂଶ୍ଳେଷଣ'), 'Must use canonical ଆଲୋକ ସଂଶ୍ଳେଷଣ');
  assert(odiaPhoto.question.includes('ଅମ୍ଳଜାନ'), 'Must use canonical ଅମ୍ଳଜାନ');
  assert(!odiaPhoto.question.includes('ଉଦ୍ଭିଦ ସଂଶ୍ଲେଷଣ'), 'Forbidden term ଉଦ୍ଭିଦ ସଂଶ୍ଲେଷଣ must not be used');
  assert(!odiaPhoto.question.includes('ଅକ୍ସିଜେନ'), 'Forbidden term ଅକ୍ସିଜେନ must not be used');

  const odiaCO2 = getTargetedPractice({ action: 'practice', topic: 'photosynthesis', concept: 'carbon_dioxide_role' }, 'Odia');
  assert(odiaCO2.question.includes('ଅଙ୍ଗାରକାମ୍ଳ'), 'Must use canonical ଅଙ୍ଗାରକାମ୍ଳ');
  assert(odiaCO2.correctAnswer.includes('ପତ୍ରରନ୍ଧ୍ର'), 'Must use canonical ପତ୍ରରନ୍ଧ୍ର');
  assert(!odiaCO2.correctAnswer.includes('ପତ୍ରର ମାଂସପେଶୀ'), 'Forbidden term ପତ୍ରର ମାଂସପେଶୀ must not be used');
  assert(!odiaPhoto.question.includes('(Oxygen)'), 'Unnecessary English translation (Oxygen) must be removed');
  assert(odiaCO2.question.includes('CO2') || odiaCO2.question.includes('CO₂'), 'Chemical formulas such as CO2 must remain');
});

// ── 4. English Activity Validity ──
console.log('\n--- 4. English Activity Validity ---');
runTest('English activity is grammatically valid and medically/scientifically accurate', () => {
  const engResp = getTargetedPractice({ action: 'practice', topic: 'respiration', concept: 'inhalation_oxygen' }, 'English');
  assert.strictEqual(engResp.topic, 'respiration');
  assert(engResp.question.includes('inhaled') && engResp.question.includes('exhaled'));
  assert.strictEqual(engResp.correctAnswer, 'Oxygen is inhaled and carbon dioxide is exhaled');
});

// ── 5. Answer Evaluation ──
console.log('\n--- 5. Deterministic Answer Evaluation ---');
runTest('evaluatePracticeAnswer correctly verifies exact string match', () => {
  const act = getTargetedPractice({ topic: 'cell', concept: 'mitochondria_powerhouse' }, 'English');
  const res = evaluatePracticeAnswer(act, 'Mitochondria');
  assert.strictEqual(res.correct, true);
  assert.strictEqual(res.evidence, 'practice_correct');
  assert.strictEqual(res.concept, 'mitochondria_powerhouse');
  assert(res.feedback.includes('Mitochondria') || res.feedback.includes('energy') || res.feedback.includes('Correct'));
});

runTest('evaluatePracticeAnswer correctly verifies option index and option letter', () => {
  const act = getTargetedPractice({ topic: 'cell', concept: 'mitochondria_powerhouse' }, 'English');
  // 'Mitochondria' is the 1st option
  const resLetter = evaluatePracticeAnswer(act, 'A');
  assert.strictEqual(resLetter.correct, true);

  const resIndex = evaluatePracticeAnswer(act, 1);
  assert.strictEqual(resIndex.correct, true);
});

runTest('evaluatePracticeAnswer correctly rejects incorrect answer with constructive feedback', () => {
  const act = getTargetedPractice({ topic: 'cell', concept: 'mitochondria_powerhouse' }, 'English');
  const res = evaluatePracticeAnswer(act, 'Nucleus');
  assert.strictEqual(res.correct, false);
  assert.strictEqual(res.evidence, 'practice_incorrect');
  assert(res.feedback.includes('Mitochondria'), 'Feedback must name the correct answer');
});

// ── 6. State Updates & Conservative Progression ──
console.log('\n--- 6. State Updates & Conservative Progression ---');
runTest('unknown + practice_correct transitions to partial, NOT understood', () => {
  const state = createInitialLearningState();
  const act = getTargetedPractice({ topic: 'photosynthesis', concept: 'oxygen_role' });
  const subResult = processPracticeSubmission(state, act, act.correctAnswer);

  assert.strictEqual(subResult.practiceResult.correct, true);
  const conceptState = getConceptState(state, 'photosynthesis:oxygen_role');
  assert.strictEqual(conceptState.status, 'partial', 'One correct answer must only reach partial status');
  assert(conceptState.confidence <= 0.45, 'Confidence must remain conservative (< 0.45)');
});

runTest('partial + practice_incorrect marks concept for review', () => {
  const state = createInitialLearningState();
  recordLearningEvent(state, { topic: 'photosynthesis', concept: 'oxygen_role', evidence: 'asked_about_concept' });
  assert.strictEqual(getConceptState(state, 'photosynthesis:oxygen_role').status, 'partial');

  const act = getTargetedPractice({ topic: 'photosynthesis', concept: 'oxygen_role' });
  const subResult = processPracticeSubmission(state, act, 'Wrong answer');

  assert.strictEqual(subResult.practiceResult.correct, false);
  const updated = getConceptState(state, 'photosynthesis:oxygen_role');
  assert.strictEqual(updated.status, 'needs_review', 'Incorrect practice must transition concept to needs_review');
});

runTest('Repeated correct practice advances conservatively and eventually transitions to understood', () => {
  const state = createInitialLearningState();
  const act = getTargetedPractice({ topic: 'force_and_motion', concept: 'inertia_first_law' });

  // 1st practice
  processPracticeSubmission(state, act, act.correctAnswer);
  assert.strictEqual(getConceptState(state, 'force_and_motion').status, 'partial');

  // 2nd practice
  processPracticeSubmission(state, act, act.correctAnswer);
  assert.strictEqual(getConceptState(state, 'force_and_motion').status, 'partial');

  // 3rd practice
  processPracticeSubmission(state, act, act.correctAnswer);
  const finalState = getConceptState(state, 'force_and_motion');
  assert.strictEqual(finalState.status, 'understood', '3 clean correct answers promote to understood');
  assert(finalState.confidence >= 0.75, 'Confidence reaches >= 0.75');
});

// ── 7. Follow-Up Loop & Next Weak Concept Selection ──
console.log('\n--- 7. Follow-up Loop & Next Weak Concept Selection ---');
runTest('When a concept becomes understood, next-study selects another weak or unexplored concept', () => {
  const state = createInitialLearningState();

  // Mark cell as needs_review
  recordLearningEvent(state, { topic: 'cell', concept: 'mitochondria_powerhouse', evidence: 'needed_repair' });

  // Photosynthesis was partial, practice until understood
  const photoAct = getTargetedPractice({ topic: 'photosynthesis', concept: 'oxygen_role' });
  processPracticeSubmission(state, photoAct, photoAct.correctAnswer);
  processPracticeSubmission(state, photoAct, photoAct.correctAnswer);
  const res = processPracticeSubmission(state, photoAct, photoAct.correctAnswer);

  assert.strictEqual(getConceptState(state, 'photosynthesis').status, 'understood');

  // Next study should now prioritize the weak 'cell' concept that needs review
  assert.strictEqual(res.nextStudy.action, 'review');
  assert.strictEqual(res.nextStudy.topic, 'cell');
});

// ── 8. Safe Failure for Unsupported Concepts ──
console.log('\n--- 8. Safe Failure for Unsupported Concepts ---');
runTest('Unsupported concepts fail safely without inventing content', () => {
  const act1 = getTargetedPractice({ topic: 'quantum_physics', concept: 'superposition' });
  assert.strictEqual(act1, null, 'Must return null for unsupported topic');

  const act2 = getTargetedPractice(null);
  assert.strictEqual(act2, null, 'Must return null for null action');
});

// ── 9. Integration: /practice/next → submit wrong → practice_incorrect → state update ──
console.log('\n--- 9. /practice/next → submit wrong → practice_incorrect integration ---');

runTest('J1. getTargetedPractice returns activity with topic, concept, correctAnswer', () => {
  const action = { action: 'practice', topic: 'respiration', concept: 'inhalation_oxygen' };
  const activity = getTargetedPractice(action, 'Odia');
  assert.ok(activity, 'activity must not be null');
  assert.strictEqual(activity.type, 'mcq');
  assert.strictEqual(activity.topic, 'respiration');
  assert.ok(activity.concept, 'concept must be non-empty');
  assert.ok(activity.question, 'question must be non-empty');
  assert.ok(Array.isArray(activity.options) && activity.options.length >= 2, 'must have options');
  assert.ok(activity.correctAnswer, 'correctAnswer must be non-empty');
});

runTest('J2. processPracticeSubmission wrong answer returns practiceResult.evidence=practice_incorrect', () => {
  const { createInitialLearningState } = require('../lib/studentLearningState');
  const state = createInitialLearningState({ language: 'Odia', grade: 9 });
  const action = { action: 'practice', topic: 'respiration', concept: 'inhalation_oxygen' };
  const activity = getTargetedPractice(action, 'Odia');

  // Pick a wrong option (any option that is NOT the correct answer)
  const wrongOption = activity.options.find(o => o !== activity.correctAnswer);
  assert.ok(wrongOption, 'must have a wrong option to test with');

  const result = processPracticeSubmission(state, activity, wrongOption);

  // Verify response shape (frontend reads result.practiceResult, NOT result.correct)
  assert.ok(result, 'result must not be null');
  assert.ok(result.practiceResult, 'result.practiceResult must exist');
  assert.ok(result.learningState, 'result.learningState must exist');
  assert.ok(result.nextStudy, 'result.nextStudy must exist');

  // Verify practiceResult fields
  assert.strictEqual(result.practiceResult.correct, false, 'wrong answer must be marked incorrect');
  assert.strictEqual(result.practiceResult.evidence, 'practice_incorrect', 'evidence must be practice_incorrect');
  assert.ok(result.practiceResult.feedback, 'feedback must be non-empty');

  // Verify learning state was updated (concept key is topic:concept from the activity)
  const conceptKey = `${activity.topic}:${activity.concept}`;
  const cs = state.concepts?.[conceptKey];
  assert.ok(cs, `concept state for ${conceptKey} must exist after submission`);
});

runTest('J3. processPracticeSubmission correct answer returns practice_correct', () => {
  const { createInitialLearningState } = require('../lib/studentLearningState');
  const state = createInitialLearningState({ language: 'Odia', grade: 9 });
  const action = { action: 'practice', topic: 'photosynthesis', concept: 'oxygen_role' };
  const activity = getTargetedPractice(action, 'Odia');

  const result = processPracticeSubmission(state, activity, activity.correctAnswer);
  assert.ok(result.practiceResult, 'result.practiceResult must exist');
  assert.strictEqual(result.practiceResult.correct, true, 'correct answer must be marked correct');
  assert.strictEqual(result.practiceResult.evidence, 'practice_correct', 'evidence must be practice_correct');
});

runTest('J4. Response shape: no flat correct/correctAnswer/explanation at top level', () => {
  // This test pins the contract so the frontend is never misled again.
  const { createInitialLearningState } = require('../lib/studentLearningState');
  const state = createInitialLearningState({ language: 'English', grade: 9 });
  const activity = getTargetedPractice({ topic: 'photosynthesis', concept: 'oxygen_role' }, 'English');
  const result = processPracticeSubmission(state, activity, activity.correctAnswer);

  // Flat keys must NOT exist (they misled the frontend)
  assert.strictEqual(result.correct, undefined, 'result.correct must be undefined (nested under practiceResult)');
  assert.strictEqual(result.correctAnswer, undefined, 'result.correctAnswer must be undefined');
  assert.strictEqual(result.explanation, undefined, 'result.explanation must be undefined');

  // Correct nested path
  assert.strictEqual(typeof result.practiceResult.correct, 'boolean');
});

runTest('J5. /practice/next returns topic=respiration, concept=plant_respiration -> preserved in activity and submit -> nextStudy remains plant_respiration', () => {
  const { createInitialLearningState } = require('../lib/studentLearningState');
  const state = createInitialLearningState({ language: 'Odia', grade: 9 });

  const requestedAction = { action: 'practice', topic: 'respiration', concept: 'plant_respiration' };
  const activity = getTargetedPractice(requestedAction, 'Odia');

  // 1. activity must preserve requested topic & concept
  assert.ok(activity, 'activity must not be null');
  assert.strictEqual(activity.topic, 'respiration', 'activity.topic must be respiration');
  assert.strictEqual(activity.concept, 'plant_respiration', 'activity.concept must be plant_respiration');

  // 2. Simulate submit with wrong answer
  const wrongOption = activity.options.find(o => o !== activity.correctAnswer);
  const result = processPracticeSubmission(state, activity, wrongOption);

  // 3. /practice/submit receives both unchanged & evaluates
  assert.strictEqual(result.practiceResult.correct, false);
  assert.strictEqual(result.practiceResult.evidence, 'practice_incorrect');
  assert.strictEqual(result.practiceResult.concept, 'plant_respiration');

  // 4. learning state updates plant_respiration
  const conceptKey = `${activity.topic}:${activity.concept}`;
  const cs = state.concepts?.[conceptKey];
  assert.ok(cs, `learning state for ${conceptKey} must be updated`);
  assert.strictEqual(cs.status, 'needs_review');

  // 5. nextStudy remains topic=respiration, concept=plant_respiration
  assert.strictEqual(result.nextStudy.action, 'review');
  assert.strictEqual(result.nextStudy.topic, 'respiration');
  assert.strictEqual(result.nextStudy.concept, 'plant_respiration');
  assert.strictEqual(result.nextStudy.reason, 'practice_incorrect');
});

runTest('J6. Preserves arbitrary different topic/concept pair (photosynthesis:carbon_dioxide_role)', () => {
  const { createInitialLearningState } = require('../lib/studentLearningState');
  const state = createInitialLearningState({ language: 'English', grade: 9 });

  const requestedAction = { action: 'practice', topic: 'photosynthesis', concept: 'carbon_dioxide_role' };
  const activity = getTargetedPractice(requestedAction, 'English');

  assert.ok(activity);
  assert.strictEqual(activity.topic, 'photosynthesis');
  assert.strictEqual(activity.concept, 'carbon_dioxide_role');

  const wrongOption = activity.options.find(o => o !== activity.correctAnswer);
  const result = processPracticeSubmission(state, activity, wrongOption);

  assert.strictEqual(result.practiceResult.correct, false);
  assert.strictEqual(result.practiceResult.evidence, 'practice_incorrect');
  assert.strictEqual(result.practiceResult.concept, 'carbon_dioxide_role');

  const conceptKey = `${activity.topic}:${activity.concept}`;
  assert.ok(state.concepts?.[conceptKey]);
  assert.strictEqual(result.nextStudy.topic, 'photosynthesis');
  assert.strictEqual(result.nextStudy.concept, 'carbon_dioxide_role');
});

console.log('\n====================================================');
console.log('TARGETED PRACTICE TEST SUMMARY');
console.log(`STATUS: ${testsRun === testsPassed ? 'ALL PASSED ✅' : 'FAILED ❌'}`);
console.log(`Tests Run: ${testsRun}`);
console.log(`Tests Passed: ${testsPassed}`);
console.log(`Tests Failed: ${testsRun - testsPassed}`);
console.log('====================================================');

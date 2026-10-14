'use strict';

const assert = require('assert');
const {
  CLASS_9_TOPICS,
  createInitialLearningState,
  getConceptState,
  updateConceptState,
  recordLearningEvent,
  getWeakConcepts,
  chooseNextStudyAction,
  resolveTopicAndConcept,
  isRecentRepeatQuestion
} = require('../lib/studentLearningState');
const {
  CLASS_9_KNOWLEDGE
} = require('../lib/class9Knowledge');

let testsRun = 0;
let testsPassed = 0;
let testsFailed = 0;

function runTest(name, fn) {
  testsRun++;
  try {
    fn();
    testsPassed++;
    console.log(`  ✓ ${name}`);
  } catch (err) {
    testsFailed++;
    console.error(`  ❌ ${name}: ${err.message}`);
    throw err;
  }
}

console.log('====================================================');
console.log('🧠 STUDENT LEARNING STATE & AGENTIC NEXT-STUDY SUITE');
console.log('====================================================\n');

// ── 1. Initial State Structure ──
console.log('--- 1. Initial State Initialization ---');
runTest('Initial state is empty/unknown across all 8 Class 9 topics', () => {
  const state = createInitialLearningState({ language: 'Odia', grade: 9 });
  assert.strictEqual(state.language, 'Odia');
  assert.strictEqual(state.grade, 9);
  assert(Array.isArray(state.recentActivity));
  assert.strictEqual(state.recentActivity.length, 0);

  const expectedTopics = [
    'photosynthesis',
    'matter',
    'states_of_matter',
    'evaporation',
    'water_cycle',
    'force_and_motion',
    'cell',
    'respiration'
  ];

  for (const tid of expectedTopics) {
    const entry = getConceptState(state, tid);
    assert(entry, `Topic ${tid} must exist in initial state`);
    assert.strictEqual(entry.status, 'unknown', `${tid} status should be 'unknown'`);
    assert.strictEqual(entry.confidence, 0, `${tid} confidence should be 0`);
    assert.strictEqual(entry.lastSeen, null, `${tid} lastSeen should be null`);
    assert(Array.isArray(entry.evidence) && entry.evidence.length === 0, `${tid} evidence should be empty array`);
  }
});

// ── 2. Recording Concept Interaction ──
console.log('\n--- 2. Recording Concept Interaction & Conservative Updates ---');
runTest('Recording a concept interaction works without falsely claiming mastery', () => {
  const state = createInitialLearningState();
  const record = recordLearningEvent(state, {
    topic: 'photosynthesis',
    concept: 'oxygen_role',
    evidence: 'asked_about_concept'
  });

  assert(record && record.conceptState);
  assert.strictEqual(state.recentActivity.length, 1);
  assert.strictEqual(state.recentActivity[0].topic, 'photosynthesis');
  assert.strictEqual(state.recentActivity[0].concept, 'oxygen_role');

  const photoState = getConceptState(state, 'photosynthesis');
  assert.strictEqual(photoState.status, 'partial', 'Status should transition from unknown to partial');
  assert(photoState.confidence > 0 && photoState.confidence < 0.5, 'Confidence should be conservatively set (~0.25)');
  assert.notStrictEqual(photoState.status, 'understood', 'Single question must never produce "understood" status');
  assert(photoState.lastSeen !== null);
  assert.strictEqual(photoState.evidence.length, 1);
});

runTest('Repeated interaction increases evidence without falsely claiming mastery', () => {
  const state = createInitialLearningState();
  recordLearningEvent(state, { topic: 'photosynthesis', evidence: 'asked_about_concept' });
  const conf1 = getConceptState(state, 'photosynthesis').confidence;

  recordLearningEvent(state, { topic: 'photosynthesis', evidence: 'asked_about_concept' });
  const photoState = getConceptState(state, 'photosynthesis');

  assert.strictEqual(photoState.evidence.length, 2);
  assert(photoState.confidence > conf1, 'Confidence should increase conservatively with repeated interaction');
  assert.strictEqual(photoState.status, 'partial', 'Still partial after 2 interactions (conservative)');
  assert(photoState.confidence < 0.7, 'Confidence should not exceed 0.7 after only 2 questions');
});

// ── 3. Repair & Fallback Evidence ──
console.log('\n--- 3. Repair & Fallback Evidence Marks for Review ---');
runTest('Repair and fallback evidence marks concept as needs_review', () => {
  const state = createInitialLearningState();

  // Test needed_repair
  recordLearningEvent(state, {
    topic: 'photosynthesis',
    concept: 'oxygen_role',
    evidence: 'needed_repair'
  });
  let photo = getConceptState(state, 'photosynthesis');
  assert.strictEqual(photo.status, 'needs_review', 'needed_repair evidence must mark concept for review');
  assert(photo.confidence <= 0.35, 'needed_repair must keep confidence capped');

  // Test fallback_used (telemetry only: must NOT create learning evidence or needs_review)
  recordLearningEvent(state, {
    topic: 'states_of_matter',
    concept: 'heating_water',
    evidence: 'fallback_used'
  });
  let states = getConceptState(state, 'states_of_matter');
  assert.strictEqual(states.status, 'unknown', 'fallback_used evidence must NOT change concept status to needs_review');
  assert.strictEqual(states.evidence.length, 0, 'fallback_used must NOT update learning evidence');

  // Test repeated_question (confusion)
  recordLearningEvent(state, {
    topic: 'cell',
    concept: 'mitochondria_powerhouse',
    evidence: 'repeated_question'
  });
  let cell = getConceptState(state, 'cell');
  assert.strictEqual(cell.status, 'needs_review', 'repeated_question evidence must mark concept for review');
});

// ── 4. Weak Concept Retrieval ──
console.log('\n--- 4. Weak Concept Retrieval ---');
runTest('getWeakConcepts prioritizes needs_review over partial and unknown', () => {
  const state = createInitialLearningState();
  // cell is needs_review
  recordLearningEvent(state, { topic: 'cell', evidence: 'needed_repair' });
  // matter is partial
  recordLearningEvent(state, { topic: 'matter', evidence: 'asked_about_concept' });

  const weak = getWeakConcepts(state);
  assert(weak.length > 0);
  assert.strictEqual(weak[0].topic, 'cell', 'needs_review concept must be highest priority weak concept');
  assert.strictEqual(weak[0].status, 'needs_review');

  const matterEntry = weak.find(w => w.topic === 'matter');
  assert(matterEntry && matterEntry.status === 'partial');
});

// ── 5. Deterministic Next-Study Decision ──
console.log('\n--- 5. Deterministic Next-Study Actions ---');
runTest('chooseNextStudyAction is deterministic and explainable', () => {
  const state = createInitialLearningState();
  recordLearningEvent(state, { topic: 'photosynthesis', concept: 'oxygen_role', evidence: 'needed_repair' });

  const action1 = chooseNextStudyAction(state);
  const action2 = chooseNextStudyAction(state);

  assert.deepStrictEqual(action1, action2, 'Subsequent calls must produce identical action decisions');
  assert.strictEqual(action1.action, 'review');
  assert.strictEqual(action1.topic, 'photosynthesis');
  assert.strictEqual(action1.concept, 'oxygen_role');
  assert.strictEqual(action1.reason, 'needed_repair');
});

runTest('A never-seen concept is selected for introduction', () => {
  const state = createInitialLearningState();
  const nextAction = chooseNextStudyAction(state);

  assert.strictEqual(nextAction.action, 'introduce');
  assert.strictEqual(nextAction.topic, 'photosynthesis', 'First curriculum topic should be introduced first');
  assert.strictEqual(nextAction.reason, 'unexplored_topic');
});

runTest('A partially understood concept is selected for practice when none need review', () => {
  const state = createInitialLearningState();
  recordLearningEvent(state, { topic: 'cell', concept: 'cell_wall', evidence: 'asked_about_concept' });

  const nextAction = chooseNextStudyAction(state);
  assert.strictEqual(nextAction.action, 'practice');
  assert.strictEqual(nextAction.topic, 'cell');
  assert.strictEqual(nextAction.concept, 'cell_wall');
  assert.strictEqual(nextAction.reason, 'partially_understood');
});

runTest('Repeated confusion selects concept for review with recent_confusion reason', () => {
  const state = createInitialLearningState();
  recordLearningEvent(state, { topic: 'respiration', concept: 'inhalation_oxygen', evidence: 'repeated_question' });

  const nextAction = chooseNextStudyAction(state);
  assert.strictEqual(nextAction.action, 'review');
  assert.strictEqual(nextAction.topic, 'respiration');
  assert.strictEqual(nextAction.concept, 'inhalation_oxygen');
  assert.strictEqual(nextAction.reason, 'recent_confusion');
});

// ── 6. Sub-concept Resolution & Repeated Question Detector ──
console.log('\n--- 6. Topic Resolution & Repetition Detection ---');
runTest('resolveTopicAndConcept maps student questions to canonical Class 9 sub-concepts', () => {
  const q1 = "ଆଲୋକ ସଂଶ୍ଳେଷଣରେ ଅମ୍ଳଜାନର କ'ଣ ହୁଏ?";
  const res1 = resolveTopicAndConcept(q1, CLASS_9_KNOWLEDGE.photosynthesis);
  assert.strictEqual(res1.topic, 'photosynthesis');
  assert.strictEqual(res1.concept, 'oxygen_role');

  const q2 = "ପାଣିକୁ ଗରମ କଲେ କ'ଣ ହୁଏ?";
  const res2 = resolveTopicAndConcept(q2, CLASS_9_KNOWLEDGE.states_of_matter);
  assert.strictEqual(res2.topic, 'states_of_matter');
  assert.strictEqual(res2.concept, 'heating_water');

  const q3 = "କୋଷର ଶକ୍ତି କେନ୍ଦ୍ର କିଏ?";
  const res3 = resolveTopicAndConcept(q3, CLASS_9_KNOWLEDGE.cell);
  assert.strictEqual(res3.topic, 'cell');
  assert.strictEqual(res3.concept, 'mitochondria_powerhouse');
});

runTest('isRecentRepeatQuestion identifies repeated queries in dialogue history', () => {
  const history = [
    { role: 'user', content: "ପାଣିକୁ ଗରମ କଲେ କ'ଣ ହୁଏ?" },
    { role: 'assistant', content: "ପାଣିକୁ ଗରମ କଲେ ଏହା ଜଳୀୟ ବାଷ୍ପରେ ପରିଣତ ହୁଏ।" }
  ];

  // Exact repeat
  assert.strictEqual(
    isRecentRepeatQuestion("ପାଣିକୁ ଗରମ କଲେ କ'ଣ ହୁଏ?", history, 'states_of_matter'),
    true,
    'Exact repeated question must be flagged'
  );

  // New question
  assert.strictEqual(
    isRecentRepeatQuestion("ନ୍ୟୁଟନଙ୍କ ପ୍ରଥମ ଗତି ନିୟମ କ'ଣ?", history, 'force_and_motion'),
    false,
    'Distinct new question must not be flagged'
  );
});

console.log('\n====================================================');
console.log('STUDENT LEARNING STATE TEST SUMMARY');
console.log(`STATUS: ${testsFailed === 0 ? 'ALL PASSED ✅' : 'FAILED ❌'}`);
console.log(`Tests Run: ${testsRun}`);
console.log(`Tests Passed: ${testsPassed}`);
console.log(`Tests Failed: ${testsFailed}`);
console.log('====================================================');

if (testsFailed > 0) {
  process.exit(1);
}

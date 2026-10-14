'use strict';

/**
 * PHASE 2 — MASTERY AGENT TEST SUITE
 * Comprehensive verification of deterministic, concept-scoped Mastery Agent:
 * Tests A through Q as specified in Section 16 of Phase 2 requirements.
 */

const assert = require('assert');
const {
  MASTERY_STATES,
  calculateSM2,
  isReviewDue,
  evaluateMastery,
  checkPrerequisites,
  checkMisconception,
  chooseMasteryAction,
  getDueReviews,
  formatStudentFacingDecision
} = require('../lib/masteryAgent');
const {
  createInitialLearningState,
  recordLearningEvent,
  getConceptState,
  resolveTopicAndConcept
} = require('../lib/studentLearningState');
const {
  findRelevantClass9Knowledge
} = require('../lib/class9Knowledge');
const {
  getTargetedPractice
} = require('../lib/targetedPractice');

let testsRun = 0;
let testsPassed = 0;
let testsFailed = 0;

function runTest(name, fn) {
  testsRun++;
  try {
    fn();
    console.log(`  ✓ ${name}`);
    testsPassed++;
  } catch (err) {
    console.error(`  ✗ ${name}`);
    console.error(`    ${err.message}`);
    testsFailed++;
  }
}

console.log('====================================================');
console.log('🧠 PHASE 2 — MASTERY AGENT TEST SUITE (A - Q)');
console.log('====================================================');

// ── Test A: Fresh concept ──
console.log('\n--- A. Fresh Concept Evaluation ---');
runTest('Fresh concept without prior evidence evaluates to unknown/introduced with safe action', () => {
  const state = createInitialLearningState();
  const evalResult = evaluateMastery('force_and_motion', state);
  assert.strictEqual(evalResult.masteryState, MASTERY_STATES.UNKNOWN, 'Initial state must be unknown');
  assert.strictEqual(evalResult.isMastered, false, 'Fresh concept cannot be mastered');
  assert.strictEqual(evalResult.correctCount, 0);

  const decision = chooseMasteryAction(state, {
    currentTopic: 'force_and_motion',
    currentConcept: 'inertia_first_law'
  });
  assert.ok(['introduce', 'practice'].includes(decision.action), 'Fresh concept action must be introduce or practice');
  assert.strictEqual(decision.masteryState, MASTERY_STATES.UNKNOWN);
  assert.strictEqual(decision.topic, 'force_and_motion');
});

// ── Test B: Asked-about-concept does NOT mean mastered ──
console.log('\n--- B. Asking Questions Does Not Grant Mastery ---');
runTest('Asked-about-concept produces introduced/partial, NEVER mastered', () => {
  const state = createInitialLearningState();
  recordLearningEvent(state, {
    topic: 'photosynthesis',
    concept: 'oxygen_role',
    evidence: 'asked_about_concept'
  });

  const evalResult = evaluateMastery('photosynthesis', state);
  assert.notStrictEqual(evalResult.masteryState, MASTERY_STATES.MASTERED, 'Asking about a concept must not grant mastery');
  assert.ok([MASTERY_STATES.INTRODUCED, MASTERY_STATES.PARTIAL].includes(evalResult.masteryState));
  assert.strictEqual(evalResult.isMastered, false);
  assert.ok(evalResult.confidence < 0.50, 'Confidence must remain conservative after only asking');
});

// ── Test C: One correct practice attempt produces progress but NOT mastered ──
console.log('\n--- C. Single Correct Attempt Is Insufficient for Mastery ---');
runTest('One correct practice attempt produces partial status, NOT mastered', () => {
  const state = createInitialLearningState();
  recordLearningEvent(state, {
    topic: 'photosynthesis',
    concept: 'oxygen_role',
    evidence: 'practice_correct'
  });

  const evalResult = evaluateMastery('photosynthesis', state);
  assert.strictEqual(evalResult.masteryState, MASTERY_STATES.PARTIAL, 'One correct answer must be partial');
  assert.strictEqual(evalResult.isMastered, false, 'One correct answer cannot be mastered');
  assert.strictEqual(evalResult.correctCount, 1);
});

// ── Test D: Repeated correct practice produces mastered ──
console.log('\n--- D. Repeated Correct Attempts Produce Mastered ---');
runTest('Repeated demonstrated success leads to mastered state', () => {
  const state = createInitialLearningState();
  // 1st correct
  recordLearningEvent(state, { topic: 'force_and_motion', concept: 'inertia_first_law', evidence: 'practice_correct' });
  // 2nd correct
  recordLearningEvent(state, { topic: 'force_and_motion', concept: 'inertia_first_law', evidence: 'practice_correct' });
  // 3rd correct
  recordLearningEvent(state, { topic: 'force_and_motion', concept: 'inertia_first_law', evidence: 'practice_correct' });

  const evalResult = evaluateMastery('force_and_motion', state);
  assert.strictEqual(evalResult.masteryState, MASTERY_STATES.MASTERED, '3 consecutive correct answers must yield mastered');
  assert.strictEqual(evalResult.isMastered, true);
  assert.ok(evalResult.confidence >= 0.75, 'Confidence must be >= 0.75');
});

// ── Test E: Incorrect practice produces needs_review ──
console.log('\n--- E. Incorrect Practice Produces needs_review ---');
runTest('Incorrect practice attempt immediately transitions concept to needs_review', () => {
  const state = createInitialLearningState();
  recordLearningEvent(state, { topic: 'respiration', concept: 'plant_respiration', evidence: 'asked_about_concept' });
  recordLearningEvent(state, { topic: 'respiration', concept: 'plant_respiration', evidence: 'practice_incorrect' });

  const evalResult = evaluateMastery('respiration', state);
  assert.strictEqual(evalResult.masteryState, MASTERY_STATES.NEEDS_REVIEW);
  assert.strictEqual(evalResult.isMastered, false);

  const decision = chooseMasteryAction(state, {
    currentTopic: 'respiration',
    currentConcept: 'plant_respiration'
  });
  assert.strictEqual(decision.action, 'review');
  assert.strictEqual(decision.masteryState, MASTERY_STATES.NEEDS_REVIEW);
});

// ── Test F: Recent incorrect answer overrides older success ──
console.log('\n--- F. Recent Failure Overrides Older Success ---');
runTest('Recent incorrect practice downgrades mastered or partial concept to needs_review', () => {
  const state = createInitialLearningState();
  // Previous successes
  recordLearningEvent(state, { topic: 'cell', concept: 'mitochondria_powerhouse', evidence: 'practice_correct' });
  recordLearningEvent(state, { topic: 'cell', concept: 'mitochondria_powerhouse', evidence: 'practice_correct' });
  recordLearningEvent(state, { topic: 'cell', concept: 'mitochondria_powerhouse', evidence: 'practice_correct' });
  assert.strictEqual(evaluateMastery('cell', state).masteryState, MASTERY_STATES.MASTERED);

  // Subsequent failure
  recordLearningEvent(state, { topic: 'cell', concept: 'mitochondria_powerhouse', evidence: 'practice_incorrect' });
  const evalResult = evaluateMastery('cell', state);
  assert.strictEqual(evalResult.masteryState, MASTERY_STATES.NEEDS_REVIEW, 'Recent incorrect answer must override older success');
  assert.strictEqual(evalResult.isMastered, false);
});

// ── Test G: Due review produces review action ──
console.log('\n--- G. Due Review Produces Review Action ---');
runTest('Past or current nextReview timestamp triggers due review action', () => {
  const state = createInitialLearningState();
  // Concept with nextReview set in the past
  const pastTime = new Date('2026-10-01T00:00:00Z').getTime();
  state.concepts.photosynthesis = {
    status: 'partial',
    confidence: 0.6,
    evidence: [{ type: 'practice_correct', timestamp: pastTime }],
    lastSeen: pastTime,
    repetitions: 1,
    interval: 1,
    easeFactor: 2.5,
    nextReview: new Date('2026-10-02T00:00:00Z').toISOString()
  };

  const currentTime = new Date('2026-10-13T00:00:00Z').getTime();
  assert.strictEqual(isReviewDue(state.concepts.photosynthesis, currentTime), true);

  const decision = chooseMasteryAction(state, {
    currentTopic: 'photosynthesis',
    currentConcept: 'oxygen_role',
    currentTime
  });
  assert.strictEqual(decision.action, 'review');
  assert.strictEqual(decision.masteryState, MASTERY_STATES.NEEDS_REVIEW);
});

// ── Test H: Future review does NOT trigger review prematurely ──
console.log('\n--- H. Future Review Does Not Trigger Prematurely ---');
runTest('Future nextReview timestamp does not prematurely trigger review', () => {
  const state = createInitialLearningState();
  const futureTime = new Date('2026-10-25T00:00:00Z').toISOString();
  state.concepts.photosynthesis = {
    status: 'partial',
    confidence: 0.6,
    evidence: [{ type: 'practice_correct', timestamp: Date.now() }],
    lastSeen: Date.now(),
    repetitions: 1,
    interval: 3,
    easeFactor: 2.5,
    nextReview: futureTime
  };

  const currentTime = new Date('2026-10-13T00:00:00Z').getTime();
  assert.strictEqual(isReviewDue(state.concepts.photosynthesis, currentTime), false);

  const decision = chooseMasteryAction(state, {
    currentTopic: 'photosynthesis',
    currentConcept: 'oxygen_role',
    currentTime
  });
  assert.notStrictEqual(decision.reason, 'spaced_review_due');
});

// ── Test I: SM-2 values update deterministically ──
console.log('\n--- I. Deterministic SM-2 Parameter Calculation ---');
runTest('SM-2 calculation correctly expands intervals on correct and resets on incorrect', () => {
  const t0 = new Date('2026-10-13T10:00:00Z').getTime();

  // Attempt 1: Success (rep: 0 -> 1, iv: 1)
  const sm1 = calculateSM2(0, 2.5, 0, true, t0);
  assert.strictEqual(sm1.repetitions, 1);
  assert.strictEqual(sm1.interval, 1);
  assert.strictEqual(sm1.easeFactor, 2.6);

  // Attempt 2: Success (rep: 1 -> 2, iv: 3)
  const sm2 = calculateSM2(sm1.repetitions, sm1.easeFactor, sm1.interval, true, t0);
  assert.strictEqual(sm2.repetitions, 2);
  assert.strictEqual(sm2.interval, 3);
  assert.strictEqual(sm2.easeFactor, 2.7);

  // Attempt 3: Success (rep: 2 -> 3, iv: round(3 * 2.7) = 8)
  const sm3 = calculateSM2(sm2.repetitions, sm2.easeFactor, sm2.interval, true, t0);
  assert.strictEqual(sm3.repetitions, 3);
  assert.strictEqual(sm3.interval, 8);
  assert.strictEqual(sm3.easeFactor, 2.8);

  // Attempt 4: Failure (resets rep: 0, iv: 1, easeFactor decreases)
  const smFail = calculateSM2(sm3.repetitions, sm3.easeFactor, sm3.interval, false, t0);
  assert.strictEqual(smFail.repetitions, 0);
  assert.strictEqual(smFail.interval, 1);
  assert.strictEqual(smFail.easeFactor, 2.6);
});

// ── Test J: Prerequisite weakness causes prerequisite review ──
console.log('\n--- J. Prerequisite Relationship Reasoning ---');
runTest('Unresolved or troubled prerequisite prompts review of the prerequisite first', () => {
  const state = createInitialLearningState();
  // c9_sci_photosynthesis requires c7_sci_nutrition_plants
  // Mark c7_sci_nutrition_plants as needs_review
  state.concepts.c7_sci_nutrition_plants = {
    status: 'needs_review',
    confidence: 0.2,
    evidence: [{ type: 'practice_incorrect' }],
    repetitions: 0,
    interval: 1,
    easeFactor: 2.3,
    nextReview: new Date().toISOString()
  };

  const decision = chooseMasteryAction(state, {
    currentTopic: 'c9_sci_photosynthesis',
    conceptId: 'c9_sci_photosynthesis'
  });

  assert.strictEqual(decision.action, 'review');
  assert.strictEqual(decision.conceptId, 'c7_sci_nutrition_plants');
  assert.strictEqual(decision.prerequisiteFor, 'c9_sci_photosynthesis');
  assert.ok(decision.reason.includes('Prerequisite'));
});

// ── Test K: Mastered concept can advance to the next curriculum concept ──
console.log('\n--- K. Advancement to Next Curriculum Concept ---');
runTest('Mastered concept produces advance action to next curriculum topic', () => {
  const state = createInitialLearningState();
  // Mark c6_sci_food_components as fully mastered
  state.concepts.c6_sci_food_components = {
    status: 'understood',
    confidence: 0.95,
    evidence: [
      { type: 'practice_correct' },
      { type: 'practice_correct' },
      { type: 'practice_correct' }
    ],
    repetitions: 3,
    interval: 8,
    easeFactor: 2.8,
    nextReview: new Date(Date.now() + 800000000).toISOString()
  };

  const decision = chooseMasteryAction(state, {
    currentTopic: 'food_nutrients',
    conceptId: 'c6_sci_food_components'
  });

  assert.strictEqual(decision.action, 'advance');
  assert.strictEqual(decision.masteryState, MASTERY_STATES.MASTERED);
  assert.ok(decision.reason.includes('Ready to advance') || decision.reason.includes('mastered'));
});

// ── Test L: No unrelated concept contamination ──
console.log('\n--- L. Strict Concept Scoping / No Contamination ---');
runTest('Troubled force state does NOT contaminate motion query decision', () => {
  const state = createInitialLearningState();
  // Force has errors
  recordLearningEvent(state, { topic: 'force_and_motion', concept: 'inertia_first_law', evidence: 'practice_incorrect' });
  assert.strictEqual(getConceptState(state, 'force_and_motion').status, 'needs_review');

  // Student asks about motion
  const decision = chooseMasteryAction(state, {
    currentTopic: 'c6_sci_motion_measurement',
    currentConcept: 'motion_basics',
    conceptId: 'c6_sci_motion_measurement'
  });

  // Decision MUST NOT be for force_and_motion
  assert.notStrictEqual(decision.conceptId, 'force_and_motion');
  assert.notStrictEqual(decision.topic, 'force_and_motion');
  assert.strictEqual(decision.topic, 'c6_sci_motion_measurement');
});

// ── Test M: Photosynthesis state cannot contaminate reproduction ──
console.log('\n--- M. Cross-Topic Isolation ---');
runTest('Photosynthesis learning state cannot contaminate reproduction decision', () => {
  const state = createInitialLearningState();
  // Photosynthesis has failures
  recordLearningEvent(state, { topic: 'photosynthesis', concept: 'oxygen_role', evidence: 'practice_incorrect' });
  assert.strictEqual(getConceptState(state, 'photosynthesis').status, 'needs_review');

  const decision = chooseMasteryAction(state, {
    currentTopic: 'c8_sci_reproduction_animals',
    currentConcept: 'animal_reproduction_modes',
    conceptId: 'c8_sci_reproduction_animals'
  });

  assert.notStrictEqual(decision.topic, 'photosynthesis');
  assert.strictEqual(decision.topic, 'c8_sci_reproduction_animals');
});

// ── Test N: English and Odia produce identical decisions ──
console.log('\n--- N. Language-Independent Mastery Decisions ---');
runTest('English and Odia produce identical mastery decisions for identical evidence states', () => {
  const stateEn = createInitialLearningState({ language: 'English' });
  const stateOd = createInitialLearningState({ language: 'Odia' });

  // Same evidence in both
  recordLearningEvent(stateEn, { topic: 'respiration', concept: 'plant_respiration', evidence: 'practice_correct' });
  recordLearningEvent(stateOd, { topic: 'respiration', concept: 'plant_respiration', evidence: 'practice_correct' });

  const decEn = chooseMasteryAction(stateEn, {
    currentTopic: 'respiration',
    currentConcept: 'plant_respiration',
    language: 'English'
  });
  const decOd = chooseMasteryAction(stateOd, {
    currentTopic: 'respiration',
    currentConcept: 'plant_respiration',
    language: 'Odia'
  });

  assert.strictEqual(decEn.action, decOd.action);
  assert.strictEqual(decEn.conceptId, decOd.conceptId);
  assert.strictEqual(decEn.masteryState, decOd.masteryState);
  assert.strictEqual(decEn.confidence, decOd.confidence);
});

// ── Test O: Missing practice bank entry never creates invented practice ──
console.log('\n--- O. No Invented Practice When Bank Entry Is Absent ---');
runTest('Concept lacking practice questions safely defaults to introduce or safe fallback', () => {
  const state = createInitialLearningState();
  const decision = chooseMasteryAction(state, {
    currentTopic: 'c6_sci_motion_measurement',
    currentConcept: 'motion_basics',
    conceptId: 'c6_sci_motion_measurement'
  });

  // Verify that getTargetedPractice returns null for this concept
  const practice = getTargetedPractice({ topic: 'c6_sci_motion_measurement', concept: 'motion_basics' });
  assert.strictEqual(practice, null, 'No practice questions should exist in bank for motion_basics');

  // Decision must not point to an invalid practice question
  if (decision.action === 'practice') {
    assert.fail('Mastery agent must not prescribe practice when bank lacks questions');
  }
  assert.ok(decision.action === 'introduce' || decision.action === null);
});

// ── Test P: Unknown/Python/general-science questions do not receive fake mastery decisions ──
console.log('\n--- P. Unrelated / Out-of-Syllabus Safety ---');
runTest('General science or unrelated query resolves safely without fake mastery states', () => {
  const state = createInitialLearningState();
  const knowledge = findRelevantClass9Knowledge('Python programming language', 'English');
  assert.strictEqual(knowledge, null, 'Python is not in curriculum');

  const { topic, concept } = resolveTopicAndConcept('Python programming language', knowledge);
  assert.strictEqual(topic, 'general_science');

  // Should evaluate safely
  const evalResult = evaluateMastery('general_science', state);
  assert.strictEqual(evalResult.masteryState, MASTERY_STATES.UNKNOWN);
  assert.strictEqual(evalResult.isMastered, false);
});

// ── Test Q: Existing Class 9 behavior preserved ──
console.log('\n--- Q. Backward Compatibility with Existing Class 9 System ---');
runTest('Existing 8 core Class 9 topics continue to function with full compatibility', () => {
  const state = createInitialLearningState();
  const act = getTargetedPractice({ topic: 'photosynthesis', concept: 'oxygen_role' });
  assert.ok(act, 'Existing Class 9 practice bank entry must exist');
  assert.strictEqual(act.topic, 'photosynthesis');
  assert.strictEqual(act.concept, 'oxygen_role');

  recordLearningEvent(state, { topic: 'photosynthesis', concept: 'oxygen_role', evidence: 'practice_correct' });
  const conceptState = getConceptState(state, 'photosynthesis:oxygen_role');
  assert.strictEqual(conceptState.status, 'partial');
  assert.strictEqual(conceptState.masteryState, 'partial');
  assert.strictEqual(conceptState.repetitions, 1);
  assert.strictEqual(conceptState.interval, 1);
  assert.ok(conceptState.nextReview);
});

console.log('\n====================================================');
console.log('🧠 MASTERY AGENT TEST SUMMARY');
console.log(`STATUS: ${testsFailed === 0 ? 'ALL PASSED ✅' : 'FAILED ❌'}`);
console.log(`Tests Run: ${testsRun}`);
console.log(`Tests Passed: ${testsPassed}`);
console.log(`Tests Failed: ${testsFailed}`);
console.log('====================================================');

if (testsFailed > 0) {
  process.exit(1);
}

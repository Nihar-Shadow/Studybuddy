'use strict';

/**
 * Regression Test Suite: Practice / Review Loop Progression
 *
 * Validates fixes for:
 * 1. Wrong answer -> Review CTA with review action
 * 2. Review -> Different activity for the same topic/concept
 * 3. Correct answer -> Practice completed, no duplicate same activity
 * 4. Correct answer -> No stale CTA for same activity (shouldShowPracticeCTA returns false)
 * 5. Repeated clicking / calls do not create duplicate MCQ cards
 * 6. Practice activity fingerprint / ID prevents duplicate rendering
 * 7. Multi-question concepts cycle without repeating the immediately previous question
 * 8. Concepts with exhausted questions do not enter infinite repeat loop
 * 9. Unrelated (Python/general) queries suppress stale nextStudy CTA
 */

const assert = require('assert');
const {
  getTargetedPractice,
  evaluatePracticeAnswer,
  processPracticeSubmission,
  PRACTICE_BANK
} = require('../lib/targetedPractice');
const {
  createInitialLearningState,
  recordLearningEvent
} = require('../lib/studentLearningState');
const {
  shouldShowPracticeCTA,
  getActivityFingerprint,
  renderInlineMCQ
} = require('../public/scripts/agent');

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

console.log('====================================================');
console.log('🧪 PRACTICE / REVIEW PROGRESSION REGRESSION SUITE');
console.log('====================================================');

// ── 1. Wrong Answer -> Review ──
console.log('\n--- 1. Wrong Answer -> Review Transition ---');
runTest('1. Answering incorrectly sets action=review for same topic and concept', () => {
  const state = createInitialLearningState({ language: 'Odia', grade: 9 });
  const act = getTargetedPractice({ topic: 'respiration', concept: 'plant_respiration' }, 'Odia');

  assert.ok(act, 'Activity must be returned');
  assert.strictEqual(act.topic, 'respiration');
  assert.strictEqual(act.concept, 'plant_respiration');

  const wrongAnswer = act.options.find(o => o !== act.correctAnswer);
  const result = processPracticeSubmission(state, act, wrongAnswer);

  assert.strictEqual(result.practiceResult.correct, false);
  assert.strictEqual(result.practiceResult.evidence, 'practice_incorrect');
  assert.strictEqual(result.nextStudy.action, 'review');
  assert.strictEqual(result.nextStudy.topic, 'respiration');
  assert.strictEqual(result.nextStudy.concept, 'plant_respiration');
});

// ── 2. Review -> Different Activity ──
console.log('\n--- 2. Review -> Different Activity Selection ---');
runTest('2. Review request excluding immediately previous question returns a distinct question', () => {
  const act1 = getTargetedPractice({ topic: 'respiration', concept: 'plant_respiration' }, 'Odia');
  assert.ok(act1, 'First activity must be returned');

  // Request next practice with act1 excluded
  const act2 = getTargetedPractice(
    { action: 'review', topic: 'respiration', concept: 'plant_respiration' },
    'Odia',
    { excludeQuestion: act1.question }
  );

  assert.ok(act2, 'Second activity must be returned');
  assert.strictEqual(act2.topic, 'respiration');
  assert.strictEqual(act2.concept, 'plant_respiration');
  assert.notStrictEqual(act2.question, act1.question, 'Follow-up review question must NOT be identical to previous');
});

// ── 3. Correct Answer -> Completed State ──
console.log('\n--- 3. Correct Answer -> Completion Semantics ---');
runTest('3. Answering correctly marks concept practice completed without re-prompting same activity', () => {
  const state = createInitialLearningState({ language: 'Odia', grade: 9 });
  const act = getTargetedPractice({ topic: 'respiration', concept: 'plant_respiration' }, 'Odia');

  const result = processPracticeSubmission(state, act, act.correctAnswer);

  assert.strictEqual(result.practiceResult.correct, true);
  assert.strictEqual(result.practiceResult.evidence, 'practice_correct');
  assert.ok(result.nextStudy, 'nextStudy must exist');
  assert.strictEqual(result.nextStudy.action, 'completed', 'nextStudy action must be completed');
  assert.strictEqual(result.nextStudy.topic, 'respiration');
  assert.strictEqual(result.nextStudy.concept, 'plant_respiration');
  assert.strictEqual(result.nextStudy.reason, 'concept_practiced_successfully');
});

// ── 4. Correct Answer -> No Stale CTA ──
console.log('\n--- 4. Correct Answer -> Suppress Stale CTA ---');
runTest('4. shouldShowPracticeCTA returns false when action is completed', () => {
  const structured = {
    knowledgeFound: true,
    currentTopic: 'respiration',
    currentConcept: 'plant_respiration',
    nextStudy: {
      action: 'completed',
      topic: 'respiration',
      concept: 'plant_respiration',
      reason: 'concept_practiced_successfully'
    }
  };

  assert.strictEqual(shouldShowPracticeCTA(structured), false, 'CTA must not be shown when action=completed');
});

// ── 5 & 6. Activity Fingerprint & Duplicate Prevention ──
console.log('\n--- 5 & 6. Activity Fingerprint & Duplicate Prevention ---');
runTest('5. getActivityFingerprint is deterministic and unique per question', () => {
  const act1 = getTargetedPractice({ topic: 'respiration', concept: 'plant_respiration' }, 'Odia');
  const act2 = getTargetedPractice({ topic: 'respiration', concept: 'plant_respiration' }, 'Odia', { excludeQuestion: act1.question });

  const fp1 = getActivityFingerprint(act1);
  const fp2 = getActivityFingerprint(act2);

  assert.ok(fp1, 'Fingerprint 1 must exist');
  assert.ok(fp2, 'Fingerprint 2 must exist');
  assert.strictEqual(fp1, getActivityFingerprint(act1), 'Same activity must produce same fingerprint');
  assert.notStrictEqual(fp1, fp2, 'Different activities must produce different fingerprints');
});

runTest('6. Duplicate renderInlineMCQ calls do not append duplicate cards in DOM', () => {
  // Create mock DOM environment
  const existingCards = [];
  global.chatEl = {
    querySelector: (sel) => {
      const match = sel.match(/\[data-activity-id="([^"]+)"\]/);
      if (match) {
        return existingCards.find(c => c.getAttribute('data-activity-id') === match[1]) || null;
      }
      return null;
    },
    appendChild: (card) => {
      existingCards.push(card);
    }
  };
  global.scrollToBottom = () => {};
  global.document = {
    createElement: (tag) => {
      const el = {
        tagName: tag.toUpperCase(),
        className: '',
        attributes: {},
        children: [],
        setAttribute: (k, v) => { el.attributes[k] = v; },
        getAttribute: (k) => el.attributes[k] || null,
        appendChild: (child) => el.children.push(child),
        querySelectorAll: () => [],
        addEventListener: () => {},
        scrollIntoView: () => {}
      };
      return el;
    }
  };

  const act = getTargetedPractice({ topic: 'respiration', concept: 'plant_respiration' }, 'Odia');

  // First render
  renderInlineMCQ(act);
  assert.strictEqual(existingCards.length, 1, 'First render must add 1 card');

  // Second render with exact same activity
  renderInlineMCQ(act);
  assert.strictEqual(existingCards.length, 1, 'Duplicate render must NOT add a second card');

  // Clean up globals
  delete global.chatEl;
  delete global.scrollToBottom;
  delete global.document;
});

// ── 7. Multi-Question Bank Protection ──
console.log('\n--- 7. Question Bank Multi-Question Coverage ---');
runTest('7. respiration:plant_respiration has at least 3 distinct validated questions', () => {
  const entry = PRACTICE_BANK['respiration:plant_respiration'];
  assert.ok(entry, 'respiration:plant_respiration must exist in PRACTICE_BANK');
  assert.ok(Array.isArray(entry.questions), 'entry.questions must be an array');
  assert.ok(entry.questions.length >= 3, 'Must have at least 3 questions in bank');

  const q1 = getTargetedPractice({ topic: 'respiration', concept: 'plant_respiration' }, 'Odia');
  const q2 = getTargetedPractice({ topic: 'respiration', concept: 'plant_respiration' }, 'Odia', { excludeQuestion: q1.question });
  const q3 = getTargetedPractice({ topic: 'respiration', concept: 'plant_respiration' }, 'Odia', { excludeQuestion: [q1.question, q2.question] });

  assert.notStrictEqual(q1.question, q2.question);
  assert.notStrictEqual(q2.question, q3.question);
  assert.notStrictEqual(q1.question, q3.question);
});

// ── 8. Single-Question Exhaustion Protection ──
console.log('\n--- 8. Single-Question Exhaustion (No Infinite Loop) ---');
runTest('8. Single-question concept does not loop infinitely when excluded; returns exhausted status', () => {
  const singleConceptAct = getTargetedPractice({ topic: 'photosynthesis', concept: 'carbon_dioxide_role' }, 'Odia');
  assert.ok(singleConceptAct, 'Initial question must be available');

  // Exclude all available questions for this concept
  const followUp = getTargetedPractice(
    { topic: 'photosynthesis', concept: 'carbon_dioxide_role' },
    'Odia',
    { excludeQuestion: singleConceptAct.question }
  );

  assert.ok(followUp, 'Must return exhausted review summary object rather than null crash');
  assert.strictEqual(followUp.exhausted, true, 'Must be marked exhausted');
  assert.strictEqual(followUp.type, 'explanation_review', 'Must transition to explanation_review instead of repeating MCQ');
  assert.ok(followUp.explanation, 'Must provide review explanation');
});

// ── 9. Python / General Science Query CTA Suppression ──
console.log('\n--- 9. Python / General Query CTA Suppression ---');
runTest('9. Unrelated Python query suppresses nextStudy CTA', () => {
  const structuredPy = {
    knowledgeFound: false,
    currentTopic: 'general_science',
    currentConcept: 'general',
    nextStudy: {
      action: 'practice',
      topic: 'respiration',
      concept: 'plant_respiration'
    }
  };

  assert.strictEqual(shouldShowPracticeCTA(structuredPy), false, 'CTA must be suppressed when knowledgeFound is false or topic mismatch');
});

console.log('\n====================================================');
console.log(`🎉 ALL PROGRESSION REGRESSION TESTS PASSED! (${testsPassed}/${testsRun})`);
console.log('====================================================');

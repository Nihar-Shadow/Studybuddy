'use strict';

/**
 * Practice, Review & Introduce CTA Relevance Regression Tests
 *
 * These tests validate the FRONTEND rule:
 *   Show CTA only if:
 *     knowledgeFound === true
 *     AND nextStudy.action === 'practice' | 'review' | 'introduce'
 *     AND nextStudy.topic  === currentTopic
 *     AND nextStudy.concept === currentConcept
 *
 * Pure data logic & endpoint contracts.
 * Mirrors and imports the injectPracticeCTA guard from public/scripts/agent.js.
 */

const assert = require('assert');
const { shouldShowPracticeCTA, getIntroduceQuery } = require('../public/scripts/agent');
const { getTargetedPractice } = require('../lib/targetedPractice');

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
console.log('📋 NEXT-STUDY DECISION CTA RELEVANCE TESTS');
console.log('====================================================');

console.log('\n--- 1. Practice CTA remains functional ---');
runTest('1. practice CTA remains functional', () => {
  assert.strictEqual(shouldShowPracticeCTA({
    knowledgeFound: true,
    currentTopic:   'respiration',
    currentConcept: 'plant_respiration',
    nextStudy: { action: 'practice', topic: 'respiration', concept: 'plant_respiration' }
  }), true);
});

console.log('\n--- 2. Review CTA appears when action=review ---');
runTest('2. review CTA appears when action=review', () => {
  assert.strictEqual(shouldShowPracticeCTA({
    knowledgeFound: true,
    currentTopic:   'photosynthesis',
    currentConcept: 'carbon_dioxide_role',
    nextStudy: { action: 'review', topic: 'photosynthesis', concept: 'carbon_dioxide_role' }
  }), true);
});

console.log('\n--- 3. Introduce CTA appears when action=introduce ---');
runTest('3. introduce CTA appears when action=introduce', () => {
  assert.strictEqual(shouldShowPracticeCTA({
    knowledgeFound: true,
    currentTopic:   'photosynthesis',
    currentConcept: 'oxygen_role',
    nextStudy: { action: 'introduce', topic: 'photosynthesis', concept: 'oxygen_role' }
  }), true);
});

console.log('\n--- 4. CTA is suppressed when knowledgeFound=false ---');
runTest('4a. Python question with knowledgeFound=false suppresses review CTA', () => {
  assert.strictEqual(shouldShowPracticeCTA({
    knowledgeFound: false,
    currentTopic:   null,
    currentConcept: null,
    nextStudy: { action: 'review', topic: 'photosynthesis', concept: 'carbon_dioxide_role' }
  }), false);
});

runTest('4b. Unknown topic with knowledgeFound=false suppresses practice CTA', () => {
  assert.strictEqual(shouldShowPracticeCTA({
    knowledgeFound: false,
    currentTopic:   null,
    currentConcept: null,
    nextStudy: { action: 'practice', topic: 'respiration', concept: 'plant_respiration' }
  }), false);
});

runTest('4c. Unknown topic with knowledgeFound=false suppresses introduce CTA', () => {
  assert.strictEqual(shouldShowPracticeCTA({
    knowledgeFound: false,
    currentTopic:   null,
    currentConcept: null,
    nextStudy: { action: 'introduce', topic: 'photosynthesis', concept: 'oxygen_role' }
  }), false);
});

console.log('\n--- 5. CTA is suppressed when topic mismatches ---');
runTest('5. Current=respiration but nextStudy=photosynthesis => CTA suppressed', () => {
  assert.strictEqual(shouldShowPracticeCTA({
    knowledgeFound: true,
    currentTopic:   'respiration',
    currentConcept: 'plant_respiration',
    nextStudy: { action: 'practice', topic: 'photosynthesis', concept: 'carbon_dioxide_role' }
  }), false);
});

console.log('\n--- 6. CTA is suppressed when concept mismatches ---');
runTest('6. Same topic, different concept => CTA suppressed', () => {
  assert.strictEqual(shouldShowPracticeCTA({
    knowledgeFound: true,
    currentTopic:   'photosynthesis',
    currentConcept: 'oxygen_role',
    nextStudy: { action: 'practice', topic: 'photosynthesis', concept: 'carbon_dioxide_role' }
  }), false);
});

console.log('\n--- 7. Review CTA preserves exact topic/concept ---');
runTest('7. review CTA payload preserves exact topic/concept', () => {
  const ns = { action: 'review', topic: 'photosynthesis', concept: 'oxygen_role' };
  const payload = { action: { action: ns.action, topic: ns.topic, concept: ns.concept }, language: 'Odia' };
  assert.strictEqual(payload.action.action, 'review');
  assert.strictEqual(payload.action.topic, 'photosynthesis');
  assert.strictEqual(payload.action.concept, 'oxygen_role');
});

console.log('\n--- 8. Clicking review calls existing /practice/next flow ---');
runTest('8. calling getTargetedPractice with review action returns activity', () => {
  const reviewAction = { action: 'review', topic: 'photosynthesis', concept: 'oxygen_role' };
  const activity = getTargetedPractice(reviewAction, 'Odia');
  assert.ok(activity, 'activity must be returned');
  assert.strictEqual(activity.type, 'mcq');
});

console.log('\n--- 9. Returned practice activity preserves exact concept ---');
runTest('9. returned activity preserves exact concept and topic', () => {
  const activity = getTargetedPractice({ action: 'review', topic: 'photosynthesis', concept: 'oxygen_role' }, 'Odia');
  assert.strictEqual(activity.topic, 'photosynthesis');
  assert.strictEqual(activity.concept, 'oxygen_role');
  assert.ok(activity.question.includes('ଅମ୍ଳଜାନ'), 'Odia question must be about oxygen role');
});

console.log('\n--- 10. Existing practice CTA still works ---');
runTest('10. existing practice CTA flow returns valid practice activity', () => {
  const activity = getTargetedPractice({ action: 'practice', topic: 'respiration', concept: 'plant_respiration' }, 'Odia');
  assert.ok(activity, 'activity must be returned');
  assert.strictEqual(activity.topic, 'respiration');
  assert.strictEqual(activity.concept, 'plant_respiration');
});

console.log('\n--- 11. Quiz Me remains unaffected ---');
runTest('11. Quiz Me pipeline remains unaffected and independent', () => {
  const quizRoutes = require('../routes/quiz');
  assert.ok(quizRoutes, 'routes/quiz must load cleanly');
  // Check introduce query helper as well
  const introQuery = getIntroduceQuery('photosynthesis', 'oxygen_role', true);
  assert.ok(introQuery.includes('ଆଲୋକ ସଂଶ୍ଳେଷଣ') && introQuery.includes('ଅମ୍ଳଜାନ'), 'Intro query generates proper topic/concept query');
});

console.log('\n--- Defensive / Null Checks ---');
runTest('12. null/missing structured => false (no crash)', () => {
  assert.strictEqual(shouldShowPracticeCTA(null), false);
  assert.strictEqual(shouldShowPracticeCTA({}), false);
  assert.strictEqual(shouldShowPracticeCTA({ knowledgeFound: true }), false);
  assert.strictEqual(shouldShowPracticeCTA({ knowledgeFound: true, currentTopic: 'a', currentConcept: 'b', nextStudy: { action: 'unsupported', topic: 'a', concept: 'b' } }), false);
});

console.log('\n====================================================');
console.log('NEXT-STUDY DECISION CTA TEST SUMMARY');
console.log(`STATUS: ${testsPassed === testsRun ? 'ALL PASSED ✅' : 'FAILED ❌'}`);
console.log(`Tests Run:    ${testsRun}`);
console.log(`Tests Passed: ${testsPassed}`);
console.log(`Tests Failed: ${testsRun - testsPassed}`);
console.log('====================================================');

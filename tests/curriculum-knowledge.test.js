'use strict';

const assert = require('assert');
const {
  CURRICULUM_CONCEPTS,
  validateCurriculumKnowledgeBase,
  findCurriculumConcept
} = require('../lib/curriculumKnowledge');

const {
  CLASS_9_KNOWLEDGE,
  getClass9Knowledge,
  findRelevantClass9Knowledge,
  validateAgainstClass9Knowledge,
  validateClass9KnowledgeBase
} = require('../lib/class9Knowledge');

console.log('====================================================');
console.log('📚 CURRICULUM KNOWLEDGE BASE TEST SUITE (CLASS 6-10)');
console.log('====================================================\n');

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

// 1. KB loads successfully
runTest('1. KB loads successfully and contains concepts', () => {
  assert(Array.isArray(CURRICULUM_CONCEPTS), 'CURRICULUM_CONCEPTS must be an array');
  assert(CURRICULUM_CONCEPTS.length >= 10, 'KB should have substantial concepts');
});

// 2-6. Grades 6-10 exist
const grades = new Set();
CURRICULUM_CONCEPTS.forEach(c => {
  for (let g = c.gradeRange[0]; g <= c.gradeRange[1]; g++) grades.add(g);
});

runTest('2. Class 6 exists in curriculum', () => assert(grades.has(6)));
runTest('3. Class 7 exists in curriculum', () => assert(grades.has(7)));
runTest('4. Class 8 exists in curriculum', () => assert(grades.has(8)));
runTest('5. Class 9 exists in curriculum', () => assert(grades.has(9)));
runTest('6. Class 10 exists in curriculum', () => assert(grades.has(10)));

// 7-8. Subjects exist
const subjects = new Set(CURRICULUM_CONCEPTS.map(c => c.subject));
runTest('7. Science exists in curriculum', () => assert(subjects.has('science')));
runTest('8. Mathematics exists in curriculum', () => assert(subjects.has('mathematics')));

// 9. Existing Class 9 topics resolve
const c9Core = ['photosynthesis', 'respiration', 'matter', 'states_of_matter', 'evaporation', 'water_cycle', 'cell', 'force_and_motion'];
runTest('9. Existing Class 9 topics exist in curriculum KB', () => {
  c9Core.forEach(t => {
    const found = CURRICULUM_CONCEPTS.some(c => c.topic === t || c.id.includes(t));
    assert(found, `Class 9 topic ${t} should exist in curriculum KB`);
  });
});

// 10-12. Core topics resolve
runTest('10. Photosynthesis resolves', () => {
  const res = findCurriculumConcept('What is photosynthesis?');
  assert(res && res.topic === 'photosynthesis');
});

runTest('11. Respiration resolves', () => {
  const res = findCurriculumConcept('What is respiration?');
  assert(res && res.topic === 'respiration');
});

runTest('12. Reproduction resolves', () => {
  const res = findCurriculumConcept('What is reproduction?');
  assert(res && res.topic === 'reproduction');
});

// 13. Prerequisite references are valid
// 14. Related concept references are valid
// 15. Misconception entries are valid
// 16. English metadata exists
// 17. Required Odia terminology exists
runTest('13-17. Curriculum knowledge validation passes', () => {
  const val = validateCurriculumKnowledgeBase();
  assert.strictEqual(val.valid, true, `Validation failed: ${val.detail}`);
});

// 18. Duplicate IDs are rejected
runTest('18. Duplicate IDs are rejected by validator', () => {
  const orig = CURRICULUM_CONCEPTS[0];
  CURRICULUM_CONCEPTS.push({ ...orig });
  const val = validateCurriculumKnowledgeBase();
  CURRICULUM_CONCEPTS.pop();
  assert.strictEqual(val.valid, false, 'Validator should detect duplicate ID');
  assert(val.errors.some(e => e.includes('Duplicate concept ID')));
});

// 19. Existing class9Knowledge compatibility tests pass
runTest('19. Existing class9Knowledge compatibility verified', () => {
  const c9Val = validateClass9KnowledgeBase();
  assert.strictEqual(c9Val.valid, true, `Class 9 validation failed: ${c9Val.detail}`);
  const kb = getClass9Knowledge('photosynthesis');
  assert(kb && kb.id === 'photosynthesis');
  const direct = findRelevantClass9Knowledge('ଆଲୋକ ସଂଶ୍ଳେଷଣ କଣ?');
  assert(direct && direct.id === 'photosynthesis');
});

console.log('\n--- Demonstration Queries (English & Odia) ---');

const demoQueries = [
  'What is photosynthesis?',
  'What is respiration?',
  'What is reproduction?',
  'What is force?',
  'What is motion?',
  "ଆଲୋକ ସଂଶ୍ଳେଷଣ କ'ଣ?",
  "ଶ୍ୱାସକ୍ରିୟା କ'ଣ?",
  "ପ୍ରଜନନ କ'ଣ?",
  "ବଳ କ'ଣ?",
  "ଗତି କ'ଣ?"
];

for (const q of demoQueries) {
  const match = findCurriculumConcept(q);
  assert(match, `Demonstration query must resolve: "${q}"`);
  console.log(`Query: "${q}" -> Grade: ${match.grade}, Subject: ${match.subject}, Chapter: ${match.chapter}, Topic: ${match.topic}, Concept: ${match.concept}`);
}

console.log('\n====================================================');
console.log(`STATUS: ALL PASSED ✅ (${testsPassed}/${testsRun})`);
console.log('====================================================');

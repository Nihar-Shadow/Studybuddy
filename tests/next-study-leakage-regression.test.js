'use strict';

const assert = require('assert');
const {
  createInitialLearningState,
  recordLearningEvent,
  chooseNextStudyAction,
  resolveTopicAndConcept,
  getConceptState
} = require('../lib/studentLearningState');
const {
  findRelevantClass9Knowledge
} = require('../lib/class9Knowledge');
const {
  getTargetedPractice
} = require('../lib/targetedPractice');
const {
  shouldShowPracticeCTA
} = require('../public/scripts/agent');

function simulateChatNextStudy(question, language = 'English', state) {
  const targetKnowledge = findRelevantClass9Knowledge(question, language);
  const { topic: identifiedTopic, concept: identifiedConcept } = resolveTopicAndConcept(question, targetKnowledge);

  recordLearningEvent(state, {
    topic: identifiedTopic,
    concept: identifiedConcept,
    evidence: 'asked_about_concept'
  });

  let nextStudyAction = null;
  if (targetKnowledge && identifiedTopic && identifiedTopic !== 'general_science') {
    const candidateAction = chooseNextStudyAction(state, {
      currentTopic: identifiedTopic,
      currentConcept: identifiedConcept
    });

    if (candidateAction && candidateAction.topic === identifiedTopic) {
      const validPractice = getTargetedPractice({
        topic: candidateAction.topic,
        concept: candidateAction.concept
      }, language);
      if (validPractice && !validPractice.exhausted) {
        nextStudyAction = candidateAction;
      }
    }
  }

  const structured = {
    currentTopic: identifiedTopic || null,
    currentConcept: identifiedConcept || null,
    knowledgeFound: !!targetKnowledge,
    nextStudy: nextStudyAction
  };

  return { targetKnowledge, identifiedTopic, identifiedConcept, nextStudyAction, structured };
}

console.log('====================================================');
console.log('🧪 NEXT-STUDY LEAKAGE REGRESSION SUITE (A - I)');
console.log('====================================================');

// A. Fresh motion query -> no unrelated action
console.log('\n--- A. Fresh motion query ---');
{
  const state = createInitialLearningState({ language: 'English', grade: 6 });
  const result = simulateChatNextStudy('What is motion?', 'English', state);

  assert.strictEqual(result.structured.knowledgeFound, true, 'Motion should resolve curriculum knowledge');
  assert.strictEqual(result.structured.currentTopic, 'motion_basics');
  assert.strictEqual(result.nextStudyAction, null, 'Fresh motion query must produce null nextStudy (no practice in bank)');
  assert.strictEqual(shouldShowPracticeCTA(result.structured), false, 'CTA must not appear');
  console.log('  ✓ Fresh motion query produces null nextStudy and suppresses CTA');
}

// B. Fresh reproduction query -> no unrelated action
console.log('\n--- B. Fresh reproduction query ---');
{
  const state = createInitialLearningState({ language: 'English', grade: 9 });
  const result = simulateChatNextStudy('What is reproduction?', 'English', state);

  assert.strictEqual(result.structured.knowledgeFound, true, 'Reproduction should resolve curriculum knowledge');
  assert.strictEqual(result.structured.currentTopic, 'reproduction');
  assert.strictEqual(result.nextStudyAction, null, 'Fresh reproduction query must produce null nextStudy (no practice in bank)');
  assert.strictEqual(shouldShowPracticeCTA(result.structured), false, 'CTA must not appear');
  console.log('  ✓ Fresh reproduction query produces null nextStudy and suppresses CTA');
}

// C. Student previously practiced force -> asks motion -> action must not become force
console.log('\n--- C. Previous force practice does not leak to motion ---');
{
  const state = createInitialLearningState({ language: 'English', grade: 9 });
  // Prior activity on force_and_motion
  recordLearningEvent(state, {
    topic: 'force_and_motion',
    concept: 'inertia_first_law',
    evidence: 'practice_incorrect'
  });
  assert.strictEqual(state.concepts['force_and_motion'].status, 'needs_review');

  // Now student asks "What is motion?"
  const result = simulateChatNextStudy('What is motion?', 'English', state);

  assert.strictEqual(result.structured.currentTopic, 'motion_basics');
  assert.strictEqual(result.nextStudyAction, null, 'Prior force activity must not leak to motion query');
  assert.strictEqual(shouldShowPracticeCTA(result.structured), false, 'CTA must not appear');
  console.log('  ✓ Prior force practice state does not contaminate motion nextStudy decision');
}

// D. Student previously practiced photosynthesis -> asks reproduction -> action must not become photosynthesis
console.log('\n--- D. Previous photosynthesis practice does not leak to reproduction ---');
{
  const state = createInitialLearningState({ language: 'English', grade: 9 });
  // Prior activity on photosynthesis
  recordLearningEvent(state, {
    topic: 'photosynthesis',
    concept: 'oxygen_role',
    evidence: 'needed_repair'
  });
  assert.strictEqual(state.concepts['photosynthesis'].status, 'needs_review');

  // Now student asks "What is reproduction?"
  const result = simulateChatNextStudy('What is reproduction?', 'English', state);

  assert.strictEqual(result.structured.currentTopic, 'reproduction');
  assert.strictEqual(result.nextStudyAction, null, 'Prior photosynthesis activity must not leak to reproduction query');
  assert.strictEqual(shouldShowPracticeCTA(result.structured), false, 'CTA must not appear');
  console.log('  ✓ Prior photosynthesis practice state does not contaminate reproduction nextStudy decision');
}

// E. Same four tests in Odia
console.log('\n--- E. Odia equivalents (E1 - E4) ---');
{
  // E1. Fresh Odia motion query
  const state1 = createInitialLearningState({ language: 'Odia', grade: 6 });
  const resE1 = simulateChatNextStudy('ଗତି କ\'ଣ?', 'Odia', state1);
  assert.strictEqual(resE1.structured.knowledgeFound, true);
  assert.strictEqual(resE1.nextStudyAction, null);
  assert.strictEqual(shouldShowPracticeCTA(resE1.structured), false);
  console.log('  ✓ E1. Fresh Odia motion: nextStudy is null, no CTA');

  // E2. Fresh Odia reproduction query
  const state2 = createInitialLearningState({ language: 'Odia', grade: 9 });
  const resE2 = simulateChatNextStudy('ପ୍ରଜନନ କ\'ଣ?', 'Odia', state2);
  assert.strictEqual(resE2.structured.knowledgeFound, true);
  assert.strictEqual(resE2.nextStudyAction, null);
  assert.strictEqual(shouldShowPracticeCTA(resE2.structured), false);
  console.log('  ✓ E2. Fresh Odia reproduction: nextStudy is null, no CTA');

  // E3. Prior force practice -> Odia motion query
  const state3 = createInitialLearningState({ language: 'Odia', grade: 9 });
  recordLearningEvent(state3, {
    topic: 'force_and_motion',
    concept: 'inertia_first_law',
    evidence: 'practice_incorrect'
  });
  const resE3 = simulateChatNextStudy('ଗତି କ\'ଣ?', 'Odia', state3);
  assert.strictEqual(resE3.nextStudyAction, null);
  assert.strictEqual(shouldShowPracticeCTA(resE3.structured), false);
  console.log('  ✓ E3. Prior force practice does not contaminate Odia motion nextStudy');

  // E4. Prior photosynthesis practice -> Odia reproduction query
  const state4 = createInitialLearningState({ language: 'Odia', grade: 9 });
  recordLearningEvent(state4, {
    topic: 'photosynthesis',
    concept: 'oxygen_role',
    evidence: 'needed_repair'
  });
  const resE4 = simulateChatNextStudy('ପ୍ରଜନନ କ\'ଣ?', 'Odia', state4);
  assert.strictEqual(resE4.nextStudyAction, null);
  assert.strictEqual(shouldShowPracticeCTA(resE4.structured), false);
  console.log('  ✓ E4. Prior photosynthesis practice does not contaminate Odia reproduction nextStudy');
}

// F. Existing Class 9 photosynthesis/respiration/force behavior remains unchanged
console.log('\n--- F. Existing Class 9 verified behavior preserved ---');
{
  const state = createInitialLearningState({ language: 'Odia', grade: 9 });

  // F1. Photosynthesis question
  const resPhoto = simulateChatNextStudy('ଆଲୋକ ସଂଶ୍ଳେଷଣରେ ଅମ୍ଳଜାନର ଭୂମିକା କ\'ଣ?', 'Odia', state);
  assert.strictEqual(resPhoto.structured.knowledgeFound, true);
  assert.strictEqual(resPhoto.structured.currentTopic, 'photosynthesis');
  assert.strictEqual(resPhoto.structured.currentConcept, 'oxygen_role');
  assert.ok(resPhoto.nextStudyAction, 'Photosynthesis must produce nextStudy action');
  assert.strictEqual(resPhoto.nextStudyAction.topic, 'photosynthesis');
  assert.strictEqual(resPhoto.nextStudyAction.concept, 'oxygen_role');
  assert.strictEqual(shouldShowPracticeCTA(resPhoto.structured), true, 'Practice CTA must show');
  console.log('  ✓ F1. Photosynthesis query produces matching nextStudy and active CTA');

  // F2. Respiration question
  const resResp = simulateChatNextStudy('ଗଛ ଦିନବେଳେ ଶ୍ୱାସକ୍ରିୟା କରେ କି?', 'Odia', state);
  assert.strictEqual(resResp.structured.knowledgeFound, true);
  assert.strictEqual(resResp.structured.currentTopic, 'respiration');
  assert.strictEqual(resResp.structured.currentConcept, 'plant_respiration');
  assert.ok(resResp.nextStudyAction, 'Respiration must produce nextStudy action');
  assert.strictEqual(resResp.nextStudyAction.topic, 'respiration');
  assert.strictEqual(resResp.nextStudyAction.concept, 'plant_respiration');
  assert.strictEqual(shouldShowPracticeCTA(resResp.structured), true, 'Practice CTA must show');
  console.log('  ✓ F2. Respiration query produces matching nextStudy and active CTA');

  // F3. Force question
  const resForce = simulateChatNextStudy('What is force?', 'English', state);
  assert.strictEqual(resForce.structured.knowledgeFound, true);
  assert.strictEqual(resForce.structured.currentTopic, 'force_and_motion');
  assert.ok(resForce.nextStudyAction, 'Force must produce nextStudy action');
  assert.strictEqual(resForce.nextStudyAction.topic, 'force_and_motion');
  assert.strictEqual(shouldShowPracticeCTA(resForce.structured), true, 'Practice CTA must show');
  console.log('  ✓ F3. Force query produces matching nextStudy and active CTA');
}

console.log('\n====================================================');
console.log('🎉 ALL NEXT-STUDY REGRESSION TESTS PASSED! ✅');
console.log('====================================================');

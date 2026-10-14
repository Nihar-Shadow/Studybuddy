'use strict';

const assert = require('assert');
const {
  CLASS_9_KNOWLEDGE,
  findRelevantClass9Knowledge,
  validateAgainstClass9Knowledge,
  getVerifiedAnswer
} = require('../lib/class9Knowledge');
const {
  validateOdiaTutorAnswer,
  validateFactualRelationships,
  extractOdiaContentPlan
} = require('../lib/languagePolicy');
const {
  resolveTopicAndConcept,
  createInitialLearningState,
  recordLearningEvent,
  getConceptState
} = require('../lib/studentLearningState');
const chatRouter = require('../routes/chat');

console.log('\n=== Judge Failure Regression Test Suite ===\n');

let passed = 0;
let failed = 0;

function runTest(name, fn) {
  try {
    fn();
    console.log(`  ✓ ${name}`);
    passed++;
  } catch (err) {
    console.error(`  ❌ ${name}: ${err.message}`);
    failed++;
    throw err;
  }
}

async function runAsyncTest(name, fn) {
  try {
    await fn();
    console.log(`  ✓ ${name}`);
    passed++;
  } catch (err) {
    console.error(`  ❌ ${name}: ${err.message}`);
    failed++;
    throw err;
  }
}

async function main() {
  // ── Test A: Direct Question ──────────────────────────────────────────
  runTest('A. Direct question detects photosynthesis knowledge', () => {
  const directQ = "ଆଲୋକ ସଂଶ୍ଳେଷଣରେ ଅମ୍ଳଜାନର କ'ଣ ହୁଏ?";
  const knowledge = findRelevantClass9Knowledge(directQ, 'Odia');
  assert(knowledge, 'Knowledge must be found');
  assert.strictEqual(knowledge.id, 'photosynthesis', 'Topic must be photosynthesis');
});

// ── Test B: Follow-up Question ───────────────────────────────────────
runTest('B. Follow-up resolves topic from conversation context', () => {
  const previousHistory = [
    { role: 'user', content: "ଆଲୋକ ସଂଶ୍ଳେଷଣରେ ଅମ୍ଳଜାନର କ'ଣ ହୁଏ?" },
    { role: 'assistant', content: "ଆଲୋକ ସଂଶ୍ଳେଷଣ ସମୟରେ ଉଦ୍ଭିଦ ଅମ୍ଳଜାନ ନିର୍ଗତ କରେ।" }
  ];
  const followUpQ = "ଅମ୍ଳଜାନ ଆସେ କେଉଁଠାରୁ?";
  const knowledge = findRelevantClass9Knowledge(followUpQ, 'Odia', previousHistory);
  assert(knowledge, 'Knowledge must be found for follow-up');
  assert.strictEqual(knowledge.id, 'photosynthesis', 'Topic must resolve to photosynthesis');

  // Also verify observed judge student request:
  const judgeQ = "ତୁମେ ଠିକ୍ ଭାବେ ବୁଝାଇନାହଁ। ଅମ୍ଳଜାନ ଆସେ କେଉଁଠାରୁ? ପୁଣିଥରେ ସହଜ ଭାବରେ ବୁଝାଅ।";
  const judgeKnowledge = findRelevantClass9Knowledge(judgeQ, 'Odia', previousHistory);
  assert(judgeKnowledge, 'Knowledge must be found for judge request');
  assert.strictEqual(judgeKnowledge.id, 'photosynthesis', 'Topic must resolve to photosynthesis');
});

// ── Test C: Follow-up Inherits Only When Prior Context Establishes It ──
runTest('C. Follow-up inherits photosynthesis context only when prior context clearly establishes it', () => {
  const followUpPronoun = "ଏହା କେଉଁଠାରୁ ଆସେ?";

  // With photosynthesis context:
  const withContext = [
    { role: 'user', content: "ଆଲୋକ ସଂଶ୍ଳେଷଣରେ ଅମ୍ଳଜାନର କ'ଣ ହୁଏ?" }
  ];
  const kWithContext = findRelevantClass9Knowledge(followUpPronoun, 'Odia', withContext);
  assert(kWithContext, 'Must inherit photosynthesis when prior context establishes it');
  assert.strictEqual(kWithContext.id, 'photosynthesis');

  // Without context (empty history):
  const kNoContext = findRelevantClass9Knowledge(followUpPronoun, 'Odia', []);
  assert.strictEqual(kNoContext, null, 'Must NOT inherit when no prior context exists');

  // With unrelated context (not establishing a Class 9 science topic):
  const unrelatedContext = [
    { role: 'user', content: "ଭାରତର ରାଜଧାନୀ କ'ଣ?" }
  ];
  const kUnrelated = findRelevantClass9Knowledge(followUpPronoun, 'Odia', unrelatedContext);
  assert.strictEqual(kUnrelated, null, 'Must NOT inherit when prior context is unrelated');
});

// ── Test D: Incorrect Factual Answer (Oxygen from CO2) ───────────────
runTest('D. Incorrect factual answer claiming oxygen comes from CO2 fails validation', () => {
  const badAnswer = "ଅମ୍ଳଜାନ CO₂ ରୁ ଆସେ";
  const valC9 = validateAgainstClass9Knowledge(badAnswer, CLASS_9_KNOWLEDGE.photosynthesis);
  assert.strictEqual(valC9.valid, false, 'Must fail Class 9 knowledge validation');
  assert.strictEqual(valC9.failedFactRule, 'rule1_photosynthesis_oxygen_from_co2');

  const valFactual = validateFactualRelationships(badAnswer, "ଅମ୍ଳଜାନ ଆସେ କେଉଁଠାରୁ?", { topic: 'photosynthesis' });
  assert.strictEqual(valFactual.valid, false, 'Must fail factual relationship validation');
  assert.strictEqual(valFactual.failedFactRule, 'rule1_photosynthesis_oxygen_from_co2');
});

// ── Test E: Correct Factual Answer (Oxygen from Water) ───────────────
runTest('E. Correct factual answer saying oxygen comes from water passes validation', () => {
  const goodAnswer = "ଜଳରୁ ଅମ୍ଳଜାନ ମୁକ୍ତ ହୁଏ";
  const valC9 = validateAgainstClass9Knowledge(goodAnswer, CLASS_9_KNOWLEDGE.photosynthesis);
  assert.strictEqual(valC9.valid, true, `Must pass Class 9 validation: ${valC9.reason} - ${valC9.detail}`);

  const fallbackAnswer = getVerifiedAnswer("ଅମ୍ଳଜାନ ଆସେ କେଉଁଠାରୁ?", CLASS_9_KNOWLEDGE.photosynthesis);
  assert(fallbackAnswer.includes('ଜଳ'), 'Fallback must mention water');
  assert(!fallbackAnswer.includes('CO2 ରୁ ଆସେ'), 'Fallback must not claim oxygen from CO2');
  const valFb = validateAgainstClass9Knowledge(fallbackAnswer, CLASS_9_KNOWLEDGE.photosynthesis);
  assert.strictEqual(valFb.valid, true, 'Verified fallback must pass validation');
});

  // ── Test F: Ensure /chat Never Throws "fallbackUsed is not defined" ──
  await runAsyncTest('F. Ensure /chat never throws ReferenceError: fallbackUsed is not defined', async () => {
  // Find /chat route handler
  const chatLayer = chatRouter.stack.find(s => s.route && s.route.path === '/chat' && s.route.methods.post);
  assert(chatLayer, '/chat post route must exist');
  const chatHandler = chatLayer.route.stack[0].handle;

  // Mock request and response
  const writtenData = [];
  const mockReq = {
    method: 'POST',
    url: '/chat',
    headers: { 'content-type': 'application/json' },
    session: { user: { id: 1, username: 'testuser' } },
    body: {
      message: 'ତୁମେ ଠିକ୍ ଭାବେ ବୁଝାଇନାହଁ। ଅମ୍ଳଜାନ ଆସେ କେଉଁଠାରୁ? ପୁଣିଥରେ ସହଜ ଭାବରେ ବୁଝାଅ।',
      language: 'Odia',
      history: [
        { role: 'user', content: "ଆଲୋକ ସଂଶ୍ଳେଷଣରେ ଅମ୍ଳଜାନର କ'ଣ ହୁଏ?" },
        { role: 'assistant', content: "ଆଲୋକ ସଂଶ୍ଳେଷଣ ସମୟରେ ଉଦ୍ଭିଦ ଅମ୍ଳଜାନ ନିର୍ଗତ କରେ।" }
      ]
    },
    on: () => {}
  };

  let finished = false;
  let sseEnded = false;
  let caughtError = null;

  const mockRes = {
    headersSent: true,
    writeHead: () => {},
    setHeader: () => {},
    flushHeaders: () => {},
    status: () => mockRes,
    json: () => {},
    write: (chunk) => {
      writtenData.push(chunk);
    },
    end: () => {
      finished = true;
    }
  };

  try {
    await chatHandler(mockReq, mockRes);
  } catch (err) {
    caughtError = err;
  }

  if (caughtError) {
    assert.fail(`/chat handler threw an error: ${caughtError.message}`);
  }

  // Check that fallbackUsed ReferenceError never occurred
  for (const chunk of writtenData) {
    assert(!chunk.includes('fallbackUsed is not defined'), 'SSE output must not contain fallbackUsed is not defined');
  }
});

// ── Test H1: Student Day Respiration Misconception ───────────────────
runTest('H1. Day respiration misconception resolves to respiration topic and plant_respiration concept', () => {
  const query = "ଗଛ ଦିନବେଳେ ଆଲୋକ ସଂଶ୍ଳେଷଣ କରେ, ତେଣୁ ଦିନବେଳେ ଗଛ ଶ୍ୱାସକ୍ରିୟା କରେ ନାହିଁ। ଏହା ସତ କି?";
  const knowledge = findRelevantClass9Knowledge(query, 'Odia');
  assert(knowledge, 'Knowledge must be found');
  assert.strictEqual(knowledge.id, 'respiration', 'Primary topic must be respiration');

  const { topic, concept } = resolveTopicAndConcept(query, knowledge);
  assert.strictEqual(topic, 'respiration', 'Topic must be respiration');
  assert.strictEqual(concept, 'plant_respiration', 'Concept must be plant_respiration');
});

// ── Test H2: Comparison Question with Explicit Respiration Query ─────
runTest('H2. Explicit respiration question comparing to photosynthesis resolves to respiration with secondary photosynthesis', () => {
  const query = "ଗଛ respiration କରେ କି? ଯଦି କରେ, ତେବେ photosynthesis ସହିତ ଏହାର ପାର୍ଥକ୍ୟ କ'ଣ?";
  const knowledge = findRelevantClass9Knowledge(query, 'Odia');
  assert(knowledge, 'Knowledge must be found');
  assert.strictEqual(knowledge.id, 'respiration', 'Primary topic must be respiration');
  assert.strictEqual(knowledge.secondaryTopic, 'photosynthesis', 'Secondary topic must be photosynthesis');

  const { topic, concept, secondaryTopic, secondaryConcept } = resolveTopicAndConcept(query, knowledge);
  assert.strictEqual(topic, 'respiration', 'Topic must be respiration');
  assert.strictEqual(concept, 'plant_respiration', 'Concept must be plant_respiration');
  assert.strictEqual(secondaryTopic, 'photosynthesis', 'Secondary topic must be photosynthesis');

  // Verify learning state update does not set understood
  const state = createInitialLearningState();
  const record = recordLearningEvent(state, {
    topic,
    concept,
    secondaryTopic,
    secondaryConcept,
    evidence: 'asked_about_concept'
  });
  assert.notStrictEqual(record.conceptState.status, 'understood', 'Asking a question must never produce understood status');
  assert.strictEqual(record.conceptState.status, 'partial', 'Asking question should produce partial status');
});

// ── Test H3: Comparison Question Order Neutrality ────────────────────
runTest('H3. "ମୁଁ photosynthesis ଓ respiration ମଧ୍ୟରେ ପାର୍ଥକ୍ୟ କ\'ଣ?" does not automatically become photosynthesis', () => {
  const query = "ମୁଁ photosynthesis ଓ respiration ମଧ୍ୟରେ ପାର୍ଥକ୍ୟ କ'ଣ?";
  const knowledge = findRelevantClass9Knowledge(query, 'Odia');
  assert(knowledge, 'Knowledge must be found');
  assert.strictEqual(knowledge.id, 'respiration', 'Must not automatically become photosynthesis merely because photosynthesis appears first');
  assert.strictEqual(knowledge.secondaryTopic, 'photosynthesis', 'Photosynthesis should be retained as secondary comparison context');

  const { topic, secondaryTopic } = resolveTopicAndConcept(query, knowledge);
  assert.strictEqual(topic, 'respiration');
  assert.strictEqual(secondaryTopic, 'photosynthesis');
});

// ── Test H4: asked_about_concept Cannot Transition Directly to understood ──
runTest('H4. asked_about_concept cannot transition directly to understood', () => {
  const state = createInitialLearningState();

  // Ask 10 questions in a row on the same concept
  for (let i = 0; i < 10; i++) {
    recordLearningEvent(state, {
      topic: 'respiration',
      concept: 'plant_respiration',
      evidence: 'asked_about_concept'
    });
  }

  const cState = getConceptState(state, 'respiration');
  assert.strictEqual(cState.status, 'partial', 'Repeated questions must remain partial and never transition directly to understood');
  assert.notStrictEqual(cState.status, 'understood', 'asked_about_concept cannot transition directly to understood');
  assert(cState.confidence <= 0.60, 'Confidence must be capped below mastery on pure question asking');
});

  // ── Test I_A: LLM bad answer + repair succeeds ───────────────────────
  await runAsyncTest('I_A. LLM bad answer + repair succeeds -> repaired validated answer returned', async () => {
  const query = "ଆଲୋକ ସଂଶ୍ଳେଷଣରେ କେଉଁ ଗ୍ୟାସ ନିଆଯାଏ?";
  const plan = extractOdiaContentPlan(query);
  const kb = findRelevantClass9Knowledge(query, 'Odia');

  const badReply = "ଗଛ ଅମ୍ଳଜାନ ନିଏ ଏବଂ ଅଙ୍ଗାରକାମ୍ଳ ଛାଡ଼େ।"; // invalid
  const goodRepairedReply = "ଆଲୋକ ସଂଶ୍ଳେଷଣ ପ୍ରକ୍ରିୟାରେ ସବୁଜ ଉଦ୍ଭିଦ ବାୟୁରୁ ଅଙ୍ଗାରକାମ୍ଳ ଗ୍ରହଣ କରେ। ଏଥିସହିତ ସୂର୍ଯ୍ୟାଲୋକ ଏବଂ ଜଳ ବ୍ୟବହାର କରି ଖାଦ୍ୟ ପ୍ରସ୍ତୁତ କରେ ଏବଂ ଅମ୍ଳଜାନ ନିର୍ଗତ କରେ।";

  const result = await chatRouter.runOdiaSafetyPipeline({
    rawReply: badReply,
    message: query,
    odiaContentPlan: plan,
    class9Knowledge: kb,
    repairFetcher: async () => goodRepairedReply
  });

  assert.strictEqual(result.finalReply, goodRepairedReply, 'Should return repaired answer');
  assert.strictEqual(result.repairSucceeded, true, 'repairSucceeded must be true');
  assert.strictEqual(result.initialValidationPassed, false, 'initialValidationPassed must be false');
  assert.strictEqual(result.finalValidationResult, 'PASSED', 'finalValidationResult must be PASSED');
  assert.strictEqual(result.fallbackAttempted, false, 'fallbackAttempted must be false when repair succeeded');
  assert.strictEqual(result.fallbackUsed, false, 'fallbackUsed must be false');
});

  // ── Test I_B: LLM bad answer + repair fails + fallback succeeds ──────
  await runAsyncTest('I_B. LLM bad answer + repair fails + fallback succeeds -> verified fallback returned', async () => {
  const query = "ଆଲୋକ ସଂଶ୍ଳେଷଣ କ'ଣ?";
  const plan = extractOdiaContentPlan(query);
  const kb = findRelevantClass9Knowledge(query, 'Odia');

  const badReply = "ଗଛ ଅମ୍ଳଜାନ ଗ୍ରହଣ କରେ।";
  const badRepair = "ଏହା ସତ ଯେ ଗଛ ଅମ୍ଳଜାନ ନିଏ।"; // repair fails too

  const result = await chatRouter.runOdiaSafetyPipeline({
    rawReply: badReply,
    message: query,
    odiaContentPlan: plan,
    class9Knowledge: kb,
    repairFetcher: async () => badRepair
  });

  assert.strictEqual(result.repairSucceeded, false, 'repairSucceeded must be false');
  assert.strictEqual(result.fallbackAttempted, true, 'fallbackAttempted must be true');
  assert.strictEqual(result.fallbackUsed, true, 'fallbackUsed must be true');
  assert.strictEqual(result.finalSafetyFallback, false, 'finalSafetyFallback must be false when topic fallback succeeded');
  assert.strictEqual(result.finalValidationResult, 'PASSED', 'finalValidationResult must be PASSED');
  assert(result.finalReply.includes('ଆଲୋକ ସଂଶ୍ଳେଷଣ'), 'Returned fallback must explain photosynthesis');
});

  // ── Test I_C: LLM bad answer + repair fails + fallback fails ──────────
  await runAsyncTest('I_C. LLM bad answer + repair fails + fallback validation fails -> NEVER return original LLM answer', async () => {
    const query = "କିଛି ଏକ ଅଜଣା ବିଜ୍ଞାନ ପ୍ରଶ୍ନ";
    const plan = { topic: 'unknown', requestedConcepts: [], conceptsMap: new Set() };
    // knowledge null so no verified class9 answer exists
    const badReply = "ଭୁଲ ଉତ୍ତର";
    const badRepair = "ଉଦ୍ଭିଦ ସଂଶ୍ଲେଷଣ ବୋଲି କହିବା ଭୁଲ।"; // contains corrupted vocabulary, fails validation!

    const result = await chatRouter.runOdiaSafetyPipeline({
      rawReply: badReply,
      message: query,
      odiaContentPlan: plan,
      class9Knowledge: null,
      repairFetcher: async () => badRepair
    });

  assert.notStrictEqual(result.finalReply, badReply, 'NEVER return original unvalidated LLM answer');
  assert.notStrictEqual(result.finalReply, badRepair, 'NEVER return failed repaired text');
  assert.strictEqual(result.finalSafetyFallback, true, 'Must enter final safety fallback path');
  assert.strictEqual(result.finalValidationResult, 'PASSED', 'Final returned response must not be marked validation=FAILED');
  assert(result.finalReply.includes('ଅସୁବିଧା ହେଉଛି'), 'Safe deterministic response must explain inability to confidently answer');
});

  // ── Test I_D: Fallback telemetry flags ────────────────────────────────
  await runAsyncTest('I_D. Fallback telemetry flags accurate across outcomes', async () => {
  const query = "କିଛି ଅଜଣା ପ୍ରଶ୍ନ";
  const badReply = "ଅଳ୍ପ ଲେଖା"; // too short, invalid

  // Case 1: Fallback attempted and failed -> fallback_attempted=true, fallback_used=false
  const resFailed = await chatRouter.runOdiaSafetyPipeline({
    rawReply: badReply,
    message: query,
    odiaContentPlan: null,
    class9Knowledge: null,
    repairFetcher: async () => badReply
  });

  assert.strictEqual(resFailed.fallbackAttempted, true, 'fallback_attempted must be true');
  assert.strictEqual(resFailed.fallbackUsed, false, 'fallback_used must be false when fallback failed');
  assert.strictEqual(resFailed.finalSafetyFallback, true, 'final_safety_fallback must be true');

  // Case 2: Fallback attempted and succeeded -> fallback_attempted=true, fallback_used=true
  const validTopicQuery = "ଆଲୋକ ସଂଶ୍ଳେଷଣ କ'ଣ?";
  const kb = findRelevantClass9Knowledge(validTopicQuery, 'Odia');
  const resSuccess = await chatRouter.runOdiaSafetyPipeline({
    rawReply: badReply,
    message: validTopicQuery,
    odiaContentPlan: extractOdiaContentPlan(validTopicQuery),
    class9Knowledge: kb,
    repairFetcher: async () => badReply
  });

  assert.strictEqual(resSuccess.fallbackAttempted, true, 'fallback_attempted must be true');
  assert.strictEqual(resSuccess.fallbackUsed, true, 'fallback_used must be true only when fallback actually becomes returned answer');
  assert.strictEqual(resSuccess.finalSafetyFallback, false, 'final_safety_fallback must be false when verified fallback worked');
});

  // ── Test I_E: Final Safety Guarantee ─────────────────────────────────
  await runAsyncTest('I_E. Final safety: If final answer cannot pass validation, do not return it as a tutor answer', async () => {
  const query = "ଆଲୋକ ସଂଶ୍ଳେଷଣ କ'ଣ?";
  const plan = extractOdiaContentPlan(query);
  const kb = findRelevantClass9Knowledge(query, 'Odia');

  const result = await chatRouter.runOdiaSafetyPipeline({
    rawReply: "ଗଛ ଅମ୍ଳଜାନ ନିଏ।", // invalid
    message: query,
    odiaContentPlan: plan,
    class9Knowledge: kb,
    repairFetcher: async () => "ଅମ୍ଳଜାନ ହିଁ ମୁଖ୍ୟ ଉପାଦାନ।" // invalid
  });

  const valQuality = validateOdiaTutorAnswer(result.finalReply, query, plan);
  const valC9 = validateAgainstClass9Knowledge(result.finalReply, kb);
  assert(valQuality.valid, `Final answer must pass quality validation: ${valQuality.reason}`);
  assert(valC9.valid, `Final answer must pass class 9 validation: ${valC9.reason}`);
  assert.strictEqual(result.finalValidationResult, 'PASSED');
});

  // ── Test I_F: Exact Adversarial Photosynthesis Question ──────────────
  await runAsyncTest('I_F. Adversarial reversed photosynthesis claim enters verified fallback or safety path without returning unvalidated answer', async () => {
  const adversarialQuery = "ମୁଁ ଜାଣିଛି ଯେ ଗଛ ଅମ୍ଳଜାନ ନେଇ ଆଲୋକ ସଂଶ୍ଳେଷଣ କରେ ଏବଂ ଅଙ୍ଗାରକାମ୍ଳ ଛାଡ଼େ। ମୁଁ ଠିକ୍ କହୁଛି କି?";
  const plan = extractOdiaContentPlan(adversarialQuery);
  const kb = findRelevantClass9Knowledge(adversarialQuery, 'Odia');

  assert(kb, 'Knowledge base must identify photosynthesis topic');
  assert.strictEqual(kb.id, 'photosynthesis');

  // Simulate LLM hallucinates agreeing with student
  const hallucinatedLLM = "ହଁ ତୁମେ ଠିକ୍ କହୁଛ, ଗଛ ଅମ୍ଳଜାନ ନେଇ ଆଲୋକ ସଂଶ୍ଳେଷଣ କରେ ଏବଂ ଅଙ୍ଗାରକାମ୍ଳ ବାହାର କରେ।";
  // Simulate repair attempt also fails
  const failedRepair = "ହଁ ଅମ୍ଳଜାନ ନିଏ ଏବଂ ଅଙ୍ଗାରକାମ୍ଳ ଛାଡ଼େ।";

  const result = await chatRouter.runOdiaSafetyPipeline({
    rawReply: hallucinatedLLM,
    message: adversarialQuery,
    odiaContentPlan: plan,
    class9Knowledge: kb,
    repairFetcher: async () => failedRepair
  });

  // 1. Must never return the hallucinated LLM or failed repair
  assert.notStrictEqual(result.finalReply, hallucinatedLLM, 'Must NEVER return unvalidated hallucinated LLM answer');
  assert.notStrictEqual(result.finalReply, failedRepair, 'Must NEVER return failed repair text');

  // 2. Returned answer must pass both validators
  const valQuality = validateOdiaTutorAnswer(result.finalReply, adversarialQuery, plan);
  const valC9 = validateAgainstClass9Knowledge(result.finalReply, kb);
  assert(valQuality.valid, `Returned answer must pass quality validation: ${valQuality.reason}`);
  assert(valC9.valid, `Returned answer must pass Class 9 validation: ${valC9.reason}`);

  // 3. Telemetry verification
  assert.strictEqual(result.initialValidationPassed, false, 'Initial validation must be false');
  assert.strictEqual(result.finalValidationResult, 'PASSED', 'Final validation must be PASSED');
  assert.strictEqual(result.fallbackAttempted, true, 'fallbackAttempted must be true');

  // 4. Must correct the misconception (O2 is released, CO2 is taken)
  assert(/ଅଙ୍ଗାରକାମ୍ଳ.*ଗ୍ରହଣ|ଗ୍ରହଣ.*ଅଙ୍ଗାରକାମ୍ଳ/i.test(result.finalReply), 'Must state plants take CO2');
  assert(/ଅମ୍ଳଜାନ.*ନିର୍ଗତ|ନିର୍ଗତ.*ଅମ୍ଳଜାନ/i.test(result.finalReply), 'Must state plants release O2');
  });

  console.log(`\nAll regression tests completed. Passed: ${passed}, Failed: ${failed}\n`);
}

main().catch(err => {
  console.error('\nFatal test runner error:', err);
  process.exit(1);
});

'use strict';

const assert = require('assert');
const http = require('http');
const {
  CLASS_9_KNOWLEDGE,
  getClass9Knowledge,
  findRelevantClass9Knowledge,
  validateAgainstClass9Knowledge,
  validateClass9KnowledgeBase,
  getVerifiedAnswer
} = require('../lib/class9Knowledge');
const {
  isOdia,
  containsOdiaScript,
  extractOdiaContentPlan,
  buildOdiaTutorPrompt,
  validateOdiaTutorAnswer,
  buildOdiaRepairPrompt,
  getOdiaDeterministicFallback
} = require('../lib/languagePolicy');
const {
  getModelForLanguage
} = require('../agent/models');

function httpJsonPost(urlStr, data, timeoutMs = 180000) {
  return new Promise((resolve, reject) => {
    const url = new URL(urlStr);
    const bodyStr = JSON.stringify(data);
    const req = http.request({
      hostname: url.hostname,
      port: url.port,
      path: url.pathname,
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(bodyStr)
      },
      timeout: timeoutMs
    }, (res) => {
      let chunks = '';
      res.on('data', d => { chunks += d; });
      res.on('end', () => {
        try {
          const parsed = JSON.parse(chunks);
          resolve({ ok: res.statusCode >= 200 && res.statusCode < 300, status: res.statusCode, json: async () => parsed });
        } catch (e) {
          resolve({ ok: false, status: res.statusCode, raw: chunks, error: e });
        }
      });
    });
    req.on('timeout', () => {
      req.destroy(new Error(`HTTP request timed out after ${timeoutMs}ms`));
    });
    req.on('error', reject);
    req.write(bodyStr);
    req.end();
  });
}

let testsRun = 0;
let testsPassed = 0;
let testsFailed = 0;
let totalRepairs = 0;
let totalFallbacks = 0;

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

async function runAsyncTest(name, fn) {
  testsRun++;
  try {
    await fn();
    testsPassed++;
    console.log(`  ✓ ${name}`);
  } catch (err) {
    testsFailed++;
    console.error(`  ❌ ${name}: ${err.message}`);
    throw err;
  }
}

/**
 * Simulates the exact Class 9 Odia tutor pipeline as integrated in routes/chat.js
 */
async function simulateClass9Pipeline(message) {
  const selectedModel = getModelForLanguage('Odia');
  const plan = extractOdiaContentPlan(message);
  const class9Knowledge = findRelevantClass9Knowledge(message, 'Odia');

  const systemPrompt = buildOdiaTutorPrompt('beginner', message, plan, class9Knowledge);

  const messages = [
    { role: 'system', content: systemPrompt },
    { role: 'user', content: message }
  ];

  const payload = {
    model: selectedModel,
    messages,
    stream: false,
    think: false,
    options: {
      temperature: 0.2,
      top_p: 0.9,
      repeat_penalty: 1.1,
      num_ctx: 8192,
      num_predict: 450
    }
  };

  const res = await httpJsonPost('http://localhost:11434/api/chat', payload);
  if (!res.ok) throw new Error(`Ollama call failed with status ${res.status}: ${res.raw || ''}`);
  const data = await res.json();
  let rawReply = (data.message?.content || '')
    .replace(/<think>[\s\S]*?<\/think>/gi, '')
    .replace(/<think>[\s\S]*$/gi, '')
    .trim();

  const promptClean = (message || '').trim().replace(/[?।\s]+$/, '');
  if (promptClean.length > 5 && rawReply.startsWith(promptClean)) {
    rawReply = rawReply.slice(promptClean.length).replace(/^[?।:\s-]+/, '').trim();
  }

  // Dual validation: standard quality + Class 9 factual
  let validation = validateOdiaTutorAnswer(rawReply, message, plan);
  let class9Val = class9Knowledge ? validateAgainstClass9Knowledge(rawReply, class9Knowledge) : { valid: true };
  if (validation.valid && !class9Val.valid) {
    validation = class9Val;
  }

  const initialValidationPassed = validation.valid && class9Val.valid;
  let retries = 0;
  let failureReason = validation.valid ? null : validation.reason;
  let failedFactRule = validation.valid ? null : (validation.failedFactRule || null);
  let fallbackUsed = false;
  let repairSucceeded = false;

  if (!validation.valid) {
    retries++;
    totalRepairs++;
    console.log(`    [Repair triggered] rule=${failedFactRule}, reason=${validation.reason}`);
    const repairPrompt = buildOdiaRepairPrompt(rawReply, message, plan, validation, class9Knowledge);
    const repairRes = await httpJsonPost('http://localhost:11434/api/chat', {
      model: selectedModel,
      messages: [{ role: 'user', content: repairPrompt }],
      stream: false,
      think: false,
      options: {
        temperature: 0.2,
        top_p: 0.9,
        repeat_penalty: 1.1,
        num_ctx: 8192,
        num_predict: 450
      }
    });

    if (repairRes.ok) {
      const repData = await repairRes.json();
      let repText = (repData.message?.content || '')
        .replace(/<think>[\s\S]*?<\/think>/gi, '')
        .replace(/<think>[\s\S]*$/gi, '')
        .trim();

      if (promptClean.length > 5 && repText.startsWith(promptClean)) {
        repText = repText.slice(promptClean.length).replace(/^[?।:\s-]+/, '').trim();
      }

      if (repText) {
        const repVal = validateOdiaTutorAnswer(repText, message, plan);
        const repC9 = class9Knowledge ? validateAgainstClass9Knowledge(repText, class9Knowledge) : { valid: true };
        if (repVal.valid && repC9.valid) {
          rawReply = repText;
          validation = repVal;
          failureReason = null;
          failedFactRule = null;
          repairSucceeded = true;
          console.log('    [Repair succeeded]');
        } else {
          const activeFailed = !repVal.valid ? repVal : repC9;
          validation = activeFailed;
          failureReason = activeFailed.reason;
          failedFactRule = activeFailed.failedFactRule || failedFactRule;
          console.log(`    [Repair failed] reason=${activeFailed.reason}`);
        }
      }
    }

    if (!validation.valid) {
      const fbText = class9Knowledge
        ? getVerifiedAnswer(message, class9Knowledge)
        : getOdiaDeterministicFallback(plan?.topic, plan?.requestedConcepts, message);
      if (fbText) {
        // Enforce full validation on fallback
        const fbQuality = validateOdiaTutorAnswer(fbText, message, plan);
        const fbC9 = class9Knowledge ? validateAgainstClass9Knowledge(fbText, class9Knowledge) : { valid: true };
        if (fbQuality.valid && fbC9.valid) {
          rawReply = fbText;
          validation = { valid: true, fallbackUsed: true };
          fallbackUsed = true;
          totalFallbacks++;
          console.log(`    [Fallback used] topic=${class9Knowledge ? class9Knowledge.id : plan?.topic}`);
        } else {
          console.error(`    [Fallback validation failed] quality=${fbQuality.valid}, c9=${fbC9.valid}`);
        }
      }
    }
  }

  // Telemetry log output
  console.log(`[Class9 Knowledge]\ntopic=${class9Knowledge ? class9Knowledge.id : 'unknown'}\nknowledge_found=${!!class9Knowledge}\nfacts_used=${class9Knowledge ? class9Knowledge.verifiedFacts.length : 0}\nvalidation=${initialValidationPassed ? 'pass' : 'fail'}\nrepair=${retries > 0 ? (repairSucceeded ? 'repaired' : 'failed') : 'none'}\nfallback=${fallbackUsed}`);

  return {
    reply: rawReply,
    validation,
    class9Knowledge,
    retries,
    fallbackUsed,
    repairSucceeded
  };
}

async function main() {
  console.log('====================================================');
  console.log('🔬 CLASS 9 VERIFIED KNOWLEDGE LAYER TEST SUITE');
  console.log('====================================================\n');

  // ── 1. Structured Knowledge Base Verification ──
  console.log('--- 1. Knowledge Base Structure (8 Topics) ---');
  const requiredTopics = [
    'photosynthesis',
    'matter',
    'states_of_matter',
    'evaporation',
    'water_cycle',
    'force_and_motion',
    'cell',
    'respiration'
  ];

  for (const tid of requiredTopics) {
    runTest(`Topic "${tid}" exists with complete schema`, () => {
      const entry = CLASS_9_KNOWLEDGE[tid];
      assert(entry, `Topic ${tid} missing from CLASS_9_KNOWLEDGE`);
      assert.strictEqual(entry.id, tid);
      assert(entry.englishName && typeof entry.englishName === 'string', `${tid} missing englishName`);
      assert(entry.odiaName && typeof entry.odiaName === 'string', `${tid} missing odiaName`);
      assert(Array.isArray(entry.concepts) && entry.concepts.length > 0, `${tid} missing concepts`);
      assert(Array.isArray(entry.verifiedFacts) && entry.verifiedFacts.length > 0, `${tid} missing verifiedFacts`);
      assert(Array.isArray(entry.commonMisconceptions) && entry.commonMisconceptions.length > 0, `${tid} missing commonMisconceptions`);
      assert(Array.isArray(entry.canonicalTerms) && entry.canonicalTerms.length > 0, `${tid} missing canonicalTerms`);
      assert(Array.isArray(entry.terminology) && entry.terminology.length > 0, `${tid} missing terminology`);
      assert(entry.verifiedExplanation && typeof entry.verifiedExplanation === 'string', `${tid} missing verifiedExplanation`);
    });
  }

  // ── 2. Knowledge Base Terminology Validation ──
  console.log('\n--- 2. Knowledge Base Terminology Validation ---');
  runTest('validateClass9KnowledgeBase passes on clean knowledge base', () => {
    const res = validateClass9KnowledgeBase();
    assert.strictEqual(res.valid, true, `validateClass9KnowledgeBase failed: ${res.detail}`);
    assert.strictEqual(res.errors.length, 0);
  });

  runTest('validateClass9KnowledgeBase verifies required canonical terms (stomata, chlorophyll, photosynthesis, CO2, O2, water vapour)', () => {
    const photo = CLASS_9_KNOWLEDGE.photosynthesis;
    const stomata = photo.terminology.find(t => t.concept === 'stomata');
    assert.strictEqual(stomata?.canonical, 'ପତ୍ରରନ୍ଧ୍ର');
    assert(stomata?.forbidden.includes('ପତ୍ରର ମାଂସପେଶୀ'));
    assert(stomata?.forbidden.includes('ମାଂସପେଶୀ'));

    const chloro = photo.terminology.find(t => t.concept === 'chlorophyll');
    assert.strictEqual(chloro?.canonical, 'ପତ୍ରହରିତ');

    const syn = photo.terminology.find(t => t.concept === 'photosynthesis');
    assert.strictEqual(syn?.canonical, 'ଆଲୋକ ସଂଶ୍ଳେଷଣ');

    const co2 = photo.terminology.find(t => t.concept === 'carbon_dioxide');
    assert.strictEqual(co2?.canonical, 'ଅଙ୍ଗାରକାମ୍ଳ');

    const o2 = photo.terminology.find(t => t.concept === 'oxygen');
    assert.strictEqual(o2?.canonical, 'ଅମ୍ଳଜାନ');

    const states = CLASS_9_KNOWLEDGE.states_of_matter;
    const wv = states.terminology.find(t => t.concept === 'water_vapour');
    assert.strictEqual(wv?.canonical, 'ଜଳୀୟ ବାଷ୍ପ');
  });

  runTest('validateClass9KnowledgeBase fails if forbidden term is introduced in verified facts', () => {
    // Temporarily inject forbidden term into a clone
    const originalFact = CLASS_9_KNOWLEDGE.photosynthesis.verifiedFacts[0];
    CLASS_9_KNOWLEDGE.photosynthesis.verifiedFacts[0] = 'ସୂର୍ଯ୍ୟାଲୋକ ଏବଂ ପତ୍ରର ମାଂସପେଶୀ ଆଲୋକ ସଂଶ୍ଳେଷଣ ପାଇଁ ଆବଶ୍ୟକ।';
    try {
      const res = validateClass9KnowledgeBase();
      assert.strictEqual(res.valid, false, 'Should fail when forbidden term appears in verified facts');
      assert(res.detail.includes('Forbidden term "ପତ୍ରର ମାଂସପେଶୀ"'), 'Error must name the forbidden term');
    } finally {
      CLASS_9_KNOWLEDGE.photosynthesis.verifiedFacts[0] = originalFact;
    }
  });

  // ── 3. Terminology & Factual Rejection Tests ──
  console.log('\n--- 3. Terminology & Factual Rejection Tests ---');
  runTest('Rejects incorrect stomata terminology "ପତ୍ରର ମାଂସପେଶୀ (Stomata)"', () => {
    const badAnswer = "ଉଦ୍ଭିଦ ପତ୍ରର ମାଂସପେଶୀ (Stomata) ମାଧ୍ୟମରେ ଅଙ୍ଗାରକାମ୍ଳ ଗ୍ରହଣ କରେ।";
    const res = validateAgainstClass9Knowledge(badAnswer, CLASS_9_KNOWLEDGE.photosynthesis);
    assert.strictEqual(res.valid, false);
    assert.strictEqual(res.reason, 'corrupted_terminology');
  });

  runTest('Rejects incorrect photosynthesis terminology "ଉଦ୍ଭିଦ ସଂଶ୍ଲେଷଣ"', () => {
    const badAnswer = "ଉଦ୍ଭିଦ ସଂଶ୍ଲେଷଣ ଏକ ପ୍ରକ୍ରିୟା ଯେଉଁଥିରେ ଉଦ୍ଭିଦ ଖାଦ୍ୟ ତିଆରି କରେ।";
    const res = validateAgainstClass9Knowledge(badAnswer, CLASS_9_KNOWLEDGE.photosynthesis);
    assert.strictEqual(res.valid, false);
    assert.strictEqual(res.reason, 'corrupted_terminology');
  });

  runTest('Rejects incorrect oxygen role (oxygen as input for photosynthesis)', () => {
    const badAnswer = "ଆଲୋକ ସଂଶ୍ଳେଷଣରେ ଉଦ୍ଭିଦ ଅମ୍ଳଜାନ ଗ୍ରହଣ କରେ।";
    const res = validateAgainstClass9Knowledge(badAnswer, CLASS_9_KNOWLEDGE.photosynthesis);
    assert.strictEqual(res.valid, false);
    assert.strictEqual(res.reason, 'misconception_oxygen_input');
  });

  runTest('Rejects incorrect CO2 role (carbon dioxide as output of photosynthesis)', () => {
    const badAnswer = "ଆଲୋକ ସଂଶ୍ଳେଷଣ ପ୍ରକ୍ରିୟାରେ ଉଦ୍ଭିଦ ଅଙ୍ଗାରକାମ୍ଳ ନିର୍ଗତ କରେ।";
    const res = validateAgainstClass9Knowledge(badAnswer, CLASS_9_KNOWLEDGE.photosynthesis);
    assert.strictEqual(res.valid, false);
    assert.strictEqual(res.reason, 'misconception_co2_output');
  });

  runTest('Rejects incorrect oxygen source (claiming oxygen comes from CO2)', () => {
    const badAnswer = "ଅମ୍ଳଜାନ CO₂ ରୁ ଆସେ";
    const res = validateAgainstClass9Knowledge(badAnswer, CLASS_9_KNOWLEDGE.photosynthesis);
    assert.strictEqual(res.valid, false);
    assert.strictEqual(res.failedFactRule, 'rule1_photosynthesis_oxygen_from_co2');
  });

  runTest('Accepts correct oxygen source (explaining oxygen comes from water)', () => {
    const goodAnswer = "ଜଳରୁ ଅମ୍ଳଜାନ ମୁକ୍ତ ହୁଏ";
    const res = validateAgainstClass9Knowledge(goodAnswer, CLASS_9_KNOWLEDGE.photosynthesis);
    assert.strictEqual(res.valid, true);
  });

  // ── 4. Question-Specific Fallbacks ──
  console.log('\n--- 4. Question-Specific Fallback Generation ---');
  runTest('Question-specific water heating fallback returns direct answer', () => {
    const q = "ପାଣିକୁ ଗରମ କଲେ କ'ଣ ହୁଏ?";
    const ans = getVerifiedAnswer(q, CLASS_9_KNOWLEDGE.states_of_matter);
    assert.strictEqual(
      ans,
      "ପାଣିକୁ ଗରମ କଲେ ଏହା ଜଳୀୟ ବାଷ୍ପରେ ପରିଣତ ହୁଏ। ଅର୍ଥାତ୍, ପାଣି ତରଳ ଅବସ୍ଥାରୁ ଗ୍ୟାସୀୟ ଅବସ୍ଥାକୁ ଯାଏ।"
    );
    // Final answer validation check
    const valQuality = validateOdiaTutorAnswer(ans, q);
    const valC9 = validateAgainstClass9Knowledge(ans, CLASS_9_KNOWLEDGE.states_of_matter);
    assert.strictEqual(valQuality.valid, true);
    assert.strictEqual(valC9.valid, true);
  });

  runTest('Question-specific photosynthesis fallback (oxygen role) returns direct answer', () => {
    const q = "ଆଲୋକ ସଂଶ୍ଳେଷଣରେ ଅମ୍ଳଜାନର କ'ଣ ହୁଏ?";
    const ans = getVerifiedAnswer(q, CLASS_9_KNOWLEDGE.photosynthesis);
    assert.strictEqual(
      ans,
      "ଆଲୋକ ସଂଶ୍ଳେଷଣ ସମୟରେ ଉଦ୍ଭିଦ ଅମ୍ଳଜାନ ନିର୍ଗତ କରେ।"
    );
    const valQuality = validateOdiaTutorAnswer(ans, q);
    const valC9 = validateAgainstClass9Knowledge(ans, CLASS_9_KNOWLEDGE.photosynthesis);
    assert.strictEqual(valQuality.valid, true);
    assert.strictEqual(valC9.valid, true);
  });

  runTest('Question-specific respiration fallback (human oxygen intake) returns direct answer', () => {
    const q = "ମଣିଷ ଅମ୍ଳଜାନ କାହିଁକି ଗ୍ରହଣ କରେ?";
    const ans = getVerifiedAnswer(q, CLASS_9_KNOWLEDGE.respiration);
    assert.strictEqual(
      ans,
      "ମଣିଷର କୋଷଗୁଡ଼ିକ ଶକ୍ତି ଉତ୍ପାଦନ ପାଇଁ ଅମ୍ଳଜାନ ବ୍ୟବହାର କରନ୍ତି।"
    );
    const valQuality = validateOdiaTutorAnswer(ans, q);
    const valC9 = validateAgainstClass9Knowledge(ans, CLASS_9_KNOWLEDGE.respiration);
    assert.strictEqual(valQuality.valid, true);
    assert.strictEqual(valC9.valid, true);
  });

  runTest('Dynamic question intent selects relevant verified facts without hardcoding', () => {
    // Photosynthesis sunlight query
    const qSun = "ଆଲୋକ ସଂଶ୍ଳେଷଣରେ ସୂର୍ଯ୍ୟାଲୋକର ଭୂମିକା କ'ଣ?";
    const ansSun = getVerifiedAnswer(qSun, CLASS_9_KNOWLEDGE.photosynthesis);
    assert(ansSun.includes('ସୂର୍ଯ୍ୟାଲୋକ') && ansSun.includes('ଶକ୍ତିର ଉତ୍ସ'));

    // Respiration plant query
    const qPlantResp = "ଉଦ୍ଭିଦ କିପରି ଶ୍ୱସନ କରେ?";
    const ansPlantResp = getVerifiedAnswer(qPlantResp, CLASS_9_KNOWLEDGE.respiration);
    assert(ansPlantResp.includes('ଶ୍ୱସନ') && ansPlantResp.includes('ଅମ୍ଳଜାନ ବ୍ୟବହାର'));
  });

  // ── 5. Deterministic Knowledge Retrieval ──
  console.log('\n--- 5. Deterministic Knowledge Retrieval ---');
  runTest('getClass9Knowledge returns by key and by Odia alias', () => {
    assert.strictEqual(getClass9Knowledge('photosynthesis')?.id, 'photosynthesis');
    assert.strictEqual(getClass9Knowledge('ଆଲୋକ ସଂଶ୍ଳେଷଣ')?.id, 'photosynthesis');
    assert.strictEqual(getClass9Knowledge('states_of_matter')?.id, 'states_of_matter');
    assert.strictEqual(getClass9Knowledge('ବାଷ୍ପୀଭବନ')?.id, 'evaporation');
    assert.strictEqual(getClass9Knowledge('ଜଳଚକ୍ର')?.id, 'water_cycle');
    assert.strictEqual(getClass9Knowledge('ବଳ ଓ ଗତି')?.id, 'force_and_motion');
    assert.strictEqual(getClass9Knowledge('କୋଷ')?.id, 'cell');
    assert.strictEqual(getClass9Knowledge('ଶ୍ୱାସକ୍ରିୟା')?.id, 'respiration');
  });

  runTest('findRelevantClass9Knowledge detects topic accurately', () => {
    assert.strictEqual(findRelevantClass9Knowledge("ଆଲୋକ ସଂଶ୍ଳେଷଣ କ'ଣ?")?.id, 'photosynthesis');
    assert.strictEqual(findRelevantClass9Knowledge("ଉଦ୍ଭିଦ ଅଙ୍ଗାରକାମ୍ଳ କାହିଁକି ଗ୍ରହଣ କରେ?")?.id, 'photosynthesis');
    assert.strictEqual(findRelevantClass9Knowledge("ଆଲୋକ ସଂଶ୍ଳେଷଣ ସମୟରେ ଅମ୍ଳଜାନର କ'ଣ ହୁଏ?")?.id, 'photosynthesis');
    assert.strictEqual(findRelevantClass9Knowledge("ପାଣିକୁ ଗରମ କଲେ କ'ଣ ହୁଏ?")?.id, 'states_of_matter');
    assert.strictEqual(findRelevantClass9Knowledge("ବାଷ୍ପୀଭବନ କିପରି ହୁଏ?")?.id, 'evaporation');
    assert.strictEqual(findRelevantClass9Knowledge("ଜଳଚକ୍ରର ସୋପାନଗୁଡ଼ିକ କ'ଣ?")?.id, 'water_cycle');
    assert.strictEqual(findRelevantClass9Knowledge("ନ୍ୟୁଟନଙ୍କ ପ୍ରଥମ ଗତି ନିୟମ କ'ଣ?")?.id, 'force_and_motion');
    assert.strictEqual(findRelevantClass9Knowledge("କୋଷର ଶକ୍ତି କେନ୍ଦ୍ର କିଏ?")?.id, 'cell');
    assert.strictEqual(findRelevantClass9Knowledge("ମଣିଷ କିପରି ଶ୍ୱାସକ୍ରିୟା କରେ?")?.id, 'respiration');

    // Follow-up resolution using conversation context
    const photoHistory = [
      { role: 'user', content: "ଆଲୋକ ସଂଶ୍ଳେଷଣରେ ଅମ୍ଳଜାନର କ'ଣ ହୁଏ?" },
      { role: 'assistant', content: "ଆଲୋକ ସଂଶ୍ଳେଷଣ ସମୟରେ ଉଦ୍ଭିଦ ଅମ୍ଳଜାନ ନିର୍ଗତ କରେ।" }
    ];
    assert.strictEqual(findRelevantClass9Knowledge("ଅମ୍ଳଜାନ ଆସେ କେଉଁଠାରୁ?", 'Odia', photoHistory)?.id, 'photosynthesis');
    assert.strictEqual(findRelevantClass9Knowledge("ଏହା କେଉଁଠାରୁ ଆସେ?", 'Odia', photoHistory)?.id, 'photosynthesis');
    assert.strictEqual(findRelevantClass9Knowledge("ଏହା କେଉଁଠାରୁ ଆସେ?", 'Odia', []), null);
    assert.strictEqual(findRelevantClass9Knowledge("ତୁମେ ଠିକ୍ ଭାବେ ବୁଝାଇନାହଁ। ଅମ୍ଳଜାନ ଆସେ କେଉଁଠାରୁ? ପୁଣିଥରେ ସହଜ ଭାବରେ ବୁଝାଅ।", 'Odia', photoHistory)?.id, 'photosynthesis');
  });

  // ── 6. Live dhee-odia Pipeline Execution ──
  console.log('\n====================================================');
  console.log('🤖 LIVE PIPELINE VERIFICATION (DHEE-ODIA)');
  console.log('====================================================');

  // Live Case A
  console.log('\n[Live Case A: Photosynthesis "ଆଲୋକ ସଂଶ୍ଳେଷଣ କ\'ଣ?"]');
  await runAsyncTest('Live Case A: "ଆଲୋକ ସଂଶ୍ଳେଷଣ କ\'ଣ?"', async () => {
    const prompt = "ଆଲୋକ ସଂଶ୍ଳେଷଣ କ'ଣ?";
    const res = await simulateClass9Pipeline(prompt);
    assert.strictEqual(res.class9Knowledge?.id, 'photosynthesis', 'Must match photosynthesis topic');
    assert.strictEqual(res.validation.valid, true, 'Result must pass validation');
    assert(!/ଉଦ୍ଭିଦ\s*ସଂଶ୍ଲେ/i.test(res.reply), 'Must not use corrupted terminology');
    assert(!/(?:ପତ୍ରର\s*)?ମାଂସପେଶୀ/i.test(res.reply), 'Must not use corrupted stomata terminology');
    console.log(`    Validated Output: "${res.reply}"`);
  });

  // Live Case B
  console.log('\n[Live Case B: Carbon dioxide "ଉଦ୍ଭିଦ ଅଙ୍ଗାରକାମ୍ଳ କାହିଁକି ଗ୍ରହଣ କରେ?"]');
  await runAsyncTest('Live Case B: "ଉଦ୍ଭିଦ ଅଙ୍ଗାରକାମ୍ଳ କାହିଁକି ଗ୍ରହଣ କରେ?"', async () => {
    const prompt = "ଉଦ୍ଭିଦ ଅଙ୍ଗାରକାମ୍ଳ କାହିଁକି ଗ୍ରହଣ କରେ?";
    const res = await simulateClass9Pipeline(prompt);
    assert.strictEqual(res.class9Knowledge?.id, 'photosynthesis', 'Must link CO2 absorption to photosynthesis');
    assert.strictEqual(res.validation.valid, true, 'Result must pass validation');
    const sentences = res.reply.split(/[।!?\n]+/);
    for (const s of sentences) {
      assert(!/ଅଙ୍ଗାରକାମ୍ଳ.*(?:ନିର୍ଗତ|ତ୍ୟାଗ|ବାହାର\s*କରେ)/i.test(s), 'Must not claim CO2 is released in photosynthesis');
    }
    console.log(`    Validated Output: "${res.reply}"`);
  });

  // Live Case C
  console.log('\n[Live Case C: Oxygen "ଆଲୋକ ସଂଶ୍ଳେଷଣ ସମୟରେ ଅମ୍ଳଜାନର କ\'ଣ ହୁଏ?"]');
  await runAsyncTest('Live Case C: "ଆଲୋକ ସଂଶ୍ଳେଷଣ ସମୟରେ ଅମ୍ଳଜାନର କ\'ଣ ହୁଏ?"', async () => {
    const prompt = "ଆଲୋକ ସଂଶ୍ଳେଷଣ ସମୟରେ ଅମ୍ଳଜାନର କ'ଣ ହୁଏ?";
    const res = await simulateClass9Pipeline(prompt);
    console.log(`    Validated Output: "${res.reply}"`);
    assert.strictEqual(res.class9Knowledge?.id, 'photosynthesis', 'Must link oxygen query to photosynthesis');
    assert.strictEqual(res.validation.valid, true, 'Result must pass validation');
    assert(!/ଅମ୍ଳଜାନ\s*(?:ଗ୍ୟାସ\s*)?(?:ଗ୍ରହଣ|ନିଏ|ଶୋଷଣ)/i.test(res.reply), 'Must not claim oxygen is absorbed in photosynthesis');
    assert(/ଅମ୍ଳଜାନ.*(?:ନିର୍ଗତ|ମୁକ୍ତ|ବାହାର|ତ୍ୟାଗ|ଉପ-ଉତ୍ପାଦ|ପ୍ରକାଶ|ସୃଷ୍ଟି|ଉତ୍ପନ୍ନ)|(?:ନିର୍ଗତ|ମୁକ୍ତ|ବାହାର|ତ୍ୟାଗ|ଉପ-ଉତ୍ପାଦ|ପ୍ରକାଶ|ସୃଷ୍ଟି|ଉତ୍ପନ୍ନ).*ଅମ୍ଳଜାନ/i.test(res.reply), 'Oxygen must be represented as released');
  });

  // Live Case D
  console.log('\n[Live Case D: Water heating "ପାଣିକୁ ଗରମ କଲେ କ\'ଣ ହୁଏ?"]');
  await runAsyncTest('Live Case D: "ପାଣିକୁ ଗରମ କଲେ କ\'ଣ ହୁଏ?"', async () => {
    const prompt = "ପାଣିକୁ ଗରମ କଲେ କ'ଣ ହୁଏ?";
    const res = await simulateClass9Pipeline(prompt);
    assert.strictEqual(res.class9Knowledge?.id, 'states_of_matter', 'Must link to states of matter');
    assert.strictEqual(res.validation.valid, true, 'Result must pass validation');
    assert(!/ଆଲୋକ\s*ସଂଶ୍ଳେଷଣ|photosynthesis|ପତ୍ରହରିତ/i.test(res.reply), 'Must not drift to photosynthesis');
    assert(/ବାଷ୍ପ|ଜଳୀ[ୟୱ]\s*ବାଷ୍ପ|ଗ୍[ୟଯ][଼]?ାସ/i.test(res.reply), 'Must explain state change to water vapour/steam');
    console.log(`    Validated Output: "${res.reply}"`);
  });

  // Live Case E
  console.log('\n[Live Case E: Unknown Question "କମ୍ପ୍ୟୁଟର ପ୍ରୋଗ୍ରାମିଂ କ\'ଣ?"]');
  await runAsyncTest('Live Case E: "କମ୍ପ୍ୟୁଟର ପ୍ରୋଗ୍ରାମିଂ କ\'ଣ?"', async () => {
    const prompt = "କମ୍ପ୍ୟୁଟର ପ୍ରୋଗ୍ରାମିଂ କ'ଣ?";
    const res = await simulateClass9Pipeline(prompt);
    assert.strictEqual(res.class9Knowledge, null, 'Must report knowledge_found=false');
    assert.strictEqual(res.validation.valid, true, 'Standard tutor handles answer safely');
    console.log(`    Output: "${res.reply}"`);
  });

  console.log('\n====================================================');
  console.log('CLASS 9 KNOWLEDGE TEST SUMMARY');
  console.log(`STATUS: ${testsFailed === 0 ? 'ALL PASSED ✅' : 'FAILED ❌'}`);
  console.log(`Tests Run: ${testsRun}`);
  console.log(`Tests Passed: ${testsPassed}`);
  console.log(`Tests Failed: ${testsFailed}`);
  console.log(`Repairs Triggered: ${totalRepairs}`);
  console.log(`Fallbacks Used: ${totalFallbacks}`);
  console.log('====================================================');
}

main().catch(err => {
  console.error('\nSuite Execution Error:', err);
  process.exit(1);
});

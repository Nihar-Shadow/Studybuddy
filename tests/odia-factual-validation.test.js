'use strict';

const assert = require('assert');
const http = require('http');
const {
  getModelForLanguage
} = require('../agent/models');
const {
  isOdia,
  containsOdiaScript,
  extractOdiaContentPlan,
  buildOdiaTutorPrompt,
  validateOdiaTutorAnswer,
  buildOdiaRepairPrompt,
  getOdiaDeterministicFallback,
  validateFactualRelationships,
  FACTUAL_REPAIR_INSTRUCTIONS,
  ODIA_EDUCATIONAL_FALLBACKS
} = require('../lib/languagePolicy');

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

// Stats tracking
let testsRun = 0;
let testsFailed = 0;
let totalRepairs = 0;
let totalFallbacks = 0;

function runTest(name, fn) {
  testsRun++;
  try {
    fn();
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
    console.log(`  ✓ ${name}`);
  } catch (err) {
    testsFailed++;
    console.error(`  ❌ ${name}: ${err.message}`);
    throw err;
  }
}

async function simulateTutorPipeline(message) {
  const selectedModel = getModelForLanguage('Odia');
  const plan = extractOdiaContentPlan(message);
  const systemPrompt = buildOdiaTutorPrompt('beginner', message, plan);

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
  if (!res.ok) throw new Error(`Ollama call failed with status ${res.status}`);
  const data = await res.json();
  let rawReply = (data.message?.content || '')
    .replace(/<think>[\s\S]*?<\/think>/gi, '')
    .replace(/<think>[\s\S]*$/gi, '')
    .trim();

  const promptClean = (message || '').trim().replace(/[?।\s]+$/, '');
  if (promptClean.length > 5 && rawReply.startsWith(promptClean)) {
    rawReply = rawReply.slice(promptClean.length).replace(/^[?।:\s-]+/, '').trim();
  }

  let validation = validateOdiaTutorAnswer(rawReply, message, plan);
  let retries = 0;
  let failureReason = validation.valid ? null : validation.reason;
  let failedFactRule = validation.valid ? null : (validation.failedFactRule || null);
  let fallbackUsed = false;

  if (!validation.valid) {
    retries++;
    totalRepairs++;
    console.log(`    [Repair triggered] rule=${failedFactRule}, reason=${validation.reason}`);
    const repairPrompt = buildOdiaRepairPrompt(rawReply, message, plan, validation);
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
      const repVal = validateOdiaTutorAnswer(repText, message, plan);
      if (repVal.valid) {
        rawReply = repText;
        validation = repVal;
        failureReason = null;
        failedFactRule = null;
      } else {
        failureReason = repVal.reason;
        failedFactRule = repVal.failedFactRule || failedFactRule;
      }
    }

    if (!validation.valid) {
      const fallback = getOdiaDeterministicFallback(plan.topic, plan.requestedConcepts, message);
      if (fallback) {
        totalFallbacks++;
        rawReply = fallback;
        validation = { valid: true, fallbackUsed: true };
        fallbackUsed = true;
        console.log(`    [Fallback used] topic=${plan.topic}`);
      }
    }
  }

  console.log(`[Odia Tutor Telemetry]\nvalidation_result=${validation.valid ? 'PASSED' : 'FAILED'}\nfailure_reason=${failureReason || 'none'}\nfailed_fact_rule=${failedFactRule || 'none'}\nretry_count=${retries}\nfallback_used=${fallbackUsed}`);

  return { reply: rawReply, validation, retries, fallbackUsed, failedFactRule };
}

async function main() {
  console.log('====================================================');
  console.log('🔬 ODIA TUTOR DETERMINISTIC FACTUAL VALIDATION SUITE');
  console.log('====================================================\n');

  // ====================================================
  // UNIT TESTS: CANONICAL RULES 1 TO 10
  // ====================================================

  console.log('--- 1. Photosynthesis Canonical Rules ---');
  runTest('Accepts valid photosynthesis answer', () => {
    const validAns = "ଆଲୋକ ସଂଶ୍ଳେଷଣ ହେଉଛି ଉଦ୍ଭିଦର ଖାଦ୍ୟ ତିଆରି ପ୍ରକ୍ରିୟା। ସୂର୍ଯ୍ୟାଲୋକ ଏଥିପାଇଁ ଶକ୍ତି ପ୍ରଦାନ କରେ। ଉଦ୍ଭିଦ ଜଳ ଏବଂ ଅଙ୍ଗାରକାମ୍ଳ ଗ୍ରହଣ କରି ଖାଦ୍ୟ ପ୍ରସ୍ତୁତ କରେ। ଏହି ପ୍ରକ୍ରିୟାରେ ଅମ୍ଳଜାନ ନିର୍ଗତ ହୁଏ।";
    const res = validateOdiaTutorAnswer(validAns, "ଆଲୋକ ସଂଶ୍ଳେଷଣ କ'ଣ?");
    assert.strictEqual(res.valid, true);
  });

  runTest('Rejects oxygen as input in photosynthesis', () => {
    const badAns = "ଆଲୋକ ସଂଶ୍ଳେଷଣରେ ଉଦ୍ଭିଦ ଅମ୍ଳଜାନ ଗ୍ରହଣ କରେ। ସୂର୍ଯ୍ୟାଲୋକ ଶକ୍ତି ଯୋଗାଏ। ଜଳ ବ୍ୟବହାର ହୁଏ।";
    const res = validateOdiaTutorAnswer(badAns, "ଆଲୋକ ସଂଶ୍ଳେଷଣ କ'ଣ?");
    assert.strictEqual(res.valid, false);
    assert.strictEqual(res.failedFactRule, 'rule1_photosynthesis_oxygen_input');
  });

  runTest('Rejects carbon dioxide as output of photosynthesis', () => {
    const badAns = "ଆଲୋକ ସଂଶ୍ଳେଷଣରେ ଉଦ୍ଭିଦ ଅଙ୍ଗାରକାମ୍ଳ ନିର୍ଗତ କରେ। ସୂର୍ଯ୍ୟାଲୋକ ଶକ୍ତି ଯୋଗାଏ। ଜଳ ବ୍ୟବହାର ହୁଏ।";
    const res = validateOdiaTutorAnswer(badAns, "ଆଲୋକ ସଂଶ୍ଳେଷଣ କ'ଣ?");
    assert.strictEqual(res.valid, false);
    assert.strictEqual(res.failedFactRule, 'rule1_photosynthesis_co2_output');
  });

  runTest('Rejects water as the main product of photosynthesis', () => {
    const badAns = "ଆଲୋକ ସଂଶ୍ଳେଷଣରେ ଜଳ ମୁଖ୍ୟ ଉତ୍ପାଦ ଭାବରେ ପ୍ରସ୍ତୁତ ହୁଏ। ସୂର୍ଯ୍ୟାଲୋକ ଶକ୍ତି ଯୋଗାଏ।";
    const res = validateOdiaTutorAnswer(badAns, "ଆଲୋକ ସଂଶ୍ଳେଷଣ କ'ଣ?");
    assert.strictEqual(res.valid, false);
    assert.strictEqual(res.failedFactRule, 'rule1_photosynthesis_water_main_product');
  });

  runTest('Rejects sunlight described as food or matter', () => {
    const badAns = "ଉଦ୍ଭିଦ ସୂର୍ଯ୍ୟାଲୋକକୁ ଖାଦ୍ୟ ଭାବରେ ଶୋଷଣ କରେ। ଏହା ଆଲୋକ ସଂଶ୍ଳେଷଣ ଅଟେ।";
    const res = validateOdiaTutorAnswer(badAns, "ଆଲୋକ ସଂଶ୍ଳେଷଣ କ'ଣ?");
    assert.strictEqual(res.valid, false);
    assert.strictEqual(res.failedFactRule, 'rule1_photosynthesis_sunlight_food');
  });

  runTest('Rejects claim that plants store CO2 at night as reason photosynthesis stops', () => {
    const badAns = "ଗଛମାନେ ରାତିରେ ଆଲୋକ ସଂଶ୍ଳେଷଣ କରନ୍ତି ନାହିଁ କାରଣ ସେମାନେ ରାତିରେ ଅଙ୍ଗାରକାମ୍ଳ ସଞ୍ଚୟ କରି ରଖନ୍ତି।";
    const res = validateOdiaTutorAnswer(badAns, "ଗଛମାନେ ରାତିରେ ଆଲୋକ ସଂଶ୍ଳେଷଣ କରନ୍ତି କି? କାହିଁକି?");
    assert.strictEqual(res.valid, false);
    assert.strictEqual(res.failedFactRule, 'rule1_photosynthesis_night_co2_storage');
  });

  console.log('\n--- 2. Plant Respiration Canonical Rules ---');
  runTest('Accepts valid plant respiration explanation', () => {
    const validAns = "ଉଦ୍ଭିଦମାନେ ଦିନ ଏବଂ ରାତି ଉଭୟ ସମୟରେ ଶ୍ୱସନ କରନ୍ତି। ଶ୍ୱସନ ପ୍ରକ୍ରିୟାରେ ଉଦ୍ଭିଦ ଅମ୍ଳଜାନ ବ୍ୟବହାର କରେ ଏବଂ ଅଙ୍ଗାରକାମ୍ଳ ତ୍ୟାଗ କରେ।";
    const res = validateOdiaTutorAnswer(validAns, "ଉଦ୍ଭିଦ କିପରି ଶ୍ୱସନ କରେ?");
    assert.strictEqual(res.valid, true);
  });

  runTest('Rejects claim that plants stop respiration at night', () => {
    const badAns = "ଉଦ୍ଭିଦମାନେ ରାତିରେ ଶ୍ୱସନ ବନ୍ଦ କରିଦିଅନ୍ତି ଏବଂ କେବଳ ଦିନରେ କରନ୍ତି।";
    const res = validateOdiaTutorAnswer(badAns, "ଉଦ୍ଭିଦ କିପରି ଶ୍ୱସନ କରେ?");
    assert.strictEqual(res.valid, false);
    assert.strictEqual(res.failedFactRule, 'rule2_plant_respiration_night_stop');
  });

  runTest('Rejects claim that plants store CO2 at night for respiration', () => {
    const badAns = "ଉଦ୍ଭିଦମାନେ ରାତିରେ ଅଙ୍ଗାରକାମ୍ଳ ସଞ୍ଚୟ କରି ରଖନ୍ତି ଶ୍ୱସନ ପାଇଁ।";
    const res = validateOdiaTutorAnswer(badAns, "ଉଦ୍ଭିଦ କିପରି ଶ୍ୱସନ କରେ?");
    assert.strictEqual(res.valid, false);
    assert.strictEqual(res.failedFactRule, 'rule2_plant_respiration_night_co2_storage');
  });

  runTest('Rejects reversed gases in plant respiration', () => {
    const badAns = "ଉଦ୍ଭିଦ ଶ୍ୱସନ ପ୍ରକ୍ରିୟାରେ ଅଙ୍ଗାରକାମ୍ଳ ଗ୍ରହଣ କରେ ଏବଂ ଅମ୍ଳଜାନ ନିର୍ଗତ କରେ।";
    const res = validateOdiaTutorAnswer(badAns, "ଉଦ୍ଭିଦ ଶ୍ୱସନ କ'ଣ?");
    assert.strictEqual(res.valid, false);
    assert.strictEqual(res.failedFactRule, 'rule2_plant_respiration_reversed_gases');
  });

  console.log('\n--- 3. Human Breathing Canonical Rules ---');
  runTest('Accepts valid human breathing answer', () => {
    const validAns = "ମଣିଷ ଶ୍ୱାସ ନେବା ସମୟରେ ବାୟୁରୁ ଅମ୍ଳଜାନ ଗ୍ରହଣ କରେ। ଶ୍ୱାସ ଛାଡ଼ିବା ସମୟରେ ଅଙ୍ଗାରକାମ୍ଳ ଗ୍ୟାସ ବାହାର କରେ।";
    const res = validateOdiaTutorAnswer(validAns, "ମଣିଷ ଶ୍ୱାସ ନେବା ସମୟରେ କେଉଁ ଗ୍ୟାସ ଗ୍ରହଣ କରେ ଏବଂ କେଉଁ ଗ୍ୟାସ ବାହାର କରେ?");
    assert.strictEqual(res.valid, true);
  });

  runTest('Rejects inverted human breathing (CO2 taken in)', () => {
    const badAns = "ମଣିଷ ଶ୍ୱାସକ୍ରିୟାରେ ଅଙ୍ଗାରକାମ୍ଳ ଗ୍ରହଣ କରେ ଏବଂ ଅମ୍ଳଜାନ ଛାଡ଼େ।";
    const res = validateOdiaTutorAnswer(badAns, "ମଣିଷ ଶ୍ୱାସକ୍ରିୟା କିପରି ହୁଏ?");
    assert.strictEqual(res.valid, false);
    assert.strictEqual(res.failedFactRule, 'rule3_human_breathing_reversed');
  });

  runTest('Rejects missing gas roles in direct human breathing question', () => {
    const incompleteAns = "ମଣିଷ ଶ୍ୱାସ ନେବା ସମୟରେ ଅମ୍ଳଜାନ ଗ୍ୟାସ ବ୍ୟବହାର କରି ବଞ୍ଚିଥାଏ। ଏହା ଏକ ପ୍ରାକୃତିକ ପ୍ରକ୍ରିୟା।";
    const res = validateOdiaTutorAnswer(incompleteAns, "ମଣିଷ ଶ୍ୱାସ ନେବା ସମୟରେ କେଉଁ ଗ୍ୟାସ ଗ୍ରହଣ କରେ ଏବଂ କେଉଁ ଗ୍ୟାସ ବାହାର କରେ?");
    assert.strictEqual(res.valid, false);
    assert.strictEqual(res.failedFactRule, 'rule3_human_breathing_missing_or_reversed');
  });

  console.log('\n--- 4. Water States Canonical Rules ---');
  runTest('Accepts valid water states answer', () => {
    const validAns = "ଜଳର ତିନୋଟି ଭୌତିକ ଅବସ୍ଥା ରହିଛି: କଠିନ ଅବସ୍ଥା ବରଫ, ତରଳ ଅବସ୍ଥା ଜଳ ବା ପାଣି, ଏବଂ ଗ୍ୟାସୀୟ ଅବସ୍ଥା ଜଳୀୟ ବାଷ୍ପ।";
    const res = validateOdiaTutorAnswer(validAns, "ଜଳର ତିନୋଟି ଅବସ୍ଥା କ'ଣ?");
    assert.strictEqual(res.valid, true);
  });

  runTest('Rejects water vapour equated to oxygen', () => {
    const badAns = "ପାଣିକୁ ଗରମ କଲେ ବାଷ୍ପ ହୁଏ ଏବଂ ଜଳୀୟ ବାଷ୍ପ ହେଉଛି ଅମ୍ଳଜାନ।";
    const res = validateOdiaTutorAnswer(badAns, "ଜଳର ଅବସ୍ଥା କ'ଣ?");
    assert.strictEqual(res.valid, false);
    assert.strictEqual(res.failedFactRule, 'rule4_water_states_gas_confusion');
  });

  runTest('Rejects heating water described as producing oxygen', () => {
    const badAns = "ପାଣିକୁ ଗରମ କଲେ ଅମ୍ଳଜାନ ସୃଷ୍ଟି ହୁଏ।";
    const res = validateOdiaTutorAnswer(badAns, "ପାଣିକୁ ଗରମ କଲେ କଣ ହୁଏ?");
    assert.strictEqual(res.valid, false);
    assert.strictEqual(res.failedFactRule, 'rule4_water_heating_produces_wrong_gas');
  });

  runTest('Rejects heating water described as producing carbon dioxide', () => {
    const badAns = "ଜଳକୁ ଗରମ କଲେ ଅଙ୍ଗାରକାମ୍ଳ ନିର୍ଗତ ହୁଏ।";
    const res = validateOdiaTutorAnswer(badAns, "ପାଣିକୁ ଗରମ କଲେ କଣ ହୁଏ?");
    assert.strictEqual(res.valid, false);
    assert.strictEqual(res.failedFactRule, 'rule4_water_heating_produces_wrong_gas');
  });

  console.log('\n--- 5 & 6. Evaporation & Condensation Canonical Rules ---');
  runTest('Accepts valid evaporation and condensation definitions', () => {
    const validAns = "ବାଷ୍ପୀଭବନରେ ଉତ୍ତାପ ଯୋଗୁଁ ତରଳ ଜଳ ବାଷ୍ପରେ ପରିଣତ ହୁଏ। ଅନ୍ୟପକ୍ଷରେ, ଘନୀଭବନରେ ଜଳୀୟ ବାଷ୍ପ ଥଣ୍ଡା ହୋଇ ତରଳ ଜଳରେ ପରିଣତ ହୁଏ।";
    const res = validateOdiaTutorAnswer(validAns, "ବାଷ୍ପୀଭବନ ଏବଂ ଘନୀଭବନ ମଧ୍ୟରେ ପାର୍ଥକ୍ୟ କ'ଣ?");
    assert.strictEqual(res.valid, true);
  });

  runTest('Rejects reversed evaporation (gas to liquid)', () => {
    const badAns = "ବାଷ୍ପ ତରଳ ଜଳରେ ପରିଣତ ହେବାକୁ ବାଷ୍ପୀଭବନ କୁହାଯାଏ। ଏହା ଏକ ଭୌତିକ ପ୍ରକ୍ରିୟା।";
    const res = validateOdiaTutorAnswer(badAns, "ବାଷ୍ପୀଭବନ କ'ଣ?");
    assert.strictEqual(res.valid, false);
    assert.strictEqual(res.failedFactRule, 'rule5_evaporation_reversed');
  });

  runTest('Rejects reversed condensation (liquid to gas)', () => {
    const badAns = "ତରଳ ଜଳ ଗ୍ୟାସରେ ପରିଣତ ହେବାକୁ ଘନୀଭବନ କୁହାଯାଏ।";
    const res = validateOdiaTutorAnswer(badAns, "ଘନୀଭବନ କ'ଣ?");
    assert.strictEqual(res.valid, false);
    assert.strictEqual(res.failedFactRule, 'rule6_condensation_reversed');
  });

  console.log('\n--- 7. Inertia (Newton 1st Law) Canonical Rules ---');
  runTest('Accepts correct Newton 1st law / inertia', () => {
    const validAns = "ନ୍ୟୁଟନଙ୍କ ପ୍ରଥମ ଗତି ନିୟମ ଅନୁସାରେ, କୌଣସି ବାହ୍ୟ ବଳ ପ୍ରୟୋଗ ନ ହେବା ପର୍ଯ୍ୟନ୍ତ ଏକ ସ୍ଥିର ବସ୍ତୁ ସ୍ଥିର ରହେ। ଏହାକୁ ଜଡ଼ତା ନିୟମ କୁହାଯାଏ।";
    const res = validateOdiaTutorAnswer(validAns, "ଜଡ଼ତା ଏବଂ ନ୍ୟୁଟନଙ୍କ ପ୍ରଥମ ନିୟମ କ'ଣ?");
    assert.strictEqual(res.valid, true);
  });

  runTest('Rejects Newton 1st law conflated with action-reaction', () => {
    const badAns = "ନ୍ୟୁଟନଙ୍କ ପ୍ରଥମ ଗତି ନିୟମ ହେଉଛି ପ୍ରତ୍ୟେକ କ୍ରିୟାର ସମାନ ଓ ବିପରୀତ ପ୍ରତିକ୍ରିୟା ରହିଛି।";
    const res = validateOdiaTutorAnswer(badAns, "ନ୍ୟୁଟନଙ୍କ ପ୍ରଥମ ଗତି ନିୟମ କ'ଣ?");
    assert.strictEqual(res.valid, false);
    assert.strictEqual(res.failedFactRule, 'rule7_newton_inertia_confusion');
  });

  console.log('\n--- 8. Water Cycle Canonical Rules ---');
  runTest('Accepts valid water cycle explanation', () => {
    const validAns = "ଜଳ ଚକ୍ରରେ ପ୍ରଥମେ ସୂର୍ଯ୍ୟଙ୍କ ଉତ୍ତାପ ଯୋଗୁଁ ତରଳ ଜଳ ବାଷ୍ପୀଭବନ ହୋଇ ବାୟୁମଣ୍ଡଳକୁ ଯାଏ। ସେଠାରେ ଘନୀଭବନ ହୋଇ ମେଘ ସୃଷ୍ଟି ହୁଏ ଏବଂ ଶେଷରେ ବର୍ଷା ଆକାରରେ ଜଳ ପୃଥିବୀକୁ ଫେରିଆସେ।";
    const res = validateOdiaTutorAnswer(validAns, "ଜଳ ଚକ୍ର କିପରି କାମ କରେ?");
    assert.strictEqual(res.valid, true);
  });

  runTest('Rejects reversed water cycle (rain going up)', () => {
    const badAns = "ଜଳ ଚକ୍ରରେ ବର୍ଷା ପୃଥିବୀରୁ ମେଘକୁ ଉପରକୁ ଯାଏ ଏବଂ ଜଳ ସୃଷ୍ଟି କରେ।";
    const res = validateOdiaTutorAnswer(badAns, "ଜଳ ଚକ୍ର କ'ଣ?");
    assert.strictEqual(res.valid, false);
    assert.strictEqual(res.failedFactRule, 'rule8_water_cycle_reversed');
  });

  console.log('\n--- 10. Semantic Contradiction Detector ---');
  runTest('Contextual contradiction check allows respiration clause inside photosynthesis answer', () => {
    const nuancedAns = "ଆଲୋକ ସଂଶ୍ଳେଷଣରେ ଉଦ୍ଭିଦ ଅଙ୍ଗାରକାମ୍ଳ ଗ୍ରହଣ କରି ଅମ୍ଳଜାନ ନିର୍ଗତ କରେ। କିନ୍ତୁ ଶ୍ୱସନ ପ୍ରକ୍ରିୟାରେ ଉଦ୍ଭିଦ ଅମ୍ଳଜାନ ଗ୍ରହଣ କରି ଅଙ୍ଗାରକାମ୍ଳ ତ୍ୟାଗ କରେ। ସୂର୍ଯ୍ୟାଲୋକ ଶକ୍ତି ଯୋଗାଏ ଏବଂ ଜଳ ବ୍ୟବହାର ହୁଏ।";
    const res = validateOdiaTutorAnswer(nuancedAns, "ଆଲୋକ ସଂଶ୍ଳେଷଣ କ'ଣ?");
    assert.strictEqual(res.valid, true, 'Respiration clause distinguishing O2 intake must NOT be falsely rejected');
  });

  runTest('Flags oxygen intake in sentence without respiration clause in photosynthesis context', () => {
    const conflictingAns = "ଆଲୋକ ସଂଶ୍ଳେଷଣରେ ଉଦ୍ଭିଦ ବାୟୁରୁ ଅମ୍ଳଜାନ ଗ୍ରହଣ କରେ। ଏହି ପ୍ରକ୍ରିୟାରେ ସୂର୍ଯ୍ୟାଲୋକ ଶକ୍ତି ଯୋଗାଏ। ଜଳ ବ୍ୟବହାର ହୁଏ।";
    const res = validateOdiaTutorAnswer(conflictingAns, "ଆଲୋକ ସଂଶ୍ଳେଷଣ କ'ଣ?");
    assert.strictEqual(res.valid, false);
    assert.strictEqual(res.failedFactRule, 'rule1_photosynthesis_oxygen_input');
  });

  // ====================================================
  // LIVE MODEL TESTS: CASES A, B, C, D
  // ====================================================
  console.log('\n====================================================');
  console.log('🤖 LIVE DHEE-ODIA PIPELINE TESTS (CASES A, B, C, D)');
  console.log('====================================================');

  // Case A: Night photosynthesis
  console.log('\n[Case A: Night Photosynthesis]');
  await runAsyncTest('Case A: "ଗଛମାନେ ରାତିରେ ଆଲୋକ ସଂଶ୍ଳେଷଣ କରନ୍ତି କି? କାହିଁକି?"', async () => {
    const promptA = "ଗଛମାନେ ରାତିରେ ଆଲୋକ ସଂଶ୍ଳେଷଣ କରନ୍ତି କି? କାହିଁକି?";
    const res = await simulateTutorPipeline(promptA);
    assert.strictEqual(res.validation.valid, true, 'Pipeline must return validated answer');
    // Must NOT claim plants store CO2 at night as the reason
    assert(!/(?:ଅଙ୍ଗାରକାମ୍ଳ|co2).*(?:ସଞ୍ଚୟ|ସାଇତି)|(?:ସଞ୍ଚୟ|ସାଇତି).*(?:ଅଙ୍ଗାରକାମ୍ଳ|co2)/i.test(res.reply), 'Must not claim CO2 storage at night');
    // Must explain absence of sunlight
    assert(/(?:ସୂର୍ଯ୍ୟାଲୋକ|ସୂର୍ଯ୍ୟଙ୍କ\s*ଆଲୋକ|ଆଲୋକ).*(?:ନ\s*ଥାଏ|ନ\s*ଥିବା|ଅନୁପସ୍ଥିତି|ଅଭାବ|ବିନା)/i.test(res.reply), 'Must explain sunlight is absent at night');
    console.log(`    Answer: "${res.reply}"`);
  });

  // Case B: Human breathing
  console.log('\n[Case B: Human Breathing]');
  await runAsyncTest('Case B: "ମଣିଷ ଶ୍ୱାସ ନେବା ସମୟରେ କେଉଁ ଗ୍ୟାସ ଗ୍ରହଣ କରେ ଏବଂ କେଉଁ ଗ୍ୟାସ ବାହାର କରେ?"', async () => {
    const promptB = "ମଣିଷ ଶ୍ୱାସ ନେବା ସମୟରେ କେଉଁ ଗ୍ୟାସ ଗ୍ରହଣ କରେ ଏବଂ କେଉଁ ଗ୍ୟାସ ବାହାର କରେ?";
    const res = await simulateTutorPipeline(promptB);
    assert.strictEqual(res.validation.valid, true, 'Pipeline must return validated answer');
    // Oxygen must be taken in
    assert(/ଅମ୍ଳଜାନ.*(?:ଗ୍ରହଣ|ନିଏ|ପ୍ରଶ୍ୱାସ)|(?:ଗ୍ରହଣ|ପ୍ରଶ୍ୱାସ).*ଅମ୍ଳଜାନ/i.test(res.reply), 'Must require oxygen in');
    // Carbon dioxide must be exhaled
    assert(/ଅଙ୍ଗାରକାମ୍ଳ.*(?:ବାହାର|ତ୍ୟାଗ|ନିଃଶ୍ୱାସ)|(?:ବାହାର|ତ୍ୟାଗ|ନିଃଶ୍ୱାସ).*ଅଙ୍ଗାରକାମ୍ଳ/i.test(res.reply), 'Must require CO2 out');
    console.log(`    Answer: "${res.reply}"`);
  });

  // Case C: Photosynthesis definition
  console.log('\n[Case C: Photosynthesis Definition]');
  await runAsyncTest('Case C: "ଆଲୋକ ସଂଶ୍ଳେଷଣ କ\'ଣ?"', async () => {
    const promptC = "ଆଲୋକ ସଂଶ୍ଳେଷଣ କ'ଣ?";
    const res = await simulateTutorPipeline(promptC);
    assert.strictEqual(res.validation.valid, true, 'Pipeline must return validated answer');
    // Must NOT state oxygen is an input
    const factCheck = validateFactualRelationships(res.reply, promptC);
    assert.strictEqual(factCheck.valid, true, `Must satisfy factual rules: ${factCheck.detail}`);
    console.log(`    Answer: "${res.reply}"`);
  });

  // Case D: Difference between evaporation and condensation
  console.log('\n[Case D: Evaporation vs Condensation]');
  await runAsyncTest('Case D: "ବାଷ୍ପୀଭବନ ଏବଂ ଘନୀଭବନ ମଧ୍ୟରେ ପାର୍ଥକ୍ୟ କ\'ଣ?"', async () => {
    const promptD = "ବାଷ୍ପୀଭବନ ଏବଂ ଘନୀଭବନ ମଧ୍ୟରେ ପାର୍ଥକ୍ୟ କ'ଣ?";
    const res = await simulateTutorPipeline(promptD);
    assert.strictEqual(res.validation.valid, true, 'Pipeline must return validated answer');
    // Must accept correct liquid->gas and gas->liquid relationships
    assert(/ବାଷ୍ପୀଭବନ.*(?:ତରଳ.*(?:ବାଷ୍ପ|ଗ୍ୟାସ)|ଜଳ.*ବାଷ୍ପ)|(?:ତରଳ.*(?:ବାଷ୍ପ|ଗ୍ୟାସ)).*ବାଷ୍ପୀଭବନ/i.test(res.reply), 'Evaporation must be liquid to gas');
    assert(/ଘନୀଭବନ.*(?:ବାଷ୍ପ.*(?:ତରଳ|ଜଳ)|ଗ୍ୟାସ.*(?:ତରଳ|ଜଳ))|(?:ବାଷ୍ପ.*(?:ତରଳ|ଜଳ)).*ଘନୀଭବନ/i.test(res.reply), 'Condensation must be gas to liquid');
    console.log(`    Answer: "${res.reply}"`);
  });

  console.log('\n====================================================');
  console.log('SUMMARY REPORT:');
  console.log(`PASS/FAIL: ${testsFailed === 0 ? 'PASS' : 'FAIL'}`);
  console.log(`number of tests: ${testsRun}`);
  console.log(`failed tests: ${testsFailed}`);
  console.log(`fallback count: ${totalFallbacks}`);
  console.log(`repair count: ${totalRepairs}`);
  console.log('====================================================');
}

main().catch(err => {
  console.error('\nSuite Execution Error:', err);
  process.exit(1);
});

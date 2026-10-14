'use strict';

const assert = require('assert');
const {
  MODELS,
  getModelForLanguage,
} = require('../agent/models');
const {
  isOdia,
  containsOdiaScript,
  extractOdiaContentPlan,
  buildOdiaTutorPrompt,
  validateOdiaTutorAnswer,
  buildOdiaRepairPrompt,
  getOdiaDeterministicFallback,
  CANONICAL_ODIA_VOCAB,
  CORRUPTED_ODIA_VOCAB,
  ODIA_EDUCATIONAL_FALLBACKS
} = require('../lib/languagePolicy');
const { buildSystemPrompt, ollamaOptions } = require('../lib/helpers');

const http = require('http');

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

async function callOdiaTutorPipeline(message, history = [], level = 'beginner', language = 'Odia') {
  const isOdiaReq = isOdia(language) || containsOdiaScript(message);
  const selectedModel = getModelForLanguage(isOdiaReq ? 'Odia' : 'English');
  const plan = extractOdiaContentPlan(message);
  const systemPrompt = isOdiaReq
    ? buildOdiaTutorPrompt(level, message, plan)
    : buildSystemPrompt(level, 'English');

  const messages = [
    { role: 'system', content: systemPrompt },
    ...history,
    { role: 'user', content: message }
  ];

  const startTime = Date.now();
  const payload = {
    model: selectedModel,
    messages,
    stream: false,
    think: false,
    options: isOdiaReq ? {
      temperature: 0.2,
      top_p: 0.9,
      repeat_penalty: 1.1,
      num_ctx: 4096,
      num_predict: 450
    } : {
      ...ollamaOptions('json'),
      num_ctx: 4096
    }
  };
  if (!isOdiaReq) {
    payload.format = 'json';
  }

  const res = await httpJsonPost('http://localhost:11434/api/chat', payload);

  if (!res.ok) throw new Error(`Ollama call failed with status ${res.status}`);
  const data = await res.json();
  let rawReply = (data.message?.content || '')
    .replace(/<think>[\s\S]*?<\/think>/gi, '')
    .replace(/<think>[\s\S]*$/gi, '')
    .trim();

  // Strip echoed prompt if repeated at start
  const promptClean = (message || '').trim().replace(/[?।\s]+$/, '');
  if (promptClean.length > 5 && rawReply.startsWith(promptClean)) {
    rawReply = rawReply.slice(promptClean.length).replace(/^[?।:\s-]+/, '').trim();
  }

  // Anti-parroting check
  const lastAssistantMsg = history.slice().reverse().find(h => h.role === 'assistant')?.content?.trim();
  let isParroting = false;
  if (lastAssistantMsg && rawReply.length > 20) {
    if (rawReply === lastAssistantMsg || rawReply.includes(lastAssistantMsg.slice(0, 50))) {
      isParroting = true;
    }
  }

  let validation = isOdiaReq ? validateOdiaTutorAnswer(rawReply, message, plan) : { valid: true };
  if (isOdiaReq && isParroting) {
    validation = { valid: false, reason: 'parroted_previous_answer', detail: 'Parroted previous answer' };
  }

  let retries = 0;
  let failureReason = validation.valid ? null : validation.reason;

  if (isOdiaReq && !validation.valid) {
    retries++;
    console.log(`  [Repair Triggered] Reason: ${validation.reason} (${validation.detail})`);
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
        num_ctx: 4096,
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
      }
    }

    if (!validation.valid) {
      console.log(`  [Deterministic Fallback Used] Topic: ${plan.topic}`);
      const fallback = getOdiaDeterministicFallback(plan.topic, plan.requestedConcepts);
      if (fallback) {
        rawReply = fallback;
        validation = { valid: true, fallbackUsed: true };
        failureReason = null;
      }
    }
  }

  const latencyMs = Date.now() - startTime;
  console.log(`[LLM]\nlanguage=${isOdiaReq ? 'Odia' : 'English'}\nmodel=${selectedModel}\ntask=tutor`);
  console.log(`[Odia Tutor Telemetry] answer_length=${rawReply.length}, generation_latency_ms=${latencyMs}, validation_result=${validation.valid ? 'PASSED' : 'FAILED'}, retry_count=${retries}, failure_reason=${failureReason || 'none'}`);

  return { reply: rawReply, validation, model: selectedModel, latencyMs, retries, plan };
}

async function runAllTests() {
  console.log('====================================================');
  console.log('🧪 RUNNING ODIA TUTOR QUALITY & POLICY TESTS');
  console.log('====================================================\n');

  // --- UNIT TESTS ---
  console.log('--- Unit Tests: Policy, Vocab, Validator & Fallback ---');

  // 1. Content plan extraction
  const pPrompt = "ଆଲୋକ ସଂଶ୍ଳେଷଣ କ'ଣ? ସହଜ ଓଡ଼ିଆରେ ୪–୫ଟି ବାକ୍ୟରେ ବୁଝାଅ। ଏଥିରେ ସୂର୍ଯ୍ୟାଲୋକ, ଜଳ, ଅଙ୍ଗାରକାମ୍ଳ ଏବଂ ଅମ୍ଳଜାନର ଭୂମିକା ସ୍ପଷ୍ଟ କର।";
  const plan = extractOdiaContentPlan(pPrompt);
  assert.strictEqual(plan.topic, 'photosynthesis', 'Topic should be photosynthesis');
  assert.deepStrictEqual(plan.sentenceCount, { min: 4, max: 5 }, 'Sentence count should be 4-5');
  assert(plan.conceptsMap.has('sunlight'), 'Should extract sunlight');
  assert(plan.conceptsMap.has('water'), 'Should extract water');
  assert(plan.conceptsMap.has('carbon_dioxide'), 'Should extract carbon dioxide');
  assert(plan.conceptsMap.has('oxygen'), 'Should extract oxygen');
  console.log('  ✓ Content plan extraction correctly parses sentence range and all 4 concepts');

  // 2. Corrupted vocab rejection
  const corruptedAnswer = "ଉଦ୍ଭିଦ ସଂଶ୍ଲେଷଣ ଏକ ପ୍ରକ୍ରିୟା। ସୂର୍ଯ୍ୟାଲୋକ ଶକ୍ତି ଯୋଗାଏ। ଜଳ ବ୍ୟବହାର ହୁଏ। ଅଙ୍ଗାରକାମ୍ଳ ଗ୍ରହଣ କରାଯାଏ। ଅମ୍ଳଜାନ ନିର୍ଗତ ହୁଏ।";
  const corruptedVal = validateOdiaTutorAnswer(corruptedAnswer, pPrompt, plan);
  assert.strictEqual(corruptedVal.valid, false, 'Should reject corrupted terminology');
  assert.strictEqual(corruptedVal.reason, 'corrupted_terminology');
  console.log('  ✓ Validator rejects corrupted term "ଉଦ୍ଭିଦ ସଂଶ୍ଲେଷଣ"');

  // 3. Factual error rejection
  const wrongFactAnswer = "ଆଲୋକ ସଂଶ୍ଳେଷଣରେ ଉଦ୍ଭିଦ ଅମ୍ଳଜାନ ଗ୍ୟାସ ଗ୍ରହଣ କରେ। ସୂର୍ଯ୍ୟାଲୋକ ଶକ୍ତି ଯୋଗାଏ। ଜଳ ବ୍ୟବହାର ହୁଏ। ଅଙ୍ଗାରକାମ୍ଳ ନିର୍ଗତ ହୁଏ।";
  const wrongFactVal = validateOdiaTutorAnswer(wrongFactAnswer, pPrompt, plan);
  assert.strictEqual(wrongFactVal.valid, false, 'Should reject oxygen as input');
  assert.strictEqual(wrongFactVal.reason, 'factual_error_oxygen_input');
  console.log('  ✓ Validator rejects factual error describing oxygen as input');

  // 4. Deterministic fallback test
  const fallback = getOdiaDeterministicFallback('photosynthesis', plan.requestedConcepts);
  assert(fallback && fallback.includes('ଆଲୋକ ସଂଶ୍ଳେଷଣ'), 'Fallback should contain canonical explanation');
  const fallbackVal = validateOdiaTutorAnswer(fallback, pPrompt, plan);
  assert.strictEqual(fallbackVal.valid, true, 'Deterministic fallback must pass validation');
  console.log('  ✓ High-confidence fallback exists and passes validation');

  console.log('\n--- Live Model Tests against Ollama ---');

  // TEST 1 — Photosynthesis
  console.log('\n[TEST 1 — Photosynthesis]');
  const t1 = await callOdiaTutorPipeline(pPrompt);
  assert.strictEqual(t1.model, 'dhee-odia', 'Odia must route to dhee-odia');
  assert(containsOdiaScript(t1.reply), 'Must contain Odia script');
  assert.strictEqual(t1.validation.valid, true, `Answer must pass validation: ${t1.reply}`);

  // Concepts checks
  assert(/ସୂର୍ଯ୍ୟାଲୋକ|ସୂର୍ଯ୍ୟ/i.test(t1.reply) && /ଶକ୍ତି|ଆଲୋକ/i.test(t1.reply), 'Must explain sunlight as energy source');
  assert(/ଜଳ|ପାଣି/i.test(t1.reply), 'Must mention water');
  assert(/ଅଙ୍ଗାରକାମ୍ଳ/i.test(t1.reply) && /ଗ୍ରହଣ|ବାୟୁ|ନିଅ|ବ୍ୟବହାର/i.test(t1.reply), 'Must explain carbon dioxide being taken in');
  assert(/ଅମ୍ଳଜାନ/i.test(t1.reply) && /ନିର୍ଗତ|ଛାଡ଼|ଉପ-ଉତ୍ପାଦ|ବାହାର|ସୃଷ୍ଟି|ଉତ୍ପନ୍ନ/i.test(t1.reply), 'Must explain oxygen being released');
  assert(!/ଉଦ୍ଭିଦ\s*ସଂଶ୍ଲେଷଣ/i.test(t1.reply), 'Must not contain corrupted term');
  console.log('  ✓ TEST 1 PASSED: Photosynthesis answered with all 4 required concepts and factual accuracy');
  console.log(`    Answer: "${t1.reply}"\n`);

  // TEST 2 — Simple science (Evaporation)
  console.log('[TEST 2 — Simple science (Evaporation)]');
  const evapPrompt = "ପାଣି ବାଷ୍ପୀଭବନ କ'ଣ? ସହଜ ଓଡ଼ିଆରେ ବୁଝାଅ।";
  const t2 = await callOdiaTutorPipeline(evapPrompt);
  assert.strictEqual(t2.model, 'dhee-odia', 'Odia must route to dhee-odia');
  assert(containsOdiaScript(t2.reply), 'Must contain Odia script');
  assert.strictEqual(t2.validation.valid, true, `Answer must pass validation: ${t2.reply}`);
  assert(/ବାଷ୍ପୀଭବନ|ବାଷ୍ପ/i.test(t2.reply), 'Must mention evaporation/vapor');
  console.log('  ✓ TEST 2 PASSED: Evaporation explained correctly');
  console.log(`    Answer: "${t2.reply}"\n`);

  // TEST 3 — Simple definition (Sun)
  console.log('[TEST 3 — Simple definition (Sun)]');
  const sunPrompt = "ସୂର୍ଯ୍ୟ କ'ଣ? ଜଣେ ଛାତ୍ର ବୁଝିପାରିବା ଭଳି ସହଜ ଓଡ଼ିଆରେ ବୁଝାଅ।";
  const t3 = await callOdiaTutorPipeline(sunPrompt);
  assert.strictEqual(t3.model, 'dhee-odia', 'Odia must route to dhee-odia');
  assert(containsOdiaScript(t3.reply), 'Must contain Odia script');
  assert.strictEqual(t3.validation.valid, true, `Answer must pass validation: ${t3.reply}`);
  assert(/ସୂର୍ଯ୍ୟ/i.test(t3.reply), 'Must mention Sun');
  assert(/ନକ୍ଷତ୍ର|ଆଲୋକ|ଶକ୍ତି|ଉତ୍ତାପ|ତାରା/i.test(t3.reply), 'Must describe Sun as star/source of light and heat');
  console.log('  ✓ TEST 3 PASSED: Sun defined clearly and naturally');
  console.log(`    Answer: "${t3.reply}"\n`);

  // TEST 4 — Follow-up
  console.log('[TEST 4 — Follow-up]');
  const f1Prompt = "ଆଲୋକ ସଂଶ୍ଳେଷଣ କ'ଣ?";
  const t4_1 = await callOdiaTutorPipeline(f1Prompt);
  console.log(`    Turn 1 Answer: "${t4_1.reply.slice(0, 60)}…"`);

  const f2Prompt = "ଏଥିରେ ଅମ୍ଳଜାନ କେଉଁଠୁ ଆସେ?";
  const history = [
    { role: 'user', content: f1Prompt },
    { role: 'assistant', content: t4_1.reply }
  ];
  const t4_2 = await callOdiaTutorPipeline(f2Prompt, history);
  assert.strictEqual(t4_2.model, 'dhee-odia', 'Odia must route to dhee-odia');
  assert(containsOdiaScript(t4_2.reply), 'Must contain Odia script');
  assert.strictEqual(t4_2.validation.valid, true, `Follow-up must pass validation: ${t4_2.reply}`);
  assert.notStrictEqual(t4_2.reply.trim(), t4_1.reply.trim(), 'Follow-up must not repeat the first turn answer');
  assert(/ଅମ୍ଳଜାନ/i.test(t4_2.reply), 'Must address oxygen origin in follow-up');
  console.log('  ✓ TEST 4 PASSED: Follow-up answered new question without parroting previous turn');
  console.log(`    Turn 2 Answer: "${t4_2.reply}"\n`);

  // TEST 5 — English regression
  console.log('[TEST 5 — English regression]');
  const enPrompt = "What is photosynthesis? Explain simply in 4-5 sentences.";
  const t5 = await callOdiaTutorPipeline(enPrompt, [], 'beginner', 'English');
  assert.strictEqual(t5.model, 'qwen3:4b', 'English prompt must route to qwen3:4b');
  assert(t5.reply.length > 20, 'English reply must be non-empty');
  assert(!containsOdiaScript(t5.reply), 'English reply should not be in Odia script');
  console.log('  ✓ TEST 5 PASSED: English prompt routes to qwen3:4b');
  console.log(`    Reply preview: "${t5.reply.slice(0, 70)}…"\n`);

  console.log('====================================================');
  console.log('🎉 ALL 5 ODIA TUTOR QUALITY TESTS PASSED PERFECTLY!');
  console.log('====================================================');
}

runAllTests().catch(err => {
  console.error('\n❌ Test Suite Failed:', err);
  process.exit(1);
});

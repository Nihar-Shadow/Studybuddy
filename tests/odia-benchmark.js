// tests/odia-benchmark.js
// Live Odia Benchmark (Part 14 & 15) comparing models or evaluating qwen3:4b vs Dhee Odia

const { parseQuizResponse } = require('../lib/parseJSON');
const {
  isOdia,
  containsOdiaScript,
  isCompleteOdiaQuestion,
  validateQuizFactualCorrectness,
  validateQuizDiversity,
  validateQuizQuality,
  getTopicCoveragePlan,
  getLanguageDirective,
} = require('../lib/languagePolicy');
const { MODELS, checkModelAvailable } = require('../agent/models');
const { ollamaOptions } = require('../lib/helpers');

const OLLAMA_URL = process.env.OLLAMA_BASE_URL || 'http://localhost:11434';

const BENCHMARK_CASES = [
  {
    id: 1,
    name: 'Photosynthesis 3 MCQs',
    topic: 'ଆଲୋକ ସଂଶ୍ଳେଷଣ',
    count: 3,
    prompt: 'ଆଲୋକ ସଂଶ୍ଳେଷଣ ବିଷୟରେ ଓଡ଼ିଆରେ ୩ଟି MCQ ତିଆରି କର।',
  },
  {
    id: 2,
    name: 'Photosynthesis 5 MCQs',
    topic: 'ଆଲୋକ ସଂଶ୍ଳେଷଣ',
    count: 5,
    prompt: 'ଆଲୋକ ସଂଶ୍ଳେଷଣ ବିଷୟରେ ୫ଟି MCQ ତିଆରି କର।',
  },
  {
    id: 3,
    name: 'Water Cycle 3 MCQs',
    topic: 'ପାଣିର ଚକ୍ର',
    count: 3,
    prompt: 'ପାଣିର ଚକ୍ର ବିଷୟରେ ୩ଟି MCQ ତିଆରି କର।',
  },
  {
    id: 4,
    name: 'Plant Parts 3 MCQs',
    topic: 'ଉଦ୍ଭିଦର ଅଂଶ',
    count: 3,
    prompt: 'ଉଦ୍ଭିଦର ଅଂଶ ବିଷୟରେ ୩ଟି MCQ ତିଆରି କର।',
  },
  {
    id: 5,
    name: 'Part 15 Constrained Test',
    topic: 'ଆଲୋକ ସଂଶ୍ଳେଷଣ',
    count: 3,
    isConstrained: true,
    prompt: `ଆଲୋକ ସଂଶ୍ଳେଷଣ ବିଷୟରେ ଓଡ଼ିଆରେ ୩ଟି MCQ ତିଆରି କର।
କେବଳ ଏହି ୩ଟି ଧାରଣା ବ୍ୟବହାର କର:
1) ସୂର୍ଯ୍ୟାଲୋକ ଶକ୍ତିର ଉତ୍ସ,
2) ଅଙ୍ଗାରକାମ୍ଳ ଗ୍ରହଣ,
3) ପତ୍ରରନ୍ଧ୍ର ଦ୍ୱାରା ଗ୍ୟାସ ବିନିମୟ।
କେବଳ ଏହି ଶବ୍ଦଗୁଡ଼ିକ ବ୍ୟବହାର କର:
ସୂର୍ଯ୍ୟାଲୋକ, ଅଙ୍ଗାରକାମ୍ଳ, ପତ୍ରରନ୍ଧ୍ର, ଅମ୍ଳଜାନ, ଜଳ।
ଅନ୍ୟ କୌଣସି ନୂଆ ବୈଜ୍ଞାନିକ ଶବ୍ଦ ତିଆରି କରନାହିଁ।`,
  },
];

async function runPrompt(modelName, testCase) {
  const coveragePlan = getTopicCoveragePlan(testCase.topic, testCase.count, 'Odia');
  const planInstructions = coveragePlan.concepts
    .map(c => `- Q${c.index}: concept "${c.description}"`)
    .join('\n');
  const langDirective = getLanguageDirective('Odia', 'quiz', testCase.topic);

  const systemPrompt = `${langDirective}You are an expert school science quiz generator.
Generate exactly ${testCase.count} multiple choice questions in natural, grammatically correct Odia (ଓଡ଼ିଆ).
MANDATORY CONCEPTS:
${planInstructions}
RULES:
1. QUESTION COUNT: Exactly ${testCase.count} questions.
2. DIVERSITY: Each question tests ONE distinct concept. Never repeat concepts.
3. OPTIONS: Exactly 4 distinct choices per question. Do NOT include A)/B)/C)/D) prefixes in options array.
4. ANSWER: "answer" must be a zero-based integer index (0, 1, 2, or 3).
5. EXPLANATION: 1 short sentence in Odia teaching why the answer is correct.
6. JSON ONLY: Return strictly JSON: {"questions":[{"question":"...","options":["...","...","...","..."],"answer":0,"explanation":"..."}]}`;

  const t0 = Date.now();
  let res;
  try {
    res = await fetch(`${OLLAMA_URL}/api/chat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: modelName,
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: testCase.prompt }
        ],
        stream: false,
        format: 'json',
        think: false,
        options: {
          ...ollamaOptions('quiz'),
          num_predict: 1200,
          num_ctx: 4096,
        }
      })
    });
  } catch (err) {
    return {
      success: false,
      error: `Network error: ${err.message}`,
      latencyMs: Date.now() - t0,
    };
  }

  const latencyMs = Date.now() - t0;
  if (!res.ok) {
    return {
      success: false,
      error: `HTTP ${res.status}: ${res.statusText}`,
      latencyMs,
    };
  }

  const data = await res.json();
  const rawContent = (data.message?.content || '').replace(/<think>[\s\S]*?<\/think>/gi, '').trim();
  const promptTokens = data.prompt_eval_count || 0;
  const evalTokens = data.eval_count || 0;
  const evalDurationNs = data.eval_duration || 1;
  const tokensPerSec = evalTokens > 0 ? ((evalTokens / evalDurationNs) * 1e9).toFixed(1) : 'N/A';

  // 1. JSON Validity
  let questions = [];
  let validJSON = false;
  try {
    questions = parseQuizResponse(rawContent);
    validJSON = Array.isArray(questions) && questions.length > 0;
  } catch (e) {
    validJSON = false;
  }

  // 2. Complete questions check
  let completeQuestionsCount = 0;
  let fourOptionsCount = 0;
  let validAnswerIndexCount = 0;
  let odiaScriptCount = 0;
  let sentenceFragments = [];

  for (const q of questions) {
    if (containsOdiaScript(q.question)) odiaScriptCount++;
    if (q.options && q.options.length === 4) fourOptionsCount++;
    if (typeof q.answerIndex === 'number' && q.answerIndex >= 0 && q.answerIndex < 4) {
      validAnswerIndexCount++;
    } else if (typeof q.answer === 'string' && q.options.some(o => o.includes(q.answer) || q.answer.includes(o))) {
      validAnswerIndexCount++;
    }

    if (isCompleteOdiaQuestion(q.question)) {
      completeQuestionsCount++;
    } else {
      sentenceFragments.push(q.question);
    }
  }

  // 3. Factual Accuracy & Quality validation
  const quality = validateQuizQuality(questions, testCase.topic, 'Odia');
  const factual = validateQuizFactualCorrectness(questions, testCase.topic, 'Odia');
  const diversity = validateQuizDiversity(questions);

  // 4. Canonical Vocabulary check
  const canonicalTerms = ['ସୂର୍ଯ୍ୟାଲୋକ', 'ଅଙ୍ଗାରକାମ୍ଳ', 'ପତ୍ରରନ୍ଧ୍ର', 'ଅମ୍ଳଜାନ', 'ଜଳ', 'ଆଲୋକ ସଂଶ୍ଳେଷଣ', 'ପତ୍ରହରିତ', 'ହରିତକଣିକା'];
  const fullText = JSON.stringify(questions);
  const foundCanonical = canonicalTerms.filter(t => fullText.includes(t));

  // 5. Hallucinated / corrupted words check
  const corruptedCandidates = ['ସୂର୍ଯ୍ୟାସ୍ଥଳୀ', 'ଗୋଲାକ', 'ଉଦ୍ଭିଦ କାହାରେ', 'ଶକ୍ତିକାମ୍ଳ', 'ପତ୍ରରନ୍ଧ୍ରାକାର'];
  const foundCorrupted = corruptedCandidates.filter(t => fullText.includes(t));

  return {
    success: true,
    model: modelName,
    caseId: testCase.id,
    caseName: testCase.name,
    targetCount: testCase.count,
    generatedCount: questions.length,
    validJSON,
    completeQuestions: `${completeQuestionsCount}/${questions.length}`,
    fourOptions: `${fourOptionsCount}/${questions.length}`,
    validAnswerIndex: `${validAnswerIndexCount}/${questions.length}`,
    odiaScriptRatio: `${odiaScriptCount}/${questions.length}`,
    sentenceFragments,
    factualValid: factual.valid,
    factualIssues: factual.issues || [],
    diversityValid: diversity.valid,
    qualityValid: quality.valid,
    qualityReason: quality.valid ? 'PASS' : (quality.detail || quality.reason),
    canonicalTermsCount: foundCanonical.length,
    canonicalTerms: foundCanonical,
    corruptedTermsFound: foundCorrupted,
    latencyMs,
    promptTokens,
    evalTokens,
    tokensPerSec,
    sampleQ1: questions[0]?.question || 'N/A',
    sampleAns1: questions[0]?.answer || 'N/A',
  };
}

async function runBenchmark() {
  console.log('===============================================================');
  console.log('StudyBuddy Live Odia Benchmark (Parts 14 & 15)');
  console.log('Comparing Models against Odia Quality, Completeness & Facts');
  console.log('===============================================================\n');

  const defaultModel = MODELS.default; // qwen3:4b
  const odiaModel = MODELS.odia;       // dhee-odia

  console.log(`Default Model configured: ${defaultModel}`);
  console.log(`Odia Model configured:    ${odiaModel}`);

  const defaultCheck = await checkModelAvailable(defaultModel);
  const odiaCheck = await checkModelAvailable(odiaModel);

  console.log(`\nOllama Status:`);
  console.log(`  - ${defaultModel}: ${defaultCheck.available ? 'INSTALLED & READY' : 'NOT INSTALLED'}`);
  console.log(`  - ${odiaModel}:    ${odiaCheck.available ? 'INSTALLED & READY' : 'NOT INSTALLED (Needs manual import)'}`);

  const modelsToTest = [];
  if (defaultCheck.available) modelsToTest.push(defaultModel);
  if (odiaCheck.available) modelsToTest.push(odiaModel);

  if (modelsToTest.length === 0) {
    console.error('No models available in Ollama to run live benchmark.');
    process.exit(1);
  }

  const results = {};

  for (const model of modelsToTest) {
    console.log(`\n---------------------------------------------------------------`);
    console.log(`Running Benchmark for model: ${model}`);
    console.log(`---------------------------------------------------------------`);
    results[model] = [];

    for (const testCase of BENCHMARK_CASES) {
      process.stdout.write(`  [${model}] Running Case ${testCase.id}: ${testCase.name}... `);
      const res = await runPrompt(model, testCase);
      results[model].push(res);
      if (res.success) {
        console.log(`Done (${(res.latencyMs / 1000).toFixed(1)}s, ${res.tokensPerSec} t/s) - Quality: ${res.qualityReason}`);
      } else {
        console.log(`Failed: ${res.error}`);
      }
    }
  }

  // Print Comparison Table
  console.log('\n===============================================================');
  console.log('BENCHMARK SUMMARY REPORT');
  console.log('===============================================================\n');

  for (const model of modelsToTest) {
    console.log(`Model: ${model}`);
    console.log('-----------------------------------------------------------------------------------------------------------------');
    console.log('ID | Test Name                | Count | JSON | Complete | 4-Opts | Factual | Diversity | Quality | Latency | t/s');
    console.log('-----------------------------------------------------------------------------------------------------------------');
    for (const r of results[model]) {
      if (!r.success) {
        console.log(`${r.caseId}  | ${r.caseName.padEnd(24)} | ERROR: ${r.error}`);
        continue;
      }
      const idStr = String(r.caseId).padEnd(2);
      const nameStr = r.caseName.padEnd(24);
      const countStr = `${r.generatedCount}/${r.targetCount}`.padEnd(5);
      const jsonStr = (r.validJSON ? 'PASS' : 'FAIL').padEnd(4);
      const compStr = r.completeQuestions.padEnd(8);
      const optStr = r.fourOptions.padEnd(6);
      const factStr = (r.factualValid ? 'PASS' : 'FAIL').padEnd(7);
      const divStr = (r.diversityValid ? 'PASS' : 'FAIL').padEnd(9);
      const qualStr = (r.qualityValid ? 'PASS' : 'FAIL').padEnd(7);
      const latStr = `${(r.latencyMs / 1000).toFixed(1)}s`.padEnd(7);
      const tpsStr = `${r.tokensPerSec}`;
      console.log(`${idStr} | ${nameStr} | ${countStr} | ${jsonStr} | ${compStr} | ${optStr} | ${factStr} | ${divStr} | ${qualStr} | ${latStr} | ${tpsStr}`);
      if (r.sentenceFragments.length > 0) {
        console.log(`     ↳ Fragment detected: "${r.sentenceFragments[0]}"`);
      }
      if (r.factualIssues.length > 0) {
        console.log(`     ↳ Factual issue: ${r.factualIssues.join('; ')}`);
      }
    }
    console.log('-----------------------------------------------------------------------------------------------------------------\n');
  }

  // Dump detailed JSON report for inspection
  const fs = require('fs');
  fs.writeFileSync('benchmark_results.json', JSON.stringify(results, null, 2));
  console.log('Detailed benchmark report written to benchmark_results.json\n');
}

runBenchmark().catch(err => {
  console.error('Benchmark execution error:', err);
});

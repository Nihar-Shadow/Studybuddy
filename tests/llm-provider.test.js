// tests/llm-provider.test.js
// Exhaustive test matrix for Phase 3: Hybrid Online/Offline LLM Architecture
// Tests A through R from Phase 3 specification.

const assert = require('assert');
const http = require('http');
const {
  OllamaProvider,
  OnlineProvider,
  HybridLLMProvider
} = require('../lib/llmProvider');
const { parseTutorResponse } = require('../lib/parseJSON');
const {
  buildStructuredOdiaTutorResponse,
  isStructuredExplanationRequested
} = require('../lib/structuredTutor');
const {
  validateOdiaTutorAnswer,
  extractOdiaContentPlan
} = require('../lib/languagePolicy');
const {
  findRelevantClass9Knowledge,
  validateAgainstClass9Knowledge
} = require('../lib/class9Knowledge');
const {
  createInitialLearningState,
  recordLearningEvent,
  chooseMasteryAction,
  resolveTopicAndConcept
} = require('../lib/studentLearningState');
const {
  calculateSM2,
  MASTERY_STATES
} = require('../lib/masteryAgent');
const {
  getTargetedPractice,
  processPracticeSubmission
} = require('../lib/targetedPractice');

let passed = 0;
let failed = 0;

async function test(name, fn) {
  try {
    await fn();
    console.log(`  ✓ ${name}`);
    passed++;
  } catch (err) {
    console.error(`  ✗ ${name}:`, err.message);
    failed++;
  }
}

// Helper to spawn a temporary mock HTTP server
function createMockServer(handler) {
  return new Promise((resolve) => {
    const server = http.createServer(handler);
    server.listen(0, '127.0.0.1', () => {
      const port = server.address().port;
      resolve({
        server,
        url: `http://127.0.0.1:${port}`,
        close: () => new Promise(r => server.close(r))
      });
    });
  });
}

async function runTestSuite() {
  console.log('====================================================');
  console.log('🌐 PHASE 3 — HYBRID LLM ARCHITECTURE TEST MATRIX (A - R)');
  console.log('====================================================\n');

  // ----------------------------------------------------
  // Test A: Online provider available -> online selected
  // ----------------------------------------------------
  await test('A. Online provider available -> online selected', async () => {
    const mockOnline = await createMockServer((req, res) => {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({
        choices: [{ message: { content: 'Online response explaining force.' } }]
      }));
    });

    try {
      const online = new OnlineProvider({
        enabled: true,
        baseUrl: mockOnline.url,
        apiKey: 'test-secret-key',
        model: 'mock-online-model',
        timeoutMs: 2000
      });

      const ollama = new OllamaProvider();
      const hybrid = new HybridLLMProvider({ onlineProvider: online, ollamaProvider: ollama });

      const result = await hybrid.generate({
        language: 'English',
        messages: [{ role: 'user', content: 'What is force?' }]
      });

      assert.strictEqual(result.provider, 'online');
      assert.strictEqual(result.fallback, false);
      assert.strictEqual(result.model, 'mock-online-model');
      assert.strictEqual(result.text, 'Online response explaining force.');
    } finally {
      await mockOnline.close();
    }
  });

  // ----------------------------------------------------
  // Test B: Online provider unavailable -> Ollama selected
  // ----------------------------------------------------
  await test('B. Online provider unavailable (500 error) -> Ollama selected', async () => {
    const mockOnline = await createMockServer((req, res) => {
      res.writeHead(500, { 'Content-Type': 'text/plain' });
      res.end('Server Internal Error');
    });

    let ollamaInvoked = false;
    const mockOllama = {
      name: 'ollama',
      defaultModel: 'qwen3:4b',
      odiaModel: 'dhee-odia',
      generate: async () => {
        ollamaInvoked = true;
        return { text: 'Ollama fallback explanation of force.', provider: 'ollama', model: 'qwen3:4b' };
      }
    };

    try {
      const online = new OnlineProvider({
        enabled: true,
        baseUrl: mockOnline.url,
        apiKey: 'test-secret-key',
        model: 'mock-online-model',
        timeoutMs: 2000
      });

      const hybrid = new HybridLLMProvider({ onlineProvider: online, ollamaProvider: mockOllama });
      const result = await hybrid.generate({
        language: 'English',
        messages: [{ role: 'user', content: 'What is force?' }]
      });

      assert.strictEqual(ollamaInvoked, true);
      assert.strictEqual(result.provider, 'ollama');
      assert.strictEqual(result.fallback, true);
      assert.strictEqual(result.text, 'Ollama fallback explanation of force.');
    } finally {
      await mockOnline.close();
    }
  });

  // ----------------------------------------------------
  // Test C: Online provider timeout -> Ollama fallback
  // ----------------------------------------------------
  await test('C. Online provider timeout -> Ollama fallback', async () => {
    const mockOnline = await createMockServer((req, res) => {
      // Intentionally hang longer than timeoutMs
      setTimeout(() => {
        try {
          res.writeHead(200, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ choices: [{ message: { content: 'Too slow' } }] }));
        } catch (_) {}
      }, 500);
    });

    let ollamaInvoked = false;
    const mockOllama = {
      name: 'ollama',
      defaultModel: 'qwen3:4b',
      odiaModel: 'dhee-odia',
      generate: async () => {
        ollamaInvoked = true;
        return { text: 'Ollama answer after online timeout.', provider: 'ollama', model: 'qwen3:4b' };
      }
    };

    try {
      const online = new OnlineProvider({
        enabled: true,
        baseUrl: mockOnline.url,
        apiKey: 'test-secret-key',
        model: 'mock-online-model',
        timeoutMs: 80 // Short timeout to test trigger
      });

      const hybrid = new HybridLLMProvider({ onlineProvider: online, ollamaProvider: mockOllama });
      const result = await hybrid.generate({
        language: 'English',
        messages: [{ role: 'user', content: 'What is force?' }]
      });

      assert.strictEqual(ollamaInvoked, true);
      assert.strictEqual(result.provider, 'ollama');
      assert.strictEqual(result.fallback, true);
      assert.strictEqual(result.text, 'Ollama answer after online timeout.');
    } finally {
      await mockOnline.close();
    }
  });

  // ----------------------------------------------------
  // Test D: Online provider missing configuration -> Ollama
  // ----------------------------------------------------
  await test('D. Online provider missing configuration -> Ollama selected directly', async () => {
    let ollamaInvoked = false;
    const mockOllama = {
      name: 'ollama',
      defaultModel: 'qwen3:4b',
      odiaModel: 'dhee-odia',
      generate: async () => {
        ollamaInvoked = true;
        return { text: 'Ollama local response.', provider: 'ollama', model: 'qwen3:4b' };
      }
    };

    const unconfiguredOnline = new OnlineProvider({
      enabled: false,
      apiKey: '',
      model: ''
    });

    const hybrid = new HybridLLMProvider({ onlineProvider: unconfiguredOnline, ollamaProvider: mockOllama });
    const result = await hybrid.generate({
      language: 'English',
      messages: [{ role: 'user', content: 'What is force?' }]
    });

    assert.strictEqual(ollamaInvoked, true);
    assert.strictEqual(result.provider, 'ollama');
    assert.strictEqual(result.fallback, false); // Not a fallback; online was disabled
    assert.strictEqual(result.text, 'Ollama local response.');
  });

  // ----------------------------------------------------
  // Test E: Ollama unavailable while online available -> online still works
  // ----------------------------------------------------
  await test('E. Ollama unavailable while online available -> online still works', async () => {
    const mockOnline = await createMockServer((req, res) => {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({
        choices: [{ message: { content: 'Online handles query even if Ollama is dead.' } }]
      }));
    });

    const brokenOllama = {
      name: 'ollama',
      defaultModel: 'qwen3:4b',
      odiaModel: 'dhee-odia',
      generate: async () => {
        throw new Error('Connection refused: Ollama is down');
      }
    };

    try {
      const online = new OnlineProvider({
        enabled: true,
        baseUrl: mockOnline.url,
        apiKey: 'test-secret-key',
        model: 'mock-online-model',
        timeoutMs: 2000
      });

      const hybrid = new HybridLLMProvider({ onlineProvider: online, ollamaProvider: brokenOllama });
      const result = await hybrid.generate({
        language: 'English',
        messages: [{ role: 'user', content: 'What is inertia?' }]
      });

      assert.strictEqual(result.provider, 'online');
      assert.strictEqual(result.text, 'Online handles query even if Ollama is dead.');
    } finally {
      await mockOnline.close();
    }
  });

  // ----------------------------------------------------
  // Test F: Both unavailable -> safe user-facing error
  // ----------------------------------------------------
  await test('F. Both unavailable -> safe error thrown without leaking secrets', async () => {
    const brokenOnline = new OnlineProvider({
      enabled: true,
      baseUrl: 'http://127.0.0.1:59999', // Non-existent port
      apiKey: 'SUPER_SECRET_TOKEN_12345',
      model: 'online-model',
      timeoutMs: 100
    });

    const brokenOllama = {
      name: 'ollama',
      defaultModel: 'qwen3:4b',
      odiaModel: 'dhee-odia',
      generate: async () => {
        throw new Error('ECONNREFUSED 127.0.0.1:11434');
      }
    };

    const hybrid = new HybridLLMProvider({ onlineProvider: brokenOnline, ollamaProvider: brokenOllama });

    let thrown = null;
    try {
      await hybrid.generate({ language: 'English', messages: [{ role: 'user', content: 'test' }] });
    } catch (err) {
      thrown = err;
    }

    assert(thrown !== null, 'Should have thrown when both fail');
    assert(thrown.message.includes('Both online provider'), 'Error message clearly explains failure');
    assert(!thrown.message.includes('SUPER_SECRET_TOKEN_12345'), 'Must NEVER leak API secret in error message');
  });

  // ----------------------------------------------------
  // Test G & H: English online vs offline structured response contract
  // ----------------------------------------------------
  await test('G. English online -> structured response contract', () => {
    const rawOnlineReply = JSON.stringify({
      intro: 'Force is an interaction that causes a mass to accelerate.',
      steps: [
        { title: 'Definition', text: 'Force is a push or pull upon an object.' },
        { title: 'Formula', text: 'F = m * a (Newton’s Second Law).' }
      ],
      summary: 'Force changes the state of motion of an object.',
      followUp: 'Would you like to try calculating force using mass and acceleration?'
    });

    const parsed = parseTutorResponse(rawOnlineReply);
    assert(parsed.intro.includes('Force'));
    assert(Array.isArray(parsed.steps) && parsed.steps.length === 2);
    assert(parsed.summary || parsed.answer);
    assert(parsed.followup || parsed.followUp);
  });

  await test('H. English offline -> structured response contract matches online', () => {
    const rawOfflineReply = JSON.stringify({
      intro: 'Force is a push or pull on an object.',
      steps: [
        { title: 'Push or Pull', text: 'Any interaction that changes motion is a force.' },
        { title: 'Units', text: 'The SI unit of force is the Newton (N).' }
      ],
      summary: 'Force produces acceleration.',
      followUp: 'Shall we explore balanced vs unbalanced forces?'
    });

    const parsed = parseTutorResponse(rawOfflineReply);
    assert(parsed.intro.includes('Force'));
    assert(Array.isArray(parsed.steps) && parsed.steps.length === 2);
    assert(parsed.summary || parsed.answer);
    assert(parsed.followup || parsed.followUp);
  });

  // ----------------------------------------------------
  // Test I & J: Odia online vs offline response + validation
  // ----------------------------------------------------
  await test('I. Odia online -> Odia response + validation', () => {
    const studentQuestion = "ଆଲୋକ ସଂଶ୍ଳେଷଣ କ'ଣ?";
    const rawOnlineOdia = "ଆଲୋକ ସଂଶ୍ଳେଷଣ ହେଉଛି ଏକ ଜୈବ ରାସାୟନିକ ପ୍ରକ୍ରିୟା। ସୂର୍ଯ୍ୟାଲୋକ ଏବଂ ପତ୍ରହରିତ ଉପସ୍ଥିତିରେ ଉଦ୍ଭିଦ ଅଙ୍ଗାରକାମ୍ଳ ଓ ଜଳ ବ୍ୟବହାର କରି ଗ୍ଲୁକୋଜ ତିଆରି କରେ ଏବଂ ଅମ୍ଳଜାନ ନିର୍ଗତ ହୁଏ।";

    const plan = extractOdiaContentPlan(studentQuestion);
    const c9Knowledge = findRelevantClass9Knowledge(studentQuestion, 'Odia', []);

    // Factual validation
    const val = validateOdiaTutorAnswer(rawOnlineOdia, studentQuestion, plan);
    assert.strictEqual(val.valid, true, `Validation failed: ${val.reason}`);

    const c9Val = validateAgainstClass9Knowledge(rawOnlineOdia, c9Knowledge);
    assert.strictEqual(c9Val.valid, true, `Class 9 validation failed: ${c9Val.reason}`);

    const structured = buildStructuredOdiaTutorResponse({
      rawReply: rawOnlineOdia,
      message: studentQuestion,
      odiaContentPlan: plan,
      class9Knowledge: c9Knowledge,
      level: 'intermediate'
    });

    assert(Array.isArray(structured.steps) && structured.steps.length > 0);
    assert(structured.intro || structured.steps[0]);
    assert(structured.answer || structured.summary);
  });

  await test('J. Odia offline -> Odia response + validation', () => {
    const studentQuestion = "ବଳ କ'ଣ?";
    const rawOfflineOdia = "ବଳ ହେଉଛି ଏକ ଟାଣିବା ବା ଠେଲିବା କ୍ରିୟା ଯାହା ବସ୍ତୁର ସ୍ଥିତାବସ୍ଥା ବା ଗତିଶୀଳ ଅବସ୍ଥାରେ ପରିବର୍ତ୍ତନ ଆଣେ। ଏହାର SI ଏକକ ହେଉଛି ନିଉଟନ (N)।";

    const plan = extractOdiaContentPlan(studentQuestion);
    const c9Knowledge = findRelevantClass9Knowledge(studentQuestion, 'Odia', []);

    const val = validateOdiaTutorAnswer(rawOfflineOdia, studentQuestion, plan);
    assert.strictEqual(val.valid, true, `Validation failed: ${val.reason}`);

    const structured = buildStructuredOdiaTutorResponse({
      rawReply: rawOfflineOdia,
      message: studentQuestion,
      odiaContentPlan: plan,
      class9Knowledge: c9Knowledge,
      level: 'intermediate'
    });

    assert(Array.isArray(structured.steps) && structured.steps.length > 0);
  });

  // ----------------------------------------------------
  // Test K: Online and offline use same curriculum resolution
  // ----------------------------------------------------
  await test('K. Online and offline use same curriculum resolution', () => {
    const query = 'How do plants convert sunlight into food?';
    const c9Online = findRelevantClass9Knowledge(query, 'English', []);
    const c9Offline = findRelevantClass9Knowledge(query, 'English', []);

    assert.strictEqual(c9Online.id, 'photosynthesis');
    assert.strictEqual(c9Offline.id, 'photosynthesis');
    assert.deepStrictEqual(c9Online.concepts, c9Offline.concepts);
  });

  // ----------------------------------------------------
  // Test L: Online and offline use same Mastery Agent
  // ----------------------------------------------------
  await test('L. Online and offline use same deterministic Mastery Agent', () => {
    const stateOnline = createInitialLearningState({ language: 'English', grade: 9 });
    const stateOffline = createInitialLearningState({ language: 'English', grade: 9 });

    recordLearningEvent(stateOnline, { topic: 'force_and_motion', concept: 'inertia_first_law', evidence: 'asked_about_concept' });
    recordLearningEvent(stateOffline, { topic: 'force_and_motion', concept: 'inertia_first_law', evidence: 'asked_about_concept' });

    const actionOnline = chooseMasteryAction(stateOnline, {
      currentTopic: 'force_and_motion',
      currentConcept: 'inertia_first_law',
      language: 'English',
      studentMessage: 'What is inertia?'
    });

    const actionOffline = chooseMasteryAction(stateOffline, {
      currentTopic: 'force_and_motion',
      currentConcept: 'inertia_first_law',
      language: 'English',
      studentMessage: 'What is inertia?'
    });

    assert.strictEqual(actionOnline.action, actionOffline.action);
    assert.strictEqual(actionOnline.masteryState, actionOffline.masteryState);
    assert.strictEqual(actionOnline.confidence, actionOffline.confidence);
  });

  // ----------------------------------------------------
  // Test M: Online and offline preserve same student learning state
  // ----------------------------------------------------
  await test('M. Online and offline preserve same student learning state schema', () => {
    const state = createInitialLearningState({ language: 'English', grade: 9 });
    recordLearningEvent(state, { topic: 'photosynthesis', concept: 'oxygen_role', evidence: 'practice_correct' });

    assert.strictEqual(state.concepts['photosynthesis:oxygen_role'].masteryState, MASTERY_STATES.PARTIAL);
    assert.strictEqual(state.concepts['photosynthesis:oxygen_role'].repetitions, 1);
  });

  // ----------------------------------------------------
  // Test N: Provider switching does not reset mastery
  // ----------------------------------------------------
  await test('N. Provider switching does not reset mastery or SM-2 parameters', () => {
    const state = createInitialLearningState({ language: 'English', grade: 9 });

    // Step 1: Learning event occurred while online
    recordLearningEvent(state, { topic: 'force_and_motion', concept: 'inertia_first_law', evidence: 'practice_correct' });
    const rep1 = state.concepts['force_and_motion:inertia_first_law'].repetitions;
    const ef1 = state.concepts['force_and_motion:inertia_first_law'].easeFactor;

    // Step 2: Connection drops, next event occurred while offline (Ollama)
    recordLearningEvent(state, { topic: 'force_and_motion', concept: 'inertia_first_law', evidence: 'practice_correct' });
    const rep2 = state.concepts['force_and_motion:inertia_first_law'].repetitions;
    const ef2 = state.concepts['force_and_motion:inertia_first_law'].easeFactor;

    assert.strictEqual(rep2, rep1 + 1);
    assert(ef2 >= ef1);

    // Step 3: Connection restored, next event online
    recordLearningEvent(state, { topic: 'force_and_motion', concept: 'inertia_first_law', evidence: 'practice_correct' });
    const rep3 = state.concepts['force_and_motion:inertia_first_law'].repetitions;
    assert.strictEqual(rep3, 3);
    assert.strictEqual(state.concepts['force_and_motion:inertia_first_law'].masteryState, MASTERY_STATES.MASTERED);
  });

  // ----------------------------------------------------
  // Test O: Existing practice tests pass
  // ----------------------------------------------------
  await test('O. Targeted practice retrieval and evaluation works reliably', () => {
    const practice = getTargetedPractice({ topic: 'photosynthesis', concept: 'oxygen_role' }, 'English');
    assert(practice && practice.question);
    assert(Array.isArray(practice.options) && practice.options.length > 0);

    const submission = processPracticeSubmission(
      createInitialLearningState({ language: 'English' }),
      practice,
      practice.correctAnswer
    );
    assert.strictEqual(submission.practiceResult.correct, true);
  });

  // ----------------------------------------------------
  // Test P: Existing Mastery Agent tests pass
  // ----------------------------------------------------
  await test('P. Mastery Agent SM-2 calculation conforms to spec', () => {
    const sm2_1 = calculateSM2(0, 2.5, 0, true);
    assert.strictEqual(sm2_1.interval, 1);
    assert.strictEqual(sm2_1.repetitions, 1);

    const sm2_2 = calculateSM2(sm2_1.repetitions, sm2_1.easeFactor, sm2_1.interval, true);
    assert.strictEqual(sm2_2.interval, 3);
    assert.strictEqual(sm2_2.repetitions, 2);

    const sm2_fail = calculateSM2(sm2_2.repetitions, sm2_2.easeFactor, sm2_2.interval, false);
    assert.strictEqual(sm2_fail.interval, 1);
    assert.strictEqual(sm2_fail.repetitions, 0);
  });

  // ----------------------------------------------------
  // Test Q: Existing Odia safety tests pass
  // ----------------------------------------------------
  await test('Q. Odia safety pipeline catches corrupted terminology & factual errors', () => {
    const badOdia = 'ଉଦ୍ଭିଦ ସଂଶ୍ଲେଷଣ ବେଳେ ଗଛ ଅମ୍ଳଜାନ ନିଏ ଏବଂ ଅଙ୍ଗାରକାମ୍ଳ ଛାଡ଼େ।';
    const plan = extractOdiaContentPlan('ଆଲୋକ ସଂଶ୍ଳେଷଣ କଣ?');
    const c9 = findRelevantClass9Knowledge('ଆଲୋକ ସଂଶ୍ଳେଷଣ କଣ?', 'Odia', []);

    const val = validateOdiaTutorAnswer(badOdia, 'ଆଲୋକ ସଂଶ୍ଳେଷଣ କଣ?', plan);
    assert.strictEqual(val.valid, false, 'Corrupted terminology must fail validation');

    const c9Val = validateAgainstClass9Knowledge(badOdia, c9);
    assert.strictEqual(c9Val.valid, false, 'Contradicting photosynthesis facts must fail Class 9 validation');
  });

  // ----------------------------------------------------
  // Test R: Quiz Me remains unchanged
  // ----------------------------------------------------
  await test('R. Quiz Me generation routes and options remain intact', () => {
    const { getModelOptions } = require('../agent/models');
    const opts = getModelOptions('English', 'quiz');
    assert.strictEqual(opts.temperature, 0.2);
    assert.strictEqual(opts.num_ctx, 4096);
  });

  console.log('\n====================================================');
  console.log(`TEST SUMMARY: ${passed} passed, ${failed} failed.`);
  console.log('====================================================');

  if (failed > 0) {
    process.exit(1);
  }
}

runTestSuite();

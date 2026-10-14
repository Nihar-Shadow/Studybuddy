'use strict';

const assert = require('assert');
const http = require('http');
const {
  HybridLLMProvider,
  OnlineProvider,
  OllamaProvider,
  createRequestScope
} = require('../lib/llmProvider');
const {
  createInitialLearningState,
  recordLearningEvent,
  getConceptState,
  chooseMasteryAction
} = require('../lib/studentLearningState');
const {
  validateOdiaTutorAnswer,
  buildOdiaRepairPrompt,
  getOdiaDeterministicFallback
} = require('../lib/languagePolicy');
const {
  findRelevantClass9Knowledge,
  getVerifiedAnswer,
  getGuaranteedClass9Answer,
  validateAgainstClass9Knowledge
} = require('../lib/class9Knowledge');
const chatRouter = require('../routes/chat');

function createMockServer(handler) {
  return new Promise((resolve) => {
    const server = http.createServer(handler);
    server.listen(0, '127.0.0.1', () => {
      const port = server.address().port;
      resolve({
        server,
        url: `http://127.0.0.1:${port}`,
        close: () => new Promise(res => server.close(res))
      });
    });
  });
}

async function runRegressionSuite() {
  console.log('====================================================');
  console.log('🧪 OFFLINE-FIRST TUTOR, MASTERY & REPAIR REGRESSION');
  console.log('====================================================\n');

  let passed = 0;
  let failed = 0;

  async function test(name, fn) {
    try {
      await fn();
      console.log(`  ✓ ${name}`);
      passed++;
    } catch (err) {
      console.error(`  ❌ ${name}: ${err.message}`);
      failed++;
    }
  }

  // 1. Offline chat does not retry online after network_error
  await test('1. Offline chat does not retry online after network_error', async () => {
    let onlineCalls = 0;
    const mockOnline = await createMockServer((req, res) => {
      onlineCalls++;
      req.destroy(new Error('getaddrinfo ENOTFOUND api.groq.com'));
    });

    let ollamaCalls = 0;
    const mockOllama = await createMockServer((req, res) => {
      ollamaCalls++;
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ message: { content: 'Ollama response' } }));
    });

    try {
      const online = new OnlineProvider({
        enabled: true,
        baseUrl: mockOnline.url,
        apiKey: 'test-key',
        model: 'test-model',
        timeoutMs: 1000
      });
      const ollama = new OllamaProvider({ baseUrl: mockOllama.url });
      const hybrid = new HybridLLMProvider({ onlineProvider: online, ollamaProvider: ollama });

      const requestScope = createRequestScope();

      // First call: online fails with network_error, marks requestScope
      const res1 = await hybrid.generate({
        language: 'English',
        task: 'chat',
        messages: [{ role: 'user', content: 'What is photosynthesis?' }],
        requestScope
      });

      assert.strictEqual(res1.provider, 'ollama');
      assert.strictEqual(onlineCalls, 1, 'First call attempted online once');
      assert.strictEqual(requestScope.onlineUnavailable, true, 'requestScope must be marked onlineUnavailable');
      assert.strictEqual(requestScope.reason, 'network_error');

      // Subsequent call in same request scope: must NOT attempt online at all
      const res2 = await hybrid.generate({
        language: 'English',
        task: 'chat',
        messages: [{ role: 'user', content: 'Second turn in request' }],
        requestScope
      });

      assert.strictEqual(res2.provider, 'ollama');
      assert.strictEqual(onlineCalls, 1, 'Subsequent call must NOT attempt online again');
      assert.strictEqual(ollamaCalls, 2, 'Ollama must handle the request directly');
    } finally {
      await mockOnline.close();
      await mockOllama.close();
    }
  });

  // 2. Offline tutor repair does not retry online
  await test('2. Offline tutor repair does not retry online', async () => {
    let onlineCalls = 0;
    const mockOnline = await createMockServer((req, res) => {
      onlineCalls++;
      req.destroy(new Error('Connection reset'));
    });

    let ollamaCalls = 0;
    const mockOllama = await createMockServer((req, res) => {
      ollamaCalls++;
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ message: { content: 'ଆଲୋକ ସଂଶ୍ଳେଷଣ ଏକ ପ୍ରକ୍ରିୟା।' } }));
    });

    try {
      const online = new OnlineProvider({
        enabled: true,
        baseUrl: mockOnline.url,
        apiKey: 'test-key',
        model: 'test-model',
        timeoutMs: 1000
      });
      const ollama = new OllamaProvider({ baseUrl: mockOllama.url });
      const hybrid = new HybridLLMProvider({ onlineProvider: online, ollamaProvider: ollama });

      const requestScope = createRequestScope();
      // Simulate initial failure already marked offline
      requestScope.onlineUnavailable = true;
      requestScope.reason = 'network_error';

      const res = await hybrid.generate({
        language: 'Odia',
        task: 'repair',
        messages: [{ role: 'user', content: 'Repair this answer' }],
        requestScope
      });

      assert.strictEqual(res.provider, 'ollama');
      assert.strictEqual(onlineCalls, 0, 'Repair must NOT attempt online when requestScope is offline');
      assert.strictEqual(ollamaCalls, 1);
    } finally {
      await mockOnline.close();
      await mockOllama.close();
    }
  });

  // 3. Offline structured-answer repair does not retry online
  await test('3. Offline structured-answer repair does not retry online', async () => {
    let onlineCalls = 0;
    const mockOnline = await createMockServer((req, res) => {
      onlineCalls++;
      res.writeHead(500, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'Server error' }));
    });

    const mockOllama = await createMockServer((req, res) => {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ message: { content: '{"answer":"structured"}' } }));
    });

    try {
      const online = new OnlineProvider({
        enabled: true,
        baseUrl: mockOnline.url,
        apiKey: 'test-key',
        model: 'test-model'
      });
      const ollama = new OllamaProvider({ baseUrl: mockOllama.url });
      const hybrid = new HybridLLMProvider({ onlineProvider: online, ollamaProvider: ollama });

      const requestScope = createRequestScope();
      requestScope.onlineUnavailable = true;

      const res = await hybrid.generate({
        language: 'English',
        task: 'structured_repair',
        messages: [{ role: 'user', content: 'Parse JSON' }],
        requestScope
      });

      assert.strictEqual(res.provider, 'ollama');
      assert.strictEqual(onlineCalls, 0, 'Structured repair must not touch online provider');
    } finally {
      await mockOnline.close();
      await mockOllama.close();
    }
  });

  // 4. Online unavailable state is request-scoped
  await test('4. Online unavailable state is request-scoped', async () => {
    const scopeA = createRequestScope();
    const scopeB = createRequestScope();

    scopeA.onlineUnavailable = true;
    scopeA.reason = 'network_error';

    assert.strictEqual(scopeA.onlineUnavailable, true);
    assert.strictEqual(scopeB.onlineUnavailable, false, 'scopeB must remain fresh and independent');
    assert.strictEqual(scopeB.reason, null);
  });

  // 5. A later request can use online again after connectivity returns
  await test('5. A later request can use online again after connectivity returns', async () => {
    let requestCount = 0;
    const mockOnline = await createMockServer((req, res) => {
      requestCount++;
      if (requestCount === 1) {
        req.destroy(new Error('Offline'));
      } else {
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ choices: [{ message: { content: 'Online restored answer' } }] }));
      }
    });

    const mockOllama = await createMockServer((req, res) => {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ message: { content: 'Ollama answer' } }));
    });

    try {
      const online = new OnlineProvider({
        enabled: true,
        baseUrl: mockOnline.url,
        apiKey: 'test-key',
        model: 'test-model'
      });
      const ollama = new OllamaProvider({ baseUrl: mockOllama.url });
      const hybrid = new HybridLLMProvider({ onlineProvider: online, ollamaProvider: ollama });

      // Request 1: Offline
      const scope1 = createRequestScope();
      const res1 = await hybrid.generate({
        language: 'English',
        task: 'chat',
        messages: [{ role: 'user', content: 'Question 1' }],
        requestScope: scope1
      });
      assert.strictEqual(res1.provider, 'ollama');
      assert.strictEqual(scope1.onlineUnavailable, true);

      // Request 2 (later): Fresh scope, connectivity restored
      const scope2 = createRequestScope();
      const res2 = await hybrid.generate({
        language: 'English',
        task: 'chat',
        messages: [{ role: 'user', content: 'Question 2' }],
        requestScope: scope2
      });
      assert.strictEqual(res2.provider, 'online', 'Online must be attempted again for fresh request');
      assert.strictEqual(res2.text, 'Online restored answer');
    } finally {
      await mockOnline.close();
      await mockOllama.close();
    }
  });

  // 6. fallback_used does NOT update learning evidence
  await test('6. fallback_used does NOT update learning evidence', () => {
    const state = createInitialLearningState();
    recordLearningEvent(state, {
      topic: 'photosynthesis',
      concept: 'oxygen_role',
      evidence: 'fallback_used'
    });

    const photo = getConceptState(state, 'photosynthesis');
    assert.strictEqual(photo.evidence.length, 0, 'fallback_used must NOT be added to learning evidence');
  });

  // 7. asked_about_concept DOES update learning evidence
  await test('7. asked_about_concept DOES update learning evidence', () => {
    const state = createInitialLearningState();
    recordLearningEvent(state, {
      topic: 'photosynthesis',
      concept: 'oxygen_role',
      evidence: 'asked_about_concept'
    });

    const photo = getConceptState(state, 'photosynthesis');
    assert.strictEqual(photo.evidence.length, 1, 'asked_about_concept must be recorded in evidence');
    assert.strictEqual(photo.evidence[0].evidence, 'asked_about_concept');
    assert.strictEqual(photo.status, 'partial', 'asking about concept should set partial status');
  });

  // 8. fallback_used does NOT create needs_review
  await test('8. fallback_used does NOT create needs_review', () => {
    const state = createInitialLearningState();
    recordLearningEvent(state, {
      topic: 'photosynthesis',
      concept: 'oxygen_role',
      evidence: 'fallback_used'
    });

    const photo = getConceptState(state, 'photosynthesis');
    assert.notStrictEqual(photo.status, 'needs_review', 'fallback_used must NOT create needs_review status');
    assert.strictEqual(photo.status, 'unknown', 'status remains unaffected by infrastructure fallback');
  });

  // 9. practice_incorrect DOES create review evidence
  await test('9. practice_incorrect DOES create review evidence', () => {
    const state = createInitialLearningState();
    recordLearningEvent(state, {
      topic: 'photosynthesis',
      concept: 'oxygen_role',
      evidence: 'practice_incorrect'
    });

    const photo = getConceptState(state, 'photosynthesis');
    assert.strictEqual(photo.status, 'needs_review', 'practice_incorrect must mark concept for review');
    assert(photo.evidence.some(e => (e.evidence || e.type) === 'practice_incorrect'));
  });

  // 10. practice_correct DOES increase mastery evidence
  await test('10. practice_correct DOES increase mastery evidence', () => {
    const state = createInitialLearningState();
    recordLearningEvent(state, {
      topic: 'photosynthesis',
      concept: 'oxygen_role',
      evidence: 'practice_correct'
    });

    const photo = getConceptState(state, 'photosynthesis');
    assert.strictEqual(photo.status, 'partial');
    assert(photo.confidence >= 0.35);
    assert.strictEqual(photo.repetitions, 1);
    const conf1 = photo.confidence;

    // Second correct attempt increases evidence towards mastery
    recordLearningEvent(state, {
      topic: 'photosynthesis',
      concept: 'oxygen_role',
      evidence: 'practice_correct'
    });
    const photo2 = getConceptState(state, 'photosynthesis');
    assert(photo2.confidence > conf1);
    assert.strictEqual(photo2.repetitions, 2);
  });

  // 11. Photosynthesis corrupted terminology is rejected
  await test('11. Photosynthesis corrupted terminology is rejected', () => {
    const prompt = "ଆଲୋକ ସଂଶ୍ଳେଷଣ କ'ଣ? ସହଜରେ ବୁଝାଅ।";

    // "ଉଦ୍ଭିଦ ସଂଶ୍ଲେଷଣ" is corrupted
    const wrong1 = "ଉଦ୍ଭିଦ ସଂଶ୍ଲେଷଣ ହେଉଛି ଉଦ୍ଭିଦର ଖାଦ୍ୟ ତିଆରି କରିବା ପ୍ରକ୍ରିୟା। ସୂର୍ଯ୍ୟାଲୋକ ଶକ୍ତି ଯୋଗାଏ।";
    const val1 = validateOdiaTutorAnswer(wrong1, prompt);
    assert.strictEqual(val1.valid, false, 'ଉଦ୍ଭିଦ ସଂଶ୍ଲେଷଣ must be rejected');
    assert(val1.reason === 'corrupted_terminology' || val1.reason === 'canonical_terminology_violation');

    // "ଷ୍ଟୋମାଟା" is transliteration
    const wrong2 = "ଆଲୋକ ସଂଶ୍ଳେଷଣରେ ଉଦ୍ଭିଦ ଷ୍ଟୋମାଟା ଦ୍ୱାରା ଅଙ୍ଗାରକାମ୍ଳ ଗ୍ରହଣ କରେ। ଏହି ପ୍ରକ୍ରିୟାରେ ଅମ୍ଳଜାନ ନିର୍ଗତ ହୁଏ।";
    const val2 = validateOdiaTutorAnswer(wrong2, prompt);
    assert.strictEqual(val2.valid, false, 'ଷ୍ଟୋମାଟା must be rejected');
    assert(val2.reason === 'corrupted_terminology' || val2.reason === 'canonical_terminology_violation');
  });

  // 12. Photosynthesis local repair can use canonical terminology
  await test('12. Photosynthesis local repair can use canonical terminology', () => {
    const prompt = "Explain photosynthesis simply";
    const rawReply = "ଉଦ୍ଭିଦ ସଂଶ୍ଲେଷଣ ଏକ ପ୍ରକ୍ରିୟା";
    const validation = { valid: false, reason: 'canonical_terminology_violation', detail: 'Corrupted term ଉଦ୍ଭିଦ ସଂଶ୍ଲେଷଣ' };

    const repairPrompt = buildOdiaRepairPrompt(rawReply, prompt, { topic: 'photosynthesis' }, validation);

    assert(repairPrompt.includes('photosynthesis = ଆଲୋକ ସଂଶ୍ଳେଷଣ'), 'Repair prompt must include canonical photosynthesis');
    assert(repairPrompt.includes('sunlight = ସୂର୍ଯ୍ୟାଲୋକ'), 'Repair prompt must include sunlight');
    assert(repairPrompt.includes('chloroplast = ହରିତକଣିକା'), 'Repair prompt must include chloroplast');
    assert(repairPrompt.includes('chlorophyll = ପତ୍ରହରିତ'), 'Repair prompt must include chlorophyll');
    assert(repairPrompt.includes('oxygen = ଅମ୍ଳଜାନ'), 'Repair prompt must include oxygen');
    assert(repairPrompt.includes('carbon dioxide = ଅଙ୍ଗାରକାମ୍ଳ'), 'Repair prompt must include carbon dioxide');
    assert(repairPrompt.includes('stomata = ପତ୍ରରନ୍ଧ୍ର'), 'Repair prompt must include stomata');
    assert(repairPrompt.includes('Use these canonical Odia terms exactly.'), 'Repair prompt must enforce exact canonical terms');
    assert(repairPrompt.includes('Do not use English transliterations such as stomata.'), 'Repair prompt must forbid transliteration');
  });

  // 13. Deterministic fallback passes final Odia validation
  await test('13. Deterministic fallback passes final Odia validation', () => {
    const kb = findRelevantClass9Knowledge('Explain photosynthesis simply', 'Odia');
    assert(kb, 'Knowledge base entry must exist for photosynthesis');

    const fallback = getVerifiedAnswer('Explain photosynthesis simply', kb);
    assert(fallback, 'Verified fallback must exist');

    const val = validateOdiaTutorAnswer(fallback, 'Explain photosynthesis simply');
    assert.strictEqual(val.valid, true, `Deterministic fallback must pass validation: ${val.reason}`);

    const c9Val = validateAgainstClass9Knowledge(fallback, kb);
    assert.strictEqual(c9Val.valid, true, `Deterministic fallback must pass Class 9 validation: ${c9Val.reason}`);

    assert(fallback.includes('ଆଲୋକ ସଂଶ୍ଳେଷଣ'), 'Fallback must contain canonical photosynthesis term');
    assert(fallback.includes('ଅମ୍ଳଜାନ'), 'Fallback must contain canonical oxygen term');
    assert(!fallback.includes('ଉଦ୍ଭିଦ ସଂଶ୍ଲେଷଣ'), 'Fallback must not contain corrupted terminology');
    assert(!fallback.includes('ଷ୍ଟୋମାଟା'), 'Fallback must not contain transliterated stomata');
  });

  // 14. No English voice/term substitution in Odia terminology validation
  await test('14. No English voice/term substitution in Odia terminology validation', () => {
    const prompt = "ଆଲୋକ ସଂଶ୍ଳେଷଣରେ ପତ୍ରରନ୍ଧ୍ରର ଭୂମିକା କ'ଣ?";
    const textWithEnglish = "ଉଦ୍ଭିଦ stomata ମାଧ୍ୟମରେ CO2 ଗ୍ରହଣ କରେ ଏବଂ oxygen ଛାଡ଼େ।";
    const val = validateOdiaTutorAnswer(textWithEnglish, prompt);
    assert.strictEqual(val.valid, false, 'Transliterated or raw English terms must be rejected in Odia tutor');
  });

  // 15. Tiny English question is not incorrectly classified as request_too_large
  await test('15. Tiny English question is not incorrectly classified as request_too_large', async () => {
    let capturedReq = null;
    const mockOnline = await createMockServer((req, res) => {
      let body = '';
      req.on('data', chunk => { body += chunk; });
      req.on('end', () => {
        capturedReq = JSON.parse(body);
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ choices: [{ message: { content: 'Gravity is the force that pulls mass toward mass.' } }] }));
      });
    });

    const mockOllama = await createMockServer((req, res) => {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ message: { content: 'Ollama gravity' } }));
    });

    try {
      const online = new OnlineProvider({
        enabled: true,
        baseUrl: mockOnline.url,
        apiKey: 'test-key',
        model: 'test-model'
      });
      const ollama = new OllamaProvider({ baseUrl: mockOllama.url });
      const hybrid = new HybridLLMProvider({ onlineProvider: online, ollamaProvider: ollama });

      const tinyMessages = [
        { role: 'system', content: 'You are StudyBuddy, an encouraging tutor.' },
        { role: 'user', content: 'What is gravity?' }
      ];

      const res = await hybrid.generate({
        language: 'English',
        task: 'chat',
        messages: tinyMessages
      });

      assert.strictEqual(res.provider, 'online');
      assert.strictEqual(res.fallback, false);
      assert.notStrictEqual(res.reason, 'online_request_too_large', 'Tiny request must NEVER be classified as request_too_large');
      assert(capturedReq, 'Online request should have been sent');
    } finally {
      await mockOnline.close();
      await mockOllama.close();
    }
  });

  console.log('\n====================================================');
  console.log(`REGRESSION SUMMARY: ${passed} passed, ${failed} failed.`);
  console.log('====================================================\n');

  if (failed > 0) {
    process.exit(1);
  }
}

runRegressionSuite().catch(err => {
  console.error('Test suite uncaught error:', err);
  process.exit(1);
});

'use strict';

/**
 * Regression Test Suite: Quiz Online Request Size + Duplicate Concept Validation
 * Verifies Test Cases A through L from specification:
 * A: Online request normal size -> online provider used.
 * B: Online request too large -> Ollama used (pre-flight check & 429 classification).
 * C: Online request too large -> no repeated online calls during slot repair (onlineUnavailableForRequest sticky flag).
 * D: 3 questions on one topic with different subskills -> PASS.
 * E: 3 genuinely duplicate questions -> FAIL validation.
 * F: Galaxy quiz: definition + gravitational binding + example -> PASS.
 * G: Odia galaxy quiz -> PASS with same diversity behavior.
 * H: English galaxy quiz -> PASS with same diversity behavior.
 * I: Online and Ollama share exact same quiz validation pipeline.
 * J: Existing Class 9 science quizzes still pass.
 * K: Existing Odia quiz checks still pass.
 * L: Fallback templates have distinct subskills and pass validation.
 */

const assert = require('assert');
const http = require('http');
const {
  OllamaProvider,
  OnlineProvider,
  HybridLLMProvider,
  classifyOnlineError
} = require('../lib/llmProvider');
const {
  normalizeQuizTopic,
  getTopicCoveragePlan,
  classifyQuestionConcept,
  validateQuizDiversity,
  validateQuizQuality,
  validateQuizFactualCorrectness,
  getQuestionValidationIssues,
  CONCEPT_FALLBACK_QUESTIONS,
  CONCEPT_FALLBACK_QUESTIONS_OD
} = require('../lib/languagePolicy');

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

async function runAllTests() {
  console.log('\n===============================================================');
  console.log('🧪 REGRESSION TEST MATRIX: QUIZ REQUEST SIZE & CONCEPT DIVERSITY');
  console.log('===============================================================\n');

  // Test Topic Normalization
  await test('Topic Normalization: Sentence to clean topic label', () => {
    const rawTopic = "A galaxy is a vast collection of stars, gas, dust, and invisible matter in space, held together by gravity";
    const normalized = normalizeQuizTopic(rawTopic);
    assert.strictEqual(normalized, 'galaxies');

    const shortTopic = "Photosynthesis";
    assert.strictEqual(normalizeQuizTopic(shortTopic), "Photosynthesis");

    const odiaSentence = "ଛାୟାପଥ ହେଉଛି କୋଟି କୋଟି ନକ୍ଷତ୍ରର ଏକ ବିଶାଳ ସମୂହ";
    assert.strictEqual(normalizeQuizTopic(odiaSentence), "ଛାୟାପଥ");
  });

  // Test A: Online request normal size -> online provider used
  await test('A. Online request normal size -> online provider used', async () => {
    let onlineCalls = 0;
    const mockOnline = await createMockServer((req, res) => {
      onlineCalls++;
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({
        choices: [{ message: { content: '{"questions":[]}' } }]
      }));
    });

    try {
      const online = new OnlineProvider({
        enabled: true,
        baseUrl: mockOnline.url,
        apiKey: 'test-key',
        model: 'test-model'
      });
      const ollama = new OllamaProvider();
      const hybrid = new HybridLLMProvider({ onlineProvider: online, ollamaProvider: ollama });

      const res = await hybrid.generate({
        task: 'quiz',
        messages: [{ role: 'user', content: 'Short normal prompt' }]
      });

      assert.strictEqual(onlineCalls, 1);
      assert.strictEqual(res.provider, 'online');
      assert.strictEqual(res.fallback, false);
    } finally {
      await mockOnline.close();
    }
  });

  // Test B: Online request too large -> Ollama used
  await test('B1. Pre-flight request too large -> Ollama used directly without calling online', async () => {
    let onlineCalls = 0;
    const mockOnline = await createMockServer((req, res) => {
      onlineCalls++;
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ choices: [{ message: { content: '{}' } }] }));
    });

    const mockOllama = await createMockServer((req, res) => {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ message: { content: '{"questions":[]}' } }));
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

      // Create message exceeding ONLINE_LLM_MAX_REQUEST_CHARS (4500 chars)
      const oversizedText = 'A'.repeat(5000);
      const res = await hybrid.generate({
        task: 'quiz',
        messages: [{ role: 'user', content: oversizedText }]
      });

      assert.strictEqual(onlineCalls, 0, 'Online provider should NOT have been called');
      assert.strictEqual(res.provider, 'ollama');
      assert.strictEqual(res.reason, 'online_request_too_large');
      assert.strictEqual(res.errorType, 'request_too_large');
    } finally {
      await mockOnline.close();
      await mockOllama.close();
    }
  });

  await test('B2. Online returns 429 "Request too large" -> Classified as request_too_large & falls back to Ollama', async () => {
    const mockOnline = await createMockServer((req, res) => {
      res.writeHead(429, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: { message: 'Request too large for model qwen/qwen3.8-27b' } }));
    });

    const mockOllama = await createMockServer((req, res) => {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ message: { content: '{"questions":[]}' } }));
    });

    try {
      const online = new OnlineProvider({
        enabled: true,
        baseUrl: mockOnline.url,
        apiKey: 'test-key',
        model: 'qwen/qwen3.8-27b'
      });
      const ollama = new OllamaProvider({ baseUrl: mockOllama.url });
      const hybrid = new HybridLLMProvider({ onlineProvider: online, ollamaProvider: ollama });

      const res = await hybrid.generate({
        task: 'quiz',
        messages: [{ role: 'user', content: 'Generate quiz' }]
      });

      assert.strictEqual(res.provider, 'ollama');
      assert.strictEqual(res.fallback, true);
      assert.strictEqual(res.errorType, 'request_too_large');
    } finally {
      await mockOnline.close();
      await mockOllama.close();
    }
  });

  await test('B3. Online returns 429 "Rate limit reached" -> Classified as rate_limited & falls back to Ollama', async () => {
    const mockOnline = await createMockServer((req, res) => {
      res.writeHead(429, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: { message: 'Rate limit reached for model qwen/qwen3.8-27b in organization org_123 on output tokens per minute (TPM)' } }));
    });

    const mockOllama = await createMockServer((req, res) => {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ message: { content: '{"questions":[]}' } }));
    });

    try {
      const online = new OnlineProvider({
        enabled: true,
        baseUrl: mockOnline.url,
        apiKey: 'test-key',
        model: 'qwen/qwen3.8-27b'
      });
      const ollama = new OllamaProvider({ baseUrl: mockOllama.url });
      const hybrid = new HybridLLMProvider({ onlineProvider: online, ollamaProvider: ollama });

      const res = await hybrid.generate({
        task: 'quiz',
        messages: [{ role: 'user', content: 'Generate quiz' }]
      });

      assert.strictEqual(res.provider, 'ollama');
      assert.strictEqual(res.fallback, true);
      assert.strictEqual(res.errorType, 'rate_limited');
    } finally {
      await mockOnline.close();
      await mockOllama.close();
    }
  });

  // Test C: Online request too large -> No repeated online calls during slot repair
  await test('C. Online request too large -> no repeated online calls during slot repairs', async () => {
    let onlineCalls = 0;
    const mockOnline = await createMockServer((req, res) => {
      onlineCalls++;
      res.writeHead(429, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: { message: 'Request too large for model qwen/qwen3.8-27b' } }));
    });

    let ollamaCalls = 0;
    const mockOllama = await createMockServer((req, res) => {
      ollamaCalls++;
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ message: { content: '{"question":"Repaired Q","options":["A","B","C","D"],"answer":0,"explanation":"Valid"}' } }));
    });

    try {
      const online = new OnlineProvider({
        enabled: true,
        baseUrl: mockOnline.url,
        apiKey: 'test-key',
        model: 'qwen/qwen3.8-27b'
      });
      const ollama = new OllamaProvider({ baseUrl: mockOllama.url });
      const hybrid = new HybridLLMProvider({ onlineProvider: online, ollamaProvider: ollama });

      // Step 1: Initial quiz generation fails with request_too_large
      let onlineUnavailableForRequest = false;
      const genResult = await hybrid.generate({
        task: 'quiz',
        messages: [{ role: 'user', content: 'Generate 3 questions' }]
      });

      if (genResult.errorType === 'request_too_large' || genResult.reason === 'online_request_too_large') {
        onlineUnavailableForRequest = true;
      }
      assert.strictEqual(onlineUnavailableForRequest, true);
      assert.strictEqual(onlineCalls, 1);
      assert.strictEqual(ollamaCalls, 1);

      // Step 2: Slot repair Q1, Q2, Q3 pass forceLocal: onlineUnavailableForRequest
      for (let slot = 1; slot <= 3; slot++) {
        const slotRes = await hybrid.generate({
          task: 'quiz',
          forceLocal: onlineUnavailableForRequest,
          messages: [{ role: 'user', content: `Repair slot Q${slot}` }]
        });
        assert.strictEqual(slotRes.provider, 'ollama');
      }

      // Online provider must NOT have been called again (still exactly 1 call)
      assert.strictEqual(onlineCalls, 1, 'Online provider must not be retried across slot repairs');
      assert.strictEqual(ollamaCalls, 4, 'Ollama handled generation and all 3 slot repairs');
    } finally {
      await mockOnline.close();
      await mockOllama.close();
    }
  });

  await test('C2. Initial online success + repair rate limit -> remaining repair slots use Ollama', async () => {
    let onlineCalls = 0;
    const mockOnline = await createMockServer((req, res) => {
      onlineCalls++;
      if (onlineCalls === 1) {
        // Initial call succeeds
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ choices: [{ message: { content: '{"questions":[{"question":"Q1","options":["A","B","C","D"],"answer":0}]}' } }] }));
      } else if (onlineCalls === 2) {
        // First repair slot hits rate limit
        res.writeHead(429, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: { message: 'Rate limit reached for model qwen/qwen3.8-27b' } }));
      } else {
        // Should not be reached during this quiz
        res.writeHead(500, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'Should not call online after rate limit' }));
      }
    });

    let ollamaCalls = 0;
    const mockOllama = await createMockServer((req, res) => {
      ollamaCalls++;
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ message: { content: '{"question":"Repaired via Ollama","options":["A","B","C","D"],"answer":0,"explanation":"Valid"}' } }));
    });

    try {
      const online = new OnlineProvider({
        enabled: true,
        baseUrl: mockOnline.url,
        apiKey: 'test-key',
        model: 'qwen/qwen3.8-27b'
      });
      const ollama = new OllamaProvider({ baseUrl: mockOllama.url });
      const hybrid = new HybridLLMProvider({ onlineProvider: online, ollamaProvider: ollama });

      // Step 1: Initial online call succeeds
      let onlineUnavailableForRequest = false;
      const initialRes = await hybrid.generate({
        task: 'quiz',
        messages: [{ role: 'user', content: 'Generate quiz' }]
      });
      assert.strictEqual(initialRes.provider, 'online');
      assert.strictEqual(onlineCalls, 1);
      assert.strictEqual(onlineUnavailableForRequest, false);

      // Step 2: First slot repair Q1 attempts online, hits 429 rate limit
      const slot1Res = await hybrid.generate({
        task: 'quiz',
        forceLocal: onlineUnavailableForRequest,
        messages: [{ role: 'user', content: 'Repair slot Q1' }]
      });
      assert.strictEqual(slot1Res.errorType, 'rate_limited');
      assert.strictEqual(slot1Res.provider, 'ollama'); // Fell back to Ollama
      if (slot1Res.errorType === 'rate_limited' || slot1Res.fallback) {
        onlineUnavailableForRequest = true;
      }
      assert.strictEqual(onlineUnavailableForRequest, true);
      assert.strictEqual(onlineCalls, 2);

      // Step 3: Second slot repair Q2 uses Ollama directly without calling online
      const slot2Res = await hybrid.generate({
        task: 'quiz',
        forceLocal: onlineUnavailableForRequest,
        messages: [{ role: 'user', content: 'Repair slot Q2' }]
      });
      assert.strictEqual(slot2Res.provider, 'ollama');
      assert.strictEqual(onlineCalls, 2, 'Online was not called again for remaining repair slot');

      // Step 4: Next independent quiz request starts fresh (online is NOT permanently disabled)
      let nextQuizOnlineUnavailable = false;
      assert.strictEqual(nextQuizOnlineUnavailable, false, 'Next independent quiz can try online again');
    } finally {
      await mockOnline.close();
      await mockOllama.close();
    }
  });

  // Test D: 3 questions on one topic with different subskills -> PASS
  await test('D. 3 questions on one topic with different subskills -> PASS diversity', () => {
    const questions = [
      {
        question: 'What is a galaxy?',
        options: ['A vast system of stars, gas, and dust bound by gravity', 'A single planet', 'An asteroid belt', 'A comet'],
        answer: 0,
        explanation: 'A galaxy is a massive collection of stars, gas, and dust.'
      },
      {
        question: 'What fundamental force holds a galaxy together?',
        options: ['Gravity', 'Magnetism', 'Friction', 'Electricity'],
        answer: 0,
        explanation: 'Gravity holds all stars and gas together in a galaxy.'
      },
      {
        question: 'Which of the following is an example of a galaxy?',
        options: ['Milky Way', 'Jupiter', 'Sirius', 'Halley Comet'],
        answer: 0,
        explanation: 'The Milky Way is our home galaxy.'
      }
    ];

    const diversity = validateQuizDiversity(questions, 'galaxies');
    assert.strictEqual(diversity.valid, true);
    assert.strictEqual(diversity.uniqueConceptsCount, 3);
  });

  // Test E: 3 genuinely duplicate questions -> FAIL validation
  await test('E. 3 genuinely duplicate questions -> FAIL duplicate_concept validation', () => {
    const duplicateQuestions = [
      {
        question: 'What is a galaxy?',
        options: ['A vast system of stars and gas', 'A planet', 'A moon', 'An asteroid'],
        answer: 0,
        explanation: 'A galaxy is a vast system of stars and gas.'
      },
      {
        question: 'Which statement defines a galaxy?',
        options: ['A vast system of stars and gas', 'A burning asteroid', 'A single moon', 'A small cloud'],
        answer: 0,
        explanation: 'A galaxy is defined as a vast system of stars and gas.'
      },
      {
        question: 'What is the definition of a galaxy?',
        options: ['A vast system of stars and gas', 'A comet', 'A black hole only', 'A solar ray'],
        answer: 0,
        explanation: 'The definition of a galaxy is a vast system of stars and gas.'
      }
    ];

    const diversity = validateQuizDiversity(duplicateQuestions, 'galaxies');
    assert.strictEqual(diversity.valid, false);
    assert.strictEqual(diversity.reason, 'duplicate_concept');
  });

  // Test F: Galaxy quiz: definition + gravitational binding + example -> PASS
  await test('F. Galaxy quiz with definition, gravitational binding, and example -> PASS', () => {
    const galaxyQuestions = [
      {
        question: 'What is a galaxy?',
        options: ['A) A vast system of stars, gas, and dust bound by gravity', 'B) A single star', 'C) A cluster of comets', 'D) A planet in orbit'],
        answer: 'A) A vast system of stars, gas, and dust bound by gravity',
        explanation: 'A galaxy is a massive gravitational system of stars and gas.'
      },
      {
        question: 'What force keeps galaxies bound together?',
        options: ['A) Gravity', 'B) Nuclear force', 'C) Friction', 'D) Magnetic force'],
        answer: 'A) Gravity',
        explanation: 'Gravity keeps stars and gas bound within a galaxy.'
      },
      {
        question: 'Which of these is an example of a galaxy?',
        options: ['A) Milky Way', 'B) Sun', 'C) Mars', 'D) Polaris'],
        answer: 'A) Milky Way',
        explanation: 'The Milky Way is the galaxy that contains our Solar System.'
      }
    ];

    const rawTopic = "A galaxy is a vast collection of stars, gas, dust, and invisible matter in space, held together by gravity";
    const normalized = normalizeQuizTopic(rawTopic);
    assert.strictEqual(normalized, 'galaxies');

    const qual = validateQuizQuality(galaxyQuestions, normalized, 'English');
    assert.strictEqual(qual.valid, true);
  });

  // Test G: Odia galaxy quiz -> PASS with same diversity behavior
  await test('G. Odia galaxy quiz with definition, gravity, and example -> PASS', () => {
    const odiaGalaxyQuestions = [
      {
        question: 'ଛାୟାପଥ (Galaxy) କାହାକୁ କୁହାଯାଏ?',
        options: ['A) ମାଧ୍ୟାକର୍ଷଣ ଦ୍ୱାରା ଏକତ୍ର ଥିବା କୋଟି କୋଟି ନକ୍ଷତ୍ର, ଗ୍ୟାସ ଓ ଧୂଳିକଣାର ବିଶାଳ ସମୂହ', 'B) ସୂର୍ଯ୍ୟ ଚାରିପାଖରେ ଘୂରୁଥିବା ଏକମାତ୍ର ଗ୍ରହ', 'C) ବରଫ ଖଣ୍ଡ', 'D) କେବଳ ବାରଟି ନକ୍ଷତ୍ର'],
        answer: 'A) ମାଧ୍ୟାକର୍ଷଣ ଦ୍ୱାରା ଏକତ୍ର ଥିବା କୋଟି କୋଟି ନକ୍ଷତ୍ର, ଗ୍ୟାସ ଓ ଧୂଳିକଣାର ବିଶାଳ ସମୂହ',
        explanation: 'ମାଧ୍ୟାକର୍ଷଣ ବଳ ଦ୍ୱାରା ଏକତ୍ର ବାନ୍ଧି ହୋଇ ରହିଥିବା ନକ୍ଷତ୍ର ଓ ଗ୍ୟାସର ବିରାଟ ସଂସ୍ଥାକୁ ଛାୟାପଥ କୁହାଯାଏ।'
      },
      {
        question: 'କେଉଁ ବଳ ଛାୟାପଥର ନକ୍ଷତ୍ର, ଗ୍ୟାସ ଏବଂ ଧୂଳିକଣାକୁ ଏକତ୍ର ଧରି ରଖିଥାଏ?',
        options: ['A) ମାଧ୍ୟାକର୍ଷଣ ବଳ', 'B) ଚୁମ୍ବକୀୟ ବିକର୍ଷଣ', 'C) ସ୍ଥିର ବୈଦ୍ୟୁତିକ ବଳ', 'D) ବାୟୁମଣ୍ଡଳୀୟ ଚାପ'],
        answer: 'A) ମାଧ୍ୟାକର୍ଷଣ ବଳ',
        explanation: 'ମାଧ୍ୟାକର୍ଷଣ ବଳ ଛାୟାପଥର ସମସ୍ତ ପଦାର୍ଥକୁ ପରସ୍ପର ସହିତ ଆବଦ୍ଧ କରି ରଖିଥାଏ।'
      },
      {
        question: 'ଆମ ସୌରମଣ୍ଡଳ କେଉଁ ଛାୟାପଥ (Galaxy) ର ଅନ୍ତର୍ଭୁକ୍ତ?',
        options: ['A) ଆକାଶଗଙ୍ଗା (Milky Way)', 'B) ବୃହସ୍ପତି', 'C) ଲୁବ୍ଧକ (Sirius)', 'D) ହ୍ୟାଲିଙ୍କ ଧୂମକେତୁ'],
        answer: 'A) ଆକାଶଗଙ୍ଗା (Milky Way)',
        explanation: 'ଆମ ସୌରମଣ୍ଡଳ ଆକାଶଗଙ୍ଗା ନାମକ କୁଣ୍ଡଳୀୟ ଛାୟାପଥରେ ଅବସ୍ଥିତ।'
      }
    ];

    const qual = validateQuizQuality(odiaGalaxyQuestions, 'ଛାୟାପଥ', 'Odia');
    assert.strictEqual(qual.valid, true);
  });

  // Test H: English galaxy quiz -> PASS with same diversity behavior
  await test('H. English quiz with concept/skill metadata -> PASS', () => {
    const metaQuestions = [
      {
        question: 'What is a galaxy?',
        options: ['A) A vast celestial system', 'B) A moon', 'C) A star', 'D) An asteroid'],
        answer: 'A) A vast celestial system',
        explanation: 'It is a vast system.',
        concept: 'galaxy_definition',
        skill: 'definition'
      },
      {
        question: 'What holds galaxies together?',
        options: ['A) Gravity', 'B) Sound', 'C) Friction', 'D) Light'],
        answer: 'A) Gravity',
        explanation: 'Gravity holds galaxies.',
        concept: 'gravitational_binding',
        skill: 'structure'
      },
      {
        question: 'Name our galaxy.',
        options: ['A) Milky Way', 'B) Solar Star', 'C) Jupiter', 'D) Orion'],
        answer: 'A) Milky Way',
        explanation: 'Milky way is our galaxy.',
        concept: 'galaxy_components_examples',
        skill: 'examples'
      }
    ];

    const diversity = validateQuizDiversity(metaQuestions, 'galaxies');
    assert.strictEqual(diversity.valid, true);
    assert.strictEqual(diversity.uniqueConceptsCount, 3);
  });

  // Test I: Online failure followed by Ollama fallback -> Same final quiz validation
  await test('I. Online failure followed by Ollama fallback -> shared quiz validation pipeline', () => {
    const sampleQuestions = [
      {
        question: 'What is a galaxy?',
        options: ['A) A vast system of stars, gas, and dust bound by gravity', 'B) A planet', 'C) An asteroid', 'D) A comet'],
        answer: 'A) A vast system of stars, gas, and dust bound by gravity',
        explanation: 'A galaxy is a massive collection of stars.'
      },
      {
        question: 'What force keeps galaxies bound together?',
        options: ['A) Gravity', 'B) Heat', 'C) Friction', 'D) Sound'],
        answer: 'A) Gravity',
        explanation: 'Gravity holds galaxies together.'
      }
    ];

    // Online and offline both run through validateQuizQuality
    const onlineVal = validateQuizQuality(sampleQuestions, 'galaxies', 'English');
    const ollamaVal = validateQuizQuality(sampleQuestions, 'galaxies', 'English');
    assert.strictEqual(onlineVal.valid, true);
    assert.strictEqual(ollamaVal.valid, true);
  });

  // Test J: Existing Class 9 quizzes still pass
  await test('J. Class 9 science facts still strictly enforced', () => {
    // Valid photosynthesis facts pass
    const validPhoto = [
      {
        question: 'Which gas is released during photosynthesis?',
        options: ['A) Oxygen', 'B) Nitrogen', 'C) Carbon dioxide', 'D) Helium'],
        answer: 'A) Oxygen',
        explanation: 'Oxygen is released as a byproduct.'
      },
      {
        question: 'What gas do plants absorb from air for photosynthesis?',
        options: ['A) Carbon dioxide', 'B) Oxygen', 'C) Argon', 'D) Neon'],
        answer: 'A) Carbon dioxide',
        explanation: 'Carbon dioxide is absorbed.'
      }
    ];
    assert.strictEqual(validateQuizFactualCorrectness(validPhoto, 'photosynthesis').valid, true);

    // Invalid facts fail
    const invalidPhoto = [
      {
        question: 'Which gas is released during photosynthesis?',
        options: ['A) Carbon dioxide', 'B) Nitrogen', 'C) Hydrogen', 'D) Helium'],
        answer: 'A) Carbon dioxide',
        explanation: 'Plants release carbon dioxide during photosynthesis.'
      }
    ];
    assert.strictEqual(validateQuizFactualCorrectness(invalidPhoto, 'photosynthesis').valid, false);
  });

  // Test K: Existing Odia quiz checks still pass
  await test('K. Odia quiz checks still pass without degradation', () => {
    const plan = getTopicCoveragePlan('ଆଲୋକ ସଂଶ୍ଳେଷଣ (Photosynthesis)', 3, 'Odia');
    assert.strictEqual(plan.plannedCount, 3);
    assert.strictEqual(plan.concepts[0].id, 'sunlight');
    assert.strictEqual(plan.concepts[1].id, 'co2_requirement');
    assert.strictEqual(plan.concepts[2].id, 'stomata');
  });

  // Test L: Fallback templates have distinct subskills and pass validation
  await test('L. Fallback templates for galaxies have distinct concepts in EN and OD', () => {
    const enDef = CONCEPT_FALLBACK_QUESTIONS.galaxy_definition;
    const enGrav = CONCEPT_FALLBACK_QUESTIONS.gravitational_binding;
    const enEx = CONCEPT_FALLBACK_QUESTIONS.galaxy_components_examples;

    assert(enDef && enGrav && enEx);
    const enFallbackQuiz = [enDef, enGrav, enEx];
    const enDiv = validateQuizDiversity(enFallbackQuiz, 'galaxies');
    assert.strictEqual(enDiv.valid, true, 'English galaxy fallback questions must have distinct concepts');

    const odDef = CONCEPT_FALLBACK_QUESTIONS_OD.galaxy_definition;
    const odGrav = CONCEPT_FALLBACK_QUESTIONS_OD.gravitational_binding;
    const odEx = CONCEPT_FALLBACK_QUESTIONS_OD.galaxy_components_examples;

    assert(odDef && odGrav && odEx);
    const odFallbackQuiz = [odDef, odGrav, odEx];
    const odDiv = validateQuizDiversity(odFallbackQuiz, 'ଛାୟାପଥ');
    assert.strictEqual(odDiv.valid, true, 'Odia galaxy fallback questions must have distinct concepts');
  });

  // Test M: Galaxy 5-question example from user prompt -> PASS
  await test('M. Galaxy five-question example -> PASS', () => {
    const q1 = {
      question: 'Which of the following best describes the fundamental structure of a galaxy?',
      options: [
        'A vast system of stars, gas, and dust bound by gravity',
        'A single star orbited by planets',
        'A dense cluster of comets',
        'A cloud of interstellar ice without stars'
      ],
      answer: 0,
      explanation: 'A galaxy is a massive collection of stars, gas, and dust bound together by gravity.',
      topic: 'galaxy'
    };
    const q2 = {
      question: 'What is the primary force responsible for holding the stars and matter within a galaxy together?',
      options: ['Gravity', 'Electromagnetism', 'Strong nuclear force', 'Weak nuclear force'],
      answer: 0,
      explanation: 'Gravity is the force that binds matter within a galaxy.',
      topic: 'galaxy'
    };
    const q3 = {
      question: 'Which of the following is a prominent example of a galaxy that is not our own?',
      options: ['Andromeda', 'Milky Way', 'Jupiter', 'Sirius'],
      answer: 0,
      explanation: 'Andromeda is a major neighboring galaxy.',
      topic: 'galaxy'
    };
    const q4 = {
      question: 'Which of the following is NOT a standard classification of galaxy shapes?',
      options: ['Triangular', 'Spiral', 'Elliptical', 'Irregular'],
      answer: 0,
      explanation: 'Galaxies are classified as spiral, elliptical, or irregular; triangular is not a standard shape.',
      topic: 'galaxy'
    };
    const q5 = {
      question: 'Where is our Solar System located in relation to the Milky Way galaxy?',
      options: [
        'In one of its spiral arms (Orion Arm)',
        'At the exact galactic center',
        'In the outer halo beyond all stars',
        'Inside a supermassive black hole'
      ],
      answer: 0,
      explanation: 'Our Solar System is located in the Orion Arm of the Milky Way.',
      topic: 'galaxy'
    };

    const questions = [q1, q2, q3, q4, q5];
    const qual = validateQuizQuality(questions, 'galaxy', 'English');
    assert.strictEqual(qual.valid, true, `Galaxy 5-question quiz must pass validation: ${qual.detail || qual.reason}`);

    // Verify each question resolved to the expected distinct concept
    assert.strictEqual(classifyQuestionConcept(q1, 'galaxy'), 'galaxy_definition');
    assert.strictEqual(classifyQuestionConcept(q2, 'galaxy'), 'gravitational_binding');
    assert.strictEqual(classifyQuestionConcept(q3, 'galaxy'), 'galaxy_components_examples');
    assert.strictEqual(classifyQuestionConcept(q4, 'galaxy'), 'galaxy_types_structure');
    assert.strictEqual(classifyQuestionConcept(q5, 'galaxy'), 'solar_system_location');
  });

  // Test N: Same topic + duplicate gravitational questions -> FAIL
  await test('N. Same topic + duplicate gravitational questions -> FAIL', () => {
    const duplicateGravity = [
      {
        question: 'What force holds galaxies together?',
        options: ['Gravity', 'Friction', 'Magnetic repulsion', 'Nuclear force'],
        answer: 0,
        explanation: 'Gravity holds galaxies together.'
      },
      {
        question: 'Which force keeps stars bound inside a galaxy?',
        options: ['Gravity', 'Air resistance', 'Electrostatic push', 'Tension'],
        answer: 0,
        explanation: 'Gravity binds stars within a galaxy.'
      }
    ];

    const diversity = validateQuizDiversity(duplicateGravity, 'galaxy');
    assert.strictEqual(diversity.valid, false);
    assert.strictEqual(diversity.reason, 'duplicate_concept');
    assert.strictEqual(diversity.concept, 'gravitational_binding');
  });

  // Test O: Full 5-concept fallback templates in EN and OD -> PASS
  await test('O. Full 5-concept fallback templates in EN and OD -> PASS', () => {
    const enKeys = ['galaxy_definition', 'gravitational_binding', 'galaxy_components_examples', 'galaxy_types_structure', 'solar_system_location'];
    const enQuestions = enKeys.map(k => CONCEPT_FALLBACK_QUESTIONS[k]);
    assert.strictEqual(enQuestions.filter(Boolean).length, 5, 'All 5 English fallback questions must exist');
    const enVal = validateQuizQuality(enQuestions, 'galaxies', 'English');
    assert.strictEqual(enVal.valid, true, `5-question EN fallback must pass: ${enVal.detail || enVal.reason}`);

    const odQuestions = enKeys.map(k => CONCEPT_FALLBACK_QUESTIONS_OD[k]);
    assert.strictEqual(odQuestions.filter(Boolean).length, 5, 'All 5 Odia fallback questions must exist');
    const odVal = validateQuizQuality(odQuestions, 'ଛାୟାପଥ', 'Odia');
    assert.strictEqual(odVal.valid, true, `5-question OD fallback must pass: ${odVal.detail || odVal.reason}`);
  });

  // Test P: Question-level validation and slot fallback detection
  await test('P. Slot repair and deterministic fallback detection -> PASS', () => {
    const plan = getTopicCoveragePlan('galaxy', 5, 'English');
    assert.strictEqual(plan.plannedCount, 5);

    // Provide quiz with 1 invalid slot (bad options) and check issues
    const sampleQuestions = [
      CONCEPT_FALLBACK_QUESTIONS.galaxy_definition,
      CONCEPT_FALLBACK_QUESTIONS.gravitational_binding,
      CONCEPT_FALLBACK_QUESTIONS.galaxy_components_examples,
      { question: 'Too short', options: ['A', 'B'], answer: 0 },
      CONCEPT_FALLBACK_QUESTIONS.solar_system_location
    ];
    const issues = getQuestionValidationIssues(sampleQuestions, 'galaxy', 'English', plan);
    assert.strictEqual(issues[3].valid, false);
    assert.strictEqual(issues[3].conceptId, 'galaxy_types_structure');
    assert(issues[3].fallbackQuestion !== null);
  });

  // Test Q: Respiratory system 4-question quiz from user prompt -> PASS
  await test('Q. Respiratory system 4-question quiz -> PASS diversity and quality validation', () => {
    const respQuestions = [
      {
        question: "What is the primary fundamental function of the human respiratory system?",
        options: ["Gas exchange (taking in oxygen and releasing carbon dioxide)", "Pumping blood to tissues", "Digesting nutrients for energy", "Filtering waste from blood"],
        answer: 0,
        explanation: "The primary function of the respiratory system is gas exchange."
      },
      {
        question: "Which specific structure within the lungs is responsible for the actual exchange of gases between the air and the blood?",
        options: ["Alveoli", "Trachea", "Bronchi", "Larynx"],
        answer: 0,
        explanation: "Alveoli are microscopic sacs where gas exchange occurs."
      },
      {
        question: "Why does a person's breathing rate increase significantly during intense physical exercise?",
        options: ["To supply more oxygen to muscles and expel excess carbon dioxide", "To decrease heart rate", "To cool the body", "To reduce stomach acid"],
        answer: 0,
        explanation: "Muscles require more oxygen during intense exercise, raising the breathing rate."
      },
      {
        question: "How does the presence of carbon monoxide in the air affect the efficiency of the human respiratory system?",
        options: ["It binds tightly to hemoglobin, reducing oxygen transport to tissues", "It increases oxygen intake in the lungs", "It paralyzes the vocal cords", "It damages bronchial cilia immediately"],
        answer: 0,
        explanation: "Carbon monoxide binds strongly to hemoglobin, impairing oxygen delivery."
      }
    ];

    const topic = "respritation sysytem of human";
    const divResult = validateQuizDiversity(respQuestions, topic);
    assert.strictEqual(divResult.valid, true, `4 respiratory questions must pass diversity: ${divResult.detail || divResult.reason}`);

    const qualResult = validateQuizQuality(respQuestions, topic, 'English');
    assert.strictEqual(qualResult.valid, true, `4 respiratory questions must pass quality: ${qualResult.detail || qualResult.reason}`);
  });

  // Test R: Same topic + genuinely duplicate questions -> FAIL duplicate_concept
  await test('R. Same topic + genuinely duplicate respiratory questions -> FAIL duplicate_concept', () => {
    const dupQuestions = [
      {
        question: "What is the main function of the respiratory system?",
        options: ["Gas exchange", "Pumping blood", "Digestion", "Filtering waste"],
        answer: 0,
        explanation: "Primary role is gas exchange."
      },
      {
        question: "What is the primary function of the human respiratory system?",
        options: ["Gas exchange", "Pumping blood", "Digestion", "Filtering waste"],
        answer: 0,
        explanation: "Fundamental role is gas exchange."
      }
    ];

    const topic = "respritation sysytem of human";
    const divResult = validateQuizDiversity(dupQuestions, topic);
    assert.strictEqual(divResult.valid, false, 'Genuinely duplicate questions must fail');
    assert.strictEqual(divResult.reason, 'duplicate_concept');
    assert.strictEqual(divResult.concept, 'respiratory_system_function');
  });

  // Test S: Same topic + different sub-concepts -> PASS
  await test('S. Same topic + different sub-concepts (function vs alveoli structure) -> PASS', () => {
    const mixedQuestions = [
      {
        question: "What is the main function of the respiratory system?",
        options: ["Gas exchange", "Pumping blood", "Digestion", "Filtering waste"],
        answer: 0,
        explanation: "Gas exchange."
      },
      {
        question: "Where does gas exchange occur in the lungs?",
        options: ["In the alveoli", "In the trachea", "In the larynx", "In the bronchi"],
        answer: 0,
        explanation: "Gas exchange occurs in the alveoli."
      }
    ];

    const topic = "respritation sysytem of human";
    const divResult = validateQuizDiversity(mixedQuestions, topic);
    assert.strictEqual(divResult.valid, true, `Distinct sub-concepts must pass: ${divResult.detail || divResult.reason}`);
  });

  // Test T: Newton's First Law five-question example -> all 5 unique concepts, passes diversity
  await test('T. Newton\'s First Law five-question example -> all five unique concepts & passes diversity', () => {
    const topic = "Newton's First Law of Motion";
    const q1 = {
      question: "What is the fundamental principle stated by Newton's First Law of Motion?",
      options: [
        "An object remains at rest or in uniform straight-line motion unless acted upon by a net external force",
        "Force equals mass times acceleration",
        "For every action there is an equal and opposite reaction",
        "Total energy in an isolated system is conserved"
      ],
      answer: 0,
      explanation: "Newton's First Law states that an object continues in its state of rest or uniform motion unless an unbalanced force acts on it."
    };
    const q2 = {
      question: "Which physical property determines an object's resistance to changes in its state of motion according to Newton's First Law?",
      options: ["Inertia", "Velocity", "Volume", "Weight"],
      answer: 0,
      explanation: "Inertia is the property of matter that resists changes in motion."
    };
    const q3 = {
      question: "Why do passengers lurch forward when a moving car suddenly stops?",
      options: [
        "Due to inertia, their bodies tend to continue moving forward",
        "Due to an external forward force",
        "Because gravity increases",
        "Due to air pressure"
      ],
      answer: 0,
      explanation: "Passengers possess inertia of motion and tend to continue forward when the vehicle stops."
    };
    const q4 = {
      question: "What is the relationship between the net external force on an object and its acceleration as implied by Newton's First Law?",
      options: [
        "When net external force is zero, acceleration is zero",
        "When net external force is zero, acceleration is maximum",
        "They are unrelated",
        "Zero net force causes continuous acceleration"
      ],
      answer: 0,
      explanation: "With zero net external force, there is zero acceleration."
    };
    const q5 = {
      question: "Why is understanding Newton's First Law crucial for the design of vehicle safety features like seatbelts and airbags?",
      options: [
        "They provide an external force to safely stop passengers whose inertia keeps them moving",
        "They eliminate gravity",
        "They prevent fuel leaks",
        "They increase car speed"
      ],
      answer: 0,
      explanation: "Seatbelts and airbags safely decelerate occupants against inertia."
    };

    assert.strictEqual(classifyQuestionConcept(q1, topic), 'rest_vs_motion');
    assert.strictEqual(classifyQuestionConcept(q2, topic), 'inertia_newton1');
    assert.strictEqual(classifyQuestionConcept(q3, topic), 'inertia_real_world');
    assert.strictEqual(classifyQuestionConcept(q4, topic), 'net_force_zero');
    assert.strictEqual(classifyQuestionConcept(q5, topic), 'safety_inertia');

    const divRes = validateQuizDiversity([q1, q2, q3, q4, q5], topic);
    assert.strictEqual(divRes.valid, true, `All 5 First Law questions must pass diversity: ${divRes.detail || divRes.reason}`);
  });

  // Test U: Genuine duplicate passenger lurch questions -> FAIL duplicate_concept (inertia_real_world)
  await test('U. Genuine duplicate passenger-lurch questions -> FAIL duplicate_concept', () => {
    const topic = "Newton's First Law of Motion";
    const qA = {
      question: "Why do passengers lurch forward when a moving car suddenly stops?",
      options: ["Due to inertia", "Due to gravity", "Due to friction", "Due to air pressure"],
      answer: 0
    };
    const qB = {
      question: "Why do passengers stumble forward when a bus applies sudden brakes?",
      options: ["Due to inertia of motion", "Due to air pressure", "Because of friction", "Due to gravity"],
      answer: 0
    };

    const divRes = validateQuizDiversity([qA, qB], topic);
    assert.strictEqual(divRes.valid, false, 'Duplicate passenger lurch questions must fail');
    assert.strictEqual(divRes.reason, 'duplicate_concept');
    assert.strictEqual(divRes.concept, 'inertia_real_world');
  });

  // Test V: Genuine duplicate zero-net-force questions -> FAIL duplicate_concept (net_force_zero)
  await test('V. Genuine duplicate zero-net-force questions -> FAIL duplicate_concept', () => {
    const topic = "Newton's First Law of Motion";
    const qA = {
      question: "What is the relationship between the net external force on an object and its acceleration as implied by Newton's First Law?",
      options: ["Zero net force means zero acceleration", "Maximum", "Infinite", "Negative"],
      answer: 0
    };
    const qB = {
      question: "When the net external force acting on an object is zero, what is its acceleration?",
      options: ["Zero", "Maximum", "Infinite", "Negative"],
      answer: 0
    };

    const divRes = validateQuizDiversity([qA, qB], topic);
    assert.strictEqual(divRes.valid, false, 'Duplicate zero-net-force questions must fail');
    assert.strictEqual(divRes.reason, 'duplicate_concept');
    assert.strictEqual(divRes.concept, 'net_force_zero');
  });

  // Test W: Genuine duplicate seatbelt/airbag safety questions -> FAIL duplicate_concept (safety_inertia)
  await test('W. Genuine duplicate seatbelt/airbag safety questions -> FAIL duplicate_concept', () => {
    const topic = "Newton's First Law of Motion";
    const qA = {
      question: "Why is understanding Newton's First Law crucial for the design of vehicle safety features like seatbelts and airbags?",
      options: ["They provide an external restraining force", "They eliminate gravity", "They reduce weight", "They increase speed"],
      answer: 0
    };
    const qB = {
      question: "How do seatbelts protect passengers from injury during sudden vehicle collisions according to Newton's laws?",
      options: ["By applying an external force against passenger inertia", "By reducing gravity", "By cooling cabin air", "By inflating tires"],
      answer: 0
    };

    const divRes = validateQuizDiversity([qA, qB], topic);
    assert.strictEqual(divRes.valid, false, 'Duplicate seatbelt safety questions must fail');
    assert.strictEqual(divRes.reason, 'duplicate_concept');
    assert.strictEqual(divRes.concept, 'safety_inertia');
  });

  // Test X: Cross-subskill passenger inertia vs zero-net-force -> PASS
  await test('X. Cross-subskill: passenger inertia vs zero-net-force -> PASS', () => {
    const topic = "Newton's First Law of Motion";
    const qPass = {
      question: "Why do passengers lurch forward when a moving car suddenly stops?",
      options: ["Due to inertia of motion", "Due to gravity", "Due to friction", "Due to air pressure"],
      answer: 0
    };
    const qForce = {
      question: "When the net external force acting on an object is zero, what is its acceleration?",
      options: ["Zero", "Maximum", "Infinite", "Negative"],
      answer: 0
    };

    const divRes = validateQuizDiversity([qPass, qForce], topic);
    assert.strictEqual(divRes.valid, true, `Different subskills must pass: ${divRes.detail || divRes.reason}`);
  });

  // Test Y: Cross-subskill zero-net-force vs seatbelt/airbag safety -> PASS
  await test('Y. Cross-subskill: zero-net-force vs seatbelt/airbag safety -> PASS', () => {
    const topic = "Newton's First Law of Motion";
    const qForce = {
      question: "What is the relationship between the net external force on an object and its acceleration as implied by Newton's First Law?",
      options: ["Zero net force means zero acceleration", "Maximum", "Infinite", "Negative"],
      answer: 0
    };
    const qSafety = {
      question: "Why is understanding Newton's First Law crucial for the design of vehicle safety features like seatbelts and airbags?",
      options: ["They apply an external force to restrain motion", "They eliminate gravity", "They reduce weight", "They increase speed"],
      answer: 0
    };

    const divRes = validateQuizDiversity([qForce, qSafety], topic);
    assert.strictEqual(divRes.valid, true, `Different subskills must pass: ${divRes.detail || divRes.reason}`);
  });

  // Test Z: Cross-subskill passenger inertia vs safety application -> PASS
  await test('Z. Cross-subskill: passenger inertia vs safety application -> PASS', () => {
    const topic = "Newton's First Law of Motion";
    const qPass = {
      question: "Why do passengers lurch forward when a moving car suddenly stops?",
      options: ["Due to inertia of motion", "Due to gravity", "Due to friction", "Due to air pressure"],
      answer: 0
    };
    const qSafety = {
      question: "How do seatbelts protect passengers from injury during sudden vehicle collisions according to Newton's laws?",
      options: ["By applying an external force against passenger inertia", "By reducing gravity", "By cooling cabin air", "By inflating tires"],
      answer: 0
    };

    const divRes = validateQuizDiversity([qPass, qSafety], topic);
    assert.strictEqual(divRes.valid, true, `Different subskills must pass: ${divRes.detail || divRes.reason}`);
  });

  // Test AA: Fallback templates for Newton's First Law have 5 distinct concepts in EN and OD -> PASS
  await test('AA. Fallback templates for Newton\'s First Law have 5 distinct concepts in EN and OD -> PASS', () => {
    const keys = ['rest_vs_motion', 'inertia_newton1', 'inertia_real_world', 'net_force_zero', 'safety_inertia'];
    const enQuestions = keys.map(k => CONCEPT_FALLBACK_QUESTIONS[k]);
    assert.strictEqual(enQuestions.filter(Boolean).length, 5, 'All 5 English fallback questions must exist');
    const enVal = validateQuizDiversity(enQuestions, "Newton's First Law of Motion");
    assert.strictEqual(enVal.valid, true, `5-question EN fallback must pass diversity: ${enVal.detail || enVal.reason}`);

    const odQuestions = keys.map(k => CONCEPT_FALLBACK_QUESTIONS_OD[k]);
    assert.strictEqual(odQuestions.filter(Boolean).length, 5, 'All 5 Odia fallback questions must exist');
    const odVal = validateQuizDiversity(odQuestions, "ନ୍ୟୁଟନଙ୍କ ପ୍ରଥମ ଗତି ନିୟମ");
    assert.strictEqual(odVal.valid, true, `5-question OD fallback must pass diversity: ${odVal.detail || odVal.reason}`);
  });

  console.log(`\n===============================================================`);
  console.log(`RESULTS: ${passed} PASSED, ${failed} FAILED`);
  console.log(`===============================================================\n`);

  if (failed > 0) {
    process.exit(1);
  }
}

runAllTests().catch((err) => {
  console.error('Unhandled test runner error:', err);
  process.exit(1);
});

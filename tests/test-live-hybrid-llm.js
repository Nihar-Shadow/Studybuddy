// tests/test-live-hybrid-llm.js
// Live end-to-end demonstration of online -> offline switching and Odia pipeline

const assert = require('assert');
const http = require('http');
const { OnlineProvider, OllamaProvider, HybridLLMProvider } = require('../lib/llmProvider');
const { parseTutorResponse } = require('../lib/parseJSON');
const {
  createInitialLearningState,
  recordLearningEvent,
  chooseMasteryAction,
  resolveTopicAndConcept,
  getConceptState
} = require('../lib/studentLearningState');
const {
  getTargetedPractice,
  processPracticeSubmission
} = require('../lib/targetedPractice');
const {
  findRelevantClass9Knowledge,
  validateAgainstClass9Knowledge
} = require('../lib/class9Knowledge');
const {
  extractOdiaContentPlan,
  validateOdiaTutorAnswer
} = require('../lib/languagePolicy');
const {
  buildStructuredOdiaTutorResponse
} = require('../lib/structuredTutor');

function createMockOnlineServer() {
  return new Promise((resolve) => {
    const server = http.createServer((req, res) => {
      let body = '';
      req.on('data', chunk => body += chunk);
      req.on('end', () => {
        const parsed = JSON.parse(body || '{}');
        const userMsg = parsed.messages?.find(m => m.role === 'user')?.content || '';

        let content = '';
        if (userMsg.includes('force') || userMsg.includes('Force')) {
          content = JSON.stringify({
            intro: 'Force is an external push or pull that can change an object’s velocity or state of rest.',
            steps: [
              { title: 'Push or Pull', text: 'Force is an interaction applied to a mass.' },
              { title: 'Newton’s Second Law', text: 'F = m * a. SI unit is Newton (N).' }
            ],
            summary: 'Force causes acceleration when unbalanced.',
            followUp: 'Would you like to try a question on inertia and Newton’s laws?'
          });
        } else if (/[\u0b00-\u0b7f]/.test(userMsg)) {
          content = "ବଳ ହେଉଛି ଏକ ଟାଣିବା ବା ଠେଲିବା କ୍ରିୟା। ଏହାର SI ଏକକ ନିଉଟନ (N)। ଏହା ବସ୍ତୁର ଗତିରେ ପରିବର୍ତ୍ତନ ଆଣିପାରେ।";
        } else {
          content = JSON.stringify({
            intro: 'General educational explanation.',
            steps: [{ title: 'Step 1', text: 'Concept explanation.' }],
            summary: 'Concept summary.',
            followUp: 'Ready for practice?'
          });
        }

        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({
          choices: [{ message: { content } }]
        }));
      });
    });

    server.listen(0, '127.0.0.1', () => {
      const port = server.address().port;
      resolve({
        url: `http://127.0.0.1:${port}`,
        close: () => new Promise(r => server.close(r))
      });
    });
  });
}

async function runLiveTest() {
  console.log('====================================================');
  console.log('🚀 STUDYBUDDY LIVE HYBRID LLM DEMONSTRATION');
  console.log('====================================================\n');

  const mockOnline = await createMockOnlineServer();
  console.log(`[Online Provider] Mock online server listening at ${mockOnline.url}`);

  const onlineProvider = new OnlineProvider({
    enabled: true,
    baseUrl: mockOnline.url,
    apiKey: 'sk-live-demo-key-12345',
    model: 'gpt-4o-mini',
    timeoutMs: 3000
  });

  const ollamaProvider = new OllamaProvider();
  const hybridProvider = new HybridLLMProvider({ onlineProvider, ollamaProvider });

  // Student session persistent state
  const studentSession = {
    learningState: createInitialLearningState({ language: 'English', grade: 9 })
  };

  try {
    // ----------------------------------------------------
    // STEP 1: ONLINE INFERENCE
    // ----------------------------------------------------
    console.log('\n--- 1. Testing ONLINE inference: "What is force?" ---');
    const onlineGen = await hybridProvider.generate({
      language: 'English',
      task: 'chat',
      messages: [{ role: 'user', content: 'What is force?' }]
    });

    console.log(`Result Provider: ${onlineGen.provider}`);
    console.log(`Result Model: ${onlineGen.model}`);
    console.log(`Result Fallback: ${onlineGen.fallback}`);
    assert.strictEqual(onlineGen.provider, 'online');
    assert.strictEqual(onlineGen.fallback, false);

    const structuredOnline = parseTutorResponse(onlineGen.text);
    console.log(`Structured Steps: ${structuredOnline.steps.length}`);
    assert(structuredOnline.steps.length > 0);

    // Curriculum & Learning Event
    const c9Knowledge = findRelevantClass9Knowledge('What is force?', 'English', []);
    const { topic, concept } = resolveTopicAndConcept('What is force?', c9Knowledge);
    recordLearningEvent(studentSession.learningState, {
      topic,
      concept,
      evidence: 'asked_about_concept'
    });

    let action1 = chooseMasteryAction(studentSession.learningState, {
      currentTopic: topic,
      currentConcept: concept,
      language: 'English',
      studentMessage: 'What is force?'
    });
    console.log(`Mastery Action after online explanation: ${action1.action} (state=${action1.masteryState}, confidence=${action1.confidence})`);
    assert.strictEqual(action1.action, 'practice');

    // Student performs practice
    const practiceActivity = getTargetedPractice({ topic, concept }, 'English');
    console.log(`Generated Practice Question: "${practiceActivity.question}"`);
    const submission1 = processPracticeSubmission(
      studentSession.learningState,
      practiceActivity,
      practiceActivity.correctAnswer
    );
    console.log(`Practice Correct: ${submission1.practiceResult.correct}`);
    assert.strictEqual(submission1.practiceResult.correct, true);

    // ----------------------------------------------------
    // STEP 2: NETWORK DROPS / ONLINE DISABLED -> AUTOMATIC FALLBACK
    // ----------------------------------------------------
    console.log('\n--- 2. Simulating network failure / disabling online provider ---');
    await mockOnline.close();
    console.log('[Online Provider] Network disconnected.');

    console.log('\n--- 3. Testing AUTOMATIC FALLBACK to Ollama: "What is force?" ---');
    const offlineGen = await hybridProvider.generate({
      language: 'English',
      task: 'chat',
      messages: [{ role: 'user', content: 'What is force?' }],
      options: { num_predict: 80, num_ctx: 2048 }
    });

    console.log(`Result Provider: ${offlineGen.provider}`);
    console.log(`Result Model: ${offlineGen.model}`);
    console.log(`Result Fallback: ${offlineGen.fallback}`);
    assert.strictEqual(offlineGen.provider, 'ollama');
    assert.strictEqual(offlineGen.fallback, true);

    // ----------------------------------------------------
    // STEP 3: SAME STUDENT PRACTICE CONTINUES UNINTERRUPTED
    // ----------------------------------------------------
    console.log('\n--- 4. Verifying student learning state survived provider switch ---');
    const studentConceptState = getConceptState(studentSession.learningState, { topic, concept });
    console.log(`Student concept: ${topic}:${concept}`);
    console.log(`Mastery State: ${studentConceptState.masteryState}`);
    console.log(`Repetitions: ${studentConceptState.repetitions}`);
    console.log(`Ease Factor: ${studentConceptState.easeFactor}`);
    assert.strictEqual(studentConceptState.repetitions, 1);
    assert.strictEqual(studentConceptState.masteryState, 'partial');

    // Continue practice offline
    recordLearningEvent(studentSession.learningState, {
      topic,
      concept,
      evidence: 'practice_correct'
    });
    console.log(`After 2nd correct practice: Repetitions=${studentConceptState.repetitions}, State=${studentConceptState.masteryState}`);
    assert.strictEqual(studentConceptState.repetitions, 2);

    // ----------------------------------------------------
    // STEP 4: ODIA REASONING & VALIDATION
    // ----------------------------------------------------
    console.log('\n--- 5. Testing Odia Tutor offline: "ବଳ କ\'ଣ?" ---');
    const odiaPrompt = "ବଳ କ'ଣ?";
    const odiaPlan = extractOdiaContentPlan(odiaPrompt);
    const odiaC9 = findRelevantClass9Knowledge(odiaPrompt, 'Odia', []);

    const odiaGen = await hybridProvider.generate({
      language: 'Odia',
      task: 'tutor',
      messages: [{ role: 'user', content: odiaPrompt }],
      options: { num_predict: 80, num_ctx: 2048 }
    });

    console.log(`Odia Provider: ${odiaGen.provider}`);
    console.log(`Odia Model: ${odiaGen.model}`);
    console.log(`Odia Raw Output Preview: "${odiaGen.text.slice(0, 80)}…"`);

    const odiaVal = validateOdiaTutorAnswer(odiaGen.text, odiaPrompt, odiaPlan);
    console.log(`Odia Terminology Validation: ${odiaVal.valid ? 'PASSED ✅' : 'FAILED ❌'}`);

    const structuredOdia = buildStructuredOdiaTutorResponse({
      rawReply: odiaGen.text,
      message: odiaPrompt,
      odiaContentPlan: odiaPlan,
      class9Knowledge: odiaC9,
      level: 'intermediate'
    });

    console.log(`Structured Odia Steps: ${structuredOdia.steps.length}`);
    console.log(`Structured Odia Intro: "${structuredOdia.intro || ''}"`);

    const odiaAction = chooseMasteryAction(studentSession.learningState, {
      currentTopic: 'force_and_motion',
      currentConcept: 'inertia_first_law',
      language: 'Odia',
      studentMessage: odiaPrompt
    });
    console.log(`Odia Next Study Decision: action=${odiaAction.action}, concept=${odiaAction.conceptId || odiaAction.concept}`);

    console.log('\n====================================================');
    console.log('✅ LIVE HYBRID LLM DEMONSTRATION COMPLETE: ALL PASS');
    console.log('====================================================');
  } catch (err) {
    console.error('❌ Live test error:', err);
    process.exit(1);
  }
}

runLiveTest();

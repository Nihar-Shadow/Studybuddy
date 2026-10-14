'use strict';

const assert = require('assert');

function normaliseOption(str) {
  return String(str || '').replace(/^[A-D][).\s]+/i, '').trim().toLowerCase();
}

function isAnswerCorrect(option, answer) {
  if (option === answer) return true;
  if (option.charAt(0).toUpperCase() === answer.charAt(0).toUpperCase() && /^[A-D]/i.test(answer)) return true;
  return normaliseOption(option) === normaliseOption(answer);
}

async function testLiveE2EOdiaWaterQuiz() {
  console.log('🧪 Running Live E2E Odia Water State Change Quiz Test...\n');

  const prompt = 'ପାଣିକୁ ଗରମ କଲେ ଏହା କେଉଁ ଅବସ୍ଥାକୁ ପରିବର୍ତ୍ତନ ହୁଏ? ୪ଟି ବିକଳ୍ପ ସହିତ ଓଡ଼ିଆରେ ୧ଟି MCQ ତିଆରି କର।';

  // 1. Authenticate
  const loginRes = await fetch('http://localhost:3000/auth/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ pin: '1234', studentName: 'Rohan' })
  });
  assert(loginRes.ok, `Login failed: ${loginRes.status}`);
  const cookie = loginRes.headers.get('set-cookie');
  console.log('✓ Successfully authenticated student session');

  // 2. Send Quiz Request with exact prompt
  const quizStart = Date.now();
  console.log(`Sending topic: "${prompt}"`);
  const quizRes = await fetch('http://localhost:3000/quiz', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Cookie': cookie
    },
    body: JSON.stringify({
      topic: prompt,
      level: 'beginner',
      language: 'Odia'
    })
  });

  const responseText = await quizRes.text();
  let data;
  try {
    data = JSON.parse(responseText);
  } catch (e) {
    throw new Error(`Failed to parse quiz response (status ${quizRes.status}): ${responseText}`);
  }

  assert(quizRes.ok, `Quiz API failed (status ${quizRes.status}): ${JSON.stringify(data)}`);
  console.log(`✓ Quiz generated in ${((Date.now() - quizStart) / 1000).toFixed(1)}s`);

  // 3. Verify assertions
  // requestedQuestions = 1
  assert.strictEqual(data.requestedQuestions, 1, `Expected requestedQuestions = 1, got ${data.requestedQuestions}`);
  console.log('✓ requestedQuestions = 1');

  // optionsPerQuestion = 4
  assert.strictEqual(data.optionsPerQuestion, 4, `Expected optionsPerQuestion = 4, got ${data.optionsPerQuestion}`);
  console.log('✓ optionsPerQuestion = 4');

  // generatedQuestions = 1
  assert(Array.isArray(data.questions), 'data.questions must be an array');
  assert.strictEqual(data.questions.length, 1, `Expected exactly 1 question, got ${data.questions.length}`);
  console.log('✓ generatedQuestions = 1');

  const q = data.questions[0];
  console.log('\n--- Generated Question ---');
  console.log(`Question: ${q.question}`);
  console.log(`Options:  ${q.options.join(' | ')}`);
  console.log(`Answer:   ${q.answer}`);
  console.log(`Expl:     ${q.explanation}\n`);

  // Options validation: exactly 4 distinct non-empty options
  assert.strictEqual(q.options.length, 4, `Expected 4 options, got ${q.options.length}`);
  const distinctOpts = new Set(q.options.map(o => normaliseOption(o)));
  assert.strictEqual(distinctOpts.size, 4, 'Options must be distinct');
  console.log('✓ exactly 4 distinct options');

  // Answer points to one option
  const matchedOptions = q.options.filter(opt => isAnswerCorrect(opt, q.answer));
  assert.strictEqual(matchedOptions.length, 1, `Expected answer to match exactly 1 option, matched ${matchedOptions.length}`);
  console.log(`✓ Answer points to exactly one option: "${matchedOptions[0]}"`);

  // language = Odia
  assert.strictEqual(data.telemetry?.language, 'Odia', `Expected telemetry language Odia, got ${data.telemetry?.language}`);
  console.log('✓ language = Odia');

  // topic = water heating/state change
  const combined = `${q.question} ${q.options.join(' ')} ${q.explanation} ${q.answer}`;
  const isWaterStateTopic = /ପାଣି|ଜଳ|ଗରମ|ଅବସ୍ଥା|ବାଷ୍ପ|ତରଳ/i.test(combined);
  assert(isWaterStateTopic, 'Question must be about water heating / state change');
  console.log('✓ topic = water heating / state change');

  // No photosynthesis or unrelated concepts
  const hasPhotosynthesis = /photosynthesis|ଆଲୋକ\s*ସଂଶ୍ଳେଷଣ|ଉଦ୍ଭିଦ\s*ସଂଶ୍ଲେ|ହରିତକଣ|ପତ୍ରହରିତ|ପତ୍ରରନ୍ଧ୍ର|କ୍ଲୋରୋଫିଲ/i.test(combined);
  assert(!hasPhotosynthesis, 'Must have zero topic drift into photosynthesis');
  console.log('✓ zero photosynthesis drift');

  // Correct answer = steam / water vapor (ବାଷ୍ପ / ଜଳୀୟ ବାଷ୍ପ)
  const resolvedAnsText = matchedOptions[0];
  const representsSteam = /ବାଷ୍ପ|ଜଳୀୟ\s*ବାଷ୍ପ|ଗ୍ୟାସ|vapor|steam/i.test(resolvedAnsText);
  assert(representsSteam, `Selected answer "${resolvedAnsText}" must represent water vapor/steam (ବାଷ୍ପ / ଜଳୀୟ ବାଷ୍ପ)`);
  console.log(`✓ correct answer represents water vapor / steam: "${resolvedAnsText}"`);

  console.log('\n🎉 ALL LIVE TEST VERIFICATIONS PASSED SUCCESSFULLY!');
}

testLiveE2EOdiaWaterQuiz().catch(err => {
  console.error('\n❌ Live E2E test failed:', err);
  process.exit(1);
});

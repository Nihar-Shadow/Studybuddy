'use strict';

const assert = require('assert');

async function runExactUserTest() {
  const promptTopic = 'ଆଲୋକ ସଂଶ୍ଳେଷଣ ବିଷୟରେ ଓଡ଼ିଆରେ ୩ଟି ସହଜ MCQ ତିଆରି କର। ପ୍ରତ୍ୟେକ ପ୍ରଶ୍ନର ୪ଟି ବିକଳ୍ପ ଥାଉ ଏବଂ କେବଳ ଗୋଟିଏ ସଠିକ୍ ଉତ୍ତର ଥାଉ।';
  console.log(`\n=== Running Exact User Odia Quiz Test ===`);
  console.log(`Prompt: "${promptTopic}"`);

  // 1. Authenticate
  const loginRes = await fetch('http://localhost:3000/auth/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ pin: '1234', studentName: 'TestUser' })
  });
  assert(loginRes.ok, `Login failed: ${loginRes.status}`);
  const cookie = loginRes.headers.get('set-cookie');
  console.log('✓ Logged in successfully');

  // 2. Call /quiz with prompt topic and numQuestions: 5 (simulating the UI default/override)
  console.log('Sending /quiz request with numQuestions: 5 in body, but prompt containing "୩ଟି"...');
  const startTime = Date.now();
  const quizRes = await fetch('http://localhost:3000/quiz', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Cookie': cookie
    },
    body: JSON.stringify({
      topic: promptTopic,
      level: 'beginner',
      numQuestions: 5, // Testing that prompt's ୩ଟି takes precedence
      language: 'Odia'
    })
  });

  const durationMs = Date.now() - startTime;
  console.log(`HTTP status: ${quizRes.status} in ${(durationMs / 1000).toFixed(2)}s`);

  const data = await quizRes.json();
  if (data.error) {
    console.error('Quiz Error Response:', data);
    process.exit(1);
  }

  console.log(`\nResults:`);
  console.log(`Questions returned: ${data.questions?.length}`);
  assert.strictEqual(data.questions?.length, 3, `Expected exactly 3 questions generated, got ${data.questions?.length}`);

  data.questions.forEach((q, i) => {
    console.log(`\n[Q${i + 1}] ${q.question}`);
    console.log(`  Options: ${q.options.join(' | ')}`);
    console.log(`  Answer: ${q.answer}`);
    console.log(`  Explanation: ${q.explanation}`);
    assert(q.options.length === 4, `Expected 4 options, got ${q.options.length}`);
    assert(q.answer !== undefined && q.answer !== null, 'Answer must exist');
  });

  console.log('\n✓ LIVE ODIA QUIZ GENERATION SUCCEEDED WITH EXACTLY 3 QUESTIONS!');
}

runExactUserTest().catch(err => {
  console.error('Test failed:', err);
  process.exit(1);
});

'use strict';

const assert = require('assert');

// Simulate client logic from public/scripts/quiz.js
function normaliseOption(str) {
  return String(str || '').replace(/^[A-D][).\s]+/i, '').trim().toLowerCase();
}
function isAnswerCorrect(option, answer) {
  if (option === answer) return true;
  if (option.charAt(0).toUpperCase() === answer.charAt(0).toUpperCase() && /^[A-D]/i.test(answer)) return true;
  return normaliseOption(option) === normaliseOption(answer);
}

async function testFullQuizFlow() {
  console.log('Testing full live quiz API and client logic flow...');
  
  // Step 1: Login
  const loginRes = await fetch('http://localhost:3000/auth/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ pin: '1234', studentName: 'Rohan' })
  });
  assert(loginRes.ok, `Login failed: ${loginRes.status}`);
  const cookie = loginRes.headers.get('set-cookie');
  console.log('✓ Successfully authenticated student session');

  // Step 2: Request Odia Quiz
  const quizStart = Date.now();
  const quizRes = await fetch('http://localhost:3000/quiz', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Cookie': cookie
    },
    body: JSON.stringify({
      topic: 'ଆଲୋକ ସଂଶ୍ଳେଷଣ',
      level: 'beginner',
      numQuestions: 3,
      language: 'Odia'
    })
  });

  assert(quizRes.ok, `Quiz API failed: ${quizRes.status}`);
  const data = await quizRes.json();
  console.log(`✓ Quiz generated in ${((Date.now() - quizStart)/1000).toFixed(1)}s`);
  assert.strictEqual(data.questions.length, 3, `Expected exactly 3 questions, got ${data.questions.length}`);
  console.log(`✓ Received ${data.questions.length} questions`);

  // Step 3: Verify client rendering & scoring simulation
  data.questions.forEach((q, idx) => {
    console.log(`\n  Q${idx + 1}: ${q.question}`);
    console.log(`    Options: ${q.options.join(' | ')}`);
    console.log(`    Answer: ${q.answer}`);
    console.log(`    Explanation: ${q.explanation}`);

    // Verify exactly one option is marked correct by client algorithm
    const correctCount = q.options.filter(opt => isAnswerCorrect(opt, q.answer)).length;
    assert.strictEqual(correctCount, 1, `Expected exactly 1 option to match answer, got ${correctCount}`);

    // Verify explanation exists and is educational
    assert(q.explanation.length > 5, 'Explanation too short');
    assert(q.explanation !== q.question, 'Explanation repeats question');
  });

  console.log('\n✓ Client answer selection and scoring validation passed cleanly!');
}

testFullQuizFlow().catch(err => {
  console.error('Test failed:', err);
  process.exit(1);
});

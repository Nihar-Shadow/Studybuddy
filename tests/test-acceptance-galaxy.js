require('dotenv').config();
const http = require('http');
const express = require('express');
const session = require('express-session');
const quizRouter = require('../routes/quiz');
const { validateQuizQuality } = require('../lib/languagePolicy');
const assert = require('assert');

async function runAcceptanceTest() {
  console.log('===============================================================');
  console.log('🚀 RUNNING CRITICAL ACCEPTANCE TESTS (LIVE LLM + QUIZ PIPELINE)');
  console.log('===============================================================\n');

  const app = express();
  app.use(express.json());
  app.use(session({ secret: 'test-secret', resave: false, saveUninitialized: true }));
  // Mock student session
  app.use((req, res, next) => {
    req.session.role = 'student';
    req.session.studentId = 'test_student';
    req.session.studentName = 'Test Student';
    next();
  });
  app.use(quizRouter);

  const server = app.listen(3002);

  function makeReq(body) {
    return new Promise((resolve, reject) => {
      const data = JSON.stringify(body);
      const req = http.request({
        hostname: 'localhost',
        port: 3002,
        path: '/quiz',
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Content-Length': Buffer.byteLength(data)
        }
      }, (res) => {
        let resData = '';
        res.on('data', chunk => resData += chunk);
        res.on('end', () => {
          try {
            resolve({ status: res.statusCode, body: JSON.parse(resData) });
          } catch (e) {
            resolve({ status: res.statusCode, body: resData });
          }
        });
      });
      req.on('error', reject);
      req.write(data);
      req.end();
    });
  }

  try {
    console.log('Test 1: topic="galaxy", level="intermediate", questions=5, options=4, language="English"');
    const res1 = await makeReq({
      topic: 'galaxy',
      level: 'intermediate',
      numQuestions: 5,
      options: 4,
      language: 'English'
    });

    console.log('-> Response Status:', res1.status);
    if (res1.status !== 200) {
      console.error('-> Response Error:', res1.body);
      assert.fail(`Test 1 failed with status ${res1.status}: ${JSON.stringify(res1.body)}`);
    }

    assert(Array.isArray(res1.body.questions), 'Must return questions array');
    assert.strictEqual(res1.body.questions.length, 5, 'Must return exactly 5 questions');
    console.log(`-> Received ${res1.body.questions.length} questions:`);
    res1.body.questions.forEach((q, idx) => {
      console.log(`   Q${idx + 1}: ${q.question}`);
      console.log(`       Options: ${q.options.join(' | ')}`);
      console.log(`       Answer: ${q.answer}`);
    });

    const val1 = validateQuizQuality(res1.body.questions, 'galaxy', 'English');
    console.log('-> Quiz validation result:', val1.valid ? 'PASSED' : `FAILED (${val1.reason})`);
    assert.strictEqual(val1.valid, true, `Quiz validation must pass: ${val1.detail || val1.reason}`);
    console.log('✓ Test 1 PASSED: 5 valid questions, no duplicate_concept failure.\n');

    console.log('Test 2: topic="galaxy", questions=3, language="Odia"');
    const res2 = await makeReq({
      topic: 'galaxy',
      level: 'intermediate',
      numQuestions: 3,
      options: 4,
      language: 'Odia'
    });

    console.log('-> Response Status:', res2.status);
    if (res2.status !== 200) {
      console.error('-> Response Error:', res2.body);
      assert.fail(`Test 2 failed with status ${res2.status}: ${JSON.stringify(res2.body)}`);
    }

    assert(Array.isArray(res2.body.questions), 'Must return questions array');
    assert.strictEqual(res2.body.questions.length, 3, 'Must return exactly 3 questions');
    console.log(`-> Received ${res2.body.questions.length} questions:`);
    res2.body.questions.forEach((q, idx) => {
      console.log(`   Q${idx + 1} (Odia): ${q.question}`);
      console.log(`       Options: ${q.options.join(' | ')}`);
      console.log(`       Answer: ${q.answer}`);
    });

    const val2 = validateQuizQuality(res2.body.questions, 'galaxy', 'Odia');
    console.log('-> Odia Quiz validation result:', val2.valid ? 'PASSED' : `FAILED (${val2.reason})`);
    assert.strictEqual(val2.valid, true, `Odia quiz validation must pass: ${val2.detail || val2.reason}`);
    console.log('✓ Test 2 PASSED: 3 valid questions, Odia validation PASSED.\n');

    console.log('===============================================================');
    console.log('ALL CRITICAL ACCEPTANCE TESTS COMPLETED SUCCESSFULLY!');
    console.log('===============================================================\n');
  } finally {
    server.close();
  }
}

runAcceptanceTest().catch((err) => {
  console.error('Acceptance test failed:', err);
  process.exit(1);
});

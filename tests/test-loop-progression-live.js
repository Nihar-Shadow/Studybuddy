'use strict';

const http = require('http');
const assert = require('assert');
const { shouldShowPracticeCTA } = require('../public/scripts/agent');

function postJson(path, payload, cookie = null) {
  return new Promise((resolve, reject) => {
    const data = JSON.stringify(payload);
    const headers = {
      'Content-Type': 'application/json',
      'Content-Length': Buffer.byteLength(data)
    };
    if (cookie) headers['Cookie'] = cookie;

    const req = http.request({
      hostname: 'localhost',
      port: 3000,
      path,
      method: 'POST',
      headers
    }, (res) => {
      let body = '';
      res.on('data', chunk => body += chunk);
      res.on('end', () => {
        try {
          resolve({ status: res.statusCode, headers: res.headers, data: JSON.parse(body) });
        } catch (e) {
          resolve({ status: res.statusCode, headers: res.headers, text: body });
        }
      });
    });
    req.on('error', reject);
    req.write(data);
    req.end();
  });
}

async function run() {
  console.log('====================================================');
  console.log('🚀 LIVE SERVER PRACTICE/REVIEW PROGRESSION TEST');
  console.log('====================================================');

  // Step 0: Login
  const loginRes = await postJson('/auth/login', { pin: '1234', studentName: 'TestStudent' });
  assert.strictEqual(loginRes.status, 200);
  const cookie = (loginRes.headers['set-cookie'] || [])[0]?.split(';')[0];
  assert.ok(cookie, 'Must obtain session cookie');
  console.log('✓ Step 0: Logged in, session cookie acquired');

  // Step 1: Initial practice request for respiration:plant_respiration
  const p1 = await postJson('/practice/next', {
    action: { action: 'practice', topic: 'respiration', concept: 'plant_respiration' },
    language: 'Odia'
  }, cookie);
  assert.strictEqual(p1.status, 200);
  const q1 = p1.data.activity;
  assert.ok(q1, 'Activity 1 must exist');
  assert.strictEqual(q1.topic, 'respiration');
  assert.strictEqual(q1.concept, 'plant_respiration');
  console.log(`✓ Step 1: Initial practice question returned: "${q1.question}"`);

  // Step 2: Submit wrong answer
  const wrongAnswer = q1.options.find(o => o !== q1.correctAnswer);
  const s1 = await postJson('/practice/submit', {
    activity: q1,
    studentAnswer: wrongAnswer
  }, cookie);
  assert.strictEqual(s1.status, 200);
  assert.strictEqual(s1.data.practiceResult.correct, false);
  assert.strictEqual(s1.data.practiceResult.evidence, 'practice_incorrect');
  assert.strictEqual(s1.data.nextStudy.action, 'review');
  assert.strictEqual(s1.data.nextStudy.topic, 'respiration');
  assert.strictEqual(s1.data.nextStudy.concept, 'plant_respiration');
  console.log('✓ Step 2: Incorrect answer evaluated -> state marked needs_review, nextStudy.action="review"');

  // Step 3: Review CTA click with excludeQuestion=q1.question
  const p2 = await postJson('/practice/next', {
    action: { action: 'review', topic: 'respiration', concept: 'plant_respiration' },
    language: 'Odia',
    excludeQuestion: q1.question
  }, cookie);
  assert.strictEqual(p2.status, 200);
  const q2 = p2.data.activity;
  assert.ok(q2, 'Activity 2 must exist');
  assert.strictEqual(q2.topic, 'respiration');
  assert.strictEqual(q2.concept, 'plant_respiration');
  assert.notStrictEqual(q2.question, q1.question, 'Follow-up review question must be different from previous');
  console.log(`✓ Step 3: Review request excluding Q1 returned distinct Q2: "${q2.question}"`);

  // Step 4: Submit correct answer for Q2
  const s2 = await postJson('/practice/submit', {
    activity: q2,
    studentAnswer: q2.correctAnswer
  }, cookie);
  assert.strictEqual(s2.status, 200);
  assert.strictEqual(s2.data.practiceResult.correct, true);
  assert.strictEqual(s2.data.practiceResult.evidence, 'practice_correct');
  assert.strictEqual(s2.data.nextStudy.action, 'completed', 'nextStudy action must be "completed" after correct answer');
  console.log('✓ Step 4: Correct answer submitted -> nextStudy.action="completed"');

  // Step 5: Verify CTA suppression on completed
  const shouldShow = shouldShowPracticeCTA({
    knowledgeFound: true,
    currentTopic: 'respiration',
    currentConcept: 'plant_respiration',
    nextStudy: s2.data.nextStudy
  });
  assert.strictEqual(shouldShow, false, 'CTA must NOT be shown when nextStudy.action="completed"');
  console.log('✓ Step 5: Completed activity suppresses repetitive CTA (no looping)');

  // Step 6: Test single-question concept exhaustion protection
  const exhaustRes = await postJson('/practice/next', {
    action: { action: 'review', topic: 'photosynthesis', concept: 'carbon_dioxide_role' },
    language: 'Odia',
    excludeQuestion: 'ଆଲୋକ ସଂଶ୍ଳେଷଣ ପ୍ରକ୍ରିୟାରେ ଅଙ୍ଗାରକାମ୍ଳର (CO2) ଭୂମିକା କ\'ଣ?'
  }, cookie);
  assert.strictEqual(exhaustRes.status, 200);
  assert.strictEqual(exhaustRes.data.activity, null, 'activity must be null when questions exhausted');
  assert.strictEqual(exhaustRes.data.exhausted, true, 'exhausted must be true');
  assert.ok(exhaustRes.data.explanation, 'Review explanation must be provided');
  console.log('✓ Step 6: Single-question concept safely exhausts without infinite loop');

  console.log('====================================================');
  console.log('🎉 LIVE PROGRESSION LOOP VERIFIED 100% SUCCESSFULLY');
  console.log('====================================================');
}

run().catch(e => {
  console.error('❌ Live test failed:', e);
  process.exit(1);
});

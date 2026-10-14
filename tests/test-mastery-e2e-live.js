'use strict';

/**
 * LIVE E2E MASTERY AGENT VERIFICATION SCRIPT (Section 18)
 * Tests the complete lifecycle on the active server:
 * Introduce -> Practice -> Incorrect -> Review -> Correct -> Repeated Success -> Mastered
 * Followed by concept isolation checks (motion, reproduction) in both English and Odia.
 */

const assert = require('assert');
const http = require('http');
const { shouldShowPracticeCTA } = require('../public/scripts/agent');

const BASE_URL = 'http://localhost:3000';

function postJson(path, body, cookie = null) {
  return new Promise((resolve, reject) => {
    const payload = JSON.stringify(body);
    const headers = {
      'Content-Type': 'application/json',
      'Content-Length': Buffer.byteLength(payload)
    };
    if (cookie) headers['Cookie'] = cookie;

    const req = http.request(`${BASE_URL}${path}`, {
      method: 'POST',
      headers
    }, (res) => {
      let data = '';
      res.on('data', chunk => { data += chunk; });
      res.on('end', () => {
        let setCookie = res.headers['set-cookie'];
        if (Array.isArray(setCookie)) setCookie = setCookie.map(c => c.split(';')[0]).join('; ');
        try {
          resolve({ status: res.statusCode, data: JSON.parse(data), cookie: setCookie, raw: data });
        } catch (_) {
          resolve({ status: res.statusCode, raw: data, cookie: setCookie });
        }
      });
    });
    req.on('error', reject);
    req.write(payload);
    req.end();
  });
}

function streamChat(message, language = 'English', cookie = null) {
  return new Promise((resolve, reject) => {
    const payload = JSON.stringify({ message, language, level: 'intermediate' });
    const headers = {
      'Content-Type': 'application/json',
      'Content-Length': Buffer.byteLength(payload)
    };
    if (cookie) headers['Cookie'] = cookie;

    const req = http.request(`${BASE_URL}/chat`, {
      method: 'POST',
      headers
    }, (res) => {
      let sseData = '';
      let finalEvent = null;
      let setCookie = res.headers['set-cookie'];
      if (Array.isArray(setCookie)) setCookie = setCookie.map(c => c.split(';')[0]).join('; ');

      if (res.statusCode !== 200) {
        let errBody = '';
        res.on('data', d => { errBody += d; });
        res.on('end', () => reject(new Error(`HTTP ${res.statusCode}: ${errBody}`)));
        return;
      }

      res.on('data', chunk => {
        sseData += chunk.toString();
        const lines = sseData.split('\n');
        sseData = lines.pop();
        for (const line of lines) {
          const trimmed = line.trim();
          if (trimmed.startsWith('data: ')) {
            const rawJson = trimmed.slice(6);
            try {
              const parsed = JSON.parse(rawJson);
              if (parsed.done) finalEvent = parsed;
            } catch (_) {}
          }
        }
      });
      res.on('end', () => {
        if (sseData && sseData.trim().startsWith('data: ')) {
          try {
            const parsed = JSON.parse(sseData.trim().slice(6));
            if (parsed.done) finalEvent = parsed;
          } catch (_) {}
        }
        resolve({ finalEvent, cookie: setCookie });
      });
    });
    req.on('error', reject);
    req.write(payload);
    req.end();
  });
}

async function run() {
  console.log('====================================================');
  console.log('🚀 LIVE E2E MASTERY AGENT VERIFICATION SUITE');
  console.log('====================================================');

  // =========================================================================
  // PART 1: English Flow
  // =========================================================================
  console.log('\n========================================');
  console.log('PART 1: English Mastery Lifecycle');
  console.log('========================================');

  // Login as fresh student
  const loginRes = await postJson('/auth/login', { pin: '1234', studentName: 'MasteryTest_EN' });
  assert.strictEqual(loginRes.status, 200);
  const cookieEn = loginRes.cookie;
  console.log('  ✓ Authenticated student session');

  // Step 1: "What is force?"
  console.log('\n--- Step 1: Ask "What is force?" ---');
  const chat1 = await streamChat('What is force?', 'English', cookieEn);
  assert.ok(chat1.finalEvent?.structured);
  const s1 = chat1.finalEvent.structured;
  console.log(`  Identified: topic=${s1.currentTopic}, concept=${s1.currentConcept}`);
  console.log(`  nextStudy action=${s1.nextStudy?.action}, masteryState=${s1.nextStudy?.masteryState}`);
  assert.strictEqual(s1.knowledgeFound, true);
  assert.strictEqual(s1.currentTopic, 'force_and_motion');
  assert.ok(['practice', 'introduce'].includes(s1.nextStudy?.action));
  assert.strictEqual(shouldShowPracticeCTA(s1), true);

  // Step 2: Practice
  console.log('\n--- Step 2: Request practice question ---');
  const p1 = await postJson('/practice/next', { action: s1.nextStudy, language: 'English' }, cookieEn);
  assert.strictEqual(p1.status, 200);
  const act1 = p1.data.activity;
  assert.ok(act1);
  assert.strictEqual(act1.topic, 'force_and_motion');
  console.log(`  Received practice: ${act1.question.slice(0, 60)}...`);

  // Step 3: Answer incorrectly
  console.log('\n--- Step 3: Answer practice incorrectly ---');
  const wrongAnswer = act1.options.find(o => o !== act1.correctAnswer);
  const sub1 = await postJson('/practice/submit', { activity: act1, studentAnswer: wrongAnswer }, cookieEn);
  assert.strictEqual(sub1.status, 200);
  console.log(`  Correct: ${sub1.data.practiceResult.correct}, Evidence: ${sub1.data.practiceResult.evidence}`);
  console.log(`  nextStudy: action=${sub1.data.nextStudy?.action}, state=${sub1.data.nextStudy?.masteryState || sub1.data.learningState?.concepts?.force_and_motion?.status}`);
  assert.strictEqual(sub1.data.practiceResult.correct, false);
  assert.strictEqual(sub1.data.practiceResult.evidence, 'practice_incorrect');
  assert.strictEqual(sub1.data.nextStudy?.action, 'review');
  assert.strictEqual(sub1.data.learningState.concepts.force_and_motion.status, 'needs_review');
  console.log('  ✓ Transitioned to needs_review -> review action');

  // Step 4: Review
  console.log('\n--- Step 4: Request review practice ---');
  const revP = await postJson('/practice/next', { action: sub1.data.nextStudy, language: 'English' }, cookieEn);
  assert.strictEqual(revP.status, 200);
  const revAct = revP.data.activity;
  assert.strictEqual(revAct.topic, 'force_and_motion');
  console.log(`  Received review activity: ${revAct.question.slice(0, 60)}...`);

  // Step 5: Answer correctly
  console.log('\n--- Step 5: Answer review practice correctly ---');
  const sub2 = await postJson('/practice/submit', { activity: revAct, studentAnswer: revAct.correctAnswer }, cookieEn);
  assert.strictEqual(sub2.status, 200);
  assert.strictEqual(sub2.data.practiceResult.correct, true);
  console.log(`  Correct: ${sub2.data.practiceResult.correct}, Evidence: ${sub2.data.practiceResult.evidence}`);

  // Step 6: Repeat enough successful practice to achieve mastery
  console.log('\n--- Step 6: Repeat practice to achieve mastery ---');
  let currentStatus = sub2.data.learningState.concepts.force_and_motion.status;
  let lastSubmit = sub2;
  let attempts = 0;
  while (currentStatus !== 'understood' && attempts < 6) {
    attempts++;
    const pNext = await postJson('/practice/next', {
      action: { action: 'practice', topic: 'force_and_motion', concept: 'inertia_first_law' },
      language: 'English'
    }, cookieEn);
    const actNext = pNext.data.activity;
    lastSubmit = await postJson('/practice/submit', { activity: actNext, studentAnswer: actNext.correctAnswer }, cookieEn);
    currentStatus = lastSubmit.data.learningState.concepts.force_and_motion.status;
    console.log(`    Attempt ${attempts}: status=${currentStatus}, masteryState=${lastSubmit.data.learningState.concepts.force_and_motion.masteryState}, confidence=${lastSubmit.data.learningState.concepts.force_and_motion.confidence}`);
  }

  const forceState = lastSubmit.data.learningState.concepts.force_and_motion;
  assert.strictEqual(forceState.status, 'understood');
  assert.strictEqual(forceState.masteryState, 'mastered');
  console.log('  ✓ Successfully demonstrated mastery (status=understood, masteryState=mastered)');

  // Step 7: Ask "What is motion?" -> Must evaluate motion only, NO force leakage
  console.log('\n--- Step 7: Ask "What is motion?" (Cross-concept isolation) ---');
  const chatMotion = await streamChat('What is motion?', 'English', cookieEn);
  const sMotion = chatMotion.finalEvent.structured;
  console.log(`  Identified: topic=${sMotion.currentTopic}, concept=${sMotion.currentConcept}`);
  console.log(`  nextStudy: ${JSON.stringify(sMotion.nextStudy)}`);
  assert.notStrictEqual(sMotion.currentTopic, 'force_and_motion', 'Topic must NOT leak force_and_motion');
  assert.notStrictEqual(sMotion.nextStudy?.topic, 'force_and_motion', 'Next study must NOT leak force_and_motion');
  assert.ok(sMotion.currentTopic === 'motion_basics' || sMotion.conceptId === 'c6_sci_motion_measurement', 'Must resolve motion concept');
  console.log('  ✓ Motion concept isolated, no force_and_motion contamination');

  // Step 8: Ask "What is reproduction?" -> Must evaluate reproduction only
  console.log('\n--- Step 8: Ask "What is reproduction?" (Cross-concept isolation) ---');
  const chatRepro = await streamChat('What is reproduction?', 'English', cookieEn);
  const sRepro = chatRepro.finalEvent.structured;
  console.log(`  Identified: topic=${sRepro.currentTopic}, concept=${sRepro.currentConcept}, conceptId=${sRepro.conceptId}`);
  console.log(`  nextStudy: ${JSON.stringify(sRepro.nextStudy)}`);
  assert.notStrictEqual(sRepro.currentTopic, 'force_and_motion');
  assert.notStrictEqual(sRepro.nextStudy?.topic, 'force_and_motion');
  assert.ok(sRepro.currentTopic.includes('reproduction') || sRepro.conceptId?.includes('reproduction'), 'Must resolve reproduction concept');
  console.log('  ✓ Reproduction concept isolated, no leakage');

  // =========================================================================
  // PART 2: Odia Flow
  // =========================================================================
  console.log('\n========================================');
  console.log('PART 2: Odia Mastery Lifecycle');
  console.log('========================================');

  // Login as fresh student for Odia
  const loginResOd = await postJson('/auth/login', { pin: '1234', studentName: 'MasteryTest_OD' });
  const cookieOd = loginResOd.cookie;
  console.log('  ✓ Authenticated Odia student session');

  // Step 9a: "ବଳ କ'ଣ?"
  console.log('\n--- Step 9a: Ask "ବଳ କ\'ଣ?" ---');
  const chatOdForce = await streamChat('ବଳ କ\'ଣ?', 'Odia', cookieOd);
  const sOdForce = chatOdForce.finalEvent.structured;
  console.log(`  Identified: topic=${sOdForce.currentTopic}, concept=${sOdForce.currentConcept}`);
  console.log(`  nextStudy action=${sOdForce.nextStudy?.action}, state=${sOdForce.nextStudy?.masteryState}`);
  assert.strictEqual(sOdForce.knowledgeFound, true);
  assert.strictEqual(sOdForce.currentTopic, 'force_and_motion');

  // Odia Practice -> Incorrect -> needs_review
  console.log('\n--- Odia Practice and Incorrect Answer ---');
  const pOd = await postJson('/practice/next', { action: sOdForce.nextStudy, language: 'Odia' }, cookieOd);
  const actOd = pOd.data.activity;
  const wrongOdAnswer = actOd.options.find(o => o !== actOd.correctAnswer);
  const subOdWrong = await postJson('/practice/submit', { activity: actOd, studentAnswer: wrongOdAnswer }, cookieOd);
  assert.strictEqual(subOdWrong.data.practiceResult.correct, false);
  assert.strictEqual(subOdWrong.data.nextStudy?.action, 'review');
  assert.strictEqual(subOdWrong.data.learningState.concepts.force_and_motion.status, 'needs_review');
  console.log('  ✓ Odia incorrect answer produced needs_review and review action');

  // Odia Review -> Correct -> Repeated Practice to Mastery
  console.log('\n--- Odia Correct Practice to Mastery ---');
  let currentOdStatus = subOdWrong.data.learningState.concepts.force_and_motion.status;
  let lastOdSubmit = subOdWrong;
  let odAttempts = 0;
  while (currentOdStatus !== 'understood' && odAttempts < 6) {
    odAttempts++;
    const pNextOd = await postJson('/practice/next', {
      action: { action: 'practice', topic: 'force_and_motion', concept: 'inertia_first_law' },
      language: 'Odia'
    }, cookieOd);
    const actNextOd = pNextOd.data.activity;
    lastOdSubmit = await postJson('/practice/submit', { activity: actNextOd, studentAnswer: actNextOd.correctAnswer }, cookieOd);
    currentOdStatus = lastOdSubmit.data.learningState.concepts.force_and_motion.status;
    console.log(`    Odia Attempt ${odAttempts}: status=${currentOdStatus}, masteryState=${lastOdSubmit.data.learningState.concepts.force_and_motion.masteryState}`);
  }

  const forceStateOd = lastOdSubmit.data.learningState.concepts.force_and_motion;
  assert.strictEqual(forceStateOd.status, 'understood');
  assert.strictEqual(forceStateOd.masteryState, 'mastered');
  console.log('  ✓ Odia mastery achieved identically');
  console.log('  ✓ Odia mastery achieved identically');

  // Step 9b: "ଗତି କ'ଣ?" -> Odia motion isolation
  console.log('\n--- Step 9b: Ask "ଗତି କ\'ଣ?" (Odia motion isolation) ---');
  const chatOdMotion = await streamChat('ଗତି କ\'ଣ?', 'Odia', cookieOd);
  const sOdMotion = chatOdMotion.finalEvent.structured;
  console.log(`  Identified: topic=${sOdMotion.currentTopic}, concept=${sOdMotion.currentConcept}`);
  assert.ok(sOdMotion.currentTopic === 'motion_basics' || sOdMotion.conceptId === 'c6_sci_motion_measurement', 'Must resolve motion concept in Odia');
  assert.notStrictEqual(sOdMotion.nextStudy?.topic, 'force_and_motion');
  console.log('  ✓ Odia motion isolated without leakage');

  // Step 9c: "ପ୍ରଜନନ କ'ଣ?" -> Odia reproduction isolation
  console.log('\n--- Step 9c: Ask "ପ୍ରଜନନ କ\'ଣ?" (Odia reproduction isolation) ---');
  const chatOdRepro = await streamChat('ପ୍ରଜନନ କ\'ଣ?', 'Odia', cookieOd);
  const sOdRepro = chatOdRepro.finalEvent.structured;
  console.log(`  Identified: topic=${sOdRepro.currentTopic}, concept=${sOdRepro.currentConcept}`);
  assert.ok(sOdRepro.currentTopic.includes('reproduction') || sOdRepro.conceptId?.includes('reproduction'), 'Must resolve reproduction concept in Odia');
  assert.notStrictEqual(sOdRepro.nextStudy?.topic, 'force_and_motion');
  console.log('  ✓ Odia reproduction isolated without leakage');

  console.log('\n====================================================');
  console.log('🎉 LIVE E2E MASTERY AGENT VERIFICATION COMPLETE ✅');
  console.log('====================================================');
}

run().catch(err => {
  console.error('❌ Live E2E failed:', err);
  process.exit(1);
});

'use strict';

/**
 * End-to-End Live Integration Test for Next-Study Decision Visibility
 * Validates steps A through F on the active running server (http://localhost:3000):
 * A. Ask: "ଗଛ ଦିନବେଳେ ଶ୍ୱାସକ୍ରିୟା କରେ କି?" -> Practice recommendation
 * B. Practice CTA -> /practice/next preserves topic & concept
 * C. Answer incorrectly -> Review CTA with observable decision trace
 * D. Review CTA -> /practice/next fires preserving exact concept
 * E. Unrelated question: "Python କ'ଣ?" -> No stale CTA
 * F. Introduce action -> getIntroduceQuery bridges to tutor pipeline
 */

const assert = require('assert');
const http = require('http');
const { shouldShowPracticeCTA, getIntroduceQuery } = require('../public/scripts/agent');

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

function streamChat(message, language = 'Odia', cookie = null) {
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
              if (parsed.error) console.error('SSE Error event:', parsed.error);
            } catch (_) {}
          }
        }
      });
      res.on('end', () => {
        if (sseData && sseData.trim().startsWith('data: ')) {
          try {
            const parsed = JSON.parse(sseData.trim().slice(6));
            if (parsed.done) finalEvent = parsed;
            if (parsed.error) console.error('SSE Error event on end:', parsed.error);
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
  console.log('🚀 LIVE AGENT NEXT-STUDY E2E VERIFICATION (A-F)');
  console.log('====================================================');

  // 0. Authenticate as student PIN 1234
  console.log('\n--- Step 0: Student Login ---');
  const loginRes = await postJson('/auth/login', { pin: '1234', studentName: 'TestStudent' });
  assert.strictEqual(loginRes.status, 200, 'Login must return 200');
  const sessionCookie = loginRes.cookie;
  console.log('  ✓ Logged in as student with cookie:', sessionCookie?.slice(0, 30));

  // Step A: Ask Odia plant respiration question
  console.log('\n--- Step A: Ask "ଗଛ ଦିନବେଳେ ଶ୍ୱାସକ୍ରିୟା କରେ କି?" ---');
  const chatRes = await streamChat('ଗଛ ଦିନବେଳେ ଶ୍ୱାସକ୍ରିୟା କରେ କି?', 'Odia', sessionCookie);
  console.log('chatRes.finalEvent:', chatRes.finalEvent);
  assert.ok(chatRes.finalEvent, 'SSE stream must return final event');
  const structuredA = chatRes.finalEvent.structured;
  assert.ok(structuredA, 'Structured data must exist');
  console.log('  Reply:', chatRes.finalEvent.reply?.slice(0, 80) + '...');
  console.log('  topic:', structuredA.currentTopic);
  console.log('  concept:', structuredA.currentConcept);
  console.log('  knowledgeFound:', structuredA.knowledgeFound);
  console.log('  nextStudy:', JSON.stringify(structuredA.nextStudy));

  assert.strictEqual(structuredA.knowledgeFound, true, 'knowledgeFound must be true');
  assert.strictEqual(structuredA.currentTopic, 'respiration', 'Topic must be respiration');
  assert.strictEqual(structuredA.currentConcept, 'plant_respiration', 'Concept must be plant_respiration');
  assert.strictEqual(shouldShowPracticeCTA(structuredA), true, 'Practice CTA guard must be true');
  console.log('  ✓ Answer appears and Practice CTA is visible to student');

  // Step B: Student clicks Practice CTA -> POST /practice/next
  console.log('\n--- Step B: Student clicks Practice CTA ---');
  const practiceRes = await postJson('/practice/next', {
    action: structuredA.nextStudy,
    language: 'Odia'
  }, sessionCookie);
  assert.strictEqual(practiceRes.status, 200, '/practice/next must return 200');
  const activity = practiceRes.data.activity;
  assert.ok(activity, 'Activity must be returned');
  assert.strictEqual(activity.topic, 'respiration');
  assert.strictEqual(activity.concept, 'plant_respiration');
  assert.ok(activity.question, 'Question must exist');
  assert.ok(Array.isArray(activity.options), 'Options must be an array');
  console.log('  Activity question:', activity.question);
  console.log('  Activity topic/concept:', activity.topic, '/', activity.concept);
  console.log('  ✓ /practice/next preserves topic & concept, inline MCQ opens');

  // Step C: Student answers INCORRECTLY
  console.log('\n--- Step C: Student answers incorrectly ---');
  const wrongOption = activity.options.find(opt => opt !== activity.correctAnswer);
  assert.ok(wrongOption, 'Wrong option must exist');
  const submitRes = await postJson('/practice/submit', {
    activity,
    studentAnswer: wrongOption
  }, sessionCookie);
  assert.strictEqual(submitRes.status, 200, '/practice/submit must return 200');
  const submitData = submitRes.data;
  console.log('  practiceResult.correct:', submitData.practiceResult.correct);
  console.log('  practiceResult.evidence:', submitData.practiceResult.evidence);
  console.log('  nextStudy:', JSON.stringify(submitData.nextStudy));

  assert.strictEqual(submitData.practiceResult.correct, false, 'Result must be incorrect');
  assert.strictEqual(submitData.practiceResult.evidence, 'practice_incorrect', 'Evidence must be practice_incorrect');
  assert.strictEqual(submitData.nextStudy.action, 'review', 'Next study action must be review');
  assert.strictEqual(submitData.nextStudy.topic, 'respiration', 'Next study topic must be respiration');
  assert.strictEqual(submitData.nextStudy.concept, 'plant_respiration', 'Next study concept must be plant_respiration');
  assert.strictEqual(submitData.nextStudy.reason, 'practice_incorrect', 'Reason must be practice_incorrect');

  const reviewGuardState = {
    knowledgeFound: true,
    currentTopic: activity.topic,
    currentConcept: activity.concept,
    nextStudy: submitData.nextStudy
  };
  assert.strictEqual(shouldShowPracticeCTA(reviewGuardState), true, 'Review CTA must be visible to student');
  console.log('  ✓ Incorrect feedback displayed, state becomes needs_review, Review CTA is now visible');

  // Step D: Student clicks Review CTA -> /practice/next
  console.log('\n--- Step D: Student clicks Review CTA ---');
  const reviewRes = await postJson('/practice/next', {
    action: { action: 'review', topic: submitData.nextStudy.topic, concept: submitData.nextStudy.concept },
    language: 'Odia'
  }, sessionCookie);
  assert.strictEqual(reviewRes.status, 200, '/practice/next for review must succeed');
  const reviewActivity = reviewRes.data.activity;
  assert.strictEqual(reviewActivity.topic, 'respiration');
  assert.strictEqual(reviewActivity.concept, 'plant_respiration');
  console.log('  Review Activity topic/concept:', reviewActivity.topic, '/', reviewActivity.concept);
  console.log('  ✓ /practice/next fires with exact topic/concept preserved, targeted review practice appears');

  // Step E: Student asks an unrelated question "Python କ'ଣ?"
  console.log('\n--- Step E: Ask unrelated question "Python କ\'ଣ?" ---');
  const pyChatRes = await streamChat('Python କ\'ଣ?', 'Odia', sessionCookie);
  assert.ok(pyChatRes.finalEvent, 'SSE stream must return final event');
  const structuredPy = pyChatRes.finalEvent.structured;
  console.log('  Python knowledgeFound:', structuredPy?.knowledgeFound);
  console.log('  Python currentTopic:', structuredPy?.currentTopic);
  console.log('  Python currentConcept:', structuredPy?.currentConcept);
  console.log('  shouldShowPracticeCTA(structuredPy):', shouldShowPracticeCTA(structuredPy));

  assert.strictEqual(structuredPy.knowledgeFound, false, 'knowledgeFound must be false for Python');
  assert.strictEqual(shouldShowPracticeCTA(structuredPy), false, 'CTA must be suppressed for unrelated query');
  console.log('  ✓ Stale review/practice CTA is suppressed for unrelated question');

  // Step F: Introduce action
  console.log('\n--- Step F: Introduce flow verification ---');
  const introduceStructured = {
    knowledgeFound: true,
    currentTopic: 'photosynthesis',
    currentConcept: 'oxygen_role',
    nextStudy: { action: 'introduce', topic: 'photosynthesis', concept: 'oxygen_role', reason: 'unexplored_topic' }
  };
  assert.strictEqual(shouldShowPracticeCTA(introduceStructured), true, 'Introduce CTA must be visible');
  const introQuery = getIntroduceQuery('photosynthesis', 'oxygen_role', true);
  console.log('  Generated Introduce Query:', introQuery);
  assert.ok(introQuery.includes('ଆଲୋକ ସଂଶ୍ଳେଷଣ') && introQuery.includes('ଅମ୍ଳଜାନ'), 'Query must target exact topic and concept');

  const introChatRes = await streamChat(introQuery, 'Odia', sessionCookie);
  assert.ok(introChatRes.finalEvent, 'Tutor must answer introduce query');
  const structuredIntro = introChatRes.finalEvent.structured;
  console.log('  Tutor answer length:', introChatRes.finalEvent.reply?.length);
  console.log('  Tutor identifiedTopic:', structuredIntro?.currentTopic);
  console.log('  Tutor identifiedConcept:', structuredIntro?.currentConcept);
  assert.strictEqual(structuredIntro?.currentTopic, 'photosynthesis');
  assert.strictEqual(structuredIntro?.currentConcept, 'oxygen_role');
  console.log('  ✓ Introduce CTA triggers concise explanation reusing tutor pipeline for exact topic/concept');

  console.log('\n====================================================');
  console.log('🎉 ALL E2E FLOWS (A - F) VERIFIED SUCCESSFULLY!');
  console.log('====================================================');
}

run().catch(err => {
  console.error('❌ E2E Verification failed:', err);
  process.exit(1);
});

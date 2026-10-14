'use strict';
require('dotenv').config();

const http = require('http');
const express = require('express');
const session = require('express-session');
const chatRouter = require('../routes/chat');
const { llmProvider } = require('../lib/llmProvider');

async function runLiveAcceptance() {
  console.log('====================================================');
  console.log('🚀 LIVE ACCEPTANCE TESTS (OFFLINE-FIRST + ONLINE RECONNECT)');
  console.log('====================================================\n');

  const app = express();
  app.use(express.json());
  app.use(session({
    secret: 'test-secret-acceptance',
    resave: false,
    saveUninitialized: true
  }));

  // Mock authenticated student session
  app.use((req, res, next) => {
    req.session.role = 'student';
    req.session.studentId = 'student_live_test';
    req.session.studentName = 'Live Student';
    next();
  });

  app.use(chatRouter);

  const PORT = 3003;
  const server = app.listen(PORT);
  console.log(`Test Express server running on port ${PORT}\n`);

  function sendChatRequest(body, cookie = null) {
    return new Promise((resolve, reject) => {
      const data = JSON.stringify(body);
      const headers = {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(data)
      };
      if (cookie) headers['Cookie'] = cookie;

      const req = http.request({
        hostname: 'localhost',
        port: PORT,
        path: '/chat',
        method: 'POST',
        headers
      }, (res) => {
        let setCookie = res.headers['set-cookie'];
        if (Array.isArray(setCookie)) setCookie = setCookie.map(c => c.split(';')[0]).join('; ');

        let raw = '';
        const events = [];
        res.on('data', chunk => {
          raw += chunk.toString();
          const lines = raw.split('\n');
          raw = lines.pop(); // keep remainder
          for (const line of lines) {
            const trimmed = line.trim();
            if (trimmed.startsWith('data: ')) {
              try {
                const parsed = JSON.parse(trimmed.slice(6));
                events.push(parsed);
              } catch (_) {}
            }
          }
        });

        res.on('end', () => {
          resolve({ status: res.statusCode, events, cookie: setCookie });
        });
      });

      req.on('error', reject);
      req.write(data);
      req.end();
    });
  }

  // Intercept console.log to capture exact logs
  const capturedLogs = [];
  const originalLog = console.log;
  const originalWarn = console.warn;
  const originalError = console.error;

  function startLogCapture() {
    capturedLogs.length = 0;
    console.log = (...args) => {
      originalLog(...args);
      capturedLogs.push(args.map(a => (typeof a === 'object' ? JSON.stringify(a) : String(a))).join(' '));
    };
    console.warn = (...args) => {
      originalWarn(...args);
      capturedLogs.push('[WARN] ' + args.map(a => (typeof a === 'object' ? JSON.stringify(a) : String(a))).join(' '));
    };
    console.error = (...args) => {
      originalError(...args);
      capturedLogs.push('[ERROR] ' + args.map(a => (typeof a === 'object' ? JSON.stringify(a) : String(a))).join(' '));
    };
  }

  function getCapturedLogs() {
    return capturedLogs.join('\n');
  }

  function stopLogCapture() {
    console.log = originalLog;
    console.warn = originalWarn;
    console.error = originalError;
  }

  try {
    // ----------------------------------------------------
    // TEST A: Odia Photosynthesis (INTERNET OFF)
    // ----------------------------------------------------
    console.log('\n--- TEST A: Odia "Explain photosynthesis simply" (INTERNET OFF) ---');
    // Simulate offline network error
    process.env.ONLINE_LLM_BASE_URL = 'https://api.groq.com.offline-sim/openai/v1';
    llmProvider.onlineBaseUrl = 'https://api.groq.com.offline-sim/openai/v1';

    startLogCapture();
    const t0 = Date.now();
    const resA = await sendChatRequest({
      message: 'Explain photosynthesis simply',
      language: 'Odia',
      level: 'beginner'
    });
    const durA = ((Date.now() - t0) / 1000).toFixed(2);
    stopLogCapture();
    const logsA = getCapturedLogs();

    console.log(`Test A duration: ${durA}s`);
    const doneEventA = resA.events.find(e => e.type === 'done');
    console.log('Test A Done Event Meta:', {
      provider: doneEventA?.provider,
      validation_result: doneEventA?.validation_result,
      fallback_used: doneEventA?.fallback_used,
      concept: doneEventA?.mastery?.concept,
      action: doneEventA?.mastery?.action
    });

    // Verify:
    const groqAttemptCountA = (logsA.match(/api\.groq\.com/g) || []).length;
    console.log('api.groq.com mention count in logs:', groqAttemptCountA);
    const onlineProbeMatchesA = logsA.match(/online_available=unknown/g) || [];
    const onlineFailMatchesA = logsA.match(/online_available=false/g) || [];
    console.log('Online probes:', onlineProbeMatchesA.length, 'Online failures marked:', onlineFailMatchesA.length);
    console.log('Includes Ollama routing reason=online_unavailable:', logsA.includes('reason=online_unavailable'));

    // Check learning state
    const lsA = doneEventA?.learningState;
    console.log('Learning state status:', lsA?.status);
    console.log('Learning state evidence:', lsA?.evidence);

    if (groqAttemptCountA > 3) {
      console.error('❌ Repeated Groq network attempts detected!');
    } else {
      console.log('✅ No repeated online attempts. Handled via requestScope.');
    }

    if (lsA?.evidence?.includes('fallback_used')) {
      console.error('❌ fallback_used is in learning evidence!');
    } else {
      console.log('✅ fallback_used is NOT in learning evidence.');
    }

    if (lsA?.status === 'needs_review') {
      console.error('❌ Status became needs_review incorrectly!');
    } else {
      console.log(`✅ Status is "${lsA?.status}" (not needs_review).`);
    }

    // ----------------------------------------------------
    // TEST B: Odia "ଆକାଶଗଙ୍ଗା କ’ଣ?" (INTERNET OFF)
    // ----------------------------------------------------
    console.log('\n--- TEST B: Odia "ଆକାଶଗଙ୍ଗା କ’ଣ?" (INTERNET OFF) ---');
    startLogCapture();
    const t0B = Date.now();
    const resB = await sendChatRequest({
      message: 'ଆକାଶଗଙ୍ଗା କ’ଣ?',
      language: 'Odia',
      level: 'beginner'
    });
    const durB = ((Date.now() - t0B) / 1000).toFixed(2);
    stopLogCapture();
    const logsB = getCapturedLogs();

    console.log(`Test B duration: ${durB}s`);
    const doneEventB = resB.events.find(e => e.type === 'done');
    console.log('Test B Done Event Meta:', {
      provider: doneEventB?.provider,
      concept: doneEventB?.mastery?.concept,
      action: doneEventB?.mastery?.action
    });
    console.log('Test B provider used:', doneEventB?.provider);

    // ----------------------------------------------------
    // TEST C: English "What is gravity?" (INTERNET OFF)
    // ----------------------------------------------------
    console.log('\n--- TEST C: English "What is gravity?" (INTERNET OFF) ---');
    startLogCapture();
    const t0C = Date.now();
    const resC = await sendChatRequest({
      message: 'What is gravity?',
      language: 'English',
      level: 'beginner'
    });
    const durC = ((Date.now() - t0C) / 1000).toFixed(2);
    stopLogCapture();
    const logsC = getCapturedLogs();

    console.log(`Test C duration: ${durC}s`);
    const doneEventC = resC.events.find(e => e.type === 'done');
    console.log('Test C provider used:', doneEventC?.provider);
    console.log('Contains request sizing telemetry:');
    const sizingMatch = logsC.split('\n').filter(l => l.includes('[Request Sizing]') || l.includes('prompt_size'));
    console.log(sizingMatch.join('\n'));
    if (logsC.includes('reason=online_request_too_large')) {
      console.error('❌ Test C was misclassified as online_request_too_large!');
    } else {
      console.log('✅ Tiny English question was NOT misclassified as online_request_too_large.');
    }

    // ----------------------------------------------------
    // TEST D: Reconnect Online (INTERNET ON)
    // ----------------------------------------------------
    console.log('\n--- TEST D: Reconnect Online (INTERNET ON) ---');
    process.env.ONLINE_LLM_BASE_URL = 'https://api.groq.com/openai/v1';
    llmProvider.onlineBaseUrl = 'https://api.groq.com/openai/v1';

    startLogCapture();
    const t0D = Date.now();
    const resD = await sendChatRequest({
      message: 'What is cell theory?',
      language: 'English',
      level: 'beginner'
    });
    const durD = ((Date.now() - t0D) / 1000).toFixed(2);
    stopLogCapture();
    const logsD = getCapturedLogs();

    console.log(`Test D duration: ${durD}s`);
    const doneEventD = resD.events.find(e => e.type === 'done');
    console.log('Test D provider used:', doneEventD?.provider);
    console.log('Test D online attempted:', logsD.includes('[Provider Routing]\nonline_available=unknown') || logsD.includes('provider=online'));

    if (doneEventD?.provider === 'online') {
      console.log('✅ Online provider reconnected and successfully answered the request!');
    } else {
      console.log(`ℹ️ Provider used: ${doneEventD?.provider}`);
    }

    console.log('\n====================================================');
    console.log('🎉 ALL LIVE ACCEPTANCE CHECKS FINISHED!');
    console.log('====================================================');

  } catch (err) {
    console.error('Acceptance test failed with error:', err);
  } finally {
    server.close();
  }
}

runLiveAcceptance().catch(console.error);

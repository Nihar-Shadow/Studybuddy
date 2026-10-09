// ── Socratic Route ───────────────────────────────
// POST /socratic — Guided-discovery dialogue via Socratic questioning

const express = require('express');
const router  = express.Router();

const { runSocraticAgent } = require('../agent/agentLoop');
const { flowTraces }       = require('../middleware/devTiming');
const { requireAuth }      = require('./auth');

router.use(requireAuth);

router.post('/socratic', async (req, res) => {
  const socStart = Date.now();
  const steps    = [];
  const mark     = (name, detail) => steps.push({ name, ms: Date.now() - socStart, detail });

  const { message, level, language, history, turn } = req.body;
  if (!message) return res.status(400).json({ error: 'message is required' });

  console.log(`\n⏱  [/socratic] Started — level: ${level || 'intermediate'}, lang: ${language || 'English'}, turn: ${turn || '?'}, prompt: "${(message || '').slice(0, 60)}…"`);
  mark('Received request', `level=${level || 'intermediate'}, lang=${language || 'English'}, turn=${turn || '?'}, history=${(history || []).length} msgs`);

  try {
    const result = await runSocraticAgent(message, level || 'intermediate', history || [], turn, language, req.session?.studentId || null, req.session?.studentName || null);
    mark('Socratic agent done', `turn=${result?.structured?.agentSummary || '?'}`);

    const socMs = Date.now() - socStart;
    console.log(`✅ [/socratic] Done in ${(socMs / 1000).toFixed(2)}s`);

    // Store flow trace for dev panel
    flowTraces['/socratic'] = {
      route: '/socratic', ts: Date.now(), totalMs: socMs, status: 'ok',
      input: (message || '').slice(0, 80), steps
    };

    res.json(result);
  } catch (err) {
    const socMs = Date.now() - socStart;
    mark('ERROR', err.message);
    flowTraces['/socratic'] = {
      route: '/socratic', ts: Date.now(), totalMs: socMs, status: 'error',
      input: (message || '').slice(0, 80), steps
    };
    console.error(`❌ [/socratic] Error after ${(socMs / 1000).toFixed(2)}s:`, err.message);
    res.status(500).json({ success: false, rawReply: 'Socratic agent error: ' + err.message });
  }
});

module.exports = router;

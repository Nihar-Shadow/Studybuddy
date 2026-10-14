// ── Agent Route ──────────────────────────────────
// POST /agent — Main agentic endpoint

const express = require('express');
const router  = express.Router();

const { runAgentLoop, runParallelAgent } = require('../agent/agentLoop');
const { isOdia, containsOdiaScript } = require('../lib/languagePolicy');
const { saveChatMessage } = require('../agent/progressStore');
const { requireAuth } = require('./auth');

router.use(requireAuth);

router.post('/agent', async (req, res) => {
  const { message, level, language, history, fast } = req.body;

  if (!message) {
    return res.status(400).json({ error: 'message is required' });
  }

  const isOdiaReq = isOdia(language) || containsOdiaScript(message);
  const effectiveLanguage = isOdiaReq ? 'Odia' : (language || 'English');
  console.log(`[Diagnostic: Request] /agent request received - Selected: "${language || 'English'}", Effective: "${effectiveLanguage}", Prompt: "${(message || '').slice(0, 60)}"`);

  const studentId   = req.session?.studentId   || null;
  const studentName = req.session?.studentName || null;

  try {
    // Use parallel agent by default (fast: true), fall back to sequential if needed
    const result = fast === false
      ? await runAgentLoop(message, level || 'intermediate', history || [], null, effectiveLanguage, studentId, studentName)
      : await runParallelAgent(message, level || 'intermediate', history || [], effectiveLanguage, studentId, studentName);

    if (result && result.rawReply && studentId) {
      try {
        saveChatMessage(studentId, { role: 'user', content: message });
        saveChatMessage(studentId, { role: 'assistant', content: result.rawReply });
      } catch (e) {
        console.warn('[/agent] Failed to save chat message:', e.message);
      }
    }

    res.json(result);
  } catch (err) {
    res.status(500).json({
      success:  false,
      rawReply: 'Agent error: ' + err.message,
      structured: null,
      toolCallLog: []
    });
  }
});

module.exports = router;

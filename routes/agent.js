// ── Agent Route ──────────────────────────────────
// POST /agent — Main agentic endpoint

const express = require('express');
const router  = express.Router();

const { runAgentLoop, runParallelAgent } = require('../agent/agentLoop');
const { requireAuth } = require('./auth');

router.use(requireAuth);

router.post('/agent', async (req, res) => {
  const { message, level, language, history, fast } = req.body;

  if (!message) {
    return res.status(400).json({ error: 'message is required' });
  }

  const studentId   = req.session?.studentId   || null;
  const studentName = req.session?.studentName || null;

  try {
    // Use parallel agent by default (fast: true), fall back to sequential if needed
    const result = fast === false
      ? await runAgentLoop(message, level || 'intermediate', history || [], null, language, studentId, studentName)
      : await runParallelAgent(message, level || 'intermediate', history || [], language, studentId, studentName);
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

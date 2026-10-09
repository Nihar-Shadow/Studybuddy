// ── Concept Map Route ────────────────────────────
// POST /concept-map — Generates a JSON concept map (nodes + edges)

const express = require('express');
const router  = express.Router();

const { toolImplementations } = require('../agent/tools');
const { flowTraces }          = require('../middleware/devTiming');
const { requireAuth }         = require('./auth');

router.use(requireAuth);

router.post('/concept-map', async (req, res) => {
  const mapStart = Date.now();
  const steps = [];
  const mark = (name, detail) => steps.push({ name, ms: Date.now() - mapStart, detail });

  const { topic, level } = req.body;
  console.log(`\n⏱  [/concept-map] Started — topic: "${topic}", level: ${level || 'intermediate'}`);
  if (!topic) return res.status(400).json({ error: 'topic is required' });
  mark('Validate input', `topic="${topic}", level=${level || 'intermediate'}`);

  try {
    const result = await toolImplementations.generate_concept_map({
      topic,
      level: level || 'intermediate'
    });
    mark('generate_concept_map tool', `nodes=${result?.nodes?.length || 0}, edges=${result?.edges?.length || 0}`);

    const mapMs = Date.now() - mapStart;
    console.log(`✅ [/concept-map] Done in ${(mapMs / 1000).toFixed(2)}s — nodes: ${result?.nodes?.length || '?'}, edges: ${result?.edges?.length || '?'}`);
    res.json(result);
    mark('Send response');

    flowTraces['/concept-map'] = {
      route: '/concept-map', ts: Date.now(), totalMs: mapMs, status: 'ok',
      input: `${topic} (${level || 'intermediate'})`, steps
    };
  } catch (err) {
    const mapMs = Date.now() - mapStart;
    mark('ERROR', err.message);
    flowTraces['/concept-map'] = {
      route: '/concept-map', ts: Date.now(), totalMs: mapMs, status: 'error',
      input: `${topic} (${level || 'intermediate'})`, steps
    };
    console.error(`❌ [/concept-map] Error after ${(mapMs / 1000).toFixed(2)}s:`, err.message);
    res.status(500).json({ success: false, error: err.message });
  }
});

module.exports = router;

// ── Dev & Utility Routes ─────────────────────────
// /dev/metrics, /dev/flow-traces, /cache-stats, /pwa-status, /cache, /topics/search

const express = require('express');
const router  = express.Router();

const { IS_DEV, devMetrics, flowTraces } = require('../middleware/devTiming');
const { getCacheStats, searchTopics, clearAll: clearSmartCache } = require('../agent/smartCache');
const { getParseMetrics } = require('../lib/parseJSON');

// ─── Cache endpoints ────────────────────────────
router.get('/cache-stats', (req, res) => {
  res.json(getCacheStats());
});

// ─── PWA Status endpoint (debugging) ────────────────────────────
router.get('/pwa-status', (req, res) => {
  res.json({
    pwaReady: true,
    serviceWorkerUrl: '/sw.js',
    manifestUrl: '/manifest.json',
    icons: {
      '192': '/assets/icon-192.png',
      '512': '/assets/icon-512.png',
      'maskable': '/assets/icon-maskable.png'
    },
    cacheVersion: 'studybuddy-v2',
    timestamp: new Date().toISOString(),
    environment: IS_DEV ? 'development' : 'production',
    message: 'PWA assets are ready. Service Worker can be registered.'
  });
});

router.delete('/cache', (req, res) => {
  clearSmartCache();
  res.json({ success: true, message: 'All cache layers cleared' });
});

// NEW: topic autocomplete endpoint (uses Trie)
router.get('/topics/search', (req, res) => {
  const prefix  = (req.query.q || '').toLowerCase();
  const results = searchTopics(prefix);
  res.json({ prefix, results, count: results.length });
});

// ── Dev metrics API ────────────────────────────────────
// Only available in dev mode. Returns aggregated benchmark data.
if (IS_DEV) {
  router.get('/dev/metrics', (req, res) => {
    const now      = Date.now();
    const window   = 60 * 1000;   // last 60 seconds
    const recent   = devMetrics.requests.filter(r => now - r.ts < window);

    // Aggregate by route — last time, avg time, call count
    const byRoute  = {};
    for (const r of recent) {
      if (!byRoute[r.route]) {
        byRoute[r.route] = { route: r.route, times: [], errors: 0, cacheHits: 0 };
      }
      byRoute[r.route].times.push(r.ms);
      if (r.status >= 400) byRoute[r.route].errors++;
      if (r.cached)        byRoute[r.route].cacheHits++;
    }

    const routes = Object.values(byRoute).map(r => ({
      route:     r.route,
      last:      r.times[r.times.length - 1],
      avg:       Math.round(r.times.reduce((a, b) => a + b, 0) / r.times.length),
      min:       Math.min(...r.times),
      max:       Math.max(...r.times),
      count:     r.times.length,
      errors:    r.errors,
      cacheHits: r.cacheHits
    }));

    // Last agent call tool breakdown
    const lastAgent = [...devMetrics.requests]
      .reverse()
      .find(r => r.route === '/agent' && r.toolLog);

    const toolBreakdown = lastAgent?.toolLog?.map(t => ({
      tool:   t.tool,
      ms:     t.result?._ms || null,   // populated if tools report timing
      cached: t.result?.cached || false
    })) || [];

    // Check Ollama models — fire-and-forget HEAD requests
    const cacheStats = getCacheStats();

    res.json({
      uptime:        Math.round((now - devMetrics.startedAt) / 1000),
      totalRequests: devMetrics.requests.length,
      totalErrors:   devMetrics.errors,
      totalCacheHits:devMetrics.cacheHits,
      lastRequestMs: devMetrics.requests.length
                     ? devMetrics.requests[devMetrics.requests.length - 1].ms
                     : null,
      routes,
      toolBreakdown,
      cache:         cacheStats,   // add smart cache statistics
      parseMetrics:  getParseMetrics(),  // JSON parse repair method stats
      timestamp:     now
    });
  });

  // Reset metrics endpoint
  router.delete('/dev/metrics', (req, res) => {
    devMetrics.requests   = [];
    devMetrics.errors     = 0;
    devMetrics.cacheHits  = 0;
    devMetrics.startedAt  = Date.now();
    res.json({ success: true });
  });

  // ── Flow Traces API ──────────────────────────────
  // Returns the last request's step-by-step timing for each instrumented route
  router.get('/dev/flow-traces', (req, res) => {
    res.json(flowTraces);
  });
}

module.exports = router;

// ── Dev Timing Middleware ─────────────────────────
// Only active in development. Tracks timing for every route.
// Stored in memory — resets on server restart.

const IS_DEV = process.env.NODE_ENV !== 'production';

const devMetrics = {
  requests:   [],       // { route, ms, status, ts, cached, toolLog }
  errors:     0,
  cacheHits:  0,
  startedAt:  Date.now()
};

// Stores the last request's step-by-step timing for each route type.
// Each trace: { route, ts, totalMs, status, steps: [{ name, ms, detail? }] }
const flowTraces = {};  // keyed by route e.g. '/chat', '/quiz', '/concept-map'

// Middleware — times every request and stores result
function devTimingMiddleware(req, res, next) {
  if (!IS_DEV) return next();

  const start      = Date.now();
  const origJson   = res.json.bind(res);
  let   captured   = null;

  // Intercept res.json to capture response body
  res.json = function(body) {
    captured = body;
    return origJson(body);
  };

  res.on('finish', () => {
    const ms     = Date.now() - start;
    const cached = captured?.structured !== undefined
                   ? (ms < 100)           // agent: cached if <100ms
                   : false;

    if (cached) devMetrics.cacheHits++;
    if (res.statusCode >= 400) devMetrics.errors++;

    devMetrics.requests.push({
      route:    req.path,
      method:   req.method,
      ms,
      status:   res.statusCode,
      ts:       Date.now(),
      cached,
      toolLog:  captured?.toolCallLog || null
    });

    // Keep only last 200 entries
    if (devMetrics.requests.length > 200) {
      devMetrics.requests = devMetrics.requests.slice(-200);
    }
  });

  next();
}

module.exports = { IS_DEV, devMetrics, flowTraces, devTimingMiddleware };

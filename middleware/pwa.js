// ── PWA Middleware ────────────────────────────────
// Set correct MIME types and cache headers for PWA assets

function pwaMimeMiddleware(req, res, next) {
  if (req.path === '/manifest.json') {
    res.type('application/manifest+json');
    res.set('Cache-Control', 'public, max-age=3600');
  }
  if (req.path === '/sw.js') {
    res.type('application/javascript');
    res.set('Cache-Control', 'no-cache, no-store, must-revalidate');
    res.set('Service-Worker-Allowed', '/');
  }
  next();
}

module.exports = { pwaMimeMiddleware };

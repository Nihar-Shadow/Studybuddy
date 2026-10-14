// ── StudyBuddy — Server Entry Point ──────────────
// Wires together middleware, routes, and starts the Express server.

require('dotenv').config();
process.env.OLLAMA_KEEP_ALIVE = process.env.OLLAMA_KEEP_ALIVE || '60m';

const express    = require('express');
const session    = require('express-session');
const compression = require('compression');
const path       = require('path');
const fs         = require('fs');
const crypto     = require('crypto');

// ── Startup security validation ──
// In production, refuse to start with default PINs or a missing SESSION_SECRET.
// In dev, warn loudly and synthesize a random session secret so HMR doesn't break.
const IS_PROD = process.env.NODE_ENV === 'production';
const DEFAULT_PINS = new Set(['1234', '9999']);

if (IS_PROD) {
  const errors = [];
  if (!process.env.SESSION_SECRET) {
    errors.push('SESSION_SECRET is required in production');
  }
  if (!process.env.STUDENT_PIN || DEFAULT_PINS.has(process.env.STUDENT_PIN)) {
    errors.push('STUDENT_PIN must be set to a non-default value (not 1234)');
  }
  if (!process.env.TEACHER_PIN || DEFAULT_PINS.has(process.env.TEACHER_PIN)) {
    errors.push('TEACHER_PIN must be set to a non-default value (not 9999)');
  }
  if ((process.env.TEACHER_PIN || '').length < 6) {
    errors.push('TEACHER_PIN must be at least 6 characters in production');
  }
  if (errors.length) {
    console.error('\n❌ Startup blocked — fix these before running with NODE_ENV=production:');
    for (const e of errors) console.error('   • ' + e);
    process.exit(1);
  }
}

// Synthesize an ephemeral SESSION_SECRET for dev so we never sign with a known string.
const SESSION_SECRET = process.env.SESSION_SECRET || (() => {
  const generated = crypto.randomBytes(32).toString('hex');
  console.warn('[security] SESSION_SECRET not set — using a random per-process secret. Sessions will not survive restart.');
  return generated;
})();

// ── Middleware ──
const { IS_DEV, devTimingMiddleware }  = require('./middleware/devTiming');
const { pwaMimeMiddleware }            = require('./middleware/pwa');
const { multerErrorHandler }           = require('./middleware/upload');

// ── Routes ──
const { router: authRoutes, requireTeacher, requireAuth } = require('./routes/auth');
const chatRoutes       = require('./routes/chat');
const quizRoutes       = require('./routes/quiz');
const agentRoutes      = require('./routes/agent');
const socraticRoutes   = require('./routes/socratic');
const conceptMapRoutes = require('./routes/conceptMap');
const progressRoutes   = require('./routes/progress');
const adminRoutes      = require('./routes/admin');
const devRoutes        = require('./routes/dev');

const app = express();

// ── Performance: Enable gzip compression ──
// Compresses all responses >1KB, reduces bandwidth by ~70%
// IMPORTANT: SSE / streaming endpoints must be excluded — compression
// buffers small chunks, preventing real-time token delivery to the client
const SSE_PATHS = ['/chat', '/api/events'];
app.use(compression({
  level: 6,
  threshold: 1024,
  filter: (req, res) => {
    if (req.headers['x-no-compression']) return false;
    // Never compress streaming SSE endpoints
    if (SSE_PATHS.includes(req.path)) return false;
    return compression.filter(req, res);
  }
}));

app.use(express.json());

// ── Session middleware (PIN auth for student/teacher roles) ──
app.use(session({
  secret:            SESSION_SECRET,
  resave:            false,
  saveUninitialized: false,
  cookie: {
    maxAge:   24 * 60 * 60 * 1000,   // 24 hours
    httpOnly: true,
    secure:   false,                  // HTTP-only local server — never HTTPS, so secure must be false
    sameSite: 'lax'
  }
}));

// ── Auth routes (login, logout, me) — must be before static files ──
app.use(authRoutes);

// ── Dev timing middleware (tracks request timing in dev mode) ──
app.use(devTimingMiddleware);

// Block devpanel.js in production — return an empty no-op script so the
// browser cache is overwritten and the panel never initialises.
app.get('/devpanel.js', (req, res, next) => {
  if (!IS_DEV) {
    res.set({
      'Content-Type':  'application/javascript',
      'Cache-Control': 'no-store, no-cache, must-revalidate',
      'Pragma':        'no-cache',
      'Expires':       '0',
    });
    // Return an empty IIFE — overwrites any cached copy instantly
    return res.send('/* devpanel disabled in production */');
  }
  next();
});

// ─────────────────────────────────────────────────
// SEMANTIC ROUTES — login-first startup flow
// ─────────────────────────────────────────────────

// Root: redirect based on session role, or to login if unauthenticated
app.get('/', (req, res) => {
  if (!req.session || !req.session.role) return res.redirect('/login');
  if (req.session.role === 'teacher')    return res.redirect('/teacher');
  return res.redirect('/app');
});

// /login — serve login page (always accessible)
app.get('/login', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'login.html'));
});

// /app — student app (requires authenticated student or teacher)
app.get('/app', (req, res, next) => {
  if (!req.session || !req.session.role) return res.redirect('/login');
  const indexPath = path.join(__dirname, 'public', 'index.html');

  // In dev mode, inject the dev panel
  if (IS_DEV) {
    fs.readFile(indexPath, 'utf8', (err, data) => {
      if (err) return res.status(500).send('Error loading page');
      data = data.replace(
        '</body>',
        '<script>(function(){var s=document.createElement("script");s.src="/devpanel.js";s.async=true;document.head.appendChild(s);})();</script></body>'
      );
      res.setHeader('Content-Type', 'text/html; charset=utf-8');
      res.send(data);
    });
  } else {
    res.sendFile(indexPath);
  }
});

// /teacher — teacher dashboard (requires teacher role)
app.get('/teacher', requireTeacher, (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'teacher.html'));
});

// /taxonomy-admin — taxonomy admin panel (requires teacher role)
app.get('/taxonomy-admin', requireTeacher, (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'taxonomy-admin.html'));
});

// /teacher/reports — student PDF report generator (requires teacher role)
app.get('/teacher/reports', requireTeacher, (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'reports.html'));
});

// Inject dev panel into other HTML responses (dev mode only)
if (IS_DEV) {
  app.use((req, res, next) => {
    const origSend = res.send?.bind(res);

    res.send = function(data) {
      if (
        typeof data === 'string' &&
        data.includes('</body>') &&
        res.getHeader('content-type')?.includes('text/html')
      ) {
        data = data.replace(
          '</body>',
          '<script>(function(){var s=document.createElement("script");s.src="/devpanel.js";s.async=true;document.head.appendChild(s);})();</script></body>'
        );
      }
      return origSend(data);
    };
    next();
  });
}

// ── PWA middleware (MIME types and cache headers) ──
app.use(pwaMimeMiddleware);

// ── Block direct access to protected HTML files ──
// Forces users through semantic routes which have auth guards
app.get('/index.html', (req, res) => res.redirect('/app'));
app.get('/teacher.html', (req, res) => res.redirect('/teacher'));
app.get('/taxonomy-admin.html', (req, res) => res.redirect('/taxonomy-admin'));
app.get('/login.html', (req, res) => res.redirect('/login'));

// ── Static files ──
app.use(express.static('public'));

// ── Multer error handler ──
app.use(multerErrorHandler);

// ── Mount all routes ──
app.use(chatRoutes);
app.use(quizRoutes);
app.use(agentRoutes);
app.use(socraticRoutes);
app.use(conceptMapRoutes);
app.use(progressRoutes);
// Gate every /admin/* request behind teacher auth BEFORE adminRoutes runs.
// Path-scoped middleware only fires on requests that match the mount path,
// so unrelated routes (e.g. /cache-stats in devRoutes) stay reachable.
app.use('/admin', requireTeacher);
app.use(adminRoutes);
app.use(devRoutes);

// ─────────────────────────────────────────────────
// SSE — Server-Sent Events for live dashboard
// ─────────────────────────────────────────────────
const sseClients = new Set();

app.get('/api/events', requireTeacher, (req, res) => {
  res.writeHead(200, {
    'Content-Type':  'text/event-stream',
    'Cache-Control': 'no-cache',
    Connection:      'keep-alive',
  });
  res.write(':\n\n');               // comment line — keeps connection alive

  sseClients.add(res);
  console.log(`[SSE] Teacher connected  (${sseClients.size} client(s))`);

  req.on('close', () => {
    sseClients.delete(res);
    console.log(`[SSE] Teacher disconnected (${sseClients.size} client(s))`);
  });
});

// Broadcast helper — called whenever progress data changes
function broadcastSSE(eventName, payload) {
  const frame = `event: ${eventName}\ndata: ${JSON.stringify(payload)}\n\n`;
  for (const client of sseClients) {
    client.write(frame);
  }
}

// Hook into progressStore changes
const progressStore = require('./agent/progressStore');
progressStore.on('data_updated', (info) => {
  broadcastSSE('data_updated', info || { ts: Date.now() });
});

const { warmUpModels } = require('./lib/helpers');

const PORT = process.env.PORT || 3000;

app.listen(PORT, '0.0.0.0', async () => {
  console.log(`\n  StudyBuddy server running at http://localhost:${PORT}`);
  console.log(`  Mode: ${process.env.NODE_ENV || 'production'}`);
  console.log(`  Keep-alive: ${process.env.OLLAMA_KEEP_ALIVE || 'default'}\n`);

  // Warm up the configured model immediately so first user request is fast
  await warmUpModels();
});

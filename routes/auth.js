
const express = require('express');
const router  = express.Router();

// ── Login rate limiter ──────────────────────────
// 4-digit PINs are tiny; without throttling they crack in seconds.
// Sliding window: max 10 failed attempts per IP per 15 minutes.
// Successful logins reset the counter for that IP.
const LOGIN_WINDOW_MS    = 15 * 60 * 1000;
const LOGIN_MAX_ATTEMPTS = 10;
const loginAttempts = new Map(); // ip -> array of failure timestamps (ms)

function pruneAttempts(ip, now) {
  const arr = loginAttempts.get(ip);
  if (!arr) return [];
  const fresh = arr.filter(ts => now - ts < LOGIN_WINDOW_MS);
  if (fresh.length) loginAttempts.set(ip, fresh);
  else loginAttempts.delete(ip);
  return fresh;
}

function loginRateLimit(req, res, next) {
  const ip  = req.ip || req.socket?.remoteAddress || 'unknown';
  const now = Date.now();
  const recent = pruneAttempts(ip, now);
  if (recent.length >= LOGIN_MAX_ATTEMPTS) {
    const retryMs = LOGIN_WINDOW_MS - (now - recent[0]);
    res.set('Retry-After', Math.ceil(retryMs / 1000));
    return res.status(429).json({ error: 'Too many login attempts. Try again later.' });
  }
  next();
}

function recordLoginFailure(req) {
  const ip  = req.ip || req.socket?.remoteAddress || 'unknown';
  const now = Date.now();
  const recent = pruneAttempts(ip, now);
  recent.push(now);
  loginAttempts.set(ip, recent);
  console.warn(`[auth] failed PIN attempt from ${ip} (${recent.length}/${LOGIN_MAX_ATTEMPTS})`);
}

function clearLoginFailures(req) {
  const ip = req.ip || req.socket?.remoteAddress || 'unknown';
  loginAttempts.delete(ip);
}

// ── GET /session — Session status for health/benchmark ──
router.get('/session', (req, res) => {
  if (!req.session.role) {
    return res.status(401).json({ authenticated: false });
  }
  res.json({ authenticated: true, role: req.session.role });
});
// ── Auth Routes ──────────────────────────────────
// PIN-based authentication with role assignment (student / teacher)
// Uses express-session to persist login state across requests.

const STUDENT_PIN = process.env.STUDENT_PIN || '1234';
const TEACHER_PIN = process.env.TEACHER_PIN || '9999';

// ── POST /auth/login — Authenticate via PIN ──────
router.post('/auth/login', loginRateLimit, (req, res) => {
  const { pin, studentName } = req.body;

  if (!pin) {
    return res.status(400).json({ error: 'PIN is required' });
  }

  const pinStr = String(pin).trim();

  if (pinStr === TEACHER_PIN) {
    clearLoginFailures(req);
    req.session.role = 'teacher';
    req.session.studentId = null;
    console.log(`🔑 [auth] Teacher logged in`);
    return res.json({ success: true, role: 'teacher', redirect: '/teacher' });
  }

  if (pinStr === STUDENT_PIN) {
    clearLoginFailures(req);
    const name = (studentName || '').trim();

    // If name not yet provided, confirm PIN is correct but don't create a session yet.
    // The client will show the name field and resubmit with the name included.
    if (!name) {
      return res.json({ success: true, role: 'student', needsName: true });
    }

    // Name provided — create the real session
    const id = name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '') || 'student-' + Date.now().toString(36);

    req.session.role        = 'student';
    req.session.studentId   = id;
    req.session.studentName = name;
    console.log(`🔑 [auth] Student logged in: ${name} (${id})`);
    return res.json({ success: true, role: 'student', studentId: id, redirect: '/app' });
  }

  recordLoginFailure(req);
  return res.status(401).json({ error: 'Invalid PIN' });
});

// ── POST /auth/logout — Destroy session ──────────
router.post('/auth/logout', (req, res) => {
  req.session.destroy(() => {
    res.json({ success: true });
  });
});

// ── GET /auth/me — Current session info ──────────
router.get('/auth/me', (req, res) => {
  if (!req.session.role) {
    return res.json({ authenticated: false });
  }
  res.json({
    authenticated: true,
    role:          req.session.role,
    studentId:     req.session.studentId || null,
    studentName:   req.session.studentName || null
  });
});

// ── Middleware: require teacher role ──────────────
function requireTeacher(req, res, next) {
  if (req.session && req.session.role === 'teacher') return next();

  // SSE / EventSource sends Accept: text/event-stream — never redirect those
  if (req.headers.accept && req.headers.accept.includes('text/event-stream')) {
    return res.status(403).json({ error: 'Teacher access required' });
  }
  // For HTML page requests, redirect to login
  if (req.accepts('html')) {
    return res.redirect('/login');
  }
  // For API requests, return 403
  return res.status(403).json({ error: 'Teacher access required' });
}

// ── Middleware: require any authenticated role ────
function requireAuth(req, res, next) {
  if (req.session && req.session.role) return next();

  if (req.accepts('html')) {
    return res.redirect('/login');
  }
  return res.status(401).json({ error: 'Authentication required' });
}

module.exports = { router, requireTeacher, requireAuth };

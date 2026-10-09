#!/usr/bin/env node
// ─────────────────────────────────────────────────────────────────────────────
// StudyBuddy Response Time Benchmark
// Usage:  node benchmark.js
// Output: Coloured terminal table + benchmark_results.json
// ─────────────────────────────────────────────────────────────────────────────

const http  = require('http');
const https = require('https');
const fs    = require('fs');
const path  = require('path');

const BASE_URL    = process.env.BASE_URL || 'http://localhost:3000';
const OUT_FILE    = path.join(__dirname, 'benchmark_results.json');
const DELAY_MS    = 1200;   // pause between requests so Ollama doesn't queue

// ── Colour helpers (no external deps) ────────────────────────────────────────
const C = {
  reset:  '\x1b[0m',
  bold:   '\x1b[1m',
  dim:    '\x1b[2m',
  green:  '\x1b[32m',
  yellow: '\x1b[33m',
  red:    '\x1b[31m',
  cyan:   '\x1b[36m',
  white:  '\x1b[37m',
  blue:   '\x1b[34m',
  magenta:'\x1b[35m',
};

function col(text, ...codes) {
  return codes.join('') + text + C.reset;
}

function timeColour(ms) {
  if (ms <   500) return col(`${ms}ms`,   C.green,  C.bold);
  if (ms <  3000) return col(`${ms}ms`,   C.yellow, C.bold);
  if (ms < 10000) return col(`${ms}ms`,   C.red,    C.bold);
  return               col(`${(ms/1000).toFixed(1)}s`, C.red, C.bold);
}

function statusColour(ok, status) {
  return ok
    ? col(`${status} OK`,   C.green)
    : col(`${status} FAIL`, C.red, C.bold);
}

// ── HTTP fetch (no axios/node-fetch needed) ───────────────────────────────────
function request(url, options = {}) {
  return new Promise((resolve, reject) => {
    const parsed  = new URL(url);
    const lib     = parsed.protocol === 'https:' ? https : http;
    const bodyStr = options.body ? JSON.stringify(options.body) : null;

    const req = lib.request({
      hostname: parsed.hostname,
      port:     parsed.port,
      path:     parsed.pathname + parsed.search,
      method:   options.method || 'GET',
      headers: {
        'Content-Type':   'application/json',
        'Content-Length': bodyStr ? Buffer.byteLength(bodyStr) : 0,
        ...(options.headers || {}),
      },
    }, (res) => {
      let data = '';
      res.on('data', chunk => { data += chunk; });
      res.on('end', () => {
        let parsed = null;
        try { parsed = JSON.parse(data); } catch {}
        resolve({ status: res.statusCode, ok: res.statusCode < 400, body: parsed, raw: data });
      });
    });

    req.on('error', reject);
  req.setTimeout(150000, () => { req.destroy(new Error('timeout')); });
    if (bodyStr) req.write(bodyStr);
    req.end();
  });
}

function sleep(ms) {
  return new Promise(r => setTimeout(r, ms));
}

// ── Test suite definition ─────────────────────────────────────────────────────
// Each test: { id, category, name, method, path, body?, validate? }
// validate(body) → true if response has expected shape

const TESTS = [

  // ── Health / instant routes (should be < 100ms) ──────────────────────────
  {
    id: 'health-progress',
    category: 'Health checks',
    name: 'GET /progress',
    method: 'GET', path: '/progress',
    validate: b => b && (b.sessions !== undefined || b.topics !== undefined),
  },
  {
    id: 'health-streak',
    category: 'Health checks',
    name: 'GET /streak',
    method: 'GET', path: '/streak',
    validate: b => b && b.current !== undefined,
  },
  {
    id: 'health-due-reviews',
    category: 'Health checks',
    name: 'GET /due-reviews',
    method: 'GET', path: '/due-reviews',
    validate: b => b && Array.isArray(b.reviews),
  },
  {
    id: 'health-cache-stats',
    category: 'Health checks',
    name: 'GET /cache-stats',
    method: 'GET', path: '/cache-stats',
    validate: b => b !== null,
  },
  {
    id: 'health-topics-search',
    category: 'Health checks',
    name: 'GET /topics/search?q=photo',
    method: 'GET', path: '/topics/search?q=photo',
    validate: b => b && Array.isArray(b.results),
  },
  {
    id: 'health-session',
    category: 'Health checks',
    name: 'GET /session',
    method: 'GET', path: '/session',
    expectStatus: [200, 401],   // 401 = auth working correctly (no session cookie)
    validate: b => true,
  },
  {
    id: 'health-pwa-status',
    category: 'Health checks',
    name: 'GET /pwa-status',
    method: 'GET', path: '/pwa-status',
    validate: b => b !== null,
  },
  {
    id: 'health-taxonomy',
    category: 'Health checks',
    name: 'GET /admin/taxonomy',
    method: 'GET', path: '/admin/taxonomy',
    validate: b => b !== null,
  },

  // ── Estimate route (no LLM — should be instant) ──────────────────────────
  {
    id: 'estimate-beginner',
    category: 'Estimate (no LLM)',
    name: 'POST /estimate — beginner, no image',
    method: 'POST', path: '/estimate',
    body: { message: 'explain gravity', level: 'beginner', hasImage: false },
    validate: b => b && typeof b.seconds === 'number',
  },
  {
    id: 'estimate-advanced',
    category: 'Estimate (no LLM)',
    name: 'POST /estimate — advanced, with image',
    method: 'POST', path: '/estimate',
    body: { message: 'explain quantum entanglement', level: 'advanced', hasImage: true },
    validate: b => b && typeof b.seconds === 'number',
  },

  // ── Direct chat (Ollama SSE — tests first-token speed) ──────────────────
  // Note: /chat uses SSE streaming. We measure time to complete response.
  {
    id: 'chat-beginner-simple',
    category: 'Direct chat (/chat)',
    name: 'POST /chat — beginner, simple topic',
    method: 'POST', path: '/chat',
    body: { message: 'what is gravity', level: 'beginner', history: [] },
    validate: () => true,   // SSE stream — just check 200 OK
  },
  {
    id: 'chat-intermediate-medium',
    category: 'Direct chat (/chat)',
    name: 'POST /chat — intermediate, medium topic',
    method: 'POST', path: '/chat',
    body: { message: 'explain the water cycle', level: 'intermediate', history: [] },
    validate: () => true,   // SSE stream
  },
  {
    id: 'chat-advanced-complex',
    category: 'Direct chat (/chat)',
    name: 'POST /chat — advanced, complex topic',
    method: 'POST', path: '/chat',
    body: { message: 'explain quantum entanglement mathematically', level: 'advanced', history: [] },
    validate: () => true,   // SSE stream
  },

  // ── Quiz generation ───────────────────────────────────────────────────────
  {
    id: 'quiz-3q-beginner',
    category: 'Quiz generation (/quiz)',
    name: 'POST /quiz — 3 questions, beginner',
    method: 'POST', path: '/quiz',
    body: { topic: 'photosynthesis', level: 'beginner', numQuestions: 3 },
    validate: b => b && Array.isArray(b.questions) && b.questions.length > 0,
  },
  {
    id: 'quiz-3q-intermediate',
    category: 'Quiz generation (/quiz)',
    name: 'POST /quiz — 3 questions, intermediate',
    method: 'POST', path: '/quiz',
    body: { topic: 'newtons laws', level: 'intermediate', numQuestions: 3 },
    validate: b => b && Array.isArray(b.questions) && b.questions.length > 0,
  },
  {
    id: 'quiz-5q-advanced',
    category: 'Quiz generation (/quiz)',
    name: 'POST /quiz — 5 questions, advanced',
    method: 'POST', path: '/quiz',
    body: { topic: 'quantum mechanics', level: 'advanced', numQuestions: 5 },
    validate: b => b && Array.isArray(b.questions),
  },

  // ── Agent mode (the core product — full parallel pipeline) ───────────────
  {
    id: 'agent-beginner-simple',
    category: 'Agent mode (/agent)',
    name: 'POST /agent — beginner, simple topic',
    method: 'POST', path: '/agent',
    body: { message: 'explain photosynthesis', level: 'beginner', history: [] },
    validate: b => b && b.success !== false,
  },
  {
    id: 'agent-intermediate-medium',
    category: 'Agent mode (/agent)',
    name: 'POST /agent — intermediate, medium topic',
    method: 'POST', path: '/agent',
    body: { message: 'explain the french revolution', level: 'intermediate', history: [] },
    validate: b => b && b.success !== false,
  },
  {
    id: 'agent-advanced-complex',
    category: 'Agent mode (/agent)',
    name: 'POST /agent — advanced, complex topic',
    method: 'POST', path: '/agent',
    body: { message: 'derive the schrodinger equation from first principles', level: 'advanced', history: [] },
    validate: b => b && b.success !== false,
  },
  {
    id: 'agent-cache-hit',
    category: 'Agent mode (/agent)',
    name: 'POST /agent — repeat query (should cache hit)',
    method: 'POST', path: '/agent',
    body: { message: 'explain photosynthesis', level: 'beginner', history: [] },
    validate: b => b && b.success !== false,
    note: 'Should be near-instant if cache is working correctly',
  },

  // ── Socratic mode ─────────────────────────────────────────────────────────
  {
    id: 'socratic-beginner',
    category: 'Socratic mode (/socratic)',
    name: 'POST /socratic — beginner',
    method: 'POST', path: '/socratic',
    body: { message: 'tell me about gravity', level: 'beginner', history: [] },
    validate: b => b !== null,
  },
  {
    id: 'socratic-advanced',
    category: 'Socratic mode (/socratic)',
    name: 'POST /socratic — advanced',
    method: 'POST', path: '/socratic',
    body: { message: 'explain entropy', level: 'advanced', history: [] },
    validate: b => b !== null,
  },

  // ── Concept map generation ────────────────────────────────────────────────
  {
    id: 'concept-map-simple',
    category: 'Concept map (/concept-map)',
    name: 'POST /concept-map — simple topic',
    method: 'POST', path: '/concept-map',
    body: { topic: 'gravity', level: 'beginner' },
    validate: b => b && Array.isArray(b.nodes),
  },
  {
    id: 'concept-map-complex',
    category: 'Concept map (/concept-map)',
    name: 'POST /concept-map — complex topic',
    method: 'POST', path: '/concept-map',
    body: { topic: 'ecosystem food chain', level: 'intermediate' },
    validate: b => b && Array.isArray(b.nodes),
  },

  // ── SRS / Progress routes ─────────────────────────────────────────────────
  {
    id: 'srs-update',
    category: 'SRS & Progress',
    name: 'PUT /srs/gravity — score update',
    method: 'PUT', path: '/srs/gravity',
    body: { score: 80 },
    validate: b => b !== null,
  },
  {
    id: 'progress-report',
    category: 'SRS & Progress',
    name: 'GET /progress-report',
    method: 'GET', path: '/progress-report',
    validate: b => b !== null,
  },
];

// ── Response time targets (ms) — at-a-glance performance check ───────────────
const TIME_TARGETS = {
  'health-progress':            100,
  'health-streak':              100,
  'health-due-reviews':         100,
  'health-cache-stats':         100,
  'health-topics-search':       200,
  'health-session':             100,
  'health-pwa-status':          100,
  'health-taxonomy':            100,
  'estimate-beginner':           50,
  'estimate-advanced':           50,
  'chat-beginner-simple':     20000,
  'chat-intermediate-medium': 20000,
  'chat-advanced-complex':    25000,
  'quiz-3q-beginner':         20000,
  'quiz-3q-intermediate':     30000,
  'quiz-5q-advanced':         60000,
  'agent-beginner-simple':    30000,
  'agent-intermediate-medium':35000,
  'agent-advanced-complex':   40000,
  'agent-cache-hit':            500,
  'socratic-beginner':        15000,
  'socratic-advanced':        15000,
  'concept-map-simple':       40000,
  'concept-map-complex':      45000,
  'srs-update':                 200,
  'progress-report':            200,
};

// ── Runner ────────────────────────────────────────────────────────────────────
async function runTest(test) {
  const url = `${BASE_URL}${test.path}`;

  const start  = Date.now();
  let result   = null;
  let error    = null;

  try {
    result = await request(url, {
      method:  test.method,
      body:    test.body,
    });
  } catch (err) {
    error = err.message;
  }

  const elapsed  = Date.now() - start;
  const ok       = !error && (
    test.expectStatus
      ? test.expectStatus.includes(result?.status)
      : result?.ok
  );
  const valid    = ok && test.validate ? test.validate(result?.body) : ok;

  return {
    id:       test.id,
    category: test.category,
    name:     test.name,
    method:   test.method,
    path:     test.path,
    note:     test.note || null,
    ms:       elapsed,
    status:   result?.status || 0,
    ok,
    valid,
    error:    error || null,
    body:     result?.body || null,
    timestamp: new Date().toISOString(),
  };
}

function printHeader() {
  const line = '═'.repeat(80);
  console.log('\n' + col(line, C.cyan));
  console.log(col('  StudyBuddy — Response Time Benchmark', C.cyan, C.bold));
  console.log(col(`  Target: ${BASE_URL}`, C.dim));
  console.log(col(`  Time:   ${new Date().toLocaleString()}`, C.dim));
  console.log(col(line, C.cyan) + '\n');
}

function printCategoryHeader(category) {
  console.log('\n' + col(`  ▸ ${category}`, C.cyan, C.bold));
  console.log(col('  ' + '─'.repeat(76), C.dim));
}

function printResult(r) {
  const status = r.error
    ? col('ERROR', C.red, C.bold)
    : statusColour(r.ok, r.status);

  const valid = r.valid
    ? col('✓ valid', C.green)
    : col('✗ invalid', r.ok ? C.yellow : C.red);

  const time = r.error ? col('timeout', C.red) : timeColour(r.ms);

  const name = r.name.padEnd(52);
  console.log(`  ${col(name, C.white)}  ${time.padEnd(20)}  ${status.padEnd(14)}  ${valid}`);

  if (r.note) {
    console.log(col(`      note: ${r.note}`, C.dim));
  }
  if (r.error) {
    console.log(col(`      error: ${r.error}`, C.red));
  }

  // Show target-time warning if over budget
  const target = TIME_TARGETS[r.id];
  if (target && !r.error) {
    const withinTarget = r.ms <= target;
    const targetStr    = target >= 1000
      ? `target: ${(target / 1000).toFixed(0)}s`
      : `target: ${target}ms`;
    if (!withinTarget) {
      console.log(col(`      ⚠ ${targetStr} — ${(r.ms / target).toFixed(1)}x over`, C.yellow));
    }
  }
}

function printSummary(results) {
  const line = '─'.repeat(80);
  console.log('\n' + col('═'.repeat(80), C.cyan));
  console.log(col('  Summary', C.bold));
  console.log(col(line, C.dim));

  const total   = results.length;
  const passed  = results.filter(r => r.ok && r.valid).length;
  const failed  = results.filter(r => !r.ok || !r.valid).length;
  const errors  = results.filter(r => r.error).length;

  const times   = results.filter(r => !r.error).map(r => r.ms);
  const avgMs   = times.length ? Math.round(times.reduce((a,b)=>a+b,0) / times.length) : 0;
  const minMs   = times.length ? Math.min(...times) : 0;
  const maxMs   = times.length ? Math.max(...times) : 0;
  const p95Ms   = times.length ? times.sort((a,b)=>a-b)[Math.floor(times.length * 0.95)] : 0;

  console.log(`  Total tests:    ${col(total,  C.white, C.bold)}`);
  console.log(`  Passed:         ${col(passed, C.green, C.bold)}`);
  console.log(`  Failed/invalid: ${col(failed, failed > 0 ? C.red : C.green, C.bold)}`);
  console.log(`  Errors:         ${col(errors, errors > 0 ? C.red : C.green, C.bold)}`);
  console.log(col(line, C.dim));
  console.log(`  Min response:   ${timeColour(minMs)}`);
  console.log(`  Avg response:   ${timeColour(avgMs)}`);
  console.log(`  p95 response:   ${timeColour(p95Ms)}`);
  console.log(`  Max response:   ${timeColour(maxMs)}`);
  console.log(col(line, C.dim));

  // Category breakdown
  const categories = [...new Set(results.map(r => r.category))];
  console.log(`\n  ${col('Category averages:', C.bold)}`);
  categories.forEach(cat => {
    const catResults = results.filter(r => r.category === cat && !r.error);
    if (catResults.length === 0) return;
    const catAvg = Math.round(catResults.reduce((a,r) => a+r.ms, 0) / catResults.length);
    const catPass = catResults.filter(r => r.ok && r.valid).length;
    console.log(`  ${cat.padEnd(38)} avg: ${timeColour(catAvg).padEnd(20)} ${catPass}/${catResults.length} passed`);
  });

  // Slowest 5
  const slowest = [...results]
    .filter(r => !r.error)
    .sort((a,b) => b.ms - a.ms)
    .slice(0, 5);
  console.log(`\n  ${col('Slowest 5:', C.bold)}`);
  slowest.forEach((r, i) => {
    console.log(`  ${String(i+1).padEnd(3)} ${r.name.padEnd(52)} ${timeColour(r.ms)}`);
  });

  // Fastest 5
  const fastest = [...results]
    .filter(r => !r.error)
    .sort((a,b) => a.ms - b.ms)
    .slice(0, 5);
  console.log(`\n  ${col('Fastest 5:', C.bold)}`);
  fastest.forEach((r, i) => {
    console.log(`  ${String(i+1).padEnd(3)} ${r.name.padEnd(52)} ${timeColour(r.ms)}`);
  });

  console.log('\n' + col('═'.repeat(80), C.cyan) + '\n');
}

function saveResults(results) {
  const report = {
    generated:  new Date().toISOString(),
    target:     BASE_URL,
    total:      results.length,
    passed:     results.filter(r => r.ok && r.valid).length,
    failed:     results.filter(r => !r.ok || !r.valid).length,
    avgMs:      Math.round(results.filter(r=>!r.error).reduce((a,r)=>a+r.ms,0) / results.filter(r=>!r.error).length || 0),
    results,
  };
  fs.writeFileSync(OUT_FILE, JSON.stringify(report, null, 2));
  console.log(col(`  Results saved → ${OUT_FILE}`, C.dim));
}

// ── Check server is up before running ────────────────────────────────────────
async function checkServer() {
  try {
    await request(`${BASE_URL}/progress`);
    return true;
  } catch {
    return false;
  }
}

// ── Main ──────────────────────────────────────────────────────────────────────
async function main() {
  printHeader();

  process.stdout.write(col('  Checking server...', C.dim));
  const up = await checkServer();
  if (!up) {
    console.log('\n\n' + col('  ✗ Server not reachable at ' + BASE_URL, C.red, C.bold));
    console.log(col('  Make sure npm run dev is running first.', C.dim) + '\n');
    process.exit(1);
  }
  console.log(col(' online ✓', C.green));
  console.log(col(`  Running ${TESTS.length} tests with ${DELAY_MS}ms pause between each...\n`, C.dim));

  const results  = [];
  let   lastCat  = null;

  for (const test of TESTS) {
    if (test.category !== lastCat) {
      printCategoryHeader(test.category);
      lastCat = test.category;
    }

    process.stdout.write(col(`  Running: ${test.name}...`, C.dim) + '\r');
    const result = await runTest(test);
    results.push(result);
    printResult(result);

    await sleep(DELAY_MS);
  }

  printSummary(results);
  saveResults(results);
}

main().catch(err => {
  console.error(col('\n  Fatal error: ' + err.message, C.red));
  process.exit(1);
});

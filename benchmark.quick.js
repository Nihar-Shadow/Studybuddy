#!/usr/bin/env node
// ─────────────────────────────────────────────────────────────────────────────
// StudyBuddy Quick Benchmark — targeted tests
// Usage:
//   node benchmark.quick.js          → runs quick health + cache comparison
//   node benchmark.quick.js cache    → cache hit/miss comparison only
//   node benchmark.quick.js agent    → agent tests only
//   node benchmark.quick.js route /chat '{"message":"gravity","level":"beginner","history":[]}'
// ─────────────────────────────────────────────────────────────────────────────

const http = require('http');
const https= require('https');

const BASE_URL = process.env.BASE_URL || 'http://localhost:3000';

const C = {
  reset:'\x1b[0m', bold:'\x1b[1m', dim:'\x1b[2m',
  green:'\x1b[32m', yellow:'\x1b[33m', red:'\x1b[31m',
  cyan:'\x1b[36m',  white:'\x1b[37m',  blue:'\x1b[34m',
};
function col(t,...c){return c.join('')+t+C.reset}
function t(ms){
  if(ms<500)  return col(ms+'ms',C.green,C.bold);
  if(ms<5000) return col(ms+'ms',C.yellow,C.bold);
  return col((ms/1000).toFixed(1)+'s',C.red,C.bold);
}

function req(url, opts={}) {
  return new Promise((resolve, reject) => {
    const u   = new URL(url);
    const lib = u.protocol==='https:'?https:http;
    const body= opts.body?JSON.stringify(opts.body):null;
    const r   = lib.request({
      hostname:u.hostname, port:u.port,
      path:u.pathname+u.search,
      method:opts.method||'GET',
      headers:{'Content-Type':'application/json','Content-Length':body?Buffer.byteLength(body):0},
    }, res => {
      let d='';
      res.on('data',c=>{d+=c});
      res.on('end',()=>{
        let parsed=null;
        try{parsed=JSON.parse(d)}catch{}
        resolve({status:res.statusCode,ok:res.statusCode<400,body:parsed});
      });
    });
    r.on('error',reject);
  r.setTimeout(150000,()=>r.destroy(new Error('timeout')));
    if(body)r.write(body);
    r.end();
  });
}

async function time_req(label, url, opts) {
  process.stdout.write(`  ${label.padEnd(55)}`);
  const start = Date.now();
  let res, err;
  try { res = await req(url, opts); }
  catch(e) { err = e.message; }
  const ms = Date.now() - start;
  if (err) {
    console.log(col('ERROR: '+err, C.red));
  } else {
    const status = res.ok ? col('✓', C.green) : col('✗ '+res.status, C.red, C.bold);
    console.log(`${t(ms).padEnd(18)} ${status}`);
  }
  return { ms, ok: !err && res?.ok };
}

async function sleep(ms){ return new Promise(r=>setTimeout(r,ms)); }

// ── Mode: route (single route test from CLI) ──────────────────────────────────
async function runRoute() {
  const route  = process.argv[3];
  const bodyRaw= process.argv[4];
  if (!route) {
    console.log(col('\n  Usage: node benchmark.quick.js route /path \'{"key":"value"}\'\n', C.dim));
    process.exit(1);
  }
  let body = null;
  if (bodyRaw) {
    try { body = JSON.parse(bodyRaw); }
    catch { console.log(col('\n  Invalid JSON body\n', C.red)); process.exit(1); }
  }
  const method = body ? 'POST' : 'GET';
  console.log(col(`\n  Testing: ${method} ${BASE_URL}${route}\n`, C.cyan, C.bold));
  await time_req(`${method} ${route}`, `${BASE_URL}${route}`, { method, body });
  console.log();
}

// ── Mode: cache (hit/miss comparison) ─────────────────────────────────────────
async function runCache() {
  console.log(col('\n  Cache Hit / Miss Comparison\n', C.cyan, C.bold));
  console.log(col('  Tests the same query twice. Second call should be near-instant.\n', C.dim));

  const PAIRS = [
    { topic:'photosynthesis', level:'beginner'     },
    { topic:'gravity',        level:'intermediate' },
    { topic:'newtons laws',   level:'advanced'     },
  ];

  for (const p of PAIRS) {
    const body = { message:`explain ${p.topic}`, level:p.level, history:[] };
    console.log(col(`  Topic: "${p.topic}" (${p.level})`, C.white, C.bold));

    const r1 = await time_req('  First call  (cache miss — Ollama)', `${BASE_URL}/agent`, { method:'POST', body });
    await sleep(300);
    const r2 = await time_req('  Second call (should be cache hit)', `${BASE_URL}/agent`, { method:'POST', body });

    if (r1.ms > 0 && r2.ms > 0) {
      const speedup = (r1.ms / r2.ms).toFixed(0);
      console.log(col(`  Speedup: ${speedup}x faster on cache hit\n`, C.green));
    }
    await sleep(800);
  }
}

// ── Mode: agent ────────────────────────────────────────────────────────────────
async function runAgent() {
  console.log(col('\n  Agent Mode Benchmarks\n', C.cyan, C.bold));

  const tests = [
    { name:'Beginner  — simple (photosynthesis)',         body:{ message:'explain photosynthesis',                  level:'beginner',     history:[] }},
    { name:'Beginner  — medium (water cycle)',            body:{ message:'explain the water cycle',                 level:'beginner',     history:[] }},
    { name:'Intermediate — medium (french revolution)',   body:{ message:'explain the french revolution',           level:'intermediate', history:[] }},
    { name:'Intermediate — hard (chemical bonding)',      body:{ message:'explain covalent and ionic bonding',      level:'intermediate', history:[] }},
    { name:'Advanced  — complex (quantum mechanics)',     body:{ message:'explain quantum superposition',           level:'advanced',     history:[] }},
    { name:'Advanced  — very hard (general relativity)',  body:{ message:'explain einsteins general relativity',    level:'advanced',     history:[] }},
  ];

  for (const t of tests) {
    await time_req(t.name, `${BASE_URL}/agent`, { method:'POST', body:t.body });
    await sleep(1000);
  }
  console.log();
}

// ── Mode: quick (default — health + fast routes) ──────────────────────────────
async function runQuick() {
  console.log(col('\n  Quick Benchmark — Health & Fast Routes\n', C.cyan, C.bold));

  const HEALTH = [
    ['GET /progress',              'GET', '/progress'],
    ['GET /streak',                'GET', '/streak'],
    ['GET /due-reviews',           'GET', '/due-reviews'],
    ['GET /cache-stats',           'GET', '/cache-stats'],
    ['GET /topics/search?q=photo', 'GET', '/topics/search?q=photo'],
    ['GET /session',               'GET', '/session'],
    ['GET /admin/taxonomy',        'GET', '/admin/taxonomy'],
    ['GET /progress-report',       'GET', '/progress-report'],
  ];

  console.log(col('  Health checks (target: < 100ms)', C.dim));
  for (const [label, method, path] of HEALTH) {
    await time_req(label, `${BASE_URL}${path}`, { method });
  }

  console.log('\n' + col('  Estimate route (target: < 50ms, no LLM)', C.dim));
  await time_req('POST /estimate — beginner',
    `${BASE_URL}/estimate`, { method:'POST', body:{ message:'explain gravity',    level:'beginner',     hasImage:false }});
  await time_req('POST /estimate — advanced',
    `${BASE_URL}/estimate`, { method:'POST', body:{ message:'quantum mechanics',  level:'advanced',     hasImage:true  }});

  console.log('\n' + col('  Quiz (target: 5–15s)', C.dim));
  await time_req('POST /quiz — 2 questions',
    `${BASE_URL}/quiz`, { method:'POST', body:{ topic:'photosynthesis', level:'beginner',     numQuestions:2 }});
  await sleep(800);
  await time_req('POST /quiz — 3 questions',
    `${BASE_URL}/quiz`, { method:'POST', body:{ topic:'gravity',        level:'intermediate', numQuestions:3 }});

  console.log('\n' + col('  Concept map (target: 5–15s)', C.dim));
  await sleep(500);
  await time_req('POST /concept-map',
    `${BASE_URL}/concept-map`, { method:'POST', body:{ topic:'gravity', level:'beginner' }});

  console.log('\n' + col('  SRS update (target: < 100ms)', C.dim));
  await time_req('PUT /srs/gravity',
    `${BASE_URL}/srs/gravity`, { method:'PUT', body:{ score:80 }});

  console.log();
}

// ── Entry ─────────────────────────────────────────────────────────────────────
async function main() {
  console.log(col('\n  StudyBuddy Quick Benchmark · ' + BASE_URL, C.cyan, C.bold));
  console.log(col('  ' + new Date().toLocaleString(), C.dim));

  const mode = process.argv[2] || 'quick';

  // Verify server is up
  process.stdout.write(col('  Checking server... ', C.dim));
  try {
    await req(`${BASE_URL}/progress`);
    console.log(col('online ✓\n', C.green));
  } catch {
    console.log(col('\n  Server not reachable. Run: npm run dev\n', C.red));
    process.exit(1);
  }

  if (mode === 'cache')  await runCache();
  else if (mode==='agent') await runAgent();
  else if (mode==='route') await runRoute();
  else                     await runQuick();
}

main().catch(e => { console.error(col('\n  '+e.message,C.red)); process.exit(1); });

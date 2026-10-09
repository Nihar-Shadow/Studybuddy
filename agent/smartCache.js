const crypto = require('crypto');
const fs     = require('fs');
const path   = require('path');

const { resolveCanonicalTopic, getTopicsInSubject } = require('./taxonomy');
const { Trie }                                       = require('./trie');
const { TOPIC_TAXONOMY }                             = require('./taxonomy');
const { processCacheMiss, resolveCanonicalTopicLive, trackAsk } = require('./dynamicTaxonomy');

// ─────────────────────────────────────────────────────────────
// Configuration — OPTIMIZED for better cache hit rates
// ─────────────────────────────────────────────────────────────
const MEM_TTL_MS       = 30  * 60 * 1000;   // 30 min in memory (was 15)
const DISK_TTL_MS      = 48  * 60 * 60 * 1000; // 48 hours on disk (was 24)
const MAX_MEM_ENTRIES  = 500;  // Increased from 300
const MAX_DISK_ENTRIES = 1000; // Increased from 500
const DISK_PATH        = path.join(__dirname, '..', 'data', 'cache.json');

// ─────────────────────────────────────────────────────────────
// Storage layers
// ─────────────────────────────────────────────────────────────
const MEM_CACHE  = new Map();   // fast in-memory layer
const IN_FLIGHT  = new Map();   // deduplication — tracks in-progress Ollama calls

// ─────────────────────────────────────────────────────────────
// Trie — built from taxonomy topics at startup
// ─────────────────────────────────────────────────────────────
const topicTrie = new Trie();
for (const topic of Object.keys(TOPIC_TAXONOMY)) {
  topicTrie.insert(topic);
}

// ─────────────────────────────────────────────────────────────
// Stop words for normalisation
// ─────────────────────────────────────────────────────────────
const STOP_WORDS = new Set([
  'explain','what','is','the','a','an','tell','me','about','describe',
  'how','does','work','please','can','you','i','want','to','learn',
  'understand','help','with','teach','define','show','give','example',
  'simple','easy','quick','brief','detailed','thorough','please','thanks',
  'could','would','should','need','know','more','little','bit','basic',
  'advanced','beginner','intermediate','lets','let', 'us','we','do',
  'get','start','begin','first','again','review','revise','study'
]);

// ─────────────────────────────────────────────────────────────
// Key generation utilities
// ─────────────────────────────────────────────────────────────

// Normalise a raw message to a clean topic string
function normaliseText(text) {
  return (text || '')
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, '')
    .split(/\s+/)
    .filter(w => w.length > 1 && !STOP_WORDS.has(w))
    .sort()          // sort so "acid base" and "base acid" match
    .join(' ')
    .trim();
}

// Generate a short MD5 hash key from tool + topic + level
function makeKey(tool, topic, level) {
  const norm = normaliseText(topic);
  const raw  = `${tool}::${norm}::${level}`;
  return crypto.createHash('md5').update(raw).digest('hex');
}

// ─────────────────────────────────────────────────────────────
// Disk cache — load on startup, save asynchronously
// ─────────────────────────────────────────────────────────────
function loadDiskCache() {
  try {
    const dir = path.dirname(DISK_PATH);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    if (!fs.existsSync(DISK_PATH)) return;

    const raw     = fs.readFileSync(DISK_PATH, 'utf8');
    const stored  = JSON.parse(raw);
    const now     = Date.now();
    let   loaded  = 0;

    for (const [key, entry] of Object.entries(stored)) {
      if (now - entry.ts < DISK_TTL_MS) {
        MEM_CACHE.set(key, entry);
        loaded++;
      }
    }
    console.log(`[smartCache] loaded ${loaded} entries from disk`);
  } catch (err) {
    console.warn('[smartCache] disk load failed (fresh start):', err.message);
  }
}

// Serial write queue — prevents lost cache entries when two requests
// race a read-modify-write against disk simultaneously.
const writeQueue = [];
let isWriting    = false;

function processWriteQueue() {
  if (isWriting) return;
  const next = writeQueue.shift();
  if (!next) return;

  isWriting = true;
  setImmediate(() => {
    try {
      const dir = path.dirname(DISK_PATH);
      if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });

      let existing;
      try {
        existing = fs.existsSync(DISK_PATH)
          ? JSON.parse(fs.readFileSync(DISK_PATH, 'utf8'))
          : {};
      } catch (parseErr) {
        // Corrupted disk cache — start fresh
        console.warn('[smartCache] disk cache corrupted — resetting:', parseErr.message);
        existing = {};
      }

      existing[next.key] = next.entry;

      // Evict oldest entries if over limit
      const keys = Object.keys(existing);
      if (keys.length > MAX_DISK_ENTRIES) {
        keys.sort((a, b) => existing[a].ts - existing[b].ts)
            .slice(0, keys.length - MAX_DISK_ENTRIES + 50)
            .forEach(k => delete existing[k]);
      }

      fs.writeFileSync(DISK_PATH, JSON.stringify(existing));
    } catch (err) {
      console.warn('[smartCache] disk save failed:', err.message);
    } finally {
      isWriting = false;
      // Drain the rest of the queue
      if (writeQueue.length > 0) processWriteQueue();
    }
  });
}

function saveToDisk(key, entry) {
  writeQueue.push({ key, entry });
  processWriteQueue();
}

// ─────────────────────────────────────────────────────────────
// Core get/set with memory eviction
// ─────────────────────────────────────────────────────────────
function cacheGet(key) {
  const entry = MEM_CACHE.get(key);
  if (!entry) return null;
  if (Date.now() - entry.ts > MEM_TTL_MS) {
    MEM_CACHE.delete(key);
    return null;
  }
  return entry.value;
}

function cacheSet(key, value) {
  console.log(`[cache WRITE] key: ${key.slice(0,8)}… — entries: ${MEM_CACHE.size + 1}`);
  // Evict oldest if memory is full
  if (MEM_CACHE.size >= MAX_MEM_ENTRIES) {
    let oldest = null, oldestTs = Infinity;
    for (const [k, v] of MEM_CACHE) {
      if (v.ts < oldestTs) { oldest = k; oldestTs = v.ts; }
    }
    if (oldest) MEM_CACHE.delete(oldest);
  }
  const entry = { value, ts: Date.now() };
  MEM_CACHE.set(key, entry);
  saveToDisk(key, entry);
}

// ─────────────────────────────────────────────────────────────
// THE 4-LAYER LOOKUP
// Call this before any Ollama tool call.
// Returns cached value if found, null if miss.
// ─────────────────────────────────────────────────────────────
function smartGet(tool, message, level) {
  // ── Layer 1: Live taxonomy resolution (base + learned topics) ──
  const canonical = resolveCanonicalTopicLive(message);
  if (canonical) {
    const key1 = makeKey(tool, canonical, level);
    const hit1 = cacheGet(key1);
    if (hit1) {
      console.log(`[L1-taxonomy] ✓ ${canonical} (${tool})`);
      trackAsk(canonical);   // increment ask count for analytics
      return { value: hit1, key: key1, layer: 1 };
    }
  }

  // ── Layer 2: Normalised hash (catches varied phrasing) ──
  const key2 = makeKey(tool, message, level);
  const hit2 = cacheGet(key2);
  if (hit2) {
    console.log(`[L2-hash] ✓ ${normaliseText(message)} (${tool})`);
    return { value: hit2, key: key2, layer: 2 };
  }

  // ── Layer 3: In-flight deduplication ──
  const inFlightKey = `${tool}::${key2}`;
  if (IN_FLIGHT.has(inFlightKey)) {
    console.log(`[L3-dedup] waiting for in-flight (${tool})`);
    return { value: null, key: key2, inFlight: IN_FLIGHT.get(inFlightKey), layer: 3 };
  }

  // ── Layer 4: Miss — trigger taxonomy learning and caller must invoke Ollama ──
  console.log(`[cache L4 MISS] ${normaliseText(message)} (${tool})`);
  if (tool === 'explain' || tool === 'quiz') {
    processCacheMiss(message, level);   // fire-and-forget taxonomy learning
  }
  return { value: null, key: key2, layer: 4 };
}

// Store a result and clear in-flight
function smartSet(tool, message, level, value) {
  const key = makeKey(tool, message, level);
  cacheSet(key, value);

  // Also store under canonical key if resolvable
  const canonical = resolveCanonicalTopic(message);
  if (canonical) {
    const canonicalKey = makeKey(tool, canonical, level);
    if (canonicalKey !== key) cacheSet(canonicalKey, value);
  }

  // Clear in-flight
  IN_FLIGHT.delete(`${tool}::${key}`);
  return key;
}

// Register a promise as in-flight to prevent duplicate calls
function registerInFlight(tool, message, level, promise) {
  const key = makeKey(tool, message, level);
  IN_FLIGHT.set(`${tool}::${key}`, promise);
  promise.finally(() => IN_FLIGHT.delete(`${tool}::${key}`));
}

// ─────────────────────────────────────────────────────────────
// Predictive pre-warming
// Call this after sending a response that includes a nextTopic.
// Silently fetches and caches the suggested next topic in background.
// ─────────────────────────────────────────────────────────────
function preWarm(nextTopic, level, explainFn) {
  if (!nextTopic || typeof explainFn !== 'function') return;

  setImmediate(async () => {
    try {
      // Check if already cached
      const checkResult = smartGet('explain', nextTopic, level);
      if (checkResult.value) {
        console.log(`[prewarm] already cached: ${nextTopic}`);
        return;
      }

      console.log(`[prewarm] fetching: ${nextTopic}`);
      const result = await explainFn({ topic: nextTopic, level, context: '' });
      smartSet('explain', nextTopic, level, result);
      console.log(`[prewarm] cached: ${nextTopic}`);

      // Also pre-warm related topics from the same subject
      const related = getTopicsInSubject(nextTopic).slice(0, 2);
      for (const relTopic of related) {
        const check = smartGet('explain', relTopic, level);
        if (!check.value) {
          console.log(`[prewarm] related: ${relTopic}`);
          const r = await explainFn({ topic: relTopic, level, context: '' });
          smartSet('explain', relTopic, level, r);
        }
      }
    } catch (err) {
      console.warn(`[prewarm] failed for ${nextTopic}:`, err.message);
    }
  });
}

// ─────────────────────────────────────────────────────────────
// Cache statistics — used by /dev/metrics
// ─────────────────────────────────────────────────────────────
function getCacheStats() {
  const now       = Date.now();
  let   validMem  = 0;
  const topics    = [];

  for (const [key, entry] of MEM_CACHE) {
    if (now - entry.ts < MEM_TTL_MS) {
      validMem++;
      topics.push({ key: key.slice(0, 8) + '...', age: Math.round((now - entry.ts) / 1000) + 's' });
    }
  }

  const { KEYWORD_TO_TOPIC } = require('./taxonomy');
  const { getStats: getTaxonomyStats } = require('./dynamicTaxonomy');
  const taxStats = getTaxonomyStats();

  return {
    memEntries:    validMem,
    inFlight:      IN_FLIGHT.size,
    taxonomySize:  Object.keys(KEYWORD_TO_TOPIC).length,
    trieTopics:    topicTrie.count,
    diskPath:      DISK_PATH,
    liveKeywords:  taxStats.liveKeywords,
    pendingTopics: taxStats.pendingCount,
    learnedTopics: taxStats.learnedCount,
    topics:        topics.slice(0, 10)  // show only first 10 for readability
  };
}

// ─────────────────────────────────────────────────────────────
// Trie prefix search — for autocomplete and debug
// ─────────────────────────────────────────────────────────────
function searchTopics(prefix) {
  return topicTrie.search(prefix);
}

// ─────────────────────────────────────────────────────────────
// Clear all caches
// ─────────────────────────────────────────────────────────────
function clearAll() {
  MEM_CACHE.clear();
  IN_FLIGHT.clear();
  try { fs.unlinkSync(DISK_PATH); } catch {}
  console.log('[smartCache] cleared all');
}

// Load disk cache on module require
loadDiskCache();

module.exports = {
  smartGet,
  smartSet,
  registerInFlight,
  preWarm,
  getCacheStats,
  searchTopics,
  makeKey,
  normaliseText,
  clearAll
};

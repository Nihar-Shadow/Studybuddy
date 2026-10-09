const fs   = require('fs');
const path = require('path');
const { parseTaxonomyResponse } = require('../lib/parseJSON');
const { classifier } = require('./models');

// ─── File paths ────────────────────────────────────────────
const DATA_DIR      = path.join(__dirname, '..', 'data');
const LEARNED_PATH  = path.join(DATA_DIR, 'taxonomy_learned.json');
const PENDING_PATH  = path.join(DATA_DIR, 'taxonomy_pending.json');

// ─── Configuration ─────────────────────────────────────────
const PROMOTION_THRESHOLD = 2;    // times asked before adding to taxonomy
const MAX_PENDING         = 200;  // max entries in pending queue
const MAX_LEARNED         = 500;  // max learned topics
const EXTRACT_TIMEOUT_MS  = 8000; // max time to wait for Gemma extraction

// ─── In-memory stores (loaded from disk on startup) ────────
let learnedTaxonomy = {};  // { topicKey: { keywords, subject, addedAt, askCount } }
let pendingQueue    = {};  // { topicKey: { rawQuestion, count, firstSeen, lastSeen, gemmaData } }

// ─── Ensure data directory exists ──────────────────────────
function ensureDataDir() {
  if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
}

// ─── Load from disk ─────────────────────────────────────────
function loadFromDisk() {
  ensureDataDir();
  try {
    if (fs.existsSync(LEARNED_PATH)) {
      learnedTaxonomy = JSON.parse(fs.readFileSync(LEARNED_PATH, 'utf8'));
      console.log(`[dynTaxonomy] loaded ${Object.keys(learnedTaxonomy).length} learned topics`);
    }
  } catch { learnedTaxonomy = {}; }

  try {
    if (fs.existsSync(PENDING_PATH)) {
      pendingQueue = JSON.parse(fs.readFileSync(PENDING_PATH, 'utf8'));
      console.log(`[dynTaxonomy] loaded ${Object.keys(pendingQueue).length} pending topics`);
    }
  } catch { pendingQueue = {}; }
}

// ─── Save to disk (async, non-blocking) ────────────────────
function saveLearned() {
  setImmediate(() => {
    try {
      ensureDataDir();
      fs.writeFileSync(LEARNED_PATH, JSON.stringify(learnedTaxonomy, null, 2));
    } catch (err) {
      console.warn('[dynTaxonomy] save learned failed:', err.message);
    }
  });
}

function savePending() {
  setImmediate(() => {
    try {
      ensureDataDir();
      fs.writeFileSync(PENDING_PATH, JSON.stringify(pendingQueue, null, 2));
    } catch (err) {
      console.warn('[dynTaxonomy] save pending failed:', err.message);
    }
  });
}

// ─── Normalise a topic key for consistent storage ──────────
function toTopicKey(text) {
  return (text || '')
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

// ─────────────────────────────────────────────────────────────
// STEP 1 — Ask Gemma to extract topic metadata from a question
// Returns: { canonicalTopic, subject, keywords, confidence }
// Uses gemma3:4b for speed — lightweight classification task
// ─────────────────────────────────────────────────────────────
async function extractTopicWithGemma(rawQuestion) {
  const prompt = `A student asked this question: "${rawQuestion}"

Extract the educational topic from this question.
Respond ONLY with valid JSON. No markdown. No explanation.

{
  "canonicalTopic": "the main topic as 1-4 words, lowercase (e.g. 'black holes', 'quantum mechanics')",
  "subject": "one of: biology, chemistry, physics, mathematics, history, english, computer_science, geography, economics, other",
  "keywords": ["3 to 6 keywords or synonyms a student might use to ask about this topic"],
  "confidence": "high | medium | low"
}`;

  try {
    const controller = new AbortController();
    const timeout    = setTimeout(() => controller.abort(), EXTRACT_TIMEOUT_MS);

    const response = await fetch('http://localhost:11434/api/chat', {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      signal:  controller.signal,
      body: JSON.stringify({
        ...classifier(),
        messages: [
          { role: 'system', content: 'You are a topic classifier. Output only JSON.' },
          { role: 'user',   content: prompt }
        ],
        stream:  false,
        options: { num_predict: 200, temperature: 0.1 }  // low temp = consistent JSON
      })
    });

    clearTimeout(timeout);
    const data    = await response.json();
    const rawText = data.message?.content || '';
    const parsed  = parseTaxonomyResponse(rawText);

    if (!parsed || !parsed.canonicalTopic) {
      console.warn('[dynTaxonomy] extraction failed for:', rawQuestion.slice(0, 80));
      return null;
    }

    return {
      ...parsed,
      canonicalTopic: toTopicKey(parsed.canonicalTopic),
    };
  } catch (err) {
    console.warn('[dynTaxonomy] Gemma extraction failed:', err.message);
    return null;
  }
}

// ─────────────────────────────────────────────────────────────
// STEP 2 — Process a cache miss
// Called by smartCache when all 4 layers miss.
// Fires extraction asynchronously — does NOT block the response.
// ─────────────────────────────────────────────────────────────
function processCacheMiss(rawQuestion, level) {
  if (!rawQuestion || rawQuestion.length < 3) return;

  // Fire-and-forget — student does not wait for this
  setImmediate(async () => {
    try {
      const gemmaData = await extractTopicWithGemma(rawQuestion);
      if (!gemmaData) return;

      const key = gemmaData.canonicalTopic;

      // Skip if already in base taxonomy or learned taxonomy
      const { KEYWORD_TO_TOPIC } = require('./taxonomy');
      if (KEYWORD_TO_TOPIC[key] || learnedTaxonomy[key]) {
        // Topic exists but wasn't caught by L1 — add the raw question as a keyword
        addKeywordToLearned(key, rawQuestion);
        return;
      }

      // Add or increment in pending queue
      if (pendingQueue[key]) {
        pendingQueue[key].count++;
        pendingQueue[key].lastSeen    = new Date().toISOString();
        pendingQueue[key].rawQuestions.push(rawQuestion.slice(0, 100));
        // Keep only last 10 example questions
        if (pendingQueue[key].rawQuestions.length > 10) {
          pendingQueue[key].rawQuestions = pendingQueue[key].rawQuestions.slice(-10);
        }
        console.log(`[dynTaxonomy] pending ++: "${key}" (count: ${pendingQueue[key].count})`);
      } else {
        // Enforce max pending size — evict oldest if full
        const pendingKeys = Object.keys(pendingQueue);
        if (pendingKeys.length >= MAX_PENDING) {
          const oldest = pendingKeys.sort((a,b) =>
            new Date(pendingQueue[a].firstSeen) - new Date(pendingQueue[b].firstSeen)
          )[0];
          delete pendingQueue[oldest];
        }

        pendingQueue[key] = {
          count:        1,
          firstSeen:    new Date().toISOString(),
          lastSeen:     new Date().toISOString(),
          rawQuestions: [rawQuestion.slice(0, 100)],
          gemmaData,
          level,
          status:       'pending'
        };
        console.log(`[dynTaxonomy] new pending: "${key}"`);
      }

      savePending();

      // Check if threshold reached — auto-promote
      if (pendingQueue[key] && pendingQueue[key].count >= PROMOTION_THRESHOLD) {
        promoteTopic(key);
      }

    } catch (err) {
      console.warn('[dynTaxonomy] processCacheMiss error:', err.message);
    }
  });
}

// ─────────────────────────────────────────────────────────────
// STEP 3 — Promote a pending topic into the learned taxonomy
// ─────────────────────────────────────────────────────────────
function promoteTopic(topicKey) {
  const pending = pendingQueue[topicKey];
  if (!pending) return false;

  // Enforce max learned size — evict least-asked
  const learnedKeys = Object.keys(learnedTaxonomy);
  if (learnedKeys.length >= MAX_LEARNED) {
    const leastUsed = learnedKeys.sort((a,b) =>
      (learnedTaxonomy[a].askCount || 0) - (learnedTaxonomy[b].askCount || 0)
    )[0];
    delete learnedTaxonomy[leastUsed];
    console.log(`[dynTaxonomy] evicted least-used: "${leastUsed}"`);
  }

  learnedTaxonomy[topicKey] = {
    keywords:    pending.gemmaData?.keywords || [],
    subject:     pending.gemmaData?.subject  || 'other',
    addedAt:     new Date().toISOString(),
    askCount:    pending.count,
    confidence:  pending.gemmaData?.confidence || 'medium',
    source:      'auto',  // 'auto' | 'manual' | 'approved'
    examples:    pending.rawQuestions.slice(0, 3),
  };

  // Remove from pending
  delete pendingQueue[topicKey];

  saveLearned();
  savePending();

  // Rebuild the live taxonomy with the new topic
  rebuildLiveTaxonomy();

  console.log(`[dynTaxonomy] PROMOTED: "${topicKey}" → learned taxonomy`);
  return true;
}

// ─────────────────────────────────────────────────────────────
// LIVE TAXONOMY MERGER
// Merges base taxonomy + learned taxonomy into one lookup map
// Called at startup and after every promotion
// ─────────────────────────────────────────────────────────────
let LIVE_KEYWORD_MAP = {};   // keyword → canonical topic (merged)

function rebuildLiveTaxonomy() {
  const { KEYWORD_TO_TOPIC, TOPIC_TAXONOMY } = require('./taxonomy');

  // Start with base taxonomy
  LIVE_KEYWORD_MAP = { ...KEYWORD_TO_TOPIC };

  // Merge learned topics
  let added = 0;
  for (const [topic, data] of Object.entries(learnedTaxonomy)) {
    LIVE_KEYWORD_MAP[topic] = topic;   // topic maps to itself
    for (const kw of (data.keywords || [])) {
      LIVE_KEYWORD_MAP[kw.toLowerCase()] = topic;
    }
    added++;
  }

  console.log(`[dynTaxonomy] live taxonomy rebuilt: ${Object.keys(LIVE_KEYWORD_MAP).length} keywords (${added} learned)`);
}

// ─── Resolve using the live merged taxonomy ─────────────────
function resolveCanonicalTopicLive(message) {
  if (!message || typeof message !== 'string') return null;

  const cleaned = message.toLowerCase().replace(/[^a-z0-9\s]/g, '');
  const words   = cleaned.split(/\s+/).filter(Boolean);
  const scores  = {};

  for (const word of words) {
    if (LIVE_KEYWORD_MAP[word]) {
      scores[LIVE_KEYWORD_MAP[word]] = (scores[LIVE_KEYWORD_MAP[word]] || 0) + 1;
    }
  }
  for (let i = 0; i < words.length - 1; i++) {
    const bigram = words[i] + ' ' + words[i+1];
    if (LIVE_KEYWORD_MAP[bigram]) {
      scores[LIVE_KEYWORD_MAP[bigram]] = (scores[LIVE_KEYWORD_MAP[bigram]] || 0) + 3;
    }
  }
  for (let i = 0; i < words.length - 2; i++) {
    const trigram = words[i] + ' ' + words[i+1] + ' ' + words[i+2];
    if (LIVE_KEYWORD_MAP[trigram]) {
      scores[LIVE_KEYWORD_MAP[trigram]] = (scores[LIVE_KEYWORD_MAP[trigram]] || 0) + 5;
    }
  }

  if (Object.keys(scores).length === 0) return null;
  return Object.entries(scores).sort((a,b) => b[1]-a[1])[0][0];
}

// ─────────────────────────────────────────────────────────────
// MANUAL CONTROLS — used by admin routes
// ─────────────────────────────────────────────────────────────

// Manually add a topic with custom keywords
function manuallyAddTopic(topicKey, keywords, subject) {
  const key = toTopicKey(topicKey);
  learnedTaxonomy[key] = {
    keywords:   keywords.map(k => k.toLowerCase().trim()),
    subject:    subject || 'other',
    addedAt:    new Date().toISOString(),
    askCount:   0,
    confidence: 'high',
    source:     'manual',
    examples:   [],
  };
  saveLearned();
  rebuildLiveTaxonomy();
  return key;
}

// Approve a pending topic (bypasses threshold)
function approvePending(topicKey) {
  if (pendingQueue[topicKey]) {
    return promoteTopic(topicKey);
  }
  return false;
}

// Reject a pending topic (removes it entirely)
function rejectPending(topicKey) {
  if (pendingQueue[topicKey]) {
    pendingQueue[topicKey].status = 'rejected';
    // Keep in pending but mark rejected so it isn't re-added
    savePending();
    return true;
  }
  return false;
}

// Remove a learned topic
function removeLearned(topicKey) {
  if (learnedTaxonomy[topicKey]) {
    delete learnedTaxonomy[topicKey];
    saveLearned();
    rebuildLiveTaxonomy();
    return true;
  }
  return false;
}

// Add a keyword to an existing learned topic
function addKeywordToLearned(topicKey, keyword) {
  const key = toTopicKey(topicKey);
  if (learnedTaxonomy[key]) {
    const kw = keyword.toLowerCase().trim();
    if (!learnedTaxonomy[key].keywords.includes(kw)) {
      learnedTaxonomy[key].keywords.push(kw);
      LIVE_KEYWORD_MAP[kw] = key;
      saveLearned();
    }
  }
}

// Increment ask count for analytics
function trackAsk(topicKey) {
  if (learnedTaxonomy[topicKey]) {
    learnedTaxonomy[topicKey].askCount = (learnedTaxonomy[topicKey].askCount || 0) + 1;
    // Save occasionally (every 10 asks) to avoid too many writes
    if (learnedTaxonomy[topicKey].askCount % 10 === 0) saveLearned();
  }
}

// ─── Stats for admin and dev panel ──────────────────────────
function getStats() {
  const learnedList = Object.entries(learnedTaxonomy).map(([k,v]) => ({
    topic:      k,
    subject:    v.subject,
    askCount:   v.askCount || 0,
    keywords:   v.keywords.length,
    source:     v.source,
    addedAt:    v.addedAt,
    confidence: v.confidence,
  })).sort((a,b) => b.askCount - a.askCount);

  const pendingList = Object.entries(pendingQueue)
    .filter(([,v]) => v.status !== 'rejected')
    .map(([k,v]) => ({
      topic:       k,
      count:       v.count,
      threshold:   PROMOTION_THRESHOLD,
      pct:         Math.round((v.count / PROMOTION_THRESHOLD) * 100),
      subject:     v.gemmaData?.subject || 'unknown',
      firstSeen:   v.firstSeen,
      lastSeen:    v.lastSeen,
      example:     v.rawQuestions?.[0] || '',
    })).sort((a,b) => b.count - a.count);

  return {
    learned:         learnedList,
    pending:         pendingList,
    learnedCount:    learnedList.length,
    pendingCount:    pendingList.length,
    liveKeywords:    Object.keys(LIVE_KEYWORD_MAP).length,
    threshold:       PROMOTION_THRESHOLD,
  };
}

// ─── Initialise on module load ────────────────────────────
loadFromDisk();
rebuildLiveTaxonomy();

module.exports = {
  processCacheMiss,
  resolveCanonicalTopicLive,
  promoteTopic,
  approvePending,
  rejectPending,
  removeLearned,
  manuallyAddTopic,
  addKeywordToLearned,
  trackAsk,
  getStats,
  rebuildLiveTaxonomy,
  PROMOTION_THRESHOLD,
};

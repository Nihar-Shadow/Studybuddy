const fs   = require('fs');
const path = require('path');
const EventEmitter = require('events');

// The module itself is an EventEmitter so server.js can listen for changes
const emitter = new EventEmitter();
const DATA_DIR   = path.join(__dirname, '..', 'data');
const STORE_PATH = path.join(DATA_DIR, 'progress.json');

// ─────────────────────────────────────────────────────────────
// MULTI-STUDENT FLAT FILE SCHEMA
// The progress.json file stores data for ALL students in one flat file.
// Each session and topic entry carries a `studentId` field.
// Legacy data (without studentId) is treated as "default" student.
//
// Schema:
// {
//   "sessions": [
//     { "studentId": "alex", "topic": "...", "level": "...", "quizScore": null, "timestamp": "..." }
//   ],
//   "topics": {
//     "alex": {
//       "gravity": { "timesStudied": 1, "scores": [], "level": "intermediate", ... }
//     }
//   },
//   "students": {
//     "alex": { "name": "Alex", "firstSeen": "...", "lastSeen": "..." }
//   }
// }
// ─────────────────────────────────────────────────────────────

const DEFAULT_STUDENT = 'default';

// Auto-create data directory and empty store if not present
function ensureStore() {
  if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
  if (!fs.existsSync(STORE_PATH)) {
    fs.writeFileSync(STORE_PATH, JSON.stringify({ sessions: [], topics: {}, students: {} }, null, 2));
  }
}

// Read the full store
function readStore() {
  ensureStore();
  let raw;
  try {
    raw = JSON.parse(fs.readFileSync(STORE_PATH, 'utf8'));
  } catch (err) {
    // Preserve the corrupt bytes before overwriting so the underlying bug
    // can be diagnosed. Without this backup, evidence of the cause is lost.
    const backupPath = `${STORE_PATH}.corrupted-${new Date().toISOString().replace(/[:.]/g, '-')}`;
    try { fs.copyFileSync(STORE_PATH, backupPath); } catch {}
    console.warn(`[progressStore] progress.json corrupted — backed up to ${backupPath}, resetting to empty:`, err.message);
    raw = { sessions: [], topics: {}, students: {} };
    try { fs.writeFileSync(STORE_PATH, JSON.stringify(raw, null, 2)); } catch {}
  }

  // ── Backward compatibility: migrate old flat format ──
  // Old format had topics as { "gravity": { ... } }
  // New format has topics as { "default": { "gravity": { ... } } }
  if (raw.topics && !raw.students) {
    // Check if old format (topics keyed directly by topic name)
    const firstKey = Object.keys(raw.topics)[0];
    if (firstKey && raw.topics[firstKey] && raw.topics[firstKey].timesStudied !== undefined) {
      // Old format detected — wrap in default student
      const oldTopics = raw.topics;
      raw.topics   = { [DEFAULT_STUDENT]: oldTopics };
      raw.students = { [DEFAULT_STUDENT]: { name: 'Default Student', firstSeen: new Date().toISOString(), lastSeen: new Date().toISOString() } };

      // Tag old sessions with default studentId
      if (Array.isArray(raw.sessions)) {
        raw.sessions = raw.sessions.map(s => ({ ...s, studentId: s.studentId || DEFAULT_STUDENT }));
      }

      writeStore(raw);
      console.log('[progressStore] Migrated legacy progress.json to multi-student format');
    }
  }

  // Ensure structure
  if (!raw.students) raw.students = {};
  if (!raw.topics)   raw.topics   = {};

  return raw;
}

// Write the full store
function writeStore(data) {
  ensureStore();
  fs.writeFileSync(STORE_PATH, JSON.stringify(data, null, 2));
  // Notify SSE listeners that data changed
  emitter.emit('data_updated', { ts: Date.now() });
}

// Ensure a student profile exists in the store
function ensureStudent(store, studentId, studentName) {
  if (!store.students[studentId]) {
    store.students[studentId] = {
      name:      studentName || studentId,
      firstSeen: new Date().toISOString(),
      lastSeen:  new Date().toISOString()
    };
  } else if (studentName && store.students[studentId].name === studentId) {
    // Update name if it was previously just the ID (e.g. first session before name was threaded)
    store.students[studentId].name = studentName;
  }
  if (!store.topics[studentId]) {
    store.topics[studentId] = {};
  }
  store.students[studentId].lastSeen = new Date().toISOString();
}

// ─────────────────────────────────────────────────────────────
// SM-2 SPACED REPETITION ALGORITHM
// grade: 0-5 (0-2 = failed/hard, 3 = pass, 4 = good, 5 = perfect)
// Automatically maps quiz scores → SM-2 grade
// ─────────────────────────────────────────────────────────────
function sm2(repetitions, easeFactor, interval, grade) {
  if (grade >= 3) {
    // Published SM-2 paper specifies interval[1]=6 days. We use 3 because
    // study sessions in a Kaggle-style demo / classroom evaluation cluster
    // into shorter windows than the Polish-language-vocabulary use case the
    // original paper validated against. A 3-day second-review tightens the
    // feedback loop for short-term mastery without changing the geometric
    // growth from rep 2 onward (still interval * easeFactor).
    if (repetitions === 0)      interval = 1;
    else if (repetitions === 1) interval = 3;
    else                        interval = Math.round(interval * easeFactor);

    easeFactor = easeFactor + (0.1 - (5 - grade) * (0.08 + (5 - grade) * 0.02));
    if (easeFactor < 1.3) easeFactor = 1.3;
    repetitions += 1;
  } else {
    // Failed — reset repetitions but keep ease factor
    repetitions = 0;
    interval    = 1;
  }

  const nextReview = new Date();
  nextReview.setDate(nextReview.getDate() + interval);
  nextReview.setHours(0, 0, 0, 0);

  return {
    repetitions,
    easeFactor: Math.round(easeFactor * 100) / 100,
    interval,
    nextReview: nextReview.toISOString()
  };
}

// Convert quiz score (0-100) to SM-2 grade (0-5)
function scoreToGrade(score) {
  if (score >= 90) return 5;
  if (score >= 75) return 4;
  if (score >= 60) return 3;
  if (score >= 40) return 2;
  if (score >= 20) return 1;
  return 0;
}

// Default SRS state for a new topic
function defaultSRS() {
  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);
  tomorrow.setHours(0, 0, 0, 0);
  return {
    repetitions: 0,
    easeFactor:  2.5,
    interval:    1,
    nextReview:  tomorrow.toISOString()
  };
}

// ─────────────────────────────────────────────────────────────
// CORE PROGRESS FUNCTIONS  (multi-student aware)
// All functions accept an optional `studentId` parameter.
// When omitted they fall back to DEFAULT_STUDENT for backward compat.
// ─────────────────────────────────────────────────────────────

// Save a study event: topic studied, optional quiz score (0-100), level
function saveProgress(topic, level, quizScore = null, studentId = DEFAULT_STUDENT, studentName = null) {
  const store = readStore();
  ensureStudent(store, studentId, studentName);

  const studentTopics = store.topics[studentId];

  if (!studentTopics[topic]) {
    studentTopics[topic] = {
      timesStudied: 0,
      scores:       [],
      level,
      lastStudied:  null,
      srs:          defaultSRS()
    };
  }

  const t = studentTopics[topic];
  t.timesStudied += 1;
  t.lastStudied   = new Date().toISOString();
  t.level         = level;

  if (quizScore !== null) {
    t.scores.push(quizScore);
    const grade = scoreToGrade(quizScore);
    const srs   = t.srs || defaultSRS();
    t.srs = sm2(srs.repetitions, srs.easeFactor, srs.interval, grade);
  }

  if (!t.srs) t.srs = defaultSRS();

  // Add session log entry (includes studentId)
  store.sessions.push({
    studentId,
    topic,
    level,
    quizScore,
    timestamp: new Date().toISOString()
  });

  // Keep only last 200 sessions (raised limit for multi-student)
  if (store.sessions.length > 200) store.sessions = store.sessions.slice(-200);

  writeStore(store);
  return studentTopics[topic];
}

// Update SRS for a topic after a dedicated review session
function updateSRS(topic, grade, studentId = DEFAULT_STUDENT) {
  const store = readStore();
  ensureStudent(store, studentId);

  const studentTopics = store.topics[studentId];
  if (!studentTopics[topic]) return null;

  const t   = studentTopics[topic];
  const srs = t.srs || defaultSRS();
  t.srs     = sm2(srs.repetitions, srs.easeFactor, srs.interval, grade);

  writeStore(store);
  return t.srs;
}

// Get topics due for review today (nextReview <= now)
function getDueReviews(studentId = DEFAULT_STUDENT) {
  const store = readStore();
  const now   = new Date();
  now.setHours(23, 59, 59, 999);

  const studentTopics = store.topics[studentId] || {};

  return Object.entries(studentTopics)
    .filter(([, data]) => {
      if (!data.srs || !data.srs.nextReview) return false;
      return new Date(data.srs.nextReview) <= now;
    })
    .map(([name, data]) => ({
      name,
      level:        data.level,
      nextReview:   data.srs.nextReview,
      interval:     data.srs.interval,
      repetitions:  data.srs.repetitions,
      easeFactor:   data.srs.easeFactor,
      avgScore:     data.scores.length > 0
        ? Math.round(data.scores.reduce((a, b) => a + b, 0) / data.scores.length)
        : null
    }))
    .sort((a, b) => new Date(a.nextReview) - new Date(b.nextReview));
}

// ─────────────────────────────────────────────────────────────
// STREAK TRACKING  (per-student)
// ─────────────────────────────────────────────────────────────
function getLearningStreak(studentId = DEFAULT_STUDENT) {
  const store = readStore();
  const studentSessions = store.sessions.filter(s => (s.studentId || DEFAULT_STUDENT) === studentId);

  if (!studentSessions.length) return { current: 0, longest: 0, lastStudied: null };

  const daySet = new Set(studentSessions.map(s => s.timestamp.slice(0, 10)));
  const days = [...daySet].sort().reverse();

  const todayStr     = new Date().toISOString().slice(0, 10);
  const yesterdayStr = (() => {
    const d = new Date();
    d.setDate(d.getDate() - 1);
    return d.toISOString().slice(0, 10);
  })();

  let current = 0;
  if (days[0] === todayStr || days[0] === yesterdayStr) {
    let checkDate = new Date(days[0]);
    for (const day of days) {
      const d = new Date(day);
      const diffDays = Math.round((checkDate - d) / (1000 * 60 * 60 * 24));
      if (diffDays === 0 || diffDays === 1) {
        current++;
        checkDate = d;
      } else {
        break;
      }
    }
  }

  let longest = 0;
  let run     = 1;
  const sortedAsc = [...daySet].sort();
  for (let i = 1; i < sortedAsc.length; i++) {
    const prev = new Date(sortedAsc[i - 1]);
    const curr = new Date(sortedAsc[i]);
    const diff = Math.round((curr - prev) / (1000 * 60 * 60 * 24));
    if (diff === 1) { run++; } else { run = 1; }
    if (run > longest) longest = run;
  }
  if (sortedAsc.length > 0 && longest < 1) longest = 1;

  return {
    current,
    longest: Math.max(longest, current),
    lastStudied:  days[0] || null,
    studiedToday: days[0] === todayStr
  };
}

// ─────────────────────────────────────────────────────────────
// PROGRESS SUMMARY  (per-student)
// ─────────────────────────────────────────────────────────────
function getProgressSummary(studentId = DEFAULT_STUDENT) {
  const store         = readStore();
  const studentTopics = store.topics[studentId] || {};
  const studentSessions = store.sessions.filter(s => (s.studentId || DEFAULT_STUDENT) === studentId);

  const topics = Object.entries(studentTopics).map(([name, data]) => {
    const avgScore = data.scores.length > 0
      ? Math.round(data.scores.reduce((a, b) => a + b, 0) / data.scores.length)
      : null;
    return { name, timesStudied: data.timesStudied, avgScore, lastStudied: data.lastStudied };
  });

  const weakAreas = topics
    .filter(t => t.avgScore === null || t.avgScore < 70)
    .map(t => t.name);

  const strongAreas = topics
    .filter(t => t.avgScore !== null && t.avgScore >= 80)
    .map(t => t.name);

  const streak     = getLearningStreak(studentId);
  const dueReviews = getDueReviews(studentId);

  return {
    studentId,
    totalTopicsStudied: topics.length,
    totalSessions:      studentSessions.length,
    topics,
    weakAreas,
    strongAreas,
    recentTopics: studentSessions.slice(-5).map(s => s.topic).reverse(),
    streak,
    dueReviews: dueReviews.length
  };
}

// ─────────────────────────────────────────────────────────────
// TEACHER / CLASS-WIDE AGGREGATION HELPERS
// ─────────────────────────────────────────────────────────────

// List all known students
function listStudents() {
  const store = readStore();
  return Object.entries(store.students).map(([id, meta]) => ({
    id,
    name:      meta.name,
    firstSeen: meta.firstSeen,
    lastSeen:  meta.lastSeen
  }));
}

// Get raw store for teacher dashboard (all students, all topics, all sessions)
function getFullClassData() {
  const store    = readStore();
  const students = listStudents();

  const perStudent = students.map(s => {
    const summary = getProgressSummary(s.id);
    return { ...s, ...summary };
  });

  return {
    students:    perStudent,
    allSessions: store.sessions,
    classSize:   students.length
  };
}

// Clear all progress (for reset feature) — per student or all
function clearProgress(studentId) {
  if (studentId) {
    const store = readStore();
    store.sessions = store.sessions.filter(s => (s.studentId || DEFAULT_STUDENT) !== studentId);
    delete store.topics[studentId];
    delete store.students[studentId];
    writeStore(store);
  } else {
    writeStore({ sessions: [], topics: {}, students: {} });
  }
}

module.exports = {
  saveProgress,
  getProgressSummary,
  clearProgress,
  updateSRS,
  getDueReviews,
  getLearningStreak,
  // Multi-student / teacher helpers
  listStudents,
  getFullClassData,
  DEFAULT_STUDENT,
  // EventEmitter delegation for SSE
  on:   (...args) => emitter.on(...args),
  off:  (...args) => emitter.off(...args),
  emit: (...args) => emitter.emit(...args),
};

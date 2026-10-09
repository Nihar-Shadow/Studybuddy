
const express = require('express');
const router  = express.Router();

// ── Progress Routes ──────────────────────────────
// /progress, /progress-report, /due-reviews, /srs/:topic, /streak

const { getProgressSummary, clearProgress, updateSRS, getDueReviews, getLearningStreak, listStudents, getFullClassData, DEFAULT_STUDENT } = require('../agent/progressStore');
const { saveProgress } = require('../agent/progressStore');
const { toolImplementations } = require('../agent/tools');
const { flowTraces }          = require('../middleware/devTiming');
const { requireAuth, requireTeacher } = require('./auth');

// All progress endpoints require an authenticated session.
// Teachers can read any studentId; students are pinned to their own.
router.use(requireAuth);

// Helper: resolve studentId from session or query param.
// Students cannot read other students by passing ?studentId=...
function resolveStudent(req) {
  if (req.session?.role === 'teacher') {
    return req.query.studentId || DEFAULT_STUDENT;
  }
  return req.session?.studentId || DEFAULT_STUDENT;
}

// GET student's full progress summary
router.get('/progress', (req, res) => {
  try {
    const studentId = resolveStudent(req);
    res.json(getProgressSummary(studentId));
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// DELETE — reset progress (per-student or all)
router.delete('/progress', (req, res) => {
  try {
    if (req.query.all === 'true') {
      // Class-wide wipe is teacher-only.
      if (req.session?.role !== 'teacher') {
        return res.status(403).json({ error: 'Teacher access required to wipe all progress' });
      }
      clearProgress();
      res.json({ success: true, message: 'All progress cleared' });
    } else {
      const studentId = resolveStudent(req);
      clearProgress(studentId);
      res.json({ success: true, message: `Progress cleared for ${studentId}` });
    }
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST — Dynamic Progress Evaluation Report
router.post('/progress-report', async (req, res) => {
  const reportStart = Date.now();
  const steps       = [];
  const mark        = (name, detail) => steps.push({ name, ms: Date.now() - reportStart, detail });

  console.log(`\n⏱  [/progress-report] Evaluation Report generation started`);
  mark('Received request');

  try {
    const studentId = req.session?.studentId || DEFAULT_STUDENT;
    const result  = await toolImplementations.generate_evaluation_report(studentId);
    const elapsed = Date.now() - reportStart;
    mark('LLM generation done', `${(elapsed / 1000).toFixed(2)}s`);

    console.log(`✅ [/progress-report] Evaluation Report done in ${(elapsed / 1000).toFixed(2)}s`);

    // Store flow trace for dev panel
    flowTraces['/progress-report'] = {
      route: '/progress-report', ts: Date.now(), totalMs: elapsed, status: 'ok',
      input: 'Evaluation Report', steps
    };

    res.json({ success: true, report: result });
  } catch (err) {
    const elapsed = Date.now() - reportStart;
    mark('ERROR', err.message);
    flowTraces['/progress-report'] = {
      route: '/progress-report', ts: Date.now(), totalMs: elapsed, status: 'error',
      input: 'Evaluation Report', steps
    };
    console.error(`❌ [/progress-report] Error after ${(elapsed / 1000).toFixed(2)}s:`, err.message);
    res.status(500).json({ success: false, error: err.message });
  }
});

// GET topics due for review today
router.get('/due-reviews', (req, res) => {
  try {
    const studentId = resolveStudent(req);
    res.json({ reviews: getDueReviews(studentId) });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /progress/quiz-score — save a completed standalone quiz score
// Called by the frontend when a student finishes a quiz card
router.post('/progress/quiz-score', (req, res) => {
  try {
    const { topic, score, level } = req.body;
    if (!topic || score === undefined) {
      return res.status(400).json({ error: 'topic and score are required' });
    }
    const studentId   = req.session?.studentId   || DEFAULT_STUDENT;
    const studentName = req.session?.studentName || null;
    const pctScore    = Math.round(Math.min(100, Math.max(0, Number(score))));
    const lvl         = level || 'intermediate';

    // Save to progress store (this records the session + score)
    saveProgress(topic, lvl, pctScore, studentId, studentName);

    // Also update SRS so spaced-repetition intervals adjust
    updateSRS(topic, pctScore, studentId);

    console.log(`[quiz-score] ${studentName || studentId} → "${topic}" ${pctScore}%`);
    res.json({ success: true, topic, score: pctScore });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// PUT update SRS after a review session
// grade: 0-5 (0=failed, 3=passed, 5=perfect)  OR  score: 0-100 (auto-converted)
router.put('/srs/:topic', (req, res) => {
  const topic = decodeURIComponent(req.params.topic);
  let { grade, score } = req.body;

  // Allow passing a raw quiz score instead of a grade
  if (grade === undefined && score !== undefined) {
    if (score >= 90)      grade = 5;
    else if (score >= 75) grade = 4;
    else if (score >= 60) grade = 3;
    else if (score >= 40) grade = 2;
    else                  grade = 0;
  }

  if (grade === undefined || grade < 0 || grade > 5) {
    return res.status(400).json({ error: 'grade (0-5) or score (0-100) required' });
  }

  try {
    const studentId = resolveStudent(req);
    const updated = updateSRS(topic, grade, studentId);
    if (!updated) return res.status(404).json({ error: 'Topic not found in progress' });
    res.json({ success: true, topic, srs: updated });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET learning streak
router.get('/streak', (req, res) => {
  try {
    const studentId = resolveStudent(req);
    res.json(getLearningStreak(studentId));
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ─────────────────────────────────────────────────
// TEACHER / CLASS-WIDE ENDPOINTS
// ─────────────────────────────────────────────────

// GET all students (for teacher dropdown)
router.get('/api/students', requireTeacher, (req, res) => {
  try {
    res.json({ students: listStudents() });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET full class data (all students, all topics, all sessions)
router.get('/api/class-data', requireTeacher, (req, res) => {
  try {
    res.json(getFullClassData());
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ─────────────────────────────────────────────────
// STUDENT PDF REPORT DATA  (teacher only)
// Returns a rich structured payload for client-side PDF generation.
// ─────────────────────────────────────────────────
router.get('/api/student-report/:studentId', requireTeacher, (req, res) => {
  try {
    const { studentId } = req.params;
    const store = require('../agent/progressStore');
    const summary = getProgressSummary(studentId);
    const classData = getFullClassData();
    const studentMeta = classData.students.find(s => s.id === studentId) || {};
    const streak = summary.streak || {};

    // Per-topic deep breakdown with SRS info
    const { readStore } = (() => {
      // Inline read — reuse the store module's data
      const fs   = require('fs');
      const path = require('path');
      const storeRaw = JSON.parse(fs.readFileSync(path.join(__dirname, '../data/progress.json'), 'utf8'));
      return { readStore: () => storeRaw };
    })();
    const raw = readStore();
    const topicDetails = Object.entries(raw.topics[studentId] || {}).map(([name, data]) => {
      const scores  = data.scores || [];
      const avg     = scores.length ? Math.round(scores.reduce((a,b)=>a+b,0)/scores.length) : null;
      const trend   = scores.length >= 2
        ? (scores[scores.length-1] - scores[0] > 0 ? 'improving' : scores[scores.length-1] - scores[0] < 0 ? 'declining' : 'stable')
        : 'new';
      return {
        name,
        timesStudied:  data.timesStudied || 0,
        level:         data.level || 'beginner',
        scores,
        avgScore:      avg,
        lastStudied:   data.lastStudied,
        trend,
        srsInterval:   data.srs?.interval || 1,
        srsRepetitions: data.srs?.repetitions || 0,
        nextReview:    data.srs?.nextReview || null,
        mastery: avg === null ? 'untested' : avg >= 85 ? 'mastered' : avg >= 65 ? 'developing' : 'needs-work'
      };
    });

    // Classify strengths / weaknesses / untested
    const strengths   = topicDetails.filter(t => t.mastery === 'mastered');
    const developing  = topicDetails.filter(t => t.mastery === 'developing');
    const needsWork   = topicDetails.filter(t => t.mastery === 'needs-work');
    const untested    = topicDetails.filter(t => t.mastery === 'untested');

    // Session timeline (last 30)
    const sessions = (raw.sessions || [])
      .filter(s => (s.studentId || 'default') === studentId)
      .slice(-30)
      .reverse();

    // Overall engagement score (0–100)
    const engagement = Math.min(100, Math.round(
      (streak.current || 0) * 5 +
      summary.totalSessions * 2 +
      summary.totalTopicsStudied * 3
    ));

    res.json({
      generatedAt: new Date().toISOString(),
      student: {
        id:        studentId,
        name:      studentMeta.name || studentId,
        firstSeen: studentMeta.firstSeen,
        lastSeen:  studentMeta.lastSeen
      },
      summary: {
        totalTopics:   summary.totalTopicsStudied,
        totalSessions: summary.totalSessions,
        dueReviews:    summary.dueReviews,
        engagement
      },
      streak: {
        current: streak.current || 0,
        longest: streak.longest || 0,
        studiedToday: streak.studiedToday || false
      },
      strengths,
      developing,
      needsWork,
      untested,
      topicDetails,
      recentTopics: summary.recentTopics || [],
      sessions
    });
  } catch (err) {
    console.error('[student-report]', err);
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;

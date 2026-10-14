'use strict';

const { CURRICULUM_CONCEPTS } = require('./curriculumKnowledge');
const { CLASS_9_KNOWLEDGE } = require('./class9Knowledge');
function getTargetedPracticeSafe(spec, lang) {
  try {
    const tp = require('./targetedPractice');
    return tp && typeof tp.getTargetedPractice === 'function' ? tp.getTargetedPractice(spec, lang) : null;
  } catch (_) {
    return null;
  }
}

/**
 * Deterministic Mastery States for StudyBuddy
 */
const MASTERY_STATES = {
  UNKNOWN: 'unknown',
  INTRODUCED: 'introduced',
  PARTIAL: 'partial',
  NEEDS_REVIEW: 'needs_review',
  MASTERED: 'mastered'
};

/**
 * Calculates SuperMemo-2 (SM-2) spaced repetition parameters deterministically.
 * @param {number} repetitions Current consecutive successful reviews
 * @param {number} easeFactor Difficulty factor (default 2.5, min 1.3)
 * @param {number} interval Interval in days
 * @param {boolean} isCorrect Whether current attempt was successful
 * @param {number|Date} baseDate Base timestamp for scheduling
 */
function calculateSM2(repetitions = 0, easeFactor = 2.5, interval = 0, isCorrect = true, baseDate = Date.now()) {
  let rep = Number(repetitions) || 0;
  let ef = Number(easeFactor) || 2.5;
  let iv = Number(interval) || 0;

  if (isCorrect) {
    if (rep === 0) {
      iv = 1;
    } else if (rep === 1) {
      iv = 3;
    } else {
      iv = Math.max(1, Math.round(iv * ef));
    }
    rep += 1;
    ef = Math.max(1.3, Math.round((ef + 0.1) * 100) / 100);
  } else {
    rep = 0;
    iv = 1;
    ef = Math.max(1.3, Math.round((ef - 0.2) * 100) / 100);
  }

  const nextDate = new Date(baseDate);
  nextDate.setDate(nextDate.getDate() + iv);
  nextDate.setHours(0, 0, 0, 0);

  return {
    repetitions: rep,
    easeFactor: ef,
    interval: iv,
    nextReview: nextDate.toISOString()
  };
}

/**
 * Checks whether a concept review is due based on SM-2 nextReview timestamp.
 */
function isReviewDue(conceptState, currentTime = Date.now()) {
  if (!conceptState || !conceptState.nextReview) return false;
  const reviewTime = new Date(conceptState.nextReview).getTime();
  if (isNaN(reviewTime)) return false;
  const now = typeof currentTime === 'number' ? currentTime : new Date(currentTime).getTime();
  return reviewTime <= now;
}

/**
 * Resolves curriculum knowledge metadata for any concept ID or topic name.
 */
function resolveCurriculumMetadata(conceptId) {
  if (!conceptId || typeof conceptId !== 'string') return null;
  const idLower = conceptId.trim().toLowerCase();

  // 1. Direct ID match in CURRICULUM_CONCEPTS
  let found = CURRICULUM_CONCEPTS.find(c => c.id.toLowerCase() === idLower);
  if (found) return found;

  // 2. Topic match in CURRICULUM_CONCEPTS
  found = CURRICULUM_CONCEPTS.find(c => c.topic && c.topic.toLowerCase() === idLower);
  if (found) return found;

  // 3. Fallback to CLASS_9_KNOWLEDGE
  if (CLASS_9_KNOWLEDGE[idLower]) {
    const k = CLASS_9_KNOWLEDGE[idLower];
    return {
      id: k.id,
      topic: k.id,
      name: { en: k.englishName, od: k.odiaName },
      prerequisites: [],
      misconceptions: (k.commonMisconceptions || []).map(m => ({ misconception: m }))
    };
  }

  return null;
}

/**
 * Evaluates mastery for a specific concept deterministically based solely on evidence.
 * LLM judgment is NEVER used.
 */
function evaluateMastery(conceptId, learningState, options = {}) {
  const currentTime = options.currentTime || Date.now();
  if (!learningState || !learningState.concepts) {
    return {
      conceptId: conceptId || 'unknown',
      topic: conceptId || 'unknown',
      concept: conceptId || 'unknown',
      masteryState: MASTERY_STATES.UNKNOWN,
      confidence: 0,
      evidence: [],
      correctCount: 0,
      incorrectCount: 0,
      isMastered: false,
      scheduling: { repetitions: 0, interval: 0, easeFactor: 2.5, nextReview: null }
    };
  }

  // Normalize key resolution
  const idStr = String(conceptId || '').trim();
  const [topicPart, subPart] = idStr.includes(':') ? idStr.split(':') : [idStr, idStr];
  const optTopic = options.topic || options.currentTopic;

  let entry = learningState.concepts[idStr]
    || (subPart && learningState.concepts[`${topicPart}:${subPart}`])
    || (optTopic && subPart && learningState.concepts[`${optTopic}:${subPart}`])
    || (optTopic && learningState.concepts[optTopic])
    || learningState.concepts[topicPart]
    || (subPart && learningState.concepts[subPart]);

  if (!entry) {
    const found = Object.keys(learningState.concepts).find(k => k === subPart || k.endsWith(`:${subPart}`) || (topicPart && k.startsWith(`${topicPart}:`)));
    if (found) entry = learningState.concepts[found];
  }

  if (!entry || !Array.isArray(entry.evidence) || entry.evidence.length === 0) {
    return {
      conceptId: idStr,
      topic: topicPart,
      concept: subPart || topicPart,
      masteryState: MASTERY_STATES.UNKNOWN,
      confidence: 0,
      evidence: [],
      correctCount: 0,
      incorrectCount: 0,
      isMastered: false,
      scheduling: {
        repetitions: entry?.repetitions || 0,
        interval: entry?.interval || 0,
        easeFactor: entry?.easeFactor || 2.5,
        nextReview: entry?.nextReview || null
      }
    };
  }

  const rawEvidence = entry.evidence;
  const evidenceTypes = rawEvidence.map(e => (typeof e === 'object' ? (e.evidence || e.type) : String(e)));

  const correctCount = evidenceTypes.filter(t => t === 'practice_correct').length;
  const incorrectCount = evidenceTypes.filter(t => t === 'practice_incorrect').length;
  const repairCount = evidenceTypes.filter(t => t === 'needed_repair').length;
  const misconceptionCount = evidenceTypes.filter(t => t === 'misconception_demonstrated').length;
  const askedCount = evidenceTypes.filter(t => t === 'asked_about_concept').length;

  const lastPracticeEvent = [...rawEvidence].reverse().find(e => {
    const t = typeof e === 'object' ? (e.evidence || e.type) : String(e);
    return t === 'practice_correct' || t === 'practice_incorrect';
  });
  const lastPracticeType = lastPracticeEvent
    ? (typeof lastPracticeEvent === 'object' ? (lastPracticeEvent.evidence || lastPracticeEvent.type) : String(lastPracticeEvent))
    : null;

  const reviewDue = isReviewDue(entry, currentTime);

  let masteryState = MASTERY_STATES.PARTIAL;
  let confidence = Number(entry.confidence) || 0;

  // 1. Misconception or recent failure or explicit needs_review -> needs_review
  if (misconceptionCount > 0 || lastPracticeType === 'practice_incorrect' || entry.status === 'needs_review') {
    masteryState = MASTERY_STATES.NEEDS_REVIEW;
    confidence = Math.max(0.05, Math.min(0.35, confidence || 0.20));
  } else if (reviewDue) {
    // Spaced review is due
    masteryState = MASTERY_STATES.NEEDS_REVIEW;
    confidence = Math.max(0.40, Math.min(0.70, confidence || 0.50));
  } else if (correctCount === 0) {
    // Zero demonstrated practice attempts
    if (askedCount > 0 || repairCount > 0) {
      masteryState = MASTERY_STATES.INTRODUCED;
      confidence = Math.max(0.20, Math.min(0.40, confidence || 0.25));
    } else {
      masteryState = MASTERY_STATES.UNKNOWN;
      confidence = 0;
    }
  } else if (correctCount === 1) {
    masteryState = MASTERY_STATES.PARTIAL;
    confidence = Math.max(0.35, Math.min(0.65, confidence || 0.50));
  } else if (correctCount >= 2) {
    // Repeated demonstrated success
    const recentFailures = evidenceTypes.slice(-4).filter(t =>
      t === 'practice_incorrect' || t === 'needed_repair' || t === 'misconception_demonstrated'
    ).length;

    if (recentFailures === 0 && (confidence >= 0.70 || correctCount >= 2)) {
      masteryState = MASTERY_STATES.MASTERED;
      confidence = Math.max(0.80, Math.min(1.0, confidence || 0.85));
    } else {
      masteryState = MASTERY_STATES.PARTIAL;
      confidence = Math.max(0.50, Math.min(0.75, confidence || 0.60));
    }
  }

  return {
    conceptId: idStr,
    topic: topicPart,
    concept: subPart || topicPart,
    masteryState,
    confidence: Math.round(confidence * 100) / 100,
    evidence: evidenceTypes,
    correctCount,
    incorrectCount,
    isMastered: masteryState === MASTERY_STATES.MASTERED,
    scheduling: {
      repetitions: entry.repetitions || 0,
      interval: entry.interval || 0,
      easeFactor: entry.easeFactor || 2.5,
      nextReview: entry.nextReview || null
    }
  };
}

/**
 * Checks direct prerequisites for a concept deterministically.
 */
function checkPrerequisites(conceptId, learningState, options = {}) {
  const metadata = resolveCurriculumMetadata(conceptId);
  if (!metadata || !Array.isArray(metadata.prerequisites) || metadata.prerequisites.length === 0) {
    return { satisfied: true, prerequisites: [] };
  }

  for (const prereqId of metadata.prerequisites) {
    const prereqEval = evaluateMastery(prereqId, learningState, options);
    if (prereqEval.masteryState === MASTERY_STATES.NEEDS_REVIEW) {
      return {
        satisfied: false,
        blockedBy: prereqId,
        status: 'needs_review',
        reason: 'Prerequisite for the current concept is not yet secure.',
        prerequisiteState: prereqEval
      };
    }
    if (prereqEval.masteryState === MASTERY_STATES.UNKNOWN) {
      return {
        satisfied: false,
        blockedBy: prereqId,
        status: 'unstudied',
        reason: 'Prerequisite has not been introduced yet.',
        prerequisiteState: prereqEval
      };
    }
  }

  return { satisfied: true, prerequisites: metadata.prerequisites };
}

/**
 * Checks if student message demonstrates a known factual misconception.
 */
function checkMisconception(conceptId, studentText = '') {
  if (!studentText || typeof studentText !== 'string') return { detected: false };
  const metadata = resolveCurriculumMetadata(conceptId);
  if (!metadata || !Array.isArray(metadata.misconceptions) || metadata.misconceptions.length === 0) {
    return { detected: false };
  }

  const clean = studentText.toLowerCase();

  // Known canonical misconceptions
  if (/respiration|ଶ୍ୱସନ/i.test(metadata.id) || /respiration|ଶ୍ୱସନ/i.test(metadata.topic)) {
    if (/ରାତିରେ\s*କେବଳ|କେବଳ\s*ରାତିରେ|only\s*at\s*night/i.test(clean) && /ଶ୍ୱସନ|ଶ୍ୱାସ|respire/i.test(clean)) {
      return {
        detected: true,
        misconception: 'Plants only respire at night',
        correction: 'Plants respire continuously both day and night.'
      };
    }
  }

  if (/photosynthesis|ଆଲୋକ\s*ସଂଶ୍ଳେଷଣ/i.test(metadata.id) || /photosynthesis|ଆଲୋକ\s*ସଂଶ୍ଳେଷଣ/i.test(metadata.topic)) {
    if (/ଅମ୍ଳଜାନ\s*ଗ୍ରହଣ|takes\s*in\s*oxygen|absorbs\s*oxygen/i.test(clean) && !/ଶ୍ୱସନ|respiration/i.test(clean)) {
      return {
        detected: true,
        misconception: 'Oxygen is absorbed during photosynthesis',
        correction: 'Plants absorb carbon dioxide and release oxygen during photosynthesis.'
      };
    }
  }

  if (/force|motion|ଗତି|ବଳ/i.test(metadata.id) || /force|motion|ଗତି|ବଳ/i.test(metadata.topic)) {
    if (/action\s*reaction/i.test(clean) && /first\s*law|ପ୍ରଥମ\s*ନିୟମ/i.test(clean)) {
      return {
        detected: true,
        misconception: "Newton's First Law is Action-Reaction",
        correction: "Newton's First Law is the Law of Inertia; Third Law is Action and Reaction."
      };
    }
  }

  return { detected: false };
}

/**
 * Formats student-facing decision description and button label.
 */
function formatStudentFacingDecision(action, reason, language = 'Odia') {
  const isOd = language === 'Odia' || (typeof language === 'string' && language.toLowerCase().includes('odia'));

  switch (action) {
    case 'practice':
      return {
        title: isOd ? '🧠 ଏବେ କ\'ଣ କରିବା?' : '🧠 What should we do next?',
        text: isOd
          ? 'ଏହି ବିଷୟଟି ଆହୁରି ଭଲଭାବେ ବୁଝିବା ପାଇଁ ଗୋଟିଏ ପ୍ରଶ୍ନ ଅଭ୍ୟାସ କରିବା।'
          : 'Let\'s practice a question to strengthen your understanding.',
        buttonLabel: isOd ? '📝 ଅଭ୍ୟାସ କରିବା' : '📝 Practice a question'
      };

    case 'review':
      return {
        title: isOd ? '🔄 ପୁଣିଥରେ ଅଭ୍ୟାସ କରିବା' : '🔄 Review and practice again',
        text: isOd
          ? 'ଚାଲ, ଏହି ଧାରଣାଟିକୁ ଆଉଥରେ ଭଲଭାବେ ଅଭ୍ୟାସ କରି ସ୍ପଷ୍ଟ କରିବା।'
          : 'Let\'s review and practice this concept again to make it clear.',
        buttonLabel: isOd ? '🔄 ପୁଣିଥରେ ଅଭ୍ୟାସ କରିବା' : '🔄 Practice again'
      };

    case 'advance':
      return {
        title: isOd ? '🎉 ଧାରଣା ସମ୍ପୂର୍ଣ୍ଣ ଆୟତ୍ତ ହୋଇଛି!' : '🎉 Concept Mastered!',
        text: isOd
          ? 'ତୁମେ ଏହି ବିଷୟଟି ଭଲଭାବେ ବୁଝିସାରିଛ। ଚାଲ, ପରବର୍ତ୍ତୀ ବିଷୟ ଆରମ୍ଭ କରିବା।'
          : 'You have mastered this concept! Let\'s advance to the next topic.',
        buttonLabel: isOd ? '🚀 ପରବର୍ତ୍ତୀ ବିଷୟ ଶିଖିବା' : '🚀 Advance to next topic'
      };

    case 'introduce':
    default:
      return {
        title: isOd ? '📚 ପ୍ରଥମେ ଏହାକୁ ଶିଖିବା' : '📚 Learn this first',
        text: isOd
          ? 'ଚାଲ, ଏହି ବିଷୟଟିକୁ ସହଜ ଭାବରେ ବୁଝିବା।'
          : 'Let\'s learn this topic step-by-step in a simple way.',
        buttonLabel: isOd ? '📖 ଶିଖିବା ଆରମ୍ଭ କର' : '📖 Start learning'
      };
  }
}

/**
 * Deterministic Mastery Agent Action Decision Engine.
 * Follows strict concept-scoping in Current Question Mode.
 */
function chooseMasteryAction(learningState, options = {}) {
  const currentTopic = options.currentTopic || options.topic;
  const currentConcept = options.currentConcept || options.concept;
  const conceptId = options.conceptId
    || (currentTopic && currentConcept && currentConcept !== currentTopic ? `${currentTopic}:${currentConcept}` : (currentTopic || currentConcept));
  const language = options.language || 'Odia';
  const currentTime = options.currentTime || Date.now();
  const studentMessage = options.studentMessage || '';

  // ─────────────────────────────────────────────────────────────────────────
  // MODE A: Current Question Mode (Explicit concept active)
  // Strict concept scoping: evaluates current concept ONLY.
  // ─────────────────────────────────────────────────────────────────────────
  if (currentTopic) {
    // 1. Check for student misconception
    if (studentMessage) {
      const misc = checkMisconception(conceptId, studentMessage);
      if (misc.detected) {
        // Record misconception evidence into learning state
        if (learningState && typeof learningState === 'object') {
          const entry = learningState.concepts?.[currentTopic];
          if (entry) {
            entry.status = MASTERY_STATES.NEEDS_REVIEW;
            entry.confidence = Math.max(0.1, Math.min(0.3, (entry.confidence || 0.2) - 0.15));
            entry.evidence = entry.evidence || [];
            entry.evidence.push({ type: 'misconception_demonstrated', detail: misc.misconception, timestamp: currentTime });
          }
        }
        const studentFacing = formatStudentFacingDecision('review', 'misconception_detected', language);
        return {
          action: 'review',
          conceptId,
          topic: currentTopic,
          concept: currentConcept || currentTopic,
          masteryState: MASTERY_STATES.NEEDS_REVIEW,
          confidence: 0.25,
          reason: `Factual misconception detected: ${misc.misconception}`,
          evidence: ['misconception_demonstrated'],
          prerequisite: null,
          nextReview: new Date(currentTime + 86400000).toISOString(),
          scheduling: { repetitions: 0, interval: 1, easeFactor: 2.3 },
          studentFacingReason: studentFacing
        };
      }
    }

    // 2. Evaluate current concept's mastery state
    const evalResult = evaluateMastery(conceptId, learningState, { currentTime, topic: currentTopic });

    // 3. Prerequisite check: If current concept is struggling or unstudied, check prerequisites
    if (evalResult.masteryState === MASTERY_STATES.UNKNOWN || evalResult.masteryState === MASTERY_STATES.NEEDS_REVIEW) {
      const prereqCheck = checkPrerequisites(conceptId, learningState, { currentTime });
      if (!prereqCheck.satisfied && prereqCheck.status === 'needs_review') {
        const studentFacing = formatStudentFacingDecision('review', prereqCheck.reason, language);
        return {
          action: 'review',
          conceptId: prereqCheck.blockedBy,
          topic: prereqCheck.blockedBy,
          concept: prereqCheck.blockedBy,
          masteryState: MASTERY_STATES.NEEDS_REVIEW,
          confidence: prereqCheck.prerequisiteState.confidence,
          reason: prereqCheck.reason,
          prerequisiteFor: conceptId,
          evidence: prereqCheck.prerequisiteState.evidence,
          nextReview: prereqCheck.prerequisiteState.scheduling.nextReview,
          scheduling: prereqCheck.prerequisiteState.scheduling,
          studentFacingReason: studentFacing
        };
      }
    }

    // 4. Action determination based on current mastery state
    let action = 'practice';
    let reason = 'partially_understood';

    if (evalResult.masteryState === MASTERY_STATES.NEEDS_REVIEW) {
      action = 'review';
      if (isReviewDue(evalResult.scheduling, currentTime)) {
        reason = 'spaced_review_due';
      } else if (evalResult.evidence[evalResult.evidence.length - 1] === 'practice_incorrect') {
        reason = 'practice_incorrect';
      } else {
        reason = 'needs_review';
      }
    } else if (evalResult.masteryState === MASTERY_STATES.UNKNOWN) {
      action = 'introduce';
      reason = 'unexplored_topic';
    } else if (evalResult.masteryState === MASTERY_STATES.INTRODUCED) {
      action = 'practice';
      reason = 'concept_introduced_needs_practice';
    } else if (evalResult.masteryState === MASTERY_STATES.PARTIAL) {
      action = 'practice';
      reason = 'partially_understood';
    } else if (evalResult.masteryState === MASTERY_STATES.MASTERED) {
      // Concept is mastered! Check advancement to next curriculum concept
      const currIdx = CURRICULUM_CONCEPTS.findIndex(c => c.id === conceptId || c.topic === currentTopic);
      if (currIdx >= 0 && currIdx < CURRICULUM_CONCEPTS.length - 1) {
        const nextConcept = CURRICULUM_CONCEPTS[currIdx + 1];
        const nextPrereq = checkPrerequisites(nextConcept.id, learningState, { currentTime });
        if (nextPrereq.satisfied) {
          action = 'advance';
          reason = `Concept mastered. Ready to advance to ${nextConcept.name?.en || nextConcept.id}.`;
        } else {
          action = 'practice';
          reason = 'mastery_reinforcement';
        }
      } else {
        action = 'practice';
        reason = 'mastery_reinforcement';
      }
    }

    // 5. Check practice bank availability: Never invent practice questions
    if (action === 'practice' || action === 'review') {
      const validPractice = getTargetedPracticeSafe({ topic: currentTopic, concept: currentConcept || currentTopic }, language);
      if (!validPractice || validPractice.exhausted) {
        // No practice in bank -> safe introduction / exploration without fake questions
        if (evalResult.masteryState === MASTERY_STATES.UNKNOWN) {
          action = 'introduce';
          reason = 'unexplored_topic';
        }
      }
    }

    const studentFacing = formatStudentFacingDecision(action, reason, language);

    return {
      action,
      conceptId,
      topic: currentTopic,
      concept: currentConcept || currentTopic,
      masteryState: evalResult.masteryState,
      confidence: evalResult.confidence,
      reason,
      evidence: evalResult.evidence,
      prerequisite: null,
      nextReview: evalResult.scheduling.nextReview,
      scheduling: evalResult.scheduling,
      studentFacingReason: studentFacing
    };
  }

  // ─────────────────────────────────────────────────────────────────────────
  // MODE B: Background Mode (Student opens app without active question)
  // Priority: 1. Overdue needs_review -> 2. Due review -> 3. Weak partial -> 4. Next unknown
  // ─────────────────────────────────────────────────────────────────────────
  if (!learningState || !learningState.concepts) {
    const studentFacing = formatStudentFacingDecision('introduce', 'unexplored_topic', language);
    return {
      action: 'introduce',
      conceptId: 'photosynthesis',
      topic: 'photosynthesis',
      concept: 'photosynthesis',
      masteryState: MASTERY_STATES.UNKNOWN,
      confidence: 0,
      reason: 'unexplored_topic',
      evidence: [],
      prerequisite: null,
      nextReview: null,
      scheduling: { repetitions: 0, interval: 0, easeFactor: 2.5 },
      studentFacingReason: studentFacing
    };
  }

  // 1. Check overdue needs_review concepts
  const entries = Object.entries(learningState.concepts).map(([key, val]) => ({ key, ...val }));
  const needsReviewList = entries.filter(e => e.status === 'needs_review');
  if (needsReviewList.length > 0) {
    needsReviewList.sort((a, b) => (a.confidence - b.confidence) || ((b.lastSeen || 0) - (a.lastSeen || 0)));
    const target = needsReviewList[0];
    const evalRes = evaluateMastery(target.key, learningState, { currentTime });
    const studentFacing = formatStudentFacingDecision('review', 'needs_review', language);
    return {
      action: 'review',
      conceptId: target.key,
      topic: target.key.split(':')[0],
      concept: target.key.split(':')[1] || target.key,
      masteryState: MASTERY_STATES.NEEDS_REVIEW,
      confidence: evalRes.confidence,
      reason: 'needs_review',
      evidence: evalRes.evidence,
      prerequisite: null,
      nextReview: evalRes.scheduling.nextReview,
      scheduling: evalRes.scheduling,
      studentFacingReason: studentFacing
    };
  }

  // 2. Check due reviews via SM-2
  const dueList = entries.filter(e => isReviewDue(e, currentTime));
  if (dueList.length > 0) {
    const target = dueList[0];
    const evalRes = evaluateMastery(target.key, learningState, { currentTime });
    const studentFacing = formatStudentFacingDecision('review', 'spaced_review_due', language);
    return {
      action: 'review',
      conceptId: target.key,
      topic: target.key.split(':')[0],
      concept: target.key.split(':')[1] || target.key,
      masteryState: MASTERY_STATES.NEEDS_REVIEW,
      confidence: evalRes.confidence,
      reason: 'spaced_review_due',
      evidence: evalRes.evidence,
      prerequisite: null,
      nextReview: evalRes.scheduling.nextReview,
      scheduling: evalRes.scheduling,
      studentFacingReason: studentFacing
    };
  }

  // 3. Check partial concepts
  const partialList = entries.filter(e => e.status === 'partial');
  if (partialList.length > 0) {
    partialList.sort((a, b) => (a.confidence - b.confidence));
    const target = partialList[0];
    const evalRes = evaluateMastery(target.key, learningState, { currentTime });
    const studentFacing = formatStudentFacingDecision('practice', 'partially_understood', language);
    return {
      action: 'practice',
      conceptId: target.key,
      topic: target.key.split(':')[0],
      concept: target.key.split(':')[1] || target.key,
      masteryState: MASTERY_STATES.PARTIAL,
      confidence: evalRes.confidence,
      reason: 'partially_understood',
      evidence: evalRes.evidence,
      prerequisite: null,
      nextReview: evalRes.scheduling.nextReview,
      scheduling: evalRes.scheduling,
      studentFacingReason: studentFacing
    };
  }

  // 4. Introduce next curriculum topic
  for (const c of CURRICULUM_CONCEPTS) {
    const entry = learningState.concepts[c.id] || learningState.concepts[c.topic];
    if (!entry || entry.status === 'unknown') {
      const studentFacing = formatStudentFacingDecision('introduce', 'unexplored_topic', language);
      return {
        action: 'introduce',
        conceptId: c.id,
        topic: c.topic,
        concept: c.id,
        masteryState: MASTERY_STATES.UNKNOWN,
        confidence: 0,
        reason: 'unexplored_topic',
        evidence: [],
        prerequisite: null,
        nextReview: null,
        scheduling: { repetitions: 0, interval: 0, easeFactor: 2.5 },
        studentFacingReason: studentFacing
      };
    }
  }

  // 5. Default: First topic reinforcement
  const studentFacing = formatStudentFacingDecision('practice', 'mastery_reinforcement', language);
  return {
    action: 'practice',
    conceptId: 'photosynthesis',
    topic: 'photosynthesis',
    concept: 'photosynthesis',
    masteryState: MASTERY_STATES.MASTERED,
    confidence: 0.85,
    reason: 'mastery_reinforcement',
    evidence: [],
    prerequisite: null,
    nextReview: null,
    scheduling: { repetitions: 1, interval: 3, easeFactor: 2.5 },
    studentFacingReason: studentFacing
  };
}

/**
 * Returns all due reviews in the student learning state.
 */
function getDueReviews(learningState, currentTime = Date.now()) {
  if (!learningState || !learningState.concepts) return [];
  const due = [];
  for (const [key, entry] of Object.entries(learningState.concepts)) {
    if (isReviewDue(entry, currentTime) || entry.status === MASTERY_STATES.NEEDS_REVIEW) {
      due.push({
        conceptId: key,
        ...evaluateMastery(key, learningState, { currentTime })
      });
    }
  }
  return due;
}

module.exports = {
  MASTERY_STATES,
  calculateSM2,
  isReviewDue,
  evaluateMastery,
  checkPrerequisites,
  checkMisconception,
  chooseMasteryAction,
  getDueReviews,
  formatStudentFacingDecision
};

'use strict';

const { CLASS_9_KNOWLEDGE } = require('./class9Knowledge');
const { calculateSM2, chooseMasteryAction, evaluateMastery, isReviewDue, getDueReviews } = require('./masteryAgent');

/**
 * 8 Core Class 9 science topics in recommended curriculum sequence.
 */
const CLASS_9_TOPICS = [
  'photosynthesis',
  'matter',
  'states_of_matter',
  'evaporation',
  'water_cycle',
  'force_and_motion',
  'cell',
  'respiration'
];

/**
 * Sub-concept mappings for the 8 core topics.
 */
const TOPIC_CONCEPT_MAPPINGS = {
  photosynthesis: [
    { id: 'sunlight', match: /ସୂର୍ଯ୍ୟାଲୋକ|sunlight/i },
    { id: 'carbon_dioxide', match: /ଅଙ୍ଗାରକାମ୍ଳ|co2|carbon dioxide/i },
    { id: 'water', match: /ଜଳ|ପାଣି|water/i },
    { id: 'oxygen_role', match: /ଅମ୍ଳଜାନ|oxygen/i },
    { id: 'chlorophyll', match: /ପତ୍ରହରିତ|chlorophyll/i },
    { id: 'chloroplast', match: /ହରିତକଣିକା|chloroplast/i },
    { id: 'stomata', match: /ପତ୍ରରନ୍ଧ୍ର|stomata/i }
  ],
  states_of_matter: [
    { id: 'heating_water', match: /ଗରମ|heat/i },
    { id: 'boiling_point', match: /ସ୍ଫୁଟନାଙ୍କ|boiling/i },
    { id: 'melting_point', match: /ଗଳନାଙ୍କ|melting/i },
    { id: 'water_states', match: /ତିନୋଟି\s*ଅବସ୍ଥା|ବରଫ|ଜଳ|ବାଷ୍ପ/i }
  ],
  respiration: [
    { id: 'plant_respiration', match: /ଉଦ୍ଭିଦ|ଗଛ|plant|ଆଲୋକ\s*ସଂଶ୍ଳେଷଣ|photosynthesis/i },
    { id: 'human_breathing', match: /ମଣିଷ|human/i },
    { id: 'inhalation_oxygen', match: /ଅମ୍ଳଜାନ|ପ୍ରଶ୍ୱାସ/i },
    { id: 'exhalation_co2', match: /ଅଙ୍ଗାରକାମ୍ଳ|ନିଃଶ୍ୱାସ/i }
  ],
  cell: [
    { id: 'mitochondria_powerhouse', match: /ଶକ୍ତି\s*କେନ୍ଦ୍ର|ମାଇଟୋକଣ୍ଡ୍ରିଆ|powerhouse/i },
    { id: 'cell_wall', match: /କୋଷ\s*ଭିତ୍ତି|cell\s*wall/i },
    { id: 'nucleus', match: /ନ୍ୟୁକ୍ଲିଅସ|nucleus/i }
  ],
  force_and_motion: [
    { id: 'inertia_first_law', match: /ଜଡ଼ତା|ପ୍ରଥମ|first/i },
    { id: 'action_reaction_third_law', match: /କ୍ରିୟା|ତୃତୀୟ|third/i },
    { id: 'momentum_second_law', match: /ସଂବେଗ|ଦ୍ୱିତୀୟ|second/i }
  ],
  evaporation: [
    { id: 'cooling_effect', match: /ଶୀତଳ|ଥଣ୍ଡା|cool/i },
    { id: 'liquid_to_gas', match: /ବାଷ୍ପ|ତରଳ/i }
  ],
  water_cycle: [
    { id: 'condensation_clouds', match: /ଘନୀଭବନ|ମେଘ/i },
    { id: 'precipitation_rain', match: /ବର୍ଷା|ଅବକ୍ଷେପଣ/i },
    { id: 'evaporation_stage', match: /ବାଷ୍ପୀଭବନ/i }
  ],
  matter: [
    { id: 'particles_atoms', match: /କଣିକା|ଅଣୁ|ପରମାଣୁ|particle/i },
    { id: 'mass_and_space', match: /ବସ୍ତୁତ୍ୱ|ସ୍ଥାନ|mass/i }
  ]
};

/**
 * Creates a fresh, lightweight local learning state.
 */
function createInitialLearningState(options = {}) {
  const concepts = {};
  for (const topicId of CLASS_9_TOPICS) {
    concepts[topicId] = {
      status: 'unknown',
      masteryState: 'unknown',
      confidence: 0,
      evidence: [],
      lastSeen: null,
      repetitions: 0,
      interval: 0,
      easeFactor: 2.5,
      nextReview: null
    };
  }

  return {
    language: options.language || 'Odia',
    grade: options.grade || 9,
    concepts,
    recentActivity: []
  };
}

/**
 * Normalizes concept key (e.g. 'photosynthesis', 'photosynthesis:oxygen_role', or { topic, concept }).
 */
function normalizeConceptKey(key) {
  if (!key) return { topic: 'general', concept: 'general', keyStr: 'general' };
  if (typeof key === 'object') {
    const t = key.topic || 'general';
    const c = key.concept || t;
    return { topic: t, concept: c, keyStr: t === c ? t : `${t}:${c}` };
  }
  const str = String(key).trim();
  if (str.includes(':')) {
    const [t, c] = str.split(':');
    return { topic: t, concept: c, keyStr: str };
  }
  return { topic: str, concept: str, keyStr: str };
}

/**
 * Retrieves the state for a given concept or topic.
 */
function getConceptState(state, concept) {
  if (!state || !state.concepts) return null;
  const { topic, concept: sub, keyStr } = normalizeConceptKey(concept);

  // 1. Direct match on keyStr (e.g. 'photosynthesis' or 'photosynthesis:oxygen_role')
  if (state.concepts[keyStr]) return state.concepts[keyStr];

  // 2. Direct match on topic
  if (state.concepts[topic]) return state.concepts[topic];

  // 3. Match on sub concept key
  if (state.concepts[sub]) return state.concepts[sub];

  return null;
}

/**
 * Updates a concept's state with new evidence.
 * Applies conservative Bayesian-style confidence updates:
 * One question does NOT equal mastery.
 */
function updateConceptState(state, concept, evidence) {
  if (!state || !state.concepts) return null;
  const { topic, concept: sub, keyStr } = normalizeConceptKey(concept);

  // Ensure topic exists in state
  if (!state.concepts[topic]) {
    state.concepts[topic] = {
      status: 'unknown',
      masteryState: 'unknown',
      confidence: 0,
      evidence: [],
      lastSeen: null,
      repetitions: 0,
      interval: 0,
      easeFactor: 2.5,
      nextReview: null
    };
  }

  const target = state.concepts[topic];
  const now = Date.now();
  target.lastSeen = now;
  if (target.repetitions === undefined) target.repetitions = 0;
  if (target.interval === undefined) target.interval = 0;
  if (target.easeFactor === undefined) target.easeFactor = 2.5;
  if (target.nextReview === undefined) target.nextReview = null;

  // Normalize evidence
  const evObj = typeof evidence === 'object' && evidence !== null
    ? { ...evidence, timestamp: evidence.timestamp || now }
    : { type: String(evidence || 'asked_about_concept'), timestamp: now };

  if (sub && sub !== topic) {
    evObj.concept = sub;
  }

  const evType = evObj.evidence || evObj.type;

  // FALLBACK_USED is infrastructure/model-routing information, NOT learning evidence.
  // It must NOT be pushed to learning evidence, and must NOT affect mastery state, confidence, or review.
  if (evType === 'fallback_used') {
    return {
      learningState: state,
      topicState: target,
      conceptState: target
    };
  }

  // Push evidence (limit history to last 30 items)
  target.evidence.push(evObj);
  if (target.evidence.length > 30) {
    target.evidence.shift();
  }

  // Count recent evidence types
  const recentTypes = target.evidence.map(e => (typeof e === 'object' ? (e.evidence || e.type) : e));

  // Conservative status & confidence transition
  switch (evType) {
    case 'needed_repair':
      target.confidence = Math.max(0.1, Math.min(0.35, target.confidence));
      target.status = 'needs_review';
      break;

    case 'repeated_question':
      target.confidence = Math.max(0.1, Math.min(0.3, target.confidence));
      target.status = 'needs_review';
      break;

    case 'practice_incorrect':
      target.confidence = Math.max(0.05, Math.min(0.3, target.confidence - 0.15));
      target.status = 'needs_review';
      {
        const sm2 = calculateSM2(target.repetitions, target.easeFactor, target.interval, false, now);
        target.repetitions = sm2.repetitions;
        target.easeFactor = sm2.easeFactor;
        target.interval = sm2.interval;
        target.nextReview = sm2.nextReview;
      }
      break;

    case 'practice_correct':
      {
        const sm2 = calculateSM2(target.repetitions, target.easeFactor, target.interval, true, now);
        target.repetitions = sm2.repetitions;
        target.easeFactor = sm2.easeFactor;
        target.interval = sm2.interval;
        target.nextReview = sm2.nextReview;
      }
      if (target.status === 'unknown') {
        target.confidence = 0.35;
        target.status = 'partial';
      } else if (target.status === 'needs_review') {
        const clears = recentTypes.slice(-2).filter(t => t === 'practice_correct' || t === 'asked_about_concept').length;
        if (clears >= 2) {
          target.status = 'partial';
          target.confidence = Math.min(0.55, target.confidence + 0.15);
        } else {
          target.confidence = Math.min(0.40, target.confidence + 0.10);
        }
      } else if (target.status === 'partial') {
        target.confidence = Math.min(0.85, target.confidence + 0.20);
        const recentFailures = recentTypes.slice(-4).filter(t => t === 'needed_repair' || t === 'repeated_question' || t === 'practice_incorrect').length;
        const correctCount = recentTypes.slice(-3).filter(t => t === 'practice_correct').length;
        if (target.confidence >= 0.70 && correctCount >= 2 && recentFailures === 0) {
          target.status = 'understood';
          target.confidence = 0.80;
        }
      } else if (target.status === 'understood') {
        target.confidence = Math.min(1.0, target.confidence + 0.05);
      }
      break;

    case 'asked_about_concept':
    default:
      if (target.status === 'unknown') {
        target.confidence = 0.25;
        target.status = 'partial';
      } else if (target.status === 'needs_review') {
        // Needs multiple successful clarifications before clearing needs_review
        const clears = recentTypes.slice(-2).filter(t => t === 'asked_about_concept' || t === 'practice_correct' || t === 'practice_success').length;
        if (clears >= 2) {
          target.status = 'partial';
          target.confidence = Math.min(0.5, target.confidence + 0.15);
        } else {
          target.confidence = Math.min(0.35, target.confidence + 0.05);
        }
      } else if (target.status === 'partial') {
        target.confidence = Math.min(0.60, target.confidence + 0.10);
        // Asking a question must NEVER produce 'understood' by itself
        target.status = 'partial';
      } else if (target.status === 'understood') {
        target.confidence = Math.min(1.0, target.confidence + 0.05);
      }
      break;
  }

  // Round confidence to 2 decimal places
  target.confidence = Math.round(target.confidence * 100) / 100;
  target.masteryState = target.status === 'understood' ? 'mastered' : target.status;

  // Also maintain specific sub-concept entry if compound key was provided
  if (keyStr !== topic) {
    if (!state.concepts[keyStr]) {
      state.concepts[keyStr] = {
        status: target.status,
        masteryState: target.masteryState,
        confidence: target.confidence,
        evidence: [evObj],
        lastSeen: now,
        repetitions: target.repetitions,
        interval: target.interval,
        easeFactor: target.easeFactor,
        nextReview: target.nextReview
      };
    } else {
      state.concepts[keyStr].status = target.status;
      state.concepts[keyStr].masteryState = target.masteryState;
      state.concepts[keyStr].confidence = target.confidence;
      state.concepts[keyStr].lastSeen = now;
      state.concepts[keyStr].repetitions = target.repetitions;
      state.concepts[keyStr].interval = target.interval;
      state.concepts[keyStr].easeFactor = target.easeFactor;
      state.concepts[keyStr].nextReview = target.nextReview;
      state.concepts[keyStr].evidence.push(evObj);
      if (state.concepts[keyStr].evidence.length > 20) state.concepts[keyStr].evidence.shift();
    }
  }

  return target;
}

/**
 * Records a learning event in the state history and updates concept status.
 */
function recordLearningEvent(state, event = {}) {
  if (!state) return null;
  const now = event.timestamp || Date.now();
  const topic = event.topic || 'photosynthesis';
  const concept = event.concept || topic;
  const evidence = event.evidence || 'asked_about_concept';

  const activityItem = {
    type: event.type || event.evidence || 'interaction',
    topic,
    concept,
    secondaryTopic: event.secondaryTopic || null,
    secondaryConcept: event.secondaryConcept || null,
    evidence,
    timestamp: now,
    detail: event.detail || null
  };

  if (!Array.isArray(state.recentActivity)) {
    state.recentActivity = [];
  }
  state.recentActivity.push(activityItem);
  if (state.recentActivity.length > 50) {
    state.recentActivity.shift();
  }

  const conceptState = updateConceptState(state, { topic, concept }, activityItem);

  return {
    event: activityItem,
    conceptState
  };
}

/**
 * Retrieves concepts needing attention, ordered by urgency:
 * 1. needs_review (highest urgency)
 * 2. unknown (not yet introduced)
 * 3. partial (needs reinforcement)
 */
function getWeakConcepts(state) {
  if (!state || !state.concepts) return [];

  const list = [];
  for (const topicId of CLASS_9_TOPICS) {
    const entry = state.concepts[topicId];
    if (entry && (entry.status === 'needs_review' || entry.status === 'unknown' || entry.status === 'partial')) {
      list.push({
        topic: topicId,
        ...entry
      });
    }
  }

  // Sort: needs_review first (by lowest confidence), then partial (by lowest confidence), then unknown
  return list.sort((a, b) => {
    const rank = (s) => (s === 'needs_review' ? 1 : s === 'partial' ? 2 : 3);
    const diff = rank(a.status) - rank(b.status);
    if (diff !== 0) return diff;
    return a.confidence - b.confidence;
  });
}

/**
 * Deterministically chooses the next study action.
 * Explainable, pedagogical progression:
 * - If concept has confusion / needs review -> action: "review"
 * - If concept is partially understood -> action: "practice"
 * - If concept not studied yet -> action: "introduce"
 */
function chooseNextStudyAction(state, options = {}) {
  const currentTopic = options?.currentTopic || options?.topic;
  const currentConcept = options?.currentConcept || options?.concept;

  if (currentTopic) {
    if (!state || !state.concepts) {
      return {
        action: 'introduce',
        topic: currentTopic,
        concept: currentConcept || currentTopic,
        reason: 'unexplored_topic'
      };
    }

    const entry = (currentConcept && state.concepts[`${currentTopic}:${currentConcept}`])
      || state.concepts[currentTopic]
      || (currentConcept && state.concepts[currentConcept]);

    if (entry && entry.status === 'needs_review') {
      const lastEv = entry.evidence?.[entry.evidence.length - 1];
      const evType = lastEv?.evidence || lastEv?.type;
      let reason = 'needs_review';
      if (evType === 'repeated_question') reason = 'recent_confusion';
      else if (evType === 'needed_repair') reason = 'needed_repair';
      else if (evType === 'practice_incorrect') reason = 'practice_incorrect';

      return {
        action: 'review',
        topic: currentTopic,
        concept: currentConcept || lastEv?.concept || currentTopic,
        reason
      };
    }

    if (entry && entry.status === 'partial') {
      const lastEv = entry.evidence?.[entry.evidence.length - 1];
      return {
        action: 'practice',
        topic: currentTopic,
        concept: currentConcept || lastEv?.concept || currentTopic,
        reason: 'partially_understood'
      };
    }

    if (entry && entry.status === 'understood') {
      return {
        action: 'practice',
        topic: currentTopic,
        concept: currentConcept || currentTopic,
        reason: 'mastery_reinforcement'
      };
    }

    return {
      action: 'introduce',
      topic: currentTopic,
      concept: currentConcept || currentTopic,
      reason: 'unexplored_topic'
    };
  }

  if (!state || !state.concepts) {
    return {
      action: 'introduce',
      topic: CLASS_9_TOPICS[0],
      concept: CLASS_9_TOPICS[0],
      reason: 'unexplored_topic'
    };
  }

  // 1. Check for any 'needs_review' concepts (highest priority)
  const needsReview = [];
  for (const topicId of CLASS_9_TOPICS) {
    const entry = state.concepts[topicId];
    if (entry && entry.status === 'needs_review') {
      needsReview.push({ topicId, ...entry });
    }
  }

  if (needsReview.length > 0) {
    // Choose lowest confidence or most recently confused
    needsReview.sort((a, b) => (a.confidence - b.confidence) || (b.lastSeen - a.lastSeen));
    const target = needsReview[0];
    const lastEv = target.evidence[target.evidence.length - 1];
    const evType = lastEv?.evidence || lastEv?.type;
    let reason = 'needs_review';
    if (evType === 'repeated_question') reason = 'recent_confusion';
    else if (evType === 'needed_repair') reason = 'needed_repair';
    else if (evType === 'practice_incorrect') reason = 'practice_incorrect';

    return {
      action: 'review',
      topic: target.topicId,
      concept: lastEv?.concept || target.topicId,
      reason
    };
  }

  // 2. Check for 'partial' concepts (needs reinforcement / practice)
  const partials = [];
  for (const topicId of CLASS_9_TOPICS) {
    const entry = state.concepts[topicId];
    if (entry && entry.status === 'partial') {
      partials.push({ topicId, ...entry });
    }
  }

  if (partials.length > 0) {
    // Pick the one most recently touched or with lowest confidence
    partials.sort((a, b) => (a.confidence - b.confidence) || (b.lastSeen - a.lastSeen));
    const target = partials[0];
    const lastEv = target.evidence[target.evidence.length - 1];
    return {
      action: 'practice',
      topic: target.topicId,
      concept: lastEv?.concept || target.topicId,
      reason: 'partially_understood'
    };
  }

  // 3. Check for 'unknown' concepts (introduce next topic in curriculum sequence)
  for (const topicId of CLASS_9_TOPICS) {
    const entry = state.concepts[topicId];
    if (!entry || entry.status === 'unknown') {
      return {
        action: 'introduce',
        topic: topicId,
        concept: topicId,
        reason: 'unexplored_topic'
      };
    }
  }

  // 4. All topics understood! Choose oldest seen topic for practice / spaced repetition
  const all = CLASS_9_TOPICS.map(tid => ({ topicId: tid, ...state.concepts[tid] }));
  all.sort((a, b) => (a.lastSeen || 0) - (b.lastSeen || 0));
  const oldest = all[0];

  return {
    action: 'practice',
    topic: oldest.topicId,
    concept: oldest.topicId,
    reason: 'mastery_reinforcement'
  };
}

/**
 * Resolves topic and sub-concept from question text and verified knowledge.
 */
function resolveTopicAndConcept(message = '', class9Knowledge = null) {
  const topicId = class9Knowledge ? class9Knowledge.id : null;
  if (!topicId) {
    return { topic: 'general_science', concept: 'general' };
  }

  let primaryConcept = topicId;
  const mappings = TOPIC_CONCEPT_MAPPINGS[topicId];
  if (Array.isArray(mappings)) {
    for (const m of mappings) {
      if (m.match.test(message)) {
        primaryConcept = m.id;
        break;
      }
    }
  }

  const result = {
    topic: topicId,
    concept: primaryConcept,
    primaryTopic: topicId,
    primaryConcept: primaryConcept
  };

  const secTopic = class9Knowledge.secondaryTopic || null;
  if (secTopic) {
    result.secondaryTopic = secTopic;
    let secConcept = secTopic;
    const secMappings = TOPIC_CONCEPT_MAPPINGS[secTopic];
    if (Array.isArray(secMappings)) {
      for (const m of secMappings) {
        if (m.match.test(message)) {
          secConcept = m.id;
          break;
        }
      }
    }
    result.secondaryConcept = secConcept;
  }

  return result;
}

/**
 * Checks if a question is a repetition or expresses confusion about recent topics.
 */
function isRecentRepeatQuestion(currentMessage = '', history = [], currentTopic = null) {
  if (!history || history.length === 0) return false;
  const recentUserTurns = history
    .filter(h => h && h.role === 'user')
    .slice(-3);

  const curClean = (currentMessage || '').trim().toLowerCase().replace(/[?।\s]+/g, ' ');
  for (const turn of recentUserTurns) {
    const prevClean = String(turn.content || '').trim().toLowerCase().replace(/[?।\s]+/g, ' ');
    if (curClean === prevClean && curClean.length > 5) return true;
    if (currentTopic && curClean.length > 5 && prevClean.includes(currentTopic)) {
      if (/କାହିଁକି|କିପରି|କ'ଣ|why|how|what/i.test(curClean) && /କାହିଁକି|କିପରି|କ'ଣ|why|how|what/i.test(prevClean)) {
        return true;
      }
    }
  }
  return false;
}

module.exports = {
  CLASS_9_TOPICS,
  TOPIC_CONCEPT_MAPPINGS,
  createInitialLearningState,
  getConceptState,
  updateConceptState,
  recordLearningEvent,
  getWeakConcepts,
  chooseNextStudyAction,
  resolveTopicAndConcept,
  isRecentRepeatQuestion,
  calculateSM2,
  chooseMasteryAction,
  evaluateMastery,
  isReviewDue,
  getDueReviews
};

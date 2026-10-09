'use strict';

// ─────────────────────────────────────────────────────────────────────────────
// lib/parseJSON.js
// Robust JSON parser for Gemma 4 responses.
// Handles: markdown fences, preamble text, trailing commas,
//          unescaped newlines, truncated responses.
// Never throws. Always returns a safe object.
// ─────────────────────────────────────────────────────────────────────────────

const parseMetrics = {
  direct:             0,
  trailing_comma_fix: 0,
  newline_fix:        0,
  truncation_repair:  0,
  plaintext_fallback: 0,
  default:            0,
};

// Export metrics so dev panel can read them
function getParseMetrics() {
  return { ...parseMetrics };
}

function bump(method) {
  if (parseMetrics[method] !== undefined) parseMetrics[method]++;
}

// ── Core parser ───────────────────────────────────────────────────────────────
// Attempts 5 repair strategies in order. Returns on first success.
function parseJSON(raw, defaultValue = null) {
  if (!raw || typeof raw !== 'string') {
    bump('default');
    return { data: defaultValue, error: 'empty response', method: 'default' };
  }

  let text = raw.trim();

  // Layer 1 — strip markdown fences
  text = text
    .replace(/^```(?:json|JSON)?[\s\r\n]*/m, '')
    .replace(/[\s\r\n]*```\s*$/m, '')
    .trim();

  // Layer 2 — extract first JSON object/array (strip any leading prose)
  const firstBrace = text.search(/[{[]/);
  if (firstBrace > 0) text = text.slice(firstBrace);

  // Trim anything after the final closing brace/bracket
  const openChar  = text[0];
  if (openChar === '{' || openChar === '[') {
    const closeChar = openChar === '{' ? '}' : ']';
    const lastClose = text.lastIndexOf(closeChar);
    if (lastClose !== -1 && lastClose < text.length - 1) {
      text = text.slice(0, lastClose + 1);
    }
  }

  // Attempt 1 — direct parse (fastest path, works for well-formed JSON)
  try {
    const data = JSON.parse(text);
    bump('direct');
    return { data, error: null, method: 'direct' };
  } catch (_) {}

  // Attempt 2 — fix trailing commas before } or ]
  const noTrailing = text.replace(/,\s*([}\]])/g, '$1');
  try {
    const data = JSON.parse(noTrailing);
    bump('trailing_comma_fix');
    return { data, error: null, method: 'trailing_comma_fix' };
  } catch (_) {}

  // Attempt 3 — fix unescaped newlines/tabs inside quoted strings
  const fixedNewlines = noTrailing.replace(
    /"(?:[^"\\]|\\.)*"/g,
    match => match
      .replace(/\n/g, '\\n')
      .replace(/\r/g, '\\r')
      .replace(/\t/g, '\\t')
  );
  try {
    const data = JSON.parse(fixedNewlines);
    bump('newline_fix');
    return { data, error: null, method: 'newline_fix' };
  } catch (_) {}

  // Attempt 4 — repair truncated JSON by closing unclosed brackets
  const repaired = repairTruncated(fixedNewlines);
  if (repaired !== fixedNewlines) {
    try {
      const data = JSON.parse(repaired);
      bump('truncation_repair');
      return { data, error: null, method: 'truncation_repair' };
    } catch (_) {}
  }

  // All attempts failed
  bump('plaintext_fallback');
  return { data: defaultValue, error: 'all repair attempts failed', method: 'plaintext_fallback' };
}

// Closes unclosed brackets/braces left by a truncated Gemma response
function repairTruncated(text) {
  const stack   = [];
  const openers = { '{': '}', '[': ']' };
  const closers = new Set(['}', ']']);
  let inString = false;
  let escaped  = false;

  for (const ch of text) {
    if (escaped)         { escaped = false; continue; }
    if (ch === '\\')     { escaped = true;  continue; }
    if (ch === '"')      { inString = !inString; continue; }
    if (inString)        { continue; }
    if (openers[ch])     { stack.push(openers[ch]); }
    if (closers.has(ch)) { stack.pop(); }
  }

  if (stack.length === 0) return text;

  let out = text.trimEnd().replace(/,\s*$/, '');
  return out + stack.reverse().join('');
}

// ── Typed parsers for each response shape ─────────────────────────────────────

/**
 * Parse a tutor explanation response.
 * ALWAYS returns a valid object — never null, never throws.
 */
function parseTutorResponse(raw) {
  const { data, method } = parseJSON(raw, null);

  if (!data || typeof data !== 'object' || Array.isArray(data)) {
    return {
      intro:    typeof raw === 'string' ? raw.trim() : 'Unable to parse response. Please try again.',
      steps:    [],
      answer:   '',
      followup: '',
      _parseMethod: 'plaintext_fallback',
      _raw: raw,
    };
  }

  return {
    intro:    typeof data.intro    === 'string' ? data.intro.trim()    : (typeof raw === 'string' ? raw.trim() : ''),
    steps:    Array.isArray(data.steps)          ? data.steps.filter(s => typeof s === 'string' || (typeof s === 'object' && s !== null)) : [],
    answer:   typeof data.answer   === 'string' ? data.answer.trim()   : '',
    followup: typeof data.followup === 'string' ? data.followup.trim() : '',
    _parseMethod: method,
  };
}

/**
 * Parse a quiz response. Returns [] if unparseable — never throws.
 */
function parseQuizResponse(raw) {
  const { data } = parseJSON(raw, null);

  let questions = null;
  if (Array.isArray(data))                questions = data;
  else if (Array.isArray(data?.questions)) questions = data.questions;
  else if (Array.isArray(data?.quiz))      questions = data.quiz;
  else if (Array.isArray(data?.items))     questions = data.items;

  if (!questions || questions.length === 0) return [];

  return questions
    .filter(q => q && typeof q === 'object')
    .map((q, i) => ({
      question:    typeof q.question    === 'string' ? q.question    : `Question ${i + 1}`,
      options:     Array.isArray(q.options)           ? q.options.map(String) : ['A', 'B', 'C', 'D'],
      correct:     q.correct !== undefined            ? q.correct     : 0,
      answer:      typeof q.answer      === 'string' ? q.answer      : '',
      explanation: typeof q.explanation === 'string' ? q.explanation : '',
    }));
}

/**
 * Parse a concept map response. Returns { nodes: [], edges: [] } if unparseable.
 */
function parseConceptMapResponse(raw) {
  const { data } = parseJSON(raw, null);
  return {
    central: typeof data?.central === 'string' ? data.central : '',
    nodes: Array.isArray(data?.nodes) ? data.nodes : [],
    edges: Array.isArray(data?.edges) ? data.edges : [],
  };
}

/**
 * Parse a next-topic suggestion. Returns safe defaults if unparseable.
 */
function parseNextTopicResponse(raw) {
  const { data } = parseJSON(raw, null);
  return {
    nextTopic: typeof data?.nextTopic    === 'string' ? data.nextTopic    :
               typeof data?.topic        === 'string' ? data.topic        :
               typeof data?.next_topic   === 'string' ? data.next_topic   : '',
    reason:    typeof data?.reason       === 'string' ? data.reason       :
               typeof data?.explanation  === 'string' ? data.explanation  : '',
    relatedTo: typeof data?.relatedTo    === 'string' ? data.relatedTo   : '',
  };
}

/**
 * Parse a Socratic question response. Returns safe default if unparseable.
 */
function parseSocraticResponse(raw) {
  const { data } = parseJSON(raw, null);

  if (!data || typeof data !== 'object') {
    return {
      acknowledgement: '',
      question:        typeof raw === 'string' ? raw.trim() : '',
      hint:            '',
      isNearAnswer:    false,
      summary:         '',
    };
  }

  return {
    acknowledgement: typeof data.acknowledgement === 'string' ? data.acknowledgement : '',
    question:        typeof data.question    === 'string' ? data.question    :
                     typeof data.socratic    === 'string' ? data.socratic    :
                     typeof data.hint        === 'string' ? data.hint        :
                     typeof raw              === 'string' ? raw.trim()       : '',
    hint:            typeof data.hint        === 'string' ? data.hint        : '',
    isNearAnswer:    !!data.isNearAnswer,
    summary:         typeof data.summary     === 'string' ? data.summary     : '',
  };
}

/**
 * Parse an evaluation report response. Returns safe defaults if unparseable.
 */
function parseEvaluationReportResponse(raw) {
  const { data } = parseJSON(raw, null);

  if (!data || typeof data !== 'object') {
    return {
      narrative:         typeof raw === 'string' ? raw.trim() : '',
      crossPollination:  null,
      vocabularyHeatmap: '',
      bigDomino:         null,
      microMission:      null,
    };
  }

  return {
    narrative:         typeof data.narrative         === 'string' ? data.narrative         : '',
    crossPollination:  data.crossPollination && typeof data.crossPollination === 'object' ? data.crossPollination : null,
    vocabularyHeatmap: typeof data.vocabularyHeatmap === 'string' ? data.vocabularyHeatmap : '',
    bigDomino:         data.bigDomino && typeof data.bigDomino === 'object' ? data.bigDomino : null,
    microMission:      data.microMission && typeof data.microMission === 'object' ? data.microMission : null,
  };
}

/**
 * Parse a taxonomy extraction response from dynamicTaxonomy.js
 */
function parseTaxonomyResponse(raw) {
  const { data } = parseJSON(raw, null);
  if (!data || typeof data !== 'object') return null;
  return {
    canonicalTopic: typeof data.canonicalTopic === 'string' ? data.canonicalTopic.toLowerCase().trim() : null,
    subject:        typeof data.subject         === 'string' ? data.subject         : 'other',
    keywords:       Array.isArray(data.keywords)             ? data.keywords.map(k => String(k).toLowerCase().trim()) : [],
    confidence:     typeof data.confidence      === 'string' ? data.confidence      : 'medium',
  };
}

module.exports = {
  parseJSON,
  parseTutorResponse,
  parseQuizResponse,
  parseConceptMapResponse,
  parseNextTopicResponse,
  parseSocraticResponse,
  parseEvaluationReportResponse,
  parseTaxonomyResponse,
  getParseMetrics,
};

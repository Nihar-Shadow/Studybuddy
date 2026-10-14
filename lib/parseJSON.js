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

  // Trim anything after the final balanced closing brace/bracket ONLY if closed
  const openChar = text[0];
  if (openChar === '{' || openChar === '[') {
    const balIndex = findBalancedCloseIndex(text);
    if (balIndex !== -1 && balIndex < text.length - 1) {
      text = text.slice(0, balIndex + 1);
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

// Finds the index where the outermost bracket/brace pair closes
function findBalancedCloseIndex(text) {
  let depth = 0;
  let inString = false;
  let escaped = false;
  let lastBalanced = -1;

  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (escaped) { escaped = false; continue; }
    if (ch === '\\') { escaped = true; continue; }
    if (ch === '"') { inString = !inString; continue; }
    if (inString) continue;

    if (ch === '{' || ch === '[') {
      depth++;
    } else if (ch === '}' || ch === ']') {
      depth--;
      if (depth === 0) {
        lastBalanced = i;
      }
    }
  }
  return lastBalanced;
}

// Finds the first index where depth returns to 0 after starting at an opener
function findFirstBalancedCloseIndex(text) {
  let depth = 0;
  let inString = false;
  let escaped = false;
  let started = false;

  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (escaped) { escaped = false; continue; }
    if (ch === '\\') { escaped = true; continue; }
    if (ch === '"') { inString = !inString; continue; }
    if (inString) continue;

    if (ch === '{' || ch === '[') {
      depth++;
      started = true;
    } else if (ch === '}' || ch === ']') {
      if (started) {
        depth--;
        if (depth === 0) {
          return i;
        }
      }
    }
  }
  return -1;
}

// Closes unclosed brackets/braces left by a truncated Gemma response
function repairTruncated(text) {
  let cleaned = text.trimEnd();

  // Strip trailing incomplete property or trailing key
  cleaned = cleaned.replace(/,\s*"[^"]*"\s*:\s*$/, '');
  cleaned = cleaned.replace(/,\s*"[^"]*"\s*$/, '');

  const stack   = [];
  const openers = { '{': '}', '[': ']' };
  const closers = new Set(['}', ']']);
  let inString = false;
  let escaped  = false;

  for (const ch of cleaned) {
    if (escaped)         { escaped = false; continue; }
    if (ch === '\\')     { escaped = true;  continue; }
    if (ch === '"')      { inString = !inString; continue; }
    if (inString)        { continue; }
    if (openers[ch])     { stack.push(openers[ch]); }
    if (closers.has(ch)) { stack.pop(); }
  }

  let out = cleaned;
  if (inString) out += '"';
  if (stack.length === 0) return out;

  out = out.replace(/,\s*$/, '');
  return out + stack.reverse().join('');
}

// ── Typed parsers for each response shape ─────────────────────────────────────

/**
 * Parse a tutor explanation response.
 * ALWAYS returns a valid object — never null, never throws.
 * Robust against empty content, unclosed <think> blocks, plaintext fallback, and flexible JSON keys.
 */
function parseTutorResponse(raw) {
  // Strip any leaked or unclosed <think> reasoning tags
  const cleanedRaw = typeof raw === 'string'
    ? raw.replace(/<think>[\s\S]*?<\/think>/gi, '').replace(/<think>[\s\S]*$/gi, '').trim()
    : '';

  if (!cleanedRaw) {
    return {
      mode: 'STANDARD',
      intro: 'I could not generate an answer. Please try asking again.',
      steps: [],
      answer: 'I could not generate an answer. Please try asking again.',
      followup: '',
      _parseMethod: 'empty_fallback',
      _empty: true,
      _raw: raw || '',
    };
  }

  const { data, method } = parseJSON(cleanedRaw, null);

  if (!data || typeof data !== 'object' || Array.isArray(data)) {
    const isJsonLike = cleanedRaw.startsWith('{') || cleanedRaw.includes('"answer"');
    if (isJsonLike) {
      const matchAns = cleanedRaw.match(/"answer"\s*:\s*"((?:[^"\\]|\\.)*)"/);
      const matchIntro = cleanedRaw.match(/"intro"\s*:\s*"((?:[^"\\]|\\.)*)"/);
      if (matchAns || matchIntro) {
        const rescuedAns = (matchAns ? matchAns[1] : matchIntro[1]).replace(/\\"/g, '"').replace(/\\n/g, '\n');
        const rescuedIntro = matchIntro ? matchIntro[1].replace(/\\"/g, '"').replace(/\\n/g, '\n') : '';
        return {
          mode: 'STANDARD',
          intro: rescuedIntro,
          steps: [],
          answer: rescuedAns,
          followup: '',
          _parseMethod: 'regex_rescue',
          _empty: false,
          _raw: cleanedRaw,
        };
      }
    }

    return {
      mode: 'STANDARD',
      intro: '',
      steps: [],
      answer: isJsonLike ? 'Unable to display response.' : cleanedRaw,
      followup: '',
      _parseMethod: isJsonLike ? 'empty_fallback' : 'plaintext_fallback',
      _empty: isJsonLike,
      _raw: cleanedRaw,
    };
  }

  // Flexible key resolution across multiple model formats
  const intro = typeof data.intro === 'string' ? data.intro.trim() :
                typeof data.summary === 'string' ? data.summary.trim() :
                typeof data.overview === 'string' ? data.overview.trim() : '';

  let steps = [];
  const rawSteps = data.steps || data.logic_steps || data.items;
  if (Array.isArray(rawSteps)) {
    steps = rawSteps.filter(s => typeof s === 'string' || (typeof s === 'object' && s !== null));
  }

  const answer = typeof data.answer === 'string' ? data.answer.trim() :
                 typeof data.final_solution === 'string' ? data.final_solution.trim() :
                 typeof data.final_answer === 'string' ? data.final_answer.trim() :
                 typeof data.response === 'string' ? data.response.trim() :
                 typeof data.text === 'string' ? data.text.trim() : '';

  const followup = typeof data.followup === 'string' ? data.followup.trim() :
                   typeof data.followUp === 'string' ? data.followUp.trim() :
                   typeof data.follow_up === 'string' ? data.follow_up.trim() :
                   typeof data.question === 'string' ? data.question.trim() : '';

  let finalAnswer = answer;
  if (!finalAnswer) {
    const matchAns = cleanedRaw.match(/"answer"\s*:\s*"((?:[^"\\]|\\.)*)"/);
    if (matchAns) {
      finalAnswer = matchAns[1].replace(/\\"/g, '"').replace(/\\n/g, '\n');
    } else if (steps.length > 0 && typeof steps[steps.length - 1].text === 'string') {
      finalAnswer = steps[steps.length - 1].text;
    } else if (intro) {
      finalAnswer = intro;
    } else {
      finalAnswer = '';
    }
  }

  // Ensure finalAnswer is NEVER a serialized JSON string
  if (typeof finalAnswer === 'string' && finalAnswer.trim().startsWith('{') && finalAnswer.includes('"')) {
    const innerMatch = finalAnswer.match(/"answer"\s*:\s*"((?:[^"\\]|\\.)*)"/) ||
                       finalAnswer.match(/"text"\s*:\s*"((?:[^"\\]|\\.)*)"/) ||
                       finalAnswer.match(/"intro"\s*:\s*"((?:[^"\\]|\\.)*)"/);
    finalAnswer = innerMatch ? innerMatch[1].replace(/\\"/g, '"') : (intro || '');
  }

  return {
    mode: data.mode || 'STANDARD',
    intro: intro || (steps.length > 0 ? '' : finalAnswer),
    steps,
    answer: finalAnswer,
    summary: finalAnswer,
    followup,
    followUp: followup,
    _parseMethod: method,
    _empty: !finalAnswer && steps.length === 0,
  };
}

/**
 * Normalizes option strings by stripping leading option labels like "A)", "B.", "C) C)", "D)   )".
 * Trims extra whitespace and normalizes Unicode.
 */
function stripOptionPrefix(text) {
  if (text === null || text === undefined) return '';
  let s = String(text).normalize('NFC').trim();
  let prev;
  do {
    prev = s;
    s = s.replace(/^[A-Da-d](?:[\s\)\.\:\-\]]*[\)\.\:\-\]]|\s{2,})\s*/, '').trim();
  } while (s !== prev && s.length > 0);
  return s.replace(/\s+/g, ' ').trim();
}

/**
 * Resolves an answer (index, single letter, option text, or labeled text) against options.
 * Never guesses options[0] on ambiguity. Returns null if unresolved or ambiguous.
 */
function resolveAnswer(rawAns, formattedOptions, cleanOptions) {
  if (rawAns === undefined || rawAns === null) return null;

  // 1. Numeric index: 0, 1, 2, 3
  if (typeof rawAns === 'number' && Number.isInteger(rawAns)) {
    if (rawAns >= 0 && rawAns < formattedOptions.length) {
      return formattedOptions[rawAns];
    }
    if (rawAns >= 1 && rawAns <= formattedOptions.length) {
      return formattedOptions[rawAns - 1];
    }
    return null;
  }

  const strAns = String(rawAns).trim();
  if (!strAns) return null;

  // 2. String index: "0", "1", "2", "3"
  if (/^[0-3]$/.test(strAns)) {
    const idx = parseInt(strAns, 10);
    if (idx >= 0 && idx < formattedOptions.length) {
      return formattedOptions[idx];
    }
  }

  // 3. Single letter: "A", "B", "C", "D" (or "A)", "b.", etc.)
  if (/^[A-D][\s\)\.\:\-]*$/i.test(strAns)) {
    const letter = strAns.charAt(0).toUpperCase();
    const idx = letter.charCodeAt(0) - 65;
    if (idx >= 0 && idx < formattedOptions.length) {
      return formattedOptions[idx];
    }
  }

  // 4. Exact match against formattedOptions: "A) text"
  const exactFormatted = formattedOptions.find(o => o.toLowerCase() === strAns.toLowerCase());
  if (exactFormatted) return exactFormatted;

  // 5. Match against cleanOptions (raw text without prefix)
  const cleanAns = stripOptionPrefix(strAns).toLowerCase();
  const exactCleanIdx = cleanOptions.findIndex(c => c.toLowerCase() === cleanAns);
  if (exactCleanIdx !== -1) {
    return formattedOptions[exactCleanIdx];
  }

  // 6. Substring match against cleanOptions (only if unambiguous)
  if (cleanAns.length > 2) {
    const matchingIndices = [];
    cleanOptions.forEach((optText, idx) => {
      const optLower = optText.toLowerCase();
      if (optLower.includes(cleanAns) || cleanAns.includes(optLower)) {
        matchingIndices.push(idx);
      }
    });
    if (matchingIndices.length === 1) {
      return formattedOptions[matchingIndices[0]];
    }
  }

  // 7. If starts with letter like "A) some wrong text", check if letter prefix resolves cleanly
  if (/^[A-D][\)\.\:\-]/i.test(strAns)) {
    const letter = strAns.charAt(0).toUpperCase();
    const idx = letter.charCodeAt(0) - 65;
    if (idx >= 0 && idx < formattedOptions.length) {
      return formattedOptions[idx];
    }
  }

  return null;
}

/**
 * Normalizes answer to a 0-based integer index (0, 1, 2, or 3).
 * Accepts numeric indices, string indices, letter prefixes, or option text.
 */
function resolveAnswerIndex(rawAns, formattedOptions = [], cleanOptions = []) {
  if (rawAns === undefined || rawAns === null) return -1;
  if (typeof rawAns === 'number' && Number.isInteger(rawAns)) {
    if (rawAns >= 0 && rawAns < (cleanOptions.length || 4)) return rawAns;
    if (rawAns >= 1 && rawAns <= (cleanOptions.length || 4)) return rawAns - 1;
    return -1;
  }
  const str = String(rawAns).trim();
  if (/^[0-3]$/.test(str)) {
    const idx = parseInt(str, 10);
    if (idx >= 0 && idx < (cleanOptions.length || 4)) return idx;
  }
  if (/^[A-D][\s\)\.\:\-]*$/i.test(str)) {
    const idx = str.charAt(0).toUpperCase().charCodeAt(0) - 65;
    if (idx >= 0 && idx < (cleanOptions.length || 4)) return idx;
  }
  // Check exact formatted match
  const fmtIdx = formattedOptions.findIndex(o => o.toLowerCase() === str.toLowerCase());
  if (fmtIdx !== -1) return fmtIdx;

  // Check clean options match
  const cleanStr = stripOptionPrefix(str).toLowerCase();
  const clnIdx = cleanOptions.findIndex(o => o.toLowerCase() === cleanStr);
  if (clnIdx !== -1) return clnIdx;

  return -1;
}

/**
 * Converts a question to canonical internal format:
 * { question: string, options: string[], answer: number, explanation: string }
 * where options are plain text without A) B) C) D) prefixes.
 */
function toCanonicalQuestion(q) {
  if (!q || typeof q !== 'object') return null;
  const cleanOpts = (q.cleanOptions || q.options || []).map(stripOptionPrefix);
  let ansIdx = (typeof q.answerIndex === 'number' && q.answerIndex >= 0) ? q.answerIndex : -1;
  if (ansIdx < 0) {
    ansIdx = resolveAnswerIndex(q.answer, q.options || [], cleanOpts);
  }
  return {
    question: String(q.question || '').trim(),
    options: cleanOpts,
    answer: ansIdx >= 0 ? ansIdx : 0,
    explanation: String(q.explanation || '').trim()
  };
}

function toCanonicalQuiz(questions) {
  if (!Array.isArray(questions)) return [];
  return questions.map(toCanonicalQuestion).filter(Boolean);
}

/**
 * Normalizes raw question objects from various schema shapes into the standard app format:
 * { question: string, options: string[], answer: string, explanation: string }
 */
function extractQuestionsFromData(data) {
  if (!data) return null;
  let items = null;

  if (Array.isArray(data)) {
    items = data;
  } else if (typeof data === 'object') {
    if (Array.isArray(data.questions))          items = data.questions;
    else if (Array.isArray(data.quiz))           items = data.quiz;
    else if (Array.isArray(data.items))          items = data.items;
    else if (Array.isArray(data.mcqs))           items = data.mcqs;
    else if (Array.isArray(data.quiz_questions)) items = data.quiz_questions;
    else if (Array.isArray(data.results))        items = data.results;
    else if (Array.isArray(data.data))           items = data.data;
    else if (Array.isArray(data.steps) && data.steps.some(s => s && (s.options || s.choices || s.answer))) items = data.steps;
    else if ((data.question || data.q || data.prompt) && (data.options || data.choices)) {
      items = [data]; // Single question object
    } else {
      // Check for numbered keys: { "1": { ... }, "2": { ... } } or { "q1": { ... } }
      const vals = Object.values(data);
      if (vals.length > 0 && vals.every(v => v && typeof v === 'object' && (v.question || v.q || v.prompt || v.options || v.choices))) {
        items = vals;
      }
    }
  }

  if (!Array.isArray(items) || items.length === 0) return null;

  const mapped = [];
  for (let i = 0; i < items.length; i++) {
    const rawQ = items[i];
    if (!rawQ || typeof rawQ !== 'object') continue;

    // 1. Question text
    const qText = rawQ.question || rawQ.q || rawQ.prompt || rawQ.title || rawQ.questionText || rawQ.text || '';
    if (typeof qText !== 'string' || qText.trim().length === 0) continue;

    // 2. Options
    let options = [];
    const rawOpts = rawQ.options || rawQ.choices || rawQ.answers || rawQ.alternatives;
    if (Array.isArray(rawOpts)) {
      options = rawOpts.map(o => String(o).trim()).filter(Boolean);
    } else if (rawOpts && typeof rawOpts === 'object') {
      const keys = Object.keys(rawOpts);
      options = keys.map(k => String(rawOpts[k]).trim());
    }

    // Clean any malformed or existing prefixes, then format standard A), B), C), D) prefixes
    const cleanOpts = options.map(stripOptionPrefix).filter(Boolean);
    let finalOptions = [];
    if (cleanOpts.length > 0) {
      finalOptions = cleanOpts.map((cleanOpt, idx) => {
        const letter = String.fromCharCode(65 + idx);
        return `${letter}) ${cleanOpt}`;
      });
    }

    // 3. Answer
    let rawAns = rawQ.answer ?? rawQ.correct ?? rawQ.correct_answer ?? rawQ.correctAnswer ?? rawQ.solution ?? rawQ.key;
    let answer = resolveAnswer(rawAns, finalOptions, cleanOpts);

    // 4. Explanation
    const explanation = typeof (rawQ.explanation || rawQ.reason || rawQ.rationale || rawQ.exp || rawQ.why) === 'string'
      ? String(rawQ.explanation || rawQ.reason || rawQ.rationale || rawQ.exp || rawQ.why).trim()
      : '';

    // Validate each question: must have meaningful text, at least 2 options, and a valid unambiguous answer
    if (qText.trim().length > 3 && finalOptions.length >= 2 && answer) {
      const ansIdx = resolveAnswerIndex(rawAns, finalOptions, cleanOpts);
      mapped.push({
        question: qText.trim(),
        options: finalOptions,
        cleanOptions: cleanOpts,
        answer,
        answerIndex: ansIdx >= 0 ? ansIdx : 0,
        explanation
      });
    }
  }

  return mapped.length > 0 ? mapped : null;
}

/**
 * Parse a quiz response. Returns [] if unparseable — never throws.
 * Supports:
 * - Direct JSON arrays or objects
 * - JSON wrapped in Markdown fences (```json ... ```)
 * - Explanatory prose before or after the JSON payload
 * - Balanced bracket extraction across candidate positions
 * - Repaired truncated responses
 * Never invents dummy fallback questions.
 */
function parseQuizResponse(raw) {
  if (!raw || typeof raw !== 'string') return [];

  // Strip <think> reasoning tags
  const clean = raw
    .replace(/<think>[\s\S]*?<\/think>/gi, '')
    .replace(/<think>[\s\S]*$/gi, '')
    .trim();

  if (!clean) return [];

  // Strategy 1: Check for JSON inside Markdown code fences (```json ... ``` or ``` ... ```)
  const fenceRegex = /```(?:json|JSON)?\s*([\s\S]*?)```/g;
  let fenceMatch;
  while ((fenceMatch = fenceRegex.exec(clean)) !== null) {
    const block = fenceMatch[1].trim();
    const { data } = parseJSON(block, null);
    const questions = extractQuestionsFromData(data);
    if (questions) return questions;
  }

  // Strategy 2: Direct core parse on the cleaned text
  const { data: directData } = parseJSON(clean, null);
  const directQuestions = extractQuestionsFromData(directData);
  if (directQuestions) return directQuestions;

  // Strategy 3: Scan for balanced brackets across the text (handles prose before and after)
  for (let i = 0; i < clean.length; i++) {
    const ch = clean[i];
    if (ch === '[' || ch === '{') {
      const remaining = clean.slice(i);
      const closeIdx = findFirstBalancedCloseIndex(remaining);
      if (closeIdx !== -1) {
        const candidate = remaining.slice(0, closeIdx + 1);
        const { data: candData } = parseJSON(candidate, null);
        const candQuestions = extractQuestionsFromData(candData);
        if (candQuestions) return candQuestions;
      }
    }
  }

  // Strategy 4: Attempt repair on trailing truncation if an array or object opener exists
  const firstBracket = clean.search(/[[{]/);
  if (firstBracket !== -1) {
    const candidate = clean.slice(firstBracket);
    const repaired = repairTruncated(candidate);
    if (repaired && repaired !== candidate) {
      const { data: repData } = parseJSON(repaired, null);
      const repQuestions = extractQuestionsFromData(repData);
      if (repQuestions) return repQuestions;
    }
  }

  return [];
}

/**
 * Parse a concept map response. Returns { central, nodes, edges } safely.
 */
function parseConceptMapResponse(raw) {
  const cleanedRaw = typeof raw === 'string'
    ? raw.replace(/<think>[\s\S]*?<\/think>/gi, '').replace(/<think>[\s\S]*$/gi, '').trim()
    : raw;
  const { data } = parseJSON(cleanedRaw, null);

  if (!data || typeof data !== 'object') {
    return { central: '', nodes: [], edges: [] };
  }

  const root = data.conceptMap || data.concept_map || data.graph || data;
  const central = typeof root.central === 'string' ? root.central.trim() :
                  typeof root.topic === 'string' ? root.topic.trim() :
                  typeof root.title === 'string' ? root.title.trim() : '';

  const rawNodes = Array.isArray(root.nodes) ? root.nodes :
                   Array.isArray(root.concepts) ? root.concepts :
                   Array.isArray(data) ? data : [];

  const nodeMap = new Set(['central']);
  const nodes = [];

  rawNodes.forEach((n, idx) => {
    if (!n) return;
    if (typeof n === 'string') {
      const id = `n${idx + 1}`;
      nodeMap.add(id);
      nodes.push({ id, label: n.trim(), type: 'main' });
      return;
    }
    if (typeof n === 'object') {
      const norm = {};
      for (const [k, v] of Object.entries(n)) {
        norm[k.trim().toLowerCase()] = typeof v === 'string' ? v.trim() : v;
      }
      const id = String(norm.id || norm.nodeid || `n${idx + 1}`).trim();
      const label = String(norm.label || norm.name || norm.concept || norm.title || norm.text || `Concept ${idx + 1}`).trim();
      const type = ['main', 'related', 'example'].includes(norm.type) ? norm.type : 'related';
      if (label && id) {
        nodeMap.add(id);
        nodes.push({ id, label, type });
      }
    }
  });

  const rawEdges = Array.isArray(root.edges) ? root.edges :
                   Array.isArray(root.links) ? root.links :
                   Array.isArray(root.connections) ? root.connections : [];

  const edges = [];
  rawEdges.forEach((e) => {
    if (!e || typeof e !== 'object') return;
    const norm = {};
    for (const [k, v] of Object.entries(e)) {
      norm[k.trim().toLowerCase()] = typeof v === 'string' ? v.trim() : v;
    }
    const from = String(norm.from || norm.source || '').trim();
    const to = String(norm.to || norm.target || '').trim();
    const label = String(norm.label || norm.relation || norm.relationship || '').trim();

    if (from && to && (nodeMap.has(from) || from === 'central') && (nodeMap.has(to) || to === 'central')) {
      edges.push({ from, to, label });
    }
  });

  if (edges.length === 0 && nodes.length > 0) {
    nodes.forEach(n => {
      edges.push({ from: 'central', to: n.id, label: 'involves' });
    });
  }

  return { central, nodes, edges };
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
  stripOptionPrefix,
  resolveAnswer,
  resolveAnswerIndex,
  toCanonicalQuestion,
  toCanonicalQuiz,
};

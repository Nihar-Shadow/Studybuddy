const { saveProgress, getProgressSummary, getDueReviews, getLearningStreak } = require('./progressStore');
const { smartGet, smartSet, registerInFlight } = require('./smartCache');
const {
  parseTutorResponse,
  parseQuizResponse,
  parseConceptMapResponse,
  parseNextTopicResponse,
  parseSocraticResponse,
  parseEvaluationReportResponse,
} = require('../lib/parseJSON');
const { ollamaOptions } = require('../lib/helpers');
const { reasoningWithDraft } = require('./models');

const enforceJSON = '\n\nIMPORTANT: Return ONLY raw JSON. No markdown. No backticks. Start with { end with }.';

// ─────────────────────────────────────────────
// LANGUAGE HELPER
// Returns a high-priority directive that is prepended to every
// tool system prompt when the student selects a non-English language.
// Gemma 4 handles 140+ languages natively — zero extra latency.
// ─────────────────────────────────────────────
let _activeLanguage = 'English';

function setActiveLanguage(lang) { _activeLanguage = lang || 'English'; }

function langPrefix() {
  if (!_activeLanguage || _activeLanguage.toLowerCase() === 'english') return '';
  return `CRITICAL: Respond ENTIRELY in ${_activeLanguage}. All text fields (explanations, questions, hints, answers, follow-ups) MUST be in ${_activeLanguage}. Do not use English unless translating a specific term.\n\n`;
}


// ─────────────────────────────────────────────
// TIMING WRAPPER FOR DEV METRICS
// Wraps fetch calls to Ollama and measures milliseconds
// ─────────────────────────────────────────────
async function timedFetch(url, options) {
  const start = Date.now();
  const res   = await fetch(url, options);
  const ms    = Date.now() - start;
  return { res, ms };
}

// ─────────────────────────────────────────────
// TOOL DEFINITIONS
// These are sent to Gemma in the system prompt
// so it knows what tools are available and when
// to call each one.
// ─────────────────────────────────────────────
const toolDefinitions = [
  {
    name: 'explain_topic',
    description: `Explains an educational topic to the student in a structured way.
      Use this tool ALWAYS as the first tool when a student asks to understand, learn,
      or explain something. Returns a structured explanation with steps.`,
    parameters: {
      type: 'object',
      properties: {
        topic:   { type: 'string', description: 'The topic to explain, e.g. "photosynthesis"' },
        level:   { type: 'string', enum: ['beginner','intermediate','advanced'],
                   description: 'The student level' },
        context: { type: 'string', description: 'Any extra context from the student message' }
      },
      required: ['topic', 'level']
    }
  },
  {
    name: 'generate_quiz',
    description: `Generates multiple-choice quiz questions on a topic to test understanding.
      Use this tool AFTER explaining a topic, or when the student asks to be tested,
      or when the student says they want to practice.`,
    parameters: {
      type: 'object',
      properties: {
        topic:        { type: 'string', description: 'Topic to quiz on' },
        level:        { type: 'string', enum: ['beginner','intermediate','advanced'] },
        numQuestions: { type: 'number', description: 'Number of questions, between 2 and 5' }
      },
      required: ['topic', 'level', 'numQuestions']
    }
  },
  {
    name: 'track_progress',
    description: `Saves the student's study activity to their progress record.
      Use this tool ALWAYS after explaining a topic or generating a quiz.
      This builds the student's learning history so future sessions can adapt.`,
    parameters: {
      type: 'object',
      properties: {
        topic:     { type: 'string', description: 'The topic that was studied' },
        level:     { type: 'string', enum: ['beginner','intermediate','advanced'] },
        quizScore: { type: 'number', description: 'Score 0-100 if a quiz was taken, else omit' }
      },
      required: ['topic', 'level']
    }
  },
  {
    name: 'suggest_next_topic',
    description: `Suggests what the student should study next based on their progress history.
      Use this tool at the END of a session, after explaining and optionally quizzing,
      to give the student a personalised learning path recommendation.`,
    parameters: {
      type: 'object',
      properties: {
        currentTopic: { type: 'string', description: 'What was just studied' },
        subject:      { type: 'string', description: 'Broad subject area, e.g. "biology"' }
      },
      required: ['currentTopic']
    }
  },
  {
    name: 'ask_socratic_question',
    description: `Guides a student to discover the answer themselves through Socratic questioning.
      Use this instead of explain_topic when the student is in Socratic mode.
      Never gives the answer directly — always asks a guiding question.`,
    parameters: {
      type: 'object',
      properties: {
        topic:           { type: 'string', description: 'The topic being explored' },
        level:           { type: 'string', enum: ['beginner','intermediate','advanced'] },
        studentResponse: { type: 'string', description: 'What the student just said (empty on turn 1)' },
        turnNumber:      { type: 'number', description: 'Which turn in the dialogue (starts at 1)' }
      },
      required: ['topic', 'level']
    }
  },
  {
    name: 'generate_concept_map',
    description: `Generates a concept map showing how ideas within a topic connect to each other.
      Use this after explaining a topic to give the student a visual knowledge graph.`,
    parameters: {
      type: 'object',
      properties: {
        topic: { type: 'string', description: 'The topic to map' },
        level: { type: 'string', enum: ['beginner','intermediate','advanced'] }
      },
      required: ['topic', 'level']
    }
  }
];

// ─────────────────────────────────────────────
// TOOL IMPLEMENTATIONS
// These run when Gemma calls a tool.
// Each returns a plain object — the result is
// fed back to Gemma as a tool_response.
// ─────────────────────────────────────────────

// Tool 1: explain_topic
// 4-layer smart cache + builds the structured explanation prompt and calls Ollama
async function explain_topic({ topic, level, context }) {
  // ── Smart cache lookup (4-layer) ──
  const lookup = smartGet('explain', topic, level);
  if (lookup.value)    return lookup.value;
  if (lookup.inFlight) return lookup.inFlight;  // deduplicated wait

  // Build the Ollama promise and register as in-flight
  const promise = (async () => {
    const systemPrompt = `${langPrefix()}You are StudyBuddy, a clear and patient tutor.
Respond ONLY with valid JSON matching this exact structure:
{
  "intro": "1-2 sentence opener",
  "steps": [
    { "title": "step label", "text": "one sentence", "emoji": "" }
  ],
  "answer": "key takeaway sentence",
  "followup": "one check-understanding question"
}
Rules:
- Steps: 3-5 items. 
- NO markdown, LaTeX, or special formatting inside strings.
- For chemical formulas: Use subscript numbers directly (H2O not H₂O or \\textH₂\\textO)
- For mathematical: Use plain text (x^2, square root, fractions as text)
- For units: Write out (watts, meters, celsius not W, m, °C)
- Plain text only. JSON must be valid.

Strict Rule: Keep your <think> section extremely brief, under 30 words. Do not show your scratchpad work; move directly to providing the structured JSON.`;

    const userMsg = context
      ? `Explain "${topic}" to a ${level} student. Extra context: ${context}${enforceJSON}`
      : `Explain "${topic}" to a ${level} student.${enforceJSON}`;

    const { res: response, ms: fetchMs } = await timedFetch('http://localhost:11434/api/chat', {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        ...reasoningWithDraft(),
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user',   content: userMsg }
        ],
        stream: false,
        options: { ...ollamaOptions('json'), num_ctx: 4096 }
      })
    });

    const data    = await response.json();
    const rawText = data.message.content;

    // Strip <think> blocks and parse with robust parser
    const cleaned = rawText.replace(/<think>[\s\S]*?<\/think>/gi, '').trim();
    const explanation = parseTutorResponse(cleaned);

    const result = { success: true, explanation, topic, level, _ms: fetchMs };
    smartSet('explain', topic, level, result);  // store in 4-layer cache
    return result;
  })();

  registerInFlight('explain', topic, level, promise);
  return promise;
}

// Tool 2: generate_quiz
// 4-layer smart cache + generates N multiple choice questions
async function generate_quiz({ topic, level, numQuestions }) {
  const n      = Math.min(Math.max(Math.round(numQuestions), 2), 5);

  // Scale token limit: advanced needs more explanation per question
  const tokenMultiplier = level === 'advanced' ? 220 : 180;
  const numPredict      = Math.min(n * tokenMultiplier + 100, 1200);

  const lookup = smartGet('quiz', `${topic}::${n}`, level);
  if (lookup.value)    return lookup.value;
  if (lookup.inFlight) return lookup.inFlight;

  const promise = (async () => {
    const systemPrompt = `${langPrefix()}You are a quiz generator.
Respond ONLY with a valid JSON array. No markdown. No explanation. Just the raw JSON.
Format:
[
  {
    "question": "Question text?",
    "options":  ["A) ...", "B) ...", "C) ...", "D) ..."],
    "answer":   "A) ...",
    "explanation": "Brief reason why correct."
  }
]`;

    const { res: response, ms: fetchMs } = await timedFetch('http://localhost:11434/api/chat', {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        ...reasoningWithDraft(),
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user',   content: `Generate exactly ${n} multiple choice questions about "${topic}" for a ${level} level student.${enforceJSON}` }
        ],
        stream: false,
        options: { ...ollamaOptions('quiz'), num_predict: numPredict, num_ctx: 4096 }
      })
    });

    const data    = await response.json();
    const rawText = data.message.content;

    // Strip <think> blocks and parse with robust parser
    const cleaned   = rawText.replace(/<think>[\s\S]*?<\/think>/gi, '').trim();
    const questions = parseQuizResponse(cleaned);

    if (questions.length > 0) {
      const result = { success: true, questions, topic, numQuestions: questions.length, _ms: fetchMs };
      smartSet('quiz', `${topic}::${n}`, level, result);
      return result;
    } else {
      const result = { success: false, error: 'Quiz generation failed', questions: [], _ms: fetchMs };
      smartSet('quiz', `${topic}::${n}`, level, result);
      return result;
    }
  })();

  registerInFlight('quiz', `${topic}::${n}`, level, promise);
  return promise;
}

// Tool 3: track_progress
// Saves to the progress JSON store and returns a summary
function track_progress({ topic, level, quizScore, studentId, studentName }) {
  try {
    const topicData = saveProgress(topic, level, quizScore ?? null, studentId, studentName);
    const summary   = getProgressSummary(studentId);
    return {
      success:     true,
      saved:       { topic, level, quizScore },
      topicRecord: topicData,
      weakAreas:   summary.weakAreas,
      totalStudied: summary.totalTopicsStudied
    };
  } catch (err) {
    return { success: false, error: err.message };
  }
}

// Tool 4: suggest_next_topic
// Reads progress store and asks Gemma for a smart next-topic recommendation
async function suggest_next_topic({ currentTopic, subject }) {
  const summary = getProgressSummary();

  const context = `
Student just studied: ${currentTopic}
Subject area: ${subject || 'general'}
Topics studied so far: ${summary.topics.map(t => t.name).join(', ') || 'none yet'}
Weak areas (low scores): ${summary.weakAreas.join(', ') || 'none identified yet'}
Strong areas: ${summary.strongAreas.join(', ') || 'none yet'}
  `.trim();

  const { res: response, ms: fetchMs } = await timedFetch('http://localhost:11434/api/chat', {
    method:  'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      ...reasoningWithDraft(),
      messages: [
        { role: 'system', content: `${langPrefix()}You are a curriculum advisor. Based on the student's progress, suggest the SINGLE most beneficial next topic to study. Respond ONLY with valid JSON: { "nextTopic": "topic name", "reason": "one sentence why", "relatedTo": "how it connects to what they just studied" }` },
        { role: 'user',   content: `${context}${enforceJSON}` }
      ],
      stream: false,
      options: { ...ollamaOptions('fast'), num_ctx: 4096 }
    })
  });

  const data    = await response.json();
  const rawText = data.message.content;

  // Strip <think> blocks and parse with robust parser
  const cleaned   = rawText.replace(/<think>[\s\S]*?<\/think>/gi, '').trim();
  const nextTopic = parseNextTopicResponse(cleaned);

  return {
    success: true,
    nextTopic: nextTopic.nextTopic || 'Review previous topics',
    reason:    nextTopic.reason    || 'Consolidate before moving forward',
    relatedTo: nextTopic.relatedTo || currentTopic,
    _ms: fetchMs
  };
}

// ─────────────────────────────────────────────
// TOOL 5: ask_socratic_question
// Witty, high-energy Socratic tutor — exactly 5 questions then Big Picture
// ─────────────────────────────────────────────
async function ask_socratic_question({ topic, level, studentResponse, turnNumber }) {
  const turn = turnNumber || 1;
  const isFinalTurn = turn >= 5;

  const systemPrompt = `${langPrefix()}You are an expert Socratic Tutor with a witty, high-energy personality. Think of yourself as the cool teacher every student wishes they had — someone who mixes pop-culture references, funny analogies, and contagious enthusiasm.

CURRENT TURN: ${turn} of 5

ABSOLUTE RULES:
1. ENTERTAIN — Use relatable pop-culture references, memes, funny analogies, and humor. Make learning feel like a conversation with a friend, not a lecture.
2. NO JARGON — Explain everything as if the student is smart but hates boring textbooks. If you must use a technical term, immediately follow it with a fun analogy.
3. THE 5-STEP LOGIC — You ask EXACTLY 5 questions total. Each question MUST build on the student's previous answer to logically lead them toward understanding the concept.
4. NEVER GIVE AWAY THE ANSWER — If the student is wrong, nudge them with a hint or a funny comparison. Say things like "Close! Think of it like..." or "Not quite — imagine if...". Never say "No, the answer is..."
5. THE REVEAL — On Turn 5 (the FINAL turn), after addressing their answer, provide a clear "🎯 Big Picture" summary that ties all 5 answers together into a simple, memorable explanation.

RESPONSE STYLE BY TURN:
- Turn 1: Energetic opening! Set the vibe. Ask something that activates what they already know. E.g. "Before we dive in — quick: if you had to explain [topic] to a 5-year-old using only pizza toppings, what would you say? 🍕"
- Turn 2-3: Build momentum. React to their answer with genuine excitement or a funny riff, then ask a question that goes one level deeper.
- Turn 4: They should be close now. Give a subtle nudge if needed. Your question should be the "aha moment" setup.
- Turn 5: THE FINALE. Acknowledge their final answer, then drop the 🎯 Big Picture summary — a clean, simple, memorable explanation (3-5 sentences) that connects the dots from all 5 turns.

${isFinalTurn ? `THIS IS TURN 5 — THE FINALE! You MUST include a "summary" field with the Big Picture. Make it clear, simple, and memorable. Tie together what the student discovered across all 5 questions.` : ''}

Respond ONLY with valid JSON (no markdown fences):
{
  "acknowledgement": "Your witty, warm reaction to the student's answer (empty string on turn 1)",
  "question": "Your Socratic question for this turn${isFinalTurn ? ' (can be a final reflective question like \\"So putting it all together, what is [topic] really about?\\")' : ''}",
  "hint": "A fun, subtle hint if turn >= 3 — use analogies or pop-culture refs. Empty string if not needed.",
  "isNearAnswer": ${turn >= 4 ? 'true' : 'false'},
  "summary": "${isFinalTurn ? 'Your 🎯 Big Picture summary (3-5 sentences). Tie everything together.' : ''}"
}`;

  const userMsg = turn === 1
    ? `Topic: "${topic}". Student level: ${level}. This is Turn 1 — start the Socratic dialogue with energy!`
    : `Topic: "${topic}". Student level: ${level}. Student's answer: "${studentResponse}". This is Turn ${turn} of 5.${isFinalTurn ? ' THIS IS THE FINAL TURN — include the Big Picture summary!' : ''}`;

  const { res: response, ms: fetchMs } = await timedFetch('http://localhost:11434/api/chat', {
    method:  'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      ...reasoningWithDraft(),
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user',   content: `${userMsg}${enforceJSON}` }
      ],
      stream: false,
      options: { ...ollamaOptions(isFinalTurn ? 'json' : 'fast'), num_ctx: 4096 }
    })
  });

  const data    = await response.json();
  const rawText = data.message.content;

  // Strip <think> blocks and parse with robust Socratic parser
  const cleaned = rawText.replace(/<think>[\s\S]*?<\/think>/gi, '').trim();
  const parsed  = parseSocraticResponse(cleaned);

  return {
    success:         true,
    acknowledgement: parsed.acknowledgement,
    question:        parsed.question,
    hint:            parsed.hint,
    isNearAnswer:    parsed.isNearAnswer || turn >= 4,
    summary:         parsed.summary,
    topic,
    turn,
    isFinalTurn,
    _ms: fetchMs
  };
}

// ─────────────────────────────────────────────
// TOOL 6: generate_concept_map
// Returns nodes and edges representing how concepts relate
// ─────────────────────────────────────────────
async function generate_concept_map({ topic, level }) {
  const systemPrompt = `${langPrefix()}You are a knowledge graph builder. Given a topic, generate a concept map showing how key ideas connect.

Respond ONLY with valid JSON in exactly this format — no markdown, no extra text:
{
  "central": "Main topic label",
  "nodes": [
    { "id": "n1", "label": "Concept name", "type": "main" },
    { "id": "n2", "label": "Related idea", "type": "related" },
    { "id": "n3", "label": "Example",      "type": "example" }
  ],
  "edges": [
    { "from": "central", "to": "n1", "label": "involves" },
    { "from": "n1",      "to": "n2", "label": "requires" }
  ]
}

Node types: "main" (key concepts), "related" (supporting ideas), "example" (concrete examples)
Rules:
- 5-9 nodes total (not counting central)
- 6-10 edges
- Beginner: simple concrete concepts. Advanced: technical, nuanced concepts.
- Edge labels: short verbs like "causes", "requires", "produces", "is part of", "leads to"`;

  const { res: response, ms: fetchMs } = await timedFetch('http://localhost:11434/api/chat', {
    method:  'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      ...reasoningWithDraft(),
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user',   content: `Generate a concept map for "${topic}" at ${level} level.${enforceJSON}` }
      ],
      stream: false,
      options: { ...ollamaOptions('json'), num_ctx: 4096 }
    })
  });

  const data    = await response.json();
  const rawText = data.message.content;

  // Strip <think> blocks and parse with robust concept map parser
  const cleaned = rawText.replace(/<think>[\s\S]*?<\/think>/gi, '').trim();
  const { central, nodes, edges } = parseConceptMapResponse(cleaned);

  if (nodes.length > 0) {
    return { success: true, central, nodes, edges, topic, level, _ms: fetchMs };
  } else {
    return { success: false, error: 'Concept map generation failed', topic, level, _ms: fetchMs };
  }
}

// ─────────────────────────────────────────────
// TOOL 7: generate_evaluation_report
// Dynamic Progress Evaluation Report — adaptive learning consultant
// ─────────────────────────────────────────────
async function generate_evaluation_report(studentId) {
  const progress   = getProgressSummary(studentId);
  const dueReviews = getDueReviews(studentId);
  const streak     = getLearningStreak(studentId);

  // Build a rich data snapshot for the LLM
  const topicDetails = progress.topics.map(t => {
    const status = t.avgScore === null ? 'studied (no quiz)' :
                   t.avgScore >= 80    ? 'mastered' :
                   t.avgScore >= 60    ? 'progressing' : 'needs review';
    return `- "${t.name}" (studied ${t.timesStudied}x, avg score: ${t.avgScore ?? 'none'}, status: ${status}, last: ${t.lastStudied})`;
  }).join('\n');

  const dueList = dueReviews.map(d =>
    `- "${d.name}" (interval: ${d.interval}d, ease: ${d.easeFactor}, avg: ${d.avgScore ?? 'none'})`
  ).join('\n') || '- None due';

  const dataBlock = `
STUDENT DATA SNAPSHOT:
Total topics studied: ${progress.totalTopicsStudied}
Total sessions: ${progress.totalSessions}
Current streak: ${streak.current} days (longest: ${streak.longest})
Strong areas (avg ≥ 80): ${progress.strongAreas.join(', ') || 'None yet'}
Weak areas (avg < 70 or no quiz): ${progress.weakAreas.join(', ') || 'None'}
Recent topics (newest first): ${progress.recentTopics.join(' → ') || 'None'}
Due for spaced review: ${dueReviews.length} topics

TOPIC DETAILS:
${topicDetails || '- No topics yet'}

DUE REVIEWS:
${dueList}
`;

  const systemPrompt = `You are an Adaptive Learning Consultant — analytical, observant, and coaching-oriented. You focus on the PROCESS of learning, not just scores.

Given the student's data below, generate a Dynamic Progress Evaluation Report with EXACTLY these 5 sections. Be specific to their actual topics and data. Never fabricate topics they haven't studied.

${dataBlock}

RESPOND ONLY with valid JSON (no markdown fences, no extra text):
{
  "narrative": "2-3 sentences describing the SHIFT in the student's learning focus. Don't list topics — describe the trajectory. E.g. 'You started with broad cultural curiosity and are now channeling that into applied science.' If only 1-2 topics, describe what their choice says about their learning style.",
  "crossPollination": {
    "topicA": "name of one studied topic",
    "topicB": "name of another studied topic",
    "connection": "1-2 sentences explaining the hidden connection — how knowing A helps with B"
  },
  "vocabularyHeatmap": "1-2 sentences about how the student's language is evolving. Are they using technical terms? Moving from casual to formal? If data is limited, describe what their topic choices suggest about their vocabulary growth trajectory.",
  "bigDomino": {
    "topic": "the ONE topic from their weak/review areas that would unlock the most progress",
    "reasoning": "1-2 sentences why this topic is the keystone"
  },
  "microMission": {
    "task": "A specific 2-minute task related to their most recent topic",
    "topic": "which topic this targets"
  }
}`;

  if (progress.totalTopicsStudied === 0) {
    return {
      success: true,
      narrative: "You haven't started studying yet! Ask me about any topic to begin your learning journey.",
      crossPollination: null,
      vocabularyHeatmap: "No data yet — your vocabulary heatmap will light up as you explore topics.",
      bigDomino: null,
      microMission: { task: "Ask StudyBuddy about a topic you're curious about. Just type it!", topic: "getting started" },
      _ms: 0
    };
  }

  const { res: response, ms: fetchMs } = await timedFetch('http://localhost:11434/api/chat', {
    method:  'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      ...reasoningWithDraft(),
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user',   content: `Generate the Dynamic Progress Evaluation Report based on the data provided.${enforceJSON}` }
      ],
      stream: false,
      options: { ...ollamaOptions('long'), num_ctx: 4096 }
    })
  });

  const data    = await response.json();
  const rawText = data.message.content;

  // Strip <think> blocks and parse with robust evaluation report parser
  const cleaned = rawText.replace(/<think>[\s\S]*?<\/think>/gi, '').trim();
  const parsed  = parseEvaluationReportResponse(cleaned);

  return { success: true, ...parsed, _ms: fetchMs };
}

// Map tool name strings to their implementation functions
const toolImplementations = {
  explain_topic,
  generate_quiz,
  track_progress,
  suggest_next_topic,
  ask_socratic_question,
  generate_concept_map,
  generate_evaluation_report
};

module.exports = { toolDefinitions, toolImplementations, setActiveLanguage };

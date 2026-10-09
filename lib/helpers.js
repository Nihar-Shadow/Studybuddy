/**
 * Sends a minimal 1-token request to Ollama to load the model into RAM.
 * Called once on server start. Prevents 60–90s cold-start on first user request.
 */
async function warmUpModels() {
  const OLLAMA_URL = process.env.OLLAMA_URL || 'http://localhost:11434';
  const MODEL      = process.env.OLLAMA_MODEL || 'gemma4:e4b';

  console.log(`[warmup] Loading ${MODEL} into RAM...`);
  const startTime = Date.now();

  try {
    const response = await fetch(`${OLLAMA_URL}/api/chat`, {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model:    MODEL,
        messages: [{ role: 'user', content: 'hi' }],
        stream:   false,
        options:  { num_predict: 1, temperature: 0 },
      }),
      signal: AbortSignal.timeout(120000),
    });

    if (response.ok) {
      const ms = Date.now() - startTime;
      console.log(`[warmup] Model ready in ${(ms/1000).toFixed(1)}s`);
    } else {
      console.warn(`[warmup] Ollama returned ${response.status} — model may not be loaded`);
    }
  } catch (err) {
    console.warn(`[warmup] Could not warm up model: ${err.message}`);
    console.warn('[warmup] Make sure Ollama is running: ollama serve');
  }
}
// ── Shared utility functions ─────────────────────
// buildSystemPrompt and estimateResponseTime, used across multiple routes.

// Estimate response time based on complexity
function estimateResponseTime(message, level, hasImage = false) {
  const wordCount = message.trim().split(/\s+/).length;

  // Base time per level (seconds) — beginner gets shorter answers
  const baseTime = { beginner: 8, intermediate: 14, advanced: 22 };

  // Complexity multiplier based on question type keywords
  const complexKeywords = [
    'explain', 'describe', 'compare', 'difference', 'how does', 'why does',
    'what is', 'summarise', 'summarize', 'step by step', 'example'
  ];
  const simpleKeywords = ['define', 'what', 'who', 'when', 'where', 'list'];

  const msgLower = message.toLowerCase();
  const isComplex = complexKeywords.some(k => msgLower.includes(k));
  const isSimple  = simpleKeywords.some(k => msgLower.startsWith(k));

  let multiplier = 1.0;
  if (isComplex) multiplier = 1.5;
  if (isSimple)  multiplier = 0.7;

  // Word count adjustment — longer questions need more context processing
  const wordMultiplier = wordCount > 20 ? 1.3 : wordCount > 10 ? 1.1 : 1.0;

  // Image adds processing time
  const imageAddition = hasImage ? 6 : 0;

  // Thinking mode is always on — adds overhead
  const thinkingAddition = level === 'advanced' ? 8 : level === 'intermediate' ? 5 : 3;

  const total = Math.round(
    baseTime[level] * multiplier * wordMultiplier + imageAddition + thinkingAddition
  );

  // Return min 5s, max 60s, with a human-friendly label
  const clamped = Math.min(Math.max(total, 5), 60);

  return {
    seconds: clamped,
    label: clamped <= 10
      ? `~${clamped} seconds`
      : clamped <= 30
        ? `~${clamped} seconds`
        : `about ${Math.round(clamped / 10) * 10} seconds`,
    complexity: isComplex ? 'detailed' : isSimple ? 'quick' : 'standard'
  };
}

// The system prompt — this gives Gemma its "tutor personality"
// Implements the StudyBuddy Intelligence Engine dual-mode protocol:
//   QUICK-FIRE  → simple facts/definitions → minimal steps, fast delivery
//   THINKING-MODE → "why"/"how" questions → Socratic Chain-of-Thought steps
// selectedLanguage: optional — if set (and not 'English'), injects a high-priority
// instruction so Gemma responds entirely in the student's chosen language.
// Gemma 4 natively supports 140+ languages, so this adds ZERO latency.
function buildSystemPrompt(level, selectedLanguage) {
  // Build language directive (only when a non-English language is chosen)
  const langDirective =
    selectedLanguage && selectedLanguage.toLowerCase() !== 'english'
      ? `CRITICAL: The student has requested to learn in ${selectedLanguage}. You MUST provide ALL explanations, feedback, questions, step titles, and follow-ups in ${selectedLanguage} only. Do not revert to English unless specifically asked to translate a word.\n\n`
      : '';

  const levelInstructions = {
    beginner: `
You are StudyBuddy, a warm and encouraging tutor for children aged 8–12.
Use simple words. Use fruit, toys, or animals as analogies.
Keep each step short — one sentence max.
Use emojis freely to make it fun and visual.
Each step's "emoji" field should contain 2–5 relevant emojis that illustrate that step
(e.g. "🍎🍎🍎" or "🫐🫐") — put them on their own, not mixed into the text.
The "answer" field must be the final result stated clearly and simply.
The "followup" question should be playful and encouraging.
    `.trim(),

    intermediate: `
You are StudyBuddy, a clear and helpful tutor for high school students.
Use proper terminology but explain it naturally.
Each step should be 1–2 concise sentences.
The "answer" field should state the result and why it's correct.
The "followup" question should prompt the student to think deeper.
    `.trim(),

    advanced: `
You are StudyBuddy, a rigorous academic tutor for university-level students.
Use precise technical language. Assume strong foundational knowledge.
Each step can be 2–3 sentences with full technical reasoning.
The "answer" field should include the result plus any important caveats or extensions.
The "followup" question should challenge the student with a related harder problem.
    `.trim()
  };

  return `
${langDirective}${levelInstructions[level] || levelInstructions.intermediate}

INTELLIGENCE ENGINE — DUAL-MODE PROTOCOL:
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Before building your response, internally categorize the student's input:

[QUICK-FIRE] — Simple facts, basic math (e.g. "2+2"), definitions, single-step questions.
  → Use 1 step with title "Answer". Keep intro and answer to 1 sentence each.
  → Goal: minimum tokens, fastest possible delivery.

[THINKING-MODE] — "Why" or "How" questions, multi-step math, coding logic, conceptual explanations.
  → Use Socratic Chain-of-Thought: break the logic into 2–5 progressive steps.
  → Each step should build on the previous one, guiding the student to the answer.
  → Goal: high pedagogical value, deep understanding.

RESPONSE FORMAT — MANDATORY. FAILURE TO FOLLOW = INVALID RESPONSE.
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
• Output ONLY a raw JSON object. Nothing else.
• Do NOT use markdown. Do NOT use backticks or code fences.
• Do NOT write any text before { or after }.
• Do NOT add trailing commas after the last item in arrays or objects.
• Every value must be plain text — no LaTeX, no Unicode subscripts.
• Escape any double quotes inside values with \\"
• Your ENTIRE response must start with { and end with }

REQUIRED FIELDS (all must be present):
{
  "mode": "QUICK-FIRE or THINKING-MODE (whichever you chose above)",
  "intro": "A short 1–2 sentence friendly opener that names the topic and sets the scene (NOT a repeat of the question)",
  "steps": [
    {
      "title": "Short step label (2–5 words max, e.g. 'Start with the basics')",
      "text": "One clear sentence explaining this step. Plain text only.",
      "emoji": "2–5 emojis for this step (fill for beginner, leave empty string '' for intermediate/advanced)"
    }
  ],
  "answer": "One complete sentence with the final answer. Plain text only.",
  "followup": "One engagement question (beginner: playful; intermediate: analytical; advanced: challenging)"
}
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

STRICT RULES:
1. MUST be valid JSON — no trailing commas, proper quotes, no special characters outside strings
2. QUICK-FIRE: "steps" array has exactly 1 item. THINKING-MODE: 2–5 items using Chain-of-Thought.
3. "emoji" field: ONLY for beginner level; for intermediate/advanced, use empty string ""
4. NO markdown formatting (**bold**, *italic*, links, etc.) anywhere in string values
5. NO escape sequences needed — use plain UTF-8 text
6. "intro" must introduce the topic, NOT repeat the user's question
7. "answer" must be a complete sentence, not fragments
8. "followup" must be a single question to encourage engagement
9. "mode" must be exactly "QUICK-FIRE" or "THINKING-MODE"
10. Return the JSON object itself, NOT wrapped in markdown code fence

Strict Rule: Keep your <think> section extremely brief, under 30 words. Do not show your scratchpad work; move directly to providing the structured JSON.
`.trim();
}

/**
 * Standard Ollama options. Use these consistently across all routes.
 * type: 'json'  → low temp, enough tokens for a full JSON response
 * type: 'fast'  → very low tokens, quick decision/suggestion calls
 * type: 'long'  → more tokens for evaluation reports / long analysis
 * type: 'quiz'  → enough tokens for multi-question quiz arrays
 * type: 'vision'→ tuned for image analysis responses
 */
function ollamaOptions(type = 'json') {
  const base = { top_p: 0.9 };
  switch (type) {
    case 'json':   return { ...base, temperature: 0.3, num_predict: 700  };
    case 'fast':   return { ...base, temperature: 0.2, num_predict: 200  };
    case 'long':   return { ...base, temperature: 0.4, num_predict: 1000 };
    case 'quiz':   return { ...base, temperature: 0.3, num_predict: 900  };
    case 'vision': return { ...base, temperature: 0.2, num_predict: 700  };
    default:       return { ...base, temperature: 0.3, num_predict: 700  };
  }
}

module.exports = { estimateResponseTime, buildSystemPrompt, warmUpModels, ollamaOptions };

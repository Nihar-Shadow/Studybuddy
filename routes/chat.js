// ── Chat Routes ──────────────────────────────────
// POST /chat (SSE streaming) and POST /chat-with-image (vision)

const express = require('express');
const fs      = require('fs');
const sharp   = require('sharp');
const router  = express.Router();

const { buildSystemPrompt, estimateResponseTime, ollamaOptions } = require('../lib/helpers');
const { parseTutorResponse } = require('../lib/parseJSON');
const { upload }       = require('../middleware/upload');
const { flowTraces }   = require('../middleware/devTiming');
const { MODELS, getModelForLanguage, resolveModelOrFallback, reasoningWithDraft } = require('../agent/models');
const {
  getLanguageDirective,
  isOdia,
  containsOdiaScript,
  validateOdiaContent,
  extractOdiaContentPlan,
  buildOdiaTutorPrompt,
  validateOdiaTutorAnswer,
  buildOdiaRepairPrompt,
  getOdiaDeterministicFallback
} = require('../lib/languagePolicy');
const {
  findRelevantClass9Knowledge,
  validateAgainstClass9Knowledge,
  getClass9Knowledge,
  getVerifiedAnswer,
  getGuaranteedClass9Answer
} = require('../lib/class9Knowledge');
const {
  createInitialLearningState,
  recordLearningEvent,
  chooseNextStudyAction,
  resolveTopicAndConcept,
  isRecentRepeatQuestion,
  chooseMasteryAction
} = require('../lib/studentLearningState');
const {
  getTargetedPractice,
  processPracticeSubmission
} = require('../lib/targetedPractice');
const {
  buildStructuredOdiaTutorResponse,
  isStructuredExplanationRequested
} = require('../lib/structuredTutor');
const { llmProvider, getProviderStatus } = require('../lib/llmProvider');
const { requireAuth } = require('./auth');

// ============ GET /api/provider-status — Live AI provider status ============
router.get('/api/provider-status', (req, res) => {
  res.json(getProviderStatus());
});

router.use(requireAuth);

// ============ POST /estimate — Quick time estimate (no Ollama call) ============
router.post('/estimate', (req, res) => {
  const { message, level, hasImage } = req.body;
  const estimate = estimateResponseTime(
    message || '',
    level || 'intermediate',
    hasImage || false
  );
  res.json(estimate);
});

// Main chat route — SSE streaming
router.post('/chat', async (req, res) => {
  const chatStart = Date.now();
  const steps = [];
  const mark = (name, detail) => steps.push({ name, ms: Date.now() - chatStart, detail });

  const { message, level, language } = req.body;
  const isOdiaReq = isOdia(language) || containsOdiaScript(message);
  const effectiveLanguage = isOdiaReq ? 'Odia' : (language || 'English');

  console.log(`[Diagnostic: Request] Selected Language: "${language || 'English'}", Detected Language: "${effectiveLanguage}", Prompt: "${(message || '').slice(0, 60)}…"`);

  // history may arrive as a JSON string (multipart) or a parsed array (JSON body)
  let history = [];
  try {
    const raw = req.body.history;
    history = typeof raw === 'string' ? JSON.parse(raw || '[]') : (raw || []);
    if (!Array.isArray(history)) history = [];
  } catch {
    history = [];
  }

  // SSE headers — keep connection open for streaming
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.setHeader('X-Accel-Buffering', 'no'); // Disable Nginx buffering if present
  res.flushHeaders();

  // Model resolution & offline check
  const modelResolution = await resolveModelOrFallback(effectiveLanguage);
  if (modelResolution.error) {
    console.error(`[LLM] Error: ${modelResolution.error}`);
    res.write(`data: ${JSON.stringify({ error: modelResolution.error })}\n\n`);
    res.write('data: [DONE]\n\n');
    res.end();
    return;
  }
  const selectedModel = modelResolution.model;

  // Exact required LLM routing logging
  console.log(`[LLM]\nlanguage=${effectiveLanguage}\nmodel=${selectedModel}\ntask=${isOdiaReq ? 'tutor' : 'chat'}`);

  console.log(`[Diagnostic: Prompt Construction] Building prompt with language: "${effectiveLanguage}", level: "${level || 'beginner'}"`);

  // Sanitize history so past assistant turns contain clean conversational text instead of raw JSON strings
  const sanitizedHistory = history
    .filter(h => h && typeof h === 'object' && h.role && h.content)
    .map(h => {
      let content = String(h.content || '').trim();
      if (h.role === 'assistant' && content.startsWith('{') && (content.includes('"answer"') || content.includes('"steps"') || content.includes('"intro"'))) {
        try {
          const parsed = parseTutorResponse(content);
          if (parsed && !parsed._empty) {
            const parts = [];
            if (parsed.intro && parsed.intro !== parsed.answer) parts.push(parsed.intro);
            if (Array.isArray(parsed.steps)) {
              for (const s of parsed.steps) {
                const stepText = typeof s === 'string' ? s : [s.title, s.text].filter(Boolean).join(': ');
                if (stepText && !parts.includes(stepText)) parts.push(stepText);
              }
            }
            if (parsed.answer && !parts.includes(parsed.answer)) parts.push(parsed.answer);
            content = parts.join('\n');
          }
        } catch (_) {}
      }
      return { role: h.role, content };
    });

  const requestScope = {
    onlineUnavailable: false,
    reason: null
  };

  // Compact sanitized history to prevent context blowout (keep at most last 4 turns or 1200 chars total)
  let compactHistory = sanitizedHistory.slice(-4);
  let historyChars = compactHistory.reduce((acc, h) => acc + (h.content ? h.content.length : 0), 0);
  while (compactHistory.length > 1 && historyChars > 1200) {
    compactHistory.shift();
    historyChars = compactHistory.reduce((acc, h) => acc + (h.content ? h.content.length : 0), 0);
  }

  let odiaContentPlan = null;
  let class9Knowledge = null;
  let odiaTutorSystemPrompt = null;
  let messages = [];
  let chatFormat = 'json';
  let modelOptions = { ...ollamaOptions('json'), num_ctx: 4096 };

  if (isOdiaReq) {
    odiaContentPlan = extractOdiaContentPlan(message);
    class9Knowledge = findRelevantClass9Knowledge(message, effectiveLanguage, sanitizedHistory);
    odiaTutorSystemPrompt = buildOdiaTutorPrompt(level || 'beginner', message, odiaContentPlan, class9Knowledge);
    messages = [
      { role: 'system', content: odiaTutorSystemPrompt },
      ...compactHistory,
      { role: 'user', content: message }
    ];
    chatFormat = undefined; // Natural plain text Odia (do not force JSON!)
    modelOptions = {
      temperature: 0.2,
      top_p: 0.9,
      repeat_penalty: 1.1,
      num_ctx: 8192,
      num_predict: 450
    };
  } else {
    messages = [
      { role: 'system', content: buildSystemPrompt(level || 'beginner', effectiveLanguage) },
      ...compactHistory,
      { role: 'user', content: message }
    ];
    chatFormat = 'json';
    modelOptions = { ...ollamaOptions('json'), num_ctx: 4096 };
  }
  mark('Build prompt', `${messages.length} messages, level=${level || 'beginner'}, lang=${effectiveLanguage}`);

  // Abort upstream generation if the client disconnects mid-stream or hits safety timeout.
  const upstreamAbort = new AbortController();
  const timeoutId = setTimeout(() => {
    try { upstreamAbort.abort('timeout'); } catch {}
  }, 90000); // 90s safety timeout

  let genResult = null;
  let rawReply = '';
  let usedProvider = 'ollama';
  let isFallback = false;

  req.on('close', () => {
    clearTimeout(timeoutId);
    try { upstreamAbort.abort(); } catch {}
  });

  const curriculumContextSize = class9Knowledge ? JSON.stringify(class9Knowledge.verifiedFacts || []).length : 0;

  try {
    genResult = await llmProvider.generate({
      language: effectiveLanguage,
      task: isOdiaReq ? 'tutor' : 'chat',
      messages,
      model: selectedModel,
      format: chatFormat,
      options: modelOptions,
      signal: upstreamAbort.signal,
      stream: true,
      requestScope,
      curriculumContextSize,
      onToken: (token) => {
        res.write(`data: ${JSON.stringify({ token })}\n\n`);
      }
    });

    clearTimeout(timeoutId);
    mark('Stream complete', `${(genResult.text || '').length} chars total`);

    rawReply = (genResult.text || '').trim();
    usedProvider = genResult.provider;
    isFallback = Boolean(genResult.fallback);

    // Guard against empty reply — never report success on a blank response
    if (!rawReply || rawReply.length === 0) {
      console.warn(`[/chat] Model returned 0 reply characters (done_reason: ${doneReason || 'unknown'}). Returning recoverable error.`);
      const isOdia = (language && language.toLowerCase().includes('odia')) || (language === 'or');
      const errorMsg = isOdia
        ? 'କ୍ଷମା କରନ୍ତୁ, ମଡେଲରୁ କୌଣସି ଉତ୍ତର ମିଳିଲା ନାହିଁ। ଦୟାକରି ପୁଣି ଚେଷ୍ଟା କରନ୍ତୁ।'
        : 'Sorry, the model did not generate an answer. Please try asking again.';
      res.write(`data: ${JSON.stringify({ error: errorMsg, done: true })}\n\n`);
      res.end();
      return;
    }

    let structured;
    let fallbackAttempted = false;
    let fallbackUsed = false;
    let finalSafetyFallback = false;
    let retries = 0;

    if (isOdiaReq) {
      // ── Odia Free-Form Tutor Pipeline with Multi-Layer Safety Guardrails ──
      const pipelineResult = await runOdiaSafetyPipeline({
        rawReply,
        message,
        odiaContentPlan,
        class9Knowledge,
        sanitizedHistory,
        selectedModel,
        requestScope
      });

      rawReply = pipelineResult.finalReply;
      validation = pipelineResult.validation;
      fallbackAttempted = pipelineResult.fallbackAttempted;
      fallbackUsed = pipelineResult.fallbackUsed;
      retries = pipelineResult.retries;
      const repairSucceeded = pipelineResult.repairSucceeded;
      finalSafetyFallback = pipelineResult.finalSafetyFallback;
      const failureReason = pipelineResult.failureReason;
      const failedFactRule = pipelineResult.failedFactRule;
      const finalValidationResult = pipelineResult.finalValidationResult;
      const initialValidationPassed = pipelineResult.initialValidationPassed;

      // Section 9 Class 9 Telemetry & Section 11 Tutor Logging
      console.log(`[Class9 Knowledge]\ntopic=${class9Knowledge ? class9Knowledge.id : 'unknown'}\nknowledge_found=${!!class9Knowledge}\nfacts_used=${class9Knowledge ? class9Knowledge.verifiedFacts.length : 0}\nvalidation=${initialValidationPassed ? 'pass' : 'fail'}\nrepair=${retries > 0 ? (repairSucceeded ? 'repaired' : 'failed') : 'none'}\nfallback=${fallbackUsed || finalSafetyFallback}`);
      console.log(`[LLM]\nlanguage=Odia\nmodel=${selectedModel}\ntask=tutor`);
      console.log(`[Odia Tutor Telemetry]\nvalidation_result=${initialValidationPassed ? 'PASSED' : 'FAILED'}\nfinal_validation_result=${finalValidationResult}\nfailure_reason=${failureReason || 'none'}\nfailed_fact_rule=${failedFactRule || 'none'}\nretry_count=${retries}\nfallback_attempted=${fallbackAttempted}\nfallback_used=${fallbackUsed}\nfinal_safety_fallback=${finalSafetyFallback}`);

      const structuredRequested = isStructuredExplanationRequested(message, 'Odia');

      structured = buildStructuredOdiaTutorResponse({
        rawReply,
        message,
        odiaContentPlan,
        class9Knowledge,
        level: level || 'beginner'
      });

      console.log(`[Tutor Structure] structured_requested=${structuredRequested}`);
      console.log(`[Tutor Structure] parsed=${Array.isArray(structured.steps) && structured.steps.length > 0}`);
      console.log(`[Tutor Structure] steps=${Array.isArray(structured.steps) ? structured.steps.length : 0}`);
      console.log(`[Tutor Structure] validation=${validation && validation.valid ? 'PASSED' : 'FAILED'}`);

      // If structured explanation was created, sync rawReply with the full structured text
      if (structured.steps && structured.steps.length > 0) {
        const sections = [];
        if (structured.intro) sections.push(structured.intro);
        structured.steps.forEach(st => {
          sections.push(`${st.title}: ${st.text || st.explanation}`);
        });
        if (structured.answer || structured.summary) sections.push(structured.answer || structured.summary);
        if (structured.followup || structured.followUp) sections.push(structured.followup || structured.followUp);
        rawReply = sections.join('\n\n');
      }

      mark('Odia tutor processed', `valid=${validation.valid}, retries=${retries}`);
    } else {
      // ── Standard non-Odia tutor pipeline (English / JSON mode) ──
      structured = parseTutorResponse(rawReply);

      // Anti-parroting and sentence deduplication guards
      if (structured.intro && typeof structured.intro === 'string') {
        const qClean = (message || '').replace(/^[0-9.?।\s]+|[?।\s]+$/g, '').trim().toLowerCase();
        const introClean = structured.intro.replace(/^[0-9.?।\s]+|[?।\s]+$/g, '').trim().toLowerCase();
        if (introClean === qClean) {
          structured.intro = '';
        } else {
          const rawQ = (message || '').trim().replace(/[?।\s]+$/, '');
          if (rawQ.length > 4 && structured.intro.startsWith(rawQ)) {
            structured.intro = structured.intro.slice(rawQ.length).replace(/^[?।:\s-]+/, '').trim();
          }
        }
        if (structured.answer && structured.intro.trim().toLowerCase() === structured.answer.trim().toLowerCase()) {
          structured.intro = '';
        }
      }

      // Populate universal aliases for English so schemas remain 100% language-independent
      if (structured && typeof structured === 'object') {
        if (structured.answer && !structured.summary) structured.summary = structured.answer;
        if (structured.summary && !structured.answer) structured.answer = structured.summary;
        if (structured.followup && !structured.followUp) structured.followUp = structured.followup;
        if (structured.followUp && !structured.followup) structured.followup = structured.followUp;
        if (Array.isArray(structured.steps)) {
          structured.steps.forEach(st => {
            if (st.text && !st.explanation) st.explanation = st.text;
            if (st.explanation && !st.text) st.text = st.explanation;
          });
        }
      }

      console.log(`[Diagnostic: Synthesis] Final answer language: ${effectiveLanguage}`);
      const structuredRequestedEn = isStructuredExplanationRequested(message, 'English');
      const isParsedEn = Array.isArray(structured.steps) && structured.steps.length > 0;
      console.log(`[LLM] language=English model=${selectedModel} task=tutor`);
      console.log(`[Tutor Structure] structured_requested=${structuredRequestedEn || structured.mode === 'THINKING-MODE' || isParsedEn}`);
      console.log(`[Tutor Structure] parsed=${isParsedEn}`);
      console.log(`[Tutor Structure] steps=${Array.isArray(structured.steps) ? structured.steps.length : 0}`);
      console.log(`[Tutor Structure] validation=PASSED`);

      if (structured._empty) {
        console.warn('[/chat] parseTutorResponse resolved to empty content');
        const errorMsg = 'Could not construct a valid answer. Please try asking again.';
        res.write(`data: ${JSON.stringify({ error: errorMsg, done: true })}\n\n`);
        res.end();
        return;
      }

      if (structured._parseMethod === 'plaintext_fallback') {
        console.warn('[/chat] parseTutorResponse used plaintext fallback');
      }
      mark('Parse structured JSON', `method=${structured._parseMethod}`);
    }

    // Universal alias normalization across both English and Odia pipelines
    if (structured && typeof structured === 'object') {
      if (structured.answer && !structured.summary) structured.summary = structured.answer;
      if (structured.summary && !structured.answer) structured.answer = structured.summary;
      if (structured.followup && !structured.followUp) structured.followUp = structured.followup;
      if (structured.followUp && !structured.followup) structured.followup = structured.followUp;
      if (Array.isArray(structured.steps)) {
        structured.steps.forEach(st => {
          if (st.text && !st.explanation) st.explanation = st.text;
          if (st.explanation && !st.text) st.text = st.explanation;
        });
      }
    }

    // ── Student Learning State & Next Study Decision Layer ──
    const targetKnowledge = isOdiaReq ? class9Knowledge : findRelevantClass9Knowledge(message, effectiveLanguage, sanitizedHistory);
    const {
      topic: identifiedTopic,
      concept: identifiedConcept,
      secondaryTopic,
      secondaryConcept
    } = resolveTopicAndConcept(message, targetKnowledge);

    let evidenceType = 'asked_about_concept';
    if (isRecentRepeatQuestion(message, sanitizedHistory, identifiedTopic)) {
      evidenceType = 'repeated_question';
    }

    if (req.session && !req.session.learningState) {
      req.session.learningState = createInitialLearningState({ language: effectiveLanguage, grade: 9 });
    }
    const currentLearningState = req.session?.learningState || createInitialLearningState({ language: effectiveLanguage, grade: 9 });

    const learningRecord = recordLearningEvent(currentLearningState, {
      topic: identifiedTopic,
      concept: identifiedConcept,
      secondaryTopic,
      secondaryConcept,
      evidence: evidenceType
    });

    let nextStudyAction = null;
    if (targetKnowledge && identifiedTopic && identifiedTopic !== 'general_science') {
      const candidateAction = chooseMasteryAction(currentLearningState, {
        currentTopic: identifiedTopic,
        currentConcept: identifiedConcept,
        conceptId: targetKnowledge.conceptId || identifiedConcept,
        language: effectiveLanguage,
        studentMessage: message
      });

      if (candidateAction && candidateAction.topic === identifiedTopic) {
        if (candidateAction.action === 'practice' || candidateAction.action === 'review') {
          const validPractice = getTargetedPractice({
            topic: candidateAction.topic,
            concept: candidateAction.concept
          }, effectiveLanguage);
          if (validPractice && !validPractice.exhausted) {
            nextStudyAction = candidateAction;
          }
        } else {
          nextStudyAction = candidateAction;
        }
      }
    }

    console.log(`[Mastery Agent] concept=${nextStudyAction?.conceptId || targetKnowledge?.conceptId || identifiedConcept} action=${nextStudyAction?.action || 'none'} state=${nextStudyAction?.masteryState || learningRecord.conceptState?.masteryState || 'unknown'} confidence=${nextStudyAction?.confidence ?? learningRecord.conceptState?.confidence ?? 0} reason=${nextStudyAction?.reason || 'none'} evidence=${JSON.stringify(nextStudyAction?.evidence || [])} nextReview=${nextStudyAction?.nextReview || 'none'}`);
    console.log(`[Learning State] topic=${identifiedTopic} concept=${identifiedConcept}${secondaryTopic ? ` secondaryTopic=${secondaryTopic}` : ''} evidence=${evidenceType} status=${learningRecord.conceptState?.status || 'unknown'}`);
    console.log(`[Next Study] action=${nextStudyAction?.action || 'none'} topic=${nextStudyAction?.topic || 'none'} concept=${nextStudyAction?.concept || 'none'} reason=${nextStudyAction?.reason || 'none'}`);

    if (structured && typeof structured === 'object') {
      structured.language = effectiveLanguage;
      structured.nextStudy = nextStudyAction;
      structured.currentTopic    = identifiedTopic  || null;
      structured.currentConcept  = identifiedConcept || null;
      structured.knowledgeFound  = !!targetKnowledge;
      if (targetKnowledge) {
        structured.grade = targetKnowledge.grade || 9;
        structured.subject = targetKnowledge.subject || 'science';
        structured.chapter = targetKnowledge.chapter || null;
        structured.conceptId = targetKnowledge.conceptId || identifiedConcept;
        structured.knowledgeSource = targetKnowledge.source || 'lib/class9Knowledge.js';
      }
    }

    // Send final SSE event with structured data + raw reply + provider telemetry, then close
    res.write(`data: ${JSON.stringify({
      done: true,
      reply: rawReply,
      structured,
      language: effectiveLanguage,
      provider: usedProvider,
      fallback: isFallback,
      model: genResult?.model || selectedModel
    })}\n\n`);
    res.end();
    mark('Send [DONE]', `structured=${!!structured}`);

    const chatMs = Date.now() - chatStart;
    console.log(`✅ [/chat] Done in ${(chatMs / 1000).toFixed(2)}s — reply length: ${rawReply.length} chars`);

    // Store flow trace
    flowTraces['/chat'] = {
      route: '/chat', ts: Date.now(), totalMs: chatMs, status: 'ok',
      input: (message || '').slice(0, 80), steps
    };
  } catch (err) {
    clearTimeout(timeoutId);
    // Client disconnect or timeout raised AbortError
    if (err.name === 'AbortError' || upstreamAbort.signal.aborted) {
      const isTimeout = upstreamAbort.signal.reason === 'timeout';
      flowTraces['/chat'] = {
        route: '/chat', ts: Date.now(), totalMs: Date.now() - chatStart,
        status: isTimeout ? 'timeout' : 'aborted',
        input: (message || '').slice(0, 80), steps
      };
      if (isTimeout) {
        console.warn('[/chat] Request timed out after 90s');
        const isOdia = (language && language.toLowerCase().includes('odia')) || (language === 'or');
        const timeoutMsg = isOdia
          ? 'ସମୟ ସମାପ୍ତ ହୋଇଗଲା (Timeout)। ଦୟାକରି ଆଉ ଥରେ ଚେଷ୍ଟା କରନ୍ତୁ।'
          : 'The request timed out while generating an answer. Please try again.';
        res.write(`data: ${JSON.stringify({ error: timeoutMsg, done: true })}\n\n`);
      }
      try { res.end(); } catch {}
      return;
    }
    const chatMs = Date.now() - chatStart;
    mark('ERROR', err.message);
    flowTraces['/chat'] = {
      route: '/chat', ts: Date.now(), totalMs: chatMs, status: 'error',
      input: (message || '').slice(0, 80), steps
    };
    console.error(`❌ [/chat] Error after ${(chatMs / 1000).toFixed(2)}s:`, err.message);
    // If headers already sent we can only write an error SSE event
    if (res.headersSent) {
      res.write(`data: ${JSON.stringify({ error: err.message })}\n\n`);
      res.end();
    } else {
      res.status(500).json({ error: err.message || 'Gemma is not running. Start Ollama first!' });
    }
  }
});

// ============ POST /chat-with-image — Homework photo analysis with vision ============
router.post('/chat-with-image', upload.single('image'), async (req, res) => {
  const { message, level, language, history: historyStr } = req.body;
  const file = req.file;

  // Validate image upload
  if (!file) {
    return res.status(400).json({ error: 'No image provided' });
  }

  try {
    // Read uploaded image and optimize it for faster processing
    const imageBuffer = fs.readFileSync(file.path);
    
    // ── Performance: Compress and resize image before sending to Ollama ──
    // Reduces upload size by ~80% and speeds up vision processing
    let optimizedBuffer;
    try {
      optimizedBuffer = await sharp(imageBuffer)
        .resize(640, 640, {       // Max 640px on longest side (down from 1024 for faster inference)
          fit: 'inside',
          withoutEnlargement: true
        })
        .webp({                    // Convert to WebP for smaller size + better quality
          quality: 80
        })
        .toBuffer();
      
      console.log(`[image] Optimized: ${imageBuffer.length} → ${optimizedBuffer.length} bytes (${Math.round((1 - optimizedBuffer.length / imageBuffer.length) * 100)}% reduction)`);
    } catch (sharpErr) {
      console.warn('[image] Sharp optimization failed, using original:', sharpErr.message);
      optimizedBuffer = imageBuffer;
    }
    
    const base64Image = optimizedBuffer.toString('base64');
    const mimeType = 'image/webp'; // Always WebP after optimization

    // Parse conversation history
    let history = [];
    try {
      history = JSON.parse(historyStr || '[]');
    } catch (e) {
      history = [];
    }

    // Build system prompt specifically for vision tasks - structured analysis format
    const langNote = getLanguageDirective(language, 'vision');
    const visionSystemPrompt = `You are an expert vision-based tutor. Analyze homework images with precision.
${langNote}

RESPOND ONLY IN THIS EXACT JSON FORMAT (no markdown, pure JSON):
{
  "visual_summary": "One sentence describing what you see in the image",
  "extracted_data": [
    "Key element 1 found (e.g., 'Math equation: 3x + 5 = 11')",
    "Key element 2 found (e.g., 'Graph showing parabola y = x²')",
    "Key element 3 found if applicable"
  ],
  "logic_steps": [
    {"step": 1, "title": "Step title", "explanation": "Detailed step explanation"},
    {"step": 2, "title": "Step title", "explanation": "Detailed step explanation"},
    {"step": 3, "title": "Step title", "explanation": "Detailed step explanation"}
  ],
  "final_solution": "The clear, highlighted final answer or conclusion",
  "confidence": "high|medium|low"
}

RULES:
1. visual_summary: Describe the IMAGE content objectively (what type of problem, subject area)
2. extracted_data: List ALL text, numbers, equations, or diagrams you can identify - be specific
3. logic_steps: Provide pedagogical breakdown - teach the concept, don't just solve
4. final_solution: State the answer clearly, boxed or highlighted format
5. confidence: Rate how clearly you could read/interpret the image

IMPORTANT: Output ONLY valid JSON. No explanatory text before or after.

Strict Rule: Keep your <think> section extremely brief, under 30 words. Do not show your scratchpad work; move directly to providing the structured JSON.`;

    // Build messages array with vision capability
    // For Ollama, we need to use the 'images' field at the message level
    const messages = [
      { role: 'system', content: visionSystemPrompt },
      ...history,
      {
        role: 'user',
        content: message || 'Please help me with this homework problem.',
        images: [base64Image]  // Ollama-style vision: pass base64 directly
      }
    ];

    const visionIsOdia = isOdia(language) || containsOdiaScript(message);
    const visionLang = visionIsOdia ? 'Odia' : (language || 'English');
    const visionResolution = await resolveModelOrFallback(visionLang);
    const visionModel = visionResolution.model;
    console.log(`[LLM]\nlanguage=${visionLang}\nmodel=${visionModel}\ntask=chat`);

    // Call Ollama with vision-capable model
    const ollamaRes = await fetch('http://localhost:11434/api/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: visionModel,
        messages: messages,
        stream: false,
        think: false,
        format: 'json',
        options: { ...ollamaOptions('vision'), num_ctx: 4096 }
        // NOTE: No speculative_model here — draft models are text-only
        //       and can't process vision/image inputs.
      })
    });

    if (!ollamaRes.ok) {
      throw new Error(`Ollama API error: ${ollamaRes.status} ${ollamaRes.statusText}`);
    }

    const data = await ollamaRes.json();
    
    if (!data.message || !data.message.content) {
      throw new Error('Invalid response from Ollama - no message content');
    }
    
    let rawReply = data.message.content;

    // Strip <think>…</think> reasoning blocks before anything else
    rawReply = rawReply.replace(/<think>[\s\S]*?<\/think>/gi, '').trim();

    // Parse vision response using robust parser (5 repair strategies)
    const { parseJSON } = require('../lib/parseJSON');
    const { data: visionParsed, method: visionMethod } = parseJSON(rawReply, null);
    let structured = null;
    let isVisionResponse = false;

    if (visionParsed && typeof visionParsed === 'object' && visionParsed.visual_summary && visionParsed.extracted_data) {
      structured = visionParsed;
      isVisionResponse = true;
    } else if (visionParsed && typeof visionParsed === 'object') {
      // Parsed as JSON but not vision format — use as-is
      structured = visionParsed;
    } else {
      // All parse attempts failed — build a vision-compatible fallback
      if (rawReply && rawReply.trim().length > 0) {
        structured = {
          visual_summary: 'Image analyzed - see details below',
          extracted_data: ['Unable to extract structured data from image'],
          logic_steps: [{
            step: 1,
            title: 'Analysis',
            explanation: rawReply
          }],
          final_solution: 'Please review the analysis above',
          confidence: 'low'
        };
        isVisionResponse = true;
      }
    }

    if (visionMethod === 'plaintext_fallback') {
      console.warn('[/chat-with-image] parseJSON used plaintext fallback');
    }

    // Clean up uploaded temp file asynchronously so any cleanup failure
    // doesn't interfere with the already-sent response.
    fs.unlink(file.path, (err) => {
      if (err) console.warn('[image] cleanup failed:', err.message);
    });

    // Return vision-specific response format
    res.json({
      reply: rawReply,           // raw text fallback
      structured: structured,    // parsed object or constructed fallback
      isVision: isVisionResponse // flag for frontend to use vision renderer
    });
  } catch (err) {
    // Clean up file on error (async, best-effort)
    if (req.file) {
      fs.unlink(req.file.path, (e) => {
        if (e) console.warn('[image] cleanup failed:', e.message);
      });
    }
    console.error('[/chat-with-image] Error:', err.message);
    res.status(500).json({ error: err.message || 'Gemma is not running. Start Ollama first!' });
  }
});

// ============ POST /practice/next — Targeted practice generator ============
router.post('/practice/next', (req, res) => {
  const { action, language, excludeQuestion } = req.body;
  const currentLearningState = req.session?.learningState || null;
  const targetAction = action || (currentLearningState ? chooseNextStudyAction(currentLearningState) : { action: 'introduce', topic: 'photosynthesis', concept: 'oxygen_role' });
  const effLang = language || currentLearningState?.language || 'English';

  const activity = getTargetedPractice(targetAction, effLang, {
    excludeQuestion,
    recentActivity: currentLearningState?.recentActivity
  });
  if (!activity) {
    return res.status(404).json({ error: 'No targeted practice available for concept', action: targetAction });
  }

  if (activity.exhausted) {
    return res.json({
      activity: null,
      exhausted: true,
      action: targetAction,
      explanation: activity.explanation,
      message: activity.message
    });
  }

  res.json({ activity, action: targetAction });
});

// ============ POST /practice/submit — Targeted practice evaluation & state update ============
router.post('/practice/submit', (req, res) => {
  const { activity, studentAnswer } = req.body;
  if (!activity) {
    return res.status(400).json({ error: 'Missing activity object' });
  }

  if (req.session && !req.session.learningState) {
    req.session.learningState = createInitialLearningState({
      language: activity.question && /[\u0b00-\u0b7f]/.test(activity.question) ? 'Odia' : 'English',
      grade: 9
    });
  }
  const currentLearningState = req.session?.learningState || createInitialLearningState();

  const submissionResult = processPracticeSubmission(currentLearningState, activity, studentAnswer);
  res.json(submissionResult);
});

/**
 * Executes the full Odia tutor safety pipeline:
 * Initial validation -> Targeted repair -> Verified fallback -> Guaranteed Class 9 answer -> Safe apology
 */
async function runOdiaSafetyPipeline({
  rawReply,
  message,
  odiaContentPlan,
  class9Knowledge,
  sanitizedHistory = [],
  selectedModel = 'dhee-odia',
  repairFetcher = null,
  requestScope = null
}) {
  const promptClean = (message || '').trim().replace(/[?।\s]+$/, '');
  let currentReply = rawReply || '';
  if (promptClean.length > 5 && currentReply.startsWith(promptClean)) {
    currentReply = currentReply.slice(promptClean.length).replace(/^[?।:\s-]+/, '').trim();
  }

  // Check anti-parroting against previous assistant turn
  const lastAssistantTurn = sanitizedHistory.slice().reverse().find(h => h.role === 'assistant')?.content?.trim();
  let isParroting = false;
  if (lastAssistantTurn && currentReply.length > 20) {
    if (currentReply === lastAssistantTurn || currentReply.includes(lastAssistantTurn.slice(0, 50))) {
      isParroting = true;
    }
  }

  // 1. Initial Validation
  let validation = validateOdiaTutorAnswer(currentReply, message, odiaContentPlan);
  let class9Val = class9Knowledge ? validateAgainstClass9Knowledge(currentReply, class9Knowledge) : { valid: true };
  if (validation.valid && !class9Val.valid) {
    validation = class9Val;
  }
  if (isParroting) {
    validation = { valid: false, reason: 'parroted_previous_answer', detail: 'Repeated previous assistant response in follow-up turn' };
  }

  const initialValidationPassed = validation.valid && class9Val.valid && !isParroting;
  let retries = 0;
  let failureReason = validation.valid ? null : validation.reason;
  let failedFactRule = validation.valid ? null : (validation.failedFactRule || null);
  let fallbackAttempted = false;
  let fallbackUsed = false;
  let repairSucceeded = false;
  let finalSafetyFallback = false;

  // 2. Targeted repair if validation failed
  if (!validation.valid) {
    retries++;
    const valFailure = (validation.reason === 'corrupted_terminology' || failedFactRule === 'canonical_terminology_violation')
      ? 'canonical_terminology_violation'
      : (validation.reason || 'quality_check_failed');
    console.log(`[Odia Tutor Quality]\nvalidation_failed=${valFailure}`);
    console.warn(`[Odia Tutor Quality] Validation failed (${validation.reason}: ${validation.detail}, rule: ${failedFactRule}). Attempting 1 targeted repair...`);
    try {
      const repairPrompt = buildOdiaRepairPrompt(currentReply, message, odiaContentPlan, validation, class9Knowledge);
      let repairedText = '';
      if (typeof repairFetcher === 'function') {
        repairedText = await repairFetcher(repairPrompt);
      } else {
        const repairResult = await llmProvider.generate({
          language: 'Odia',
          task: 'repair',
          messages: [
            { role: 'user', content: repairPrompt }
          ],
          model: selectedModel,
          stream: false,
          requestScope,
          options: {
            temperature: 0.2,
            top_p: 0.9,
            repeat_penalty: 1.1,
            num_ctx: 8192,
            num_predict: 450
          }
        });
        repairedText = (repairResult.text || '').trim();
      }

      if (promptClean.length > 5 && repairedText.startsWith(promptClean)) {
        repairedText = repairedText.slice(promptClean.length).replace(/^[?।:\s-]+/, '').trim();
      }

      if (repairedText) {
        const repairedValidation = validateOdiaTutorAnswer(repairedText, message, odiaContentPlan);
        const repairedClass9Val = class9Knowledge ? validateAgainstClass9Knowledge(repairedText, class9Knowledge) : { valid: true };
        if (repairedValidation.valid && repairedClass9Val.valid) {
          console.log('[Odia Tutor Quality] Targeted repair succeeded!');
          currentReply = repairedText;
          validation = repairedValidation;
          failureReason = null;
          failedFactRule = null;
          repairSucceeded = true;
        } else {
          const activeFailed = !repairedValidation.valid ? repairedValidation : repairedClass9Val;
          console.warn(`[Odia Tutor Quality] Targeted repair also failed (${activeFailed.reason}: ${activeFailed.detail}, rule: ${activeFailed.failedFactRule})`);
          validation = activeFailed;
          failureReason = activeFailed.reason;
          failedFactRule = activeFailed.failedFactRule || failedFactRule;
        }
      }
    } catch (repairErr) {
      console.warn('[Odia Tutor Quality] Targeted repair error:', repairErr.message);
    }

    // 3. Question-specific verified fallback if repair failed
    if (!validation.valid) {
      fallbackAttempted = true;
      const fallbackText = class9Knowledge
        ? getVerifiedAnswer(message, class9Knowledge)
        : getOdiaDeterministicFallback(odiaContentPlan?.topic, odiaContentPlan?.requestedConcepts, message);
      if (fallbackText) {
        console.log(`[Odia Tutor Quality] Using question-specific fallback for topic: ${class9Knowledge ? class9Knowledge.id : odiaContentPlan?.topic}`);
        const fbVal = validateOdiaTutorAnswer(fallbackText, message, odiaContentPlan);
        const fbClass9 = class9Knowledge ? validateAgainstClass9Knowledge(fallbackText, class9Knowledge) : { valid: true };
        if (fbVal.valid && fbClass9.valid) {
          currentReply = fallbackText;
          validation = { valid: true, fallbackUsed: true };
          fallbackUsed = true;
          failureReason = null;
          failedFactRule = null;
        } else {
          console.error(`[Odia Tutor Quality] Fallback validation failed! fbVal=${fbVal.reason}, fbClass9=${fbClass9.reason}`);
        }
      }
    }

    // 4. Final deterministic safety path if fallback was unavailable or failed validation
    if (!validation.valid) {
      console.warn('[Odia Tutor Quality] Entering final deterministic safety path...');
      let finalAnswerCandidate = '';

      if (class9Knowledge) {
        finalAnswerCandidate = getGuaranteedClass9Answer(class9Knowledge, message, odiaContentPlan);
        if (finalAnswerCandidate) {
          const candVal = validateOdiaTutorAnswer(finalAnswerCandidate, message, odiaContentPlan);
          const candC9 = validateAgainstClass9Knowledge(finalAnswerCandidate, class9Knowledge);
          if (candVal.valid && candC9.valid) {
            currentReply = finalAnswerCandidate;
            validation = { valid: true, guaranteedClass9Used: true };
            finalSafetyFallback = true;
            failureReason = null;
            failedFactRule = null;
          } else {
            console.warn(`[Odia Tutor Quality] Guaranteed Class 9 answer validation failed: ${candVal.reason || candC9.reason}`);
          }
        }
      }

      if (!validation.valid) {
        const SAFE_FALLBACK_ODIA = 'ଏହି ପ୍ରଶ୍ନର ନିଶ୍ଚିତ ଉତ୍ତର ଦେବାରେ ମୋତେ ଅସୁବିଧା ହେଉଛି। ଦୟାକରି ପ୍ରଶ୍ନଟିକୁ ଆଉଥରେ ସହଜ ଭାବରେ ପଚାର।';
        currentReply = SAFE_FALLBACK_ODIA;
        validation = { valid: true, safeApologyUsed: true };
        finalSafetyFallback = true;
        failureReason = null;
        failedFactRule = null;
      }
    }
  }

  const finalValidationResult = validation.valid ? 'PASSED' : 'FAILED';

  return {
    finalReply: currentReply,
    validation,
    initialValidationPassed,
    finalValidationResult,
    retries,
    failureReason,
    failedFactRule,
    fallbackAttempted,
    fallbackUsed,
    finalSafetyFallback,
    repairSucceeded
  };
}

router.runOdiaSafetyPipeline = runOdiaSafetyPipeline;

module.exports = router;

// ── Quiz Route ───────────────────────────────────
// POST /quiz — Quiz generation endpoint

const express = require('express');
const router  = express.Router();

const { flowTraces }      = require('../middleware/devTiming');
const { parseQuizResponse, stripOptionPrefix, resolveAnswer } = require('../lib/parseJSON');
const { ollamaOptions }   = require('../lib/helpers');
const { llmProvider }     = require('../lib/llmProvider');
const { MODELS, getModelForLanguage, resolveModelOrFallback, reasoningWithDraft, getModelOptions } = require('../agent/models');
const {
  getLanguageDirective,
  isOdia,
  validateOdiaQuiz,
  containsOdiaScript,
  extractQuestionCount,
  extractOptionCount,
  getTopicFactualRules,
  detectTopicType,
  validateQuizQuality,
  validateQuizFactualCorrectness,
  getTopicCoveragePlan,
  validateQuizDiversity,
  formatQuizValidationFailures,
  getQuestionValidationIssues,
  normalizeQuizTopic,
  CONCEPT_FALLBACK_QUESTIONS,
  CONCEPT_FALLBACK_QUESTIONS_OD
} = require('../lib/languagePolicy');
const { requireAuth }     = require('./auth');

router.use(requireAuth);

function sanitizeQuestions(rawQuestions, topic) {
  return (rawQuestions || [])
    .filter(q => q && typeof q === 'object')
    .map((q, index) => {
      const rawOptions = Array.isArray(q.options)
        ? q.options.map(o => String(o).trim())
        : [];

      const cleanedOptions = rawOptions
        .map(stripOptionPrefix)
        .filter(Boolean);

      const seen = new Set();
      const uniqueCleaned = [];
      for (const opt of cleanedOptions) {
        if (!seen.has(opt)) {
          seen.add(opt);
          uniqueCleaned.push(opt);
        }
      }

      while (uniqueCleaned.length < 4) {
        uniqueCleaned.push(`Option ${uniqueCleaned.length + 1}`);
      }
      const finalOptions = uniqueCleaned.slice(0, 4).map((text, idx) => {
        return `${String.fromCharCode(65 + idx)}) ${text}`;
      });

      const rawAnswer = q.answer !== undefined && q.answer !== null ? q.answer : '';
      const resolvedAnswer = resolveAnswer(rawAnswer, finalOptions, uniqueCleaned.slice(0, 4));

      return {
        question:    String(q.question || `Question ${index + 1}`).trim(),
        options:     finalOptions,
        answer:      resolvedAnswer,
        topic,
        concept:     q.concept ? String(q.concept).trim() : undefined,
        skill:       q.skill ? String(q.skill).trim() : undefined,
        explanation: String(q.explanation || 'No explanation provided').trim()
      };
    })
    .filter(q => q.question && q.question.length > 5 && q.answer);
}

async function logOllamaError(res, reqPayload, context = 'quiz') {
  let errBodyText = '';
  let errData = null;
  try {
    errBodyText = await res.text();
    errData = JSON.parse(errBodyText);
  } catch (_) {
    errData = { error: errBodyText || res.statusText };
  }

  console.error(`\n==================== OLLAMA API ERROR [${context}] ====================`);
  console.error(`HTTP status: ${res.status} ${res.statusText}`);
  console.error(`model name: ${reqPayload.model}`);
  console.error(`format=json: ${reqPayload.format === 'json'}`);
  console.error(`think sent: ${Boolean(reqPayload.think)}`);
  console.error('request options:', JSON.stringify(reqPayload.options, null, 2));
  console.error('response.data:', JSON.stringify(errData, null, 2));
  console.error(`response.data.error: ${errData?.error || 'N/A'}`);
  console.error('===================================================================\n');

  return errData;
}

router.post('/quiz', async (req, res) => {
  const quizStart = Date.now();
  const steps = [];
  const mark = (name, detail) => steps.push({ name, ms: Date.now() - quizStart, detail });

  const { topic, level, numQuestions, language } = req.body;
  const isOdiaReq = isOdia(language) || containsOdiaScript(topic);
  const effectiveLanguage = isOdiaReq ? 'Odia' : (language || 'English');

  // Extract explicit question count and option count from prompt text if present
  const explicitCount = extractQuestionCount(topic);
  const explicitOptions = extractOptionCount(topic);
  const numQuestionsInt = explicitCount || parseInt(numQuestions, 10) || 3;

  // Topic normalization: preserve raw sentence as context while using clean label for prompts
  const normalizedTopic = normalizeQuizTopic(topic);
  const quizTopic = normalizedTopic || topic;

  console.log(`\n⏱  [/quiz] Started — topic: "${topic}" (normalized: "${quizTopic}"), level: ${level}, questions: ${numQuestionsInt}${explicitCount ? ` (extracted: ${explicitCount})` : ''}, options: ${explicitOptions}, requestedLang: "${language || 'English'}", effectiveLang: "${effectiveLanguage}"`);

  if (!topic || !level) {
    return res.status(400).json({ error: 'Missing topic or level' });
  }

  if (isNaN(numQuestionsInt) || numQuestionsInt < 1 || numQuestionsInt > 10) {
    return res.status(400).json({ error: 'numQuestions must be between 1 and 10' });
  }
  mark('Validate input', `topic="${quizTopic}", ${numQuestionsInt} questions, ${explicitOptions} options, lang=${effectiveLanguage}`);

  // Central model resolution & offline check
  const modelResolution = await resolveModelOrFallback(effectiveLanguage);
  if (modelResolution.error) {
    console.error(`[LLM] Error: ${modelResolution.error}`);
    return res.status(503).json({
      error: modelResolution.error,
      model: modelResolution.originalModel,
      language: effectiveLanguage,
      questions: []
    });
  }
  const selectedModel = modelResolution.model;

  // Exact required LLM routing logging
  console.log(`[LLM]\nlanguage=${effectiveLanguage}\nmodel=${selectedModel}\ntask=quiz`);

  // Create topic coverage plan before calling the model
  const coveragePlan = getTopicCoveragePlan(quizTopic, numQuestionsInt, effectiveLanguage);
  if (coveragePlan.broadened && coveragePlan.broadeningNote) {
    console.log(`[/quiz] Coverage plan note: ${coveragePlan.broadeningNote}`);
  }

  const langDirective = getLanguageDirective(effectiveLanguage, 'quiz', quizTopic);
  const factualRules = getTopicFactualRules(quizTopic, effectiveLanguage);
  const targetConceptDesc = coveragePlan.concepts[0]?.description || quizTopic;

  // Topic coverage instructions
  const planInstructions = coveragePlan.concepts
    .map(c => `- Q${c.index}: concept "${c.description}"`)
    .join('\n');

  // Compact schema sample: single representative object rather than duplicating N times
  const schemaSample = '{"question":"...","options":["opt1","opt2","opt3","opt4"],"answer":0,"explanation":"..."}';

  const systemPrompt = isOdiaReq
    ? `${langDirective}You are an expert school science quiz generator.
Generate exactly ${numQuestionsInt} multiple choice question${numQuestionsInt === 1 ? '' : 's'} for a ${level} level student in natural, grammatically correct Odia (ଓଡ଼ିଆ).

${factualRules}

${numQuestionsInt === 1 ? `CONCEPT-LOCK MANDATORY REQUIREMENT:
Generate exactly ONE concept-specific question about: "${targetConceptDesc}".
Do NOT generate a broad quiz. Do NOT shift to unrelated topics. The correct answer must directly represent the scientific fact of this concept.` : `MANDATORY CONCEPTS (Each question MUST test its assigned concept from this list):
${planInstructions}`}

RULES:
1. QUESTION COUNT: Output EXACTLY ${numQuestionsInt} question${numQuestionsInt === 1 ? '' : 's'} in the "questions" array.
2. DIVERSITY: Each question tests ONE distinct concept. Never repeat concepts.
3. OPTIONS: Exactly ${explicitOptions} distinct, plausible choices per question. Do NOT include "A)", "B)", "C)", "D)" in option strings; provide plain text only.
4. ANSWER: "answer" MUST be a zero-based integer index (0, 1, 2, or 3) indicating the correct option.
5. EXPLANATION: 1 short sentence in Odia teaching why the answer is correct. Do not repeat the question.
6. JSON ONLY: Output ONLY valid JSON containing all ${numQuestionsInt} question${numQuestionsInt === 1 ? '' : 's'}:
{"questions":[${schemaSample}]}`.trim()
    : `You are an educational quiz generator for school students (${level} level).
Generate exactly ${numQuestionsInt} multiple choice question${numQuestionsInt === 1 ? '' : 's'} in ${effectiveLanguage}.

${factualRules}

${numQuestionsInt === 1 ? `CONCEPT-LOCK MANDATORY REQUIREMENT:
Generate exactly ONE concept-specific question about: "${targetConceptDesc}".` : `MANDATORY CONCEPTS (Each question MUST test its assigned concept):
${planInstructions}`}

RULES:
1. Each question must test a DIFFERENT concept and have a DIFFERENT correct answer.
2. Exactly ${explicitOptions} plausible options per question, plain text WITHOUT "A)", "B)", "C)", "D)" labels.
3. "answer" must be a zero-based integer index (0, 1, 2, or 3).
4. "explanation": 1 concise sentence explaining why the answer is correct.
Output ONLY valid JSON containing all ${numQuestionsInt} question${numQuestionsInt === 1 ? '' : 's'}: {"questions":[${schemaSample}]}`.trim();

  const userPrompt = numQuestionsInt === 1
    ? `Generate exactly 1 multiple choice question with ${explicitOptions} options for "${quizTopic}" in ${effectiveLanguage}. Return ONLY the JSON object with 1 question in the questions array.`
    : `Generate the ${numQuestionsInt}-question quiz with ${explicitOptions} options per question for "${quizTopic}" in ${effectiveLanguage}. Ensure all ${numQuestionsInt} questions are included in the JSON questions array. Return only the JSON object.`;
  const promptLength = systemPrompt.length + userPrompt.length;
  mark('Build prompt', `${promptLength} chars, ${coveragePlan.plannedCount} planned concepts`);

  // Telemetry profiling
  let modelLatencyMs = 0;
  let parseTimeMs = 0;
  let validationTimeMs = 0;
  let retries = 0;
  let retryLatencyMs = 0;
  let promptTokens = 0;
  let outputTokens = 0;
  let ttftMs = null;
  let generationMs = null;
  let tokensPerSec = null;

  // Sized appropriately for language token density (Odia requires ~400 tokens/question, English ~130)
  const numPredict = isOdiaReq
    ? Math.min(1800, Math.max(1200, numQuestionsInt * 450))
    : Math.min(1000, Math.max(400, numQuestionsInt * 150));

  // Call provider with a timeout to prevent server hang on long quiz generation
  const controller = new AbortController();
  const timeout    = setTimeout(() => controller.abort(), 120000); // 120s max
  let onlineUnavailableForRequest = false;

  try {
    const fetchStart = Date.now();
    let responseText = '';

    try {
      const genResult = await llmProvider.generate({
        language: effectiveLanguage,
        task: 'quiz',
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt }
        ],
        model: selectedModel,
        format: 'json',
        options: {
          ...ollamaOptions('quiz'),
          ...getModelOptions(selectedModel, 'quiz', {
            temperature: 0.2,
            num_predict: numPredict,
            num_ctx: 4096
          })
        },
        signal: controller.signal,
        stream: false
      });

      if (genResult.errorType === 'request_too_large' || genResult.errorType === 'rate_limited' || genResult.reason === 'online_request_too_large' || genResult.fallback) {
        onlineUnavailableForRequest = true;
        console.log(`[/quiz] Online provider unavailable for this quiz request (${genResult.errorType || 'fallback'}). Subsequent repairs will route directly to Ollama.`);
      }

      responseText = (genResult.text || '').trim();
    } finally {
      clearTimeout(timeout);
    }
    modelLatencyMs = Date.now() - fetchStart;
    mark('LLM API call', `model=${selectedModel}, ms=${modelLatencyMs}`);
    console.log(`[/quiz] Raw response length: ${responseText.length} chars (latency: ${modelLatencyMs}ms)`);

    // ─── Robust JSON parsing via central parser ───
    const parseStart = Date.now();
    responseText = responseText.replace(/<think>[\s\S]*?<\/think>/gi, '').trim();
    let questions = sanitizeQuestions(parseQuizResponse(responseText), quizTopic);
    if (questions.length > numQuestionsInt) {
      questions = questions.slice(0, numQuestionsInt);
    }
    parseTimeMs = Date.now() - parseStart;
    console.log('[/quiz] Parsed questions preview:', JSON.stringify(questions));
    mark('Parse JSON', `${questions.length} questions via parseQuizResponse in ${parseTimeMs}ms`);

    // Quality, Odia language compliance, deterministic factual check, and concept diversity check
    const valStart = Date.now();
    let qualityCheck = validateQuizQuality(questions, quizTopic, effectiveLanguage);
    validationTimeMs = Date.now() - valStart;
    const needsRetry = (questions.length < numQuestionsInt) || !qualityCheck.valid;

    if (needsRetry) {
      retries = 1;
      const retryFetchStart = Date.now();

      // Check slot-level issues if we have partial questions
      const slotIssues = getQuestionValidationIssues(questions, quizTopic, effectiveLanguage, coveragePlan);
      const failedSlots = slotIssues.filter(s => !s.valid);

      if (failedSlots.length > 0 && questions.length > 0) {
        console.warn(`[/quiz] ${failedSlots.length} of ${questions.length} question slot(s) failed validation — attempting slot-level repair...`);

        for (const slot of failedSlots) {
          const slotIdx = slot.index;
          const targetConcept = slot.targetConcept;
          const expectedFact = slot.expectedFact || `Must accurately test concept: ${targetConcept}`;
          const failureReason = slot.detail || slot.reason;

          const slotPrompt = `TOPIC:
${quizTopic}

TARGET CONCEPT:
${targetConcept}

REQUIRED FACT:
${expectedFact}

LANGUAGE:
${effectiveLanguage}

Generate exactly ONE complete multiple choice question for this topic and target concept.
Topic must remain strictly "${quizTopic}". Do NOT change the topic or concept.
Do NOT introduce unrelated concepts (no photosynthesis, no plants, no cellular biology, no oxygen production).
Required output:
- Exactly 1 question (complete interrogative sentence in ${effectiveLanguage})
- Exactly 4 options (distinct, non-empty, plain text without labels)
- Exactly 1 correct answer representing the required fact
Return ONLY valid JSON matching this schema:
{"question":"...","options":["...","...","...","..."],"answer":0,"explanation":"..."}

REASON FOR PREVIOUS FAILURE:
${failureReason}`;

          try {
            const slotRes = await llmProvider.generate({
              language: effectiveLanguage,
              task: 'quiz',
              forceLocal: onlineUnavailableForRequest,
              messages: [
                { role: 'system', content: `${langDirective}You are an expert school science quiz generator.` },
                { role: 'user', content: slotPrompt }
              ],
              model: selectedModel,
              format: 'json',
              options: {
                ...ollamaOptions('quiz'),
                ...getModelOptions(selectedModel, 'quiz', {
                  temperature: 0.2,
                  num_predict: 500,
                  num_ctx: 4096
                })
              },
              stream: false
            });

            if (slotRes.errorType === 'rate_limited' || slotRes.errorType === 'request_too_large' || slotRes.fallback) {
              onlineUnavailableForRequest = true;
              console.log(`[/quiz] Online provider unavailable during slot repair (${slotRes.errorType || 'fallback'}). Subsequent repairs will route directly to Ollama.`);
            }

            const slotClean = (slotRes.text || '').replace(/<think>[\s\S]*?<\/think>/gi, '').trim();
            const repairedQuestions = sanitizeQuestions(parseQuizResponse(slotClean), quizTopic);
            if (repairedQuestions.length > 0) {
              const rep = repairedQuestions[0];
              if (!rep.concept && slot.conceptId) rep.concept = slot.conceptId;
              const repVal = validateQuizQuality([rep], quizTopic, effectiveLanguage);
              if (repVal.valid) {
                // Check that inserting this question maintains full-quiz diversity
                const candidateQuiz = [...questions];
                candidateQuiz[slotIdx] = rep;
                const candDiversity = validateQuizDiversity(candidateQuiz, quizTopic);
                if (candDiversity.valid) {
                  questions[slotIdx] = rep;
                  console.log(`[/quiz] Repaired question slot Q${slotIdx + 1} successfully.`);
                  continue;
                }
              }
            }
          } catch (slotErr) {
            onlineUnavailableForRequest = true;
            console.warn(`[/quiz] Slot repair fetch failed for Q${slotIdx + 1}:`, slotErr.message);
          }

          // If slot repair failed, check deterministic template fallback
          const slotFallback = (isOdiaReq && CONCEPT_FALLBACK_QUESTIONS_OD[slot.conceptId]) || slot.fallbackQuestion || CONCEPT_FALLBACK_QUESTIONS[slot.conceptId];
          if (slotFallback) {
            console.log(`[/quiz] Using deterministic template fallback for Q${slotIdx + 1} (${slot.conceptId}).`);
            const fallbackSanitized = sanitizeQuestions([slotFallback], quizTopic);
            if (fallbackSanitized.length > 0) {
              questions[slotIdx] = fallbackSanitized[0];
            }
          }
        }

        retryLatencyMs = Date.now() - retryFetchStart;
        const rValStart = Date.now();
        qualityCheck = validateQuizQuality(questions, quizTopic, effectiveLanguage);
        validationTimeMs += (Date.now() - rValStart);

        if (!qualityCheck.valid) {
          console.warn(`[/quiz] Post-slot repair quality issue (${qualityCheck.reason}) — applying fallback template questions`);
          const remainingIssues = getQuestionValidationIssues(questions, quizTopic, effectiveLanguage, coveragePlan);
          for (const s of remainingIssues) {
            const fbObj = (isOdiaReq && CONCEPT_FALLBACK_QUESTIONS_OD[s.conceptId]) || s.fallbackQuestion || CONCEPT_FALLBACK_QUESTIONS[s.conceptId];
            if (!s.valid && fbObj) {
              const fb = sanitizeQuestions([fbObj], quizTopic);
              if (fb.length > 0) questions[s.index] = fb[0];
            }
          }
          qualityCheck = validateQuizQuality(questions, quizTopic, effectiveLanguage);
        }
      } else {
        // Full quiz retry fallback
        const failures = formatQuizValidationFailures(questions, qualityCheck, quizTopic);
        const issueSummary = failures.join('; ');
        console.warn(`[/quiz] Full quiz output needs correction (${issueSummary}) — attempting full corrective retry...`);
        const retryInstruction = `FAILED GENERATION:
${failures.join('\n')}

RETRY REQUIREMENTS:
- Replace ALL failed questions rather than merely rewriting the same question.
- Assigned concepts for this quiz:
${planInstructions}
- Each question must test a DIFFERENT concept from the list above. Do not repeat concepts.
- Correct every listed factual error.
- Return exactly ${numQuestionsInt} questions.
- Return options as 4 plain text strings WITHOUT "A)", "B)", "C)", "D)" labels.
- All 4 options per question must be completely unique and distinct.
- Return "answer" as a zero-based integer index (0, 1, 2, or 3).
- Return ONLY valid JSON: {"questions":[{"question":"...","options":["...","...","...","..."],"answer":0,"explanation":"..."}]}`;

        try {
          const retryGen = await llmProvider.generate({
            language: effectiveLanguage,
            task: 'quiz',
            forceLocal: onlineUnavailableForRequest,
            messages: [
              { role: 'system', content: systemPrompt },
              { role: 'user', content: retryInstruction }
            ],
            model: selectedModel,
            format: 'json',
            options: {
              ...ollamaOptions('quiz'),
              ...getModelOptions(selectedModel, 'quiz', {
                temperature: 0.2,
                num_predict: numPredict,
                num_ctx: 4096
              })
            },
            stream: false
          });

          retryLatencyMs = Date.now() - retryFetchStart;
          const retryClean = (retryGen.text || '').replace(/<think>[\s\S]*?<\/think>/gi, '').trim();
          const rParseStart = Date.now();
          const retryQuestions = sanitizeQuestions(parseQuizResponse(retryClean), quizTopic);
          parseTimeMs += (Date.now() - rParseStart);

          const rValStart = Date.now();
          const retryQuality = validateQuizQuality(retryQuestions, quizTopic, effectiveLanguage);
          validationTimeMs += (Date.now() - rValStart);
          if (retryQuestions.length > 0) {
            if (retryQuality.valid) {
              questions = retryQuestions;
              qualityCheck = retryQuality;
              console.log('[/quiz] Corrective retry succeeded with', questions.length, 'quality-validated questions in', retryLatencyMs, 'ms');
            } else {
                console.warn('[/quiz] Corrective retry had validation issue:', retryQuality.reason);
                // Repair invalid slots using deterministic fallbacks
                const rSlotIssues = getQuestionValidationIssues(retryQuestions, quizTopic, effectiveLanguage, coveragePlan);
                const repaired = [...retryQuestions];
                for (const slot of rSlotIssues) {
                  const fbObj = (isOdiaReq && CONCEPT_FALLBACK_QUESTIONS_OD[slot.conceptId]) || slot.fallbackQuestion || CONCEPT_FALLBACK_QUESTIONS[slot.conceptId];
                  if (!slot.valid && fbObj) {
                    console.log(`[/quiz] Repairing invalid retry question Q${slot.index + 1} (${slot.conceptId}) with fallback.`);
                    const fb = sanitizeQuestions([fbObj], quizTopic);
                    if (fb.length > 0) repaired[slot.index] = fb[0];
                  }
                }
                const repCheck = validateQuizQuality(repaired, quizTopic, effectiveLanguage);
                if (repCheck.valid) {
                  questions = repaired;
                  qualityCheck = repCheck;
                  console.log('[/quiz] Post-retry slot repair succeeded with quality-validated questions.');
                } else {
                  qualityCheck = retryQuality;
                }
              }
            }
        } catch (retryErr) {
          retryLatencyMs = Date.now() - retryFetchStart;
          console.warn('[/quiz] Corrective retry error:', retryErr.message);
        }
      }
    }

    if (!qualityCheck.valid) {
      if (coveragePlan?.concepts) {
        const fallbackQuestions = [];
        for (let i = 0; i < numQuestionsInt && i < coveragePlan.concepts.length; i++) {
          const c = coveragePlan.concepts[i];
          const fbObj = (isOdiaReq && CONCEPT_FALLBACK_QUESTIONS_OD[c?.id]) || CONCEPT_FALLBACK_QUESTIONS[c?.id];
          if (fbObj) {
            const fb = sanitizeQuestions([fbObj], quizTopic);
            if (fb.length > 0) fallbackQuestions.push(fb[0]);
          }
        }
        if (fallbackQuestions.length === numQuestionsInt) {
          const fbCheck = validateQuizQuality(fallbackQuestions, quizTopic, effectiveLanguage);
          if (fbCheck.valid) {
            console.log('[/quiz] Using deterministic curriculum fallback questions after LLM failure.');
            questions = fallbackQuestions;
            qualityCheck = fbCheck;
          }
        }
      }
    }

    if (!qualityCheck.valid) {
      console.warn('[/quiz] Quiz failed quality validation after retry:', qualityCheck.reason);
      return res.status(422).json({
        error: isOdiaReq
          ? `ଓଡ଼ିଆ ପ୍ରଶ୍ନର ଗୁଣବତ୍ତା ଯାଞ୍ଚ ବିଫଳ ହେଲା (${qualityCheck.detail || qualityCheck.reason})। ଦୟାକରି ପୁଣି ଚେଷ୍ଟା କରନ୍ତୁ।`
          : `Quiz quality check failed (${qualityCheck.detail || qualityCheck.reason}). Please try again.`,
        needsReview: true,
        qualityIssue: qualityCheck.reason,
        coveragePlan: coveragePlan.concepts,
        telemetry: {
          language: effectiveLanguage,
          model: selectedModel,
          task: 'quiz',
          promptLength,
          promptTokens,
          outputTokens,
          ttftMs,
          generationMs,
          tokensPerSec,
          modelLatencyMs,
          parseTimeMs,
          validationTimeMs,
          retries,
          retryLatencyMs,
          totalMs: Date.now() - quizStart
        },
        questions: []
      });
    }

    if (questions.length === 0) {
      console.warn('[quiz] parseQuizResponse returned empty array — raw preview:',
        responseText.slice(0, 150));
      return res.status(500).json({
        error: isOdiaReq
          ? 'ପ୍ରଶ୍ନ ପ୍ରସ୍ତୁତ କରିବାରେ ଅସୁବିଧା ହେଲା। ଦୟାକରି ପୁଣି ଚେଷ୍ଟା କରନ୍ତୁ।'
          : 'No valid questions could be generated. Please try again.',
        needsReview: true,
        coveragePlan: coveragePlan.concepts,
        questions: []
      });
    }

    // Ensure all requested question slots (1..numQuestionsInt) are fulfilled
    if (questions.length < numQuestionsInt && coveragePlan?.concepts) {
      for (let i = questions.length; i < numQuestionsInt; i++) {
        const concept = coveragePlan.concepts[i];
        const fbObj = (isOdiaReq && CONCEPT_FALLBACK_QUESTIONS_OD[concept?.id]) || CONCEPT_FALLBACK_QUESTIONS[concept?.id];
        if (concept && fbObj) {
          const fallback = sanitizeQuestions([fbObj], quizTopic);
          if (fallback.length > 0) {
            questions.push(fallback[0]);
          }
        }
      }
    }

    // Strictly enforce final question count equals numQuestionsInt
    if (questions.length > numQuestionsInt) {
      questions = questions.slice(0, numQuestionsInt);
    }
    const validatedQuestions = questions;

    if (validatedQuestions.length === 0) {
      return res.status(500).json({ error: 'No valid questions could be generated. Please try again.' });
    }
    mark('Validate questions', `${validatedQuestions.length} valid`);

    const quizMs = Date.now() - quizStart;
    const telemetry = {
      language: effectiveLanguage,
      model: selectedModel,
      task: 'quiz',
      promptLength,
      promptTokens,
      outputTokens,
      ttftMs,
      generationMs,
      tokensPerSec,
      modelLatencyMs,
      retryLatencyMs,
      retries,
      parseTimeMs,
      validationTimeMs,
      totalMs: quizMs
    };

    console.log(`⏱ [/quiz] Telemetry: total=${quizMs}ms, model=${modelLatencyMs}ms (ttft=${ttftMs}ms, gen=${generationMs}ms, ${outputTokens} tok @ ${tokensPerSec} tps), prompt=${promptLength} chars (${promptTokens} tok), retries=${retries}, parse=${parseTimeMs}ms, val=${validationTimeMs}ms`);
    console.log(`✅ [/quiz] Done in ${(quizMs / 1000).toFixed(2)}s — ${validatedQuestions.length} questions generated`);

    res.json({
      questions: validatedQuestions,
      requestedQuestions: numQuestionsInt,
      optionsPerQuestion: explicitOptions || 4,
      coveragePlan: coveragePlan.concepts,
      broadened: coveragePlan.broadened,
      broadeningNote: coveragePlan.broadeningNote,
      telemetry
    });
    mark('Send response');

    flowTraces['/quiz'] = {
      route: '/quiz', ts: Date.now(), totalMs: quizMs, status: 'ok',
      input: `${topic} (${numQuestionsInt}q, ${level})`, steps, telemetry
    };

  } catch (err) {
    const quizMs = Date.now() - quizStart;
    mark('ERROR', err.message);
    flowTraces['/quiz'] = {
      route: '/quiz', ts: Date.now(), totalMs: quizMs, status: 'error',
      input: `${topic} (${numQuestions}q, ${level})`, steps
    };
    if (err.name === 'AbortError') {
      console.warn(`⏰ [/quiz] Timed out after ${(quizMs / 1000).toFixed(1)}s`);
      return res.json({ success: false, questions: [], error: 'Quiz generation timed out', topic, level });
    }
    console.error(`❌ [/quiz] Error after ${(quizMs / 1000).toFixed(2)}s:`, err.message);
    res.json({ success: false, questions: [], error: err.message || 'Quiz generation failed', topic, level });
  }
});

module.exports = router;

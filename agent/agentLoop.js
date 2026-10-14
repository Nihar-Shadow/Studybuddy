const { toolDefinitions, toolImplementations, setActiveLanguage } = require('./tools');
const { getProgressSummary } = require('./progressStore');
const { preWarm } = require('./smartCache');
const { reasoningWithDraft, getModelForLanguage } = require('./models');
const { getLanguageDirective, isOdia, containsOdiaScript, validateOdiaContent } = require('../lib/languagePolicy');

// The main agent loop - simplified version
// Directly executes tools based on the student message and synthesizes results
async function runAgentLoop(studentMessage, level, conversationHistory, progressSummary, language, studentId, studentName) {
  setActiveLanguage(language);
  const summary = progressSummary || getProgressSummary(studentId);

  const toolCallLog = [];
  let explanation = null;
  let conceptMap = null;
  let quiz = null;
  let nextTopic = null;

  try {
    // STEP 1: Always try to explain the topic first
    const topicMatch = studentMessage.match(/(?:explain|learn|teach|what is|tell me about)\s+(?:what is |about )?([\w\s]+)(?:\?|$)/i);
    const isQuizRequest = /quiz|test|practice|question|ପ୍ରଶ୍ନ|କ୍ୱିଜ୍/i.test(studentMessage);
    const isProgressRequest = /progress|studied|weak|strong|next|ଅଗ୍ରଗତି/i.test(studentMessage);

    let mainTopic = null;

    if (topicMatch && !isQuizRequest) {
      mainTopic = topicMatch[1].trim();
    } else if (!isQuizRequest && !isProgressRequest) {
      mainTopic = extractCleanTopic(studentMessage);
    }

    if (mainTopic) {
      // STEP 1: Run explain_topic and generate_concept_map IN PARALLEL
      console.log(`[Agent] Running explain + concept map in parallel for: ${mainTopic} [${language || 'English'}]`);
      const [expResult, mapResult] = await Promise.all([
        toolImplementations.explain_topic({
          topic: mainTopic,
          level: level,
          context: studentMessage,
          language
        }),
        toolImplementations.generate_concept_map({
          topic: mainTopic,
          level: level,
          language
        })
      ]);

      if (expResult.success) {
        explanation = expResult.explanation;
        toolCallLog.push({ tool: 'explain_topic', args: { topic: mainTopic, level }, result: expResult });
      }

      if (mapResult.success) {
        conceptMap = mapResult;
        toolCallLog.push({ tool: 'generate_concept_map', args: { topic: mainTopic, level }, result: mapResult });
      }

      // STEP 2: Generate a quiz after explanation
      if (explanation && explanation.steps && explanation.steps.length > 0) {
        console.log(`[Agent] Generating quiz for: ${mainTopic} [${language || 'English'}]`);
        const quizResult = await toolImplementations.generate_quiz({
          topic: mainTopic,
          level: level,
          numQuestions: 3,
          language
        });

        if (quizResult.success && quizResult.questions && quizResult.questions.length > 0) {
          quiz = quizResult.questions;
          toolCallLog.push({ tool: 'generate_quiz', args: { topic: mainTopic, level, numQuestions: 3 }, result: quizResult });
        }
      }

      // STEP 3: Track progress
      if (mainTopic) {
        console.log(`[Agent] Tracking progress for: ${mainTopic}`);
        const trackResult = await toolImplementations.track_progress({
          topic: mainTopic,
          level: level,
          quizScore: null,
          studentId,
          studentName
        });
        toolCallLog.push({ tool: 'track_progress', args: { topic: mainTopic, level }, result: trackResult });
      }

      // STEP 4: Suggest next topic
      if (mainTopic && toolCallLog.length >= 2) {
        console.log(`[Agent] Suggesting next topic after: ${mainTopic}`);
        const nextResult = await toolImplementations.suggest_next_topic({
          currentTopic: mainTopic,
          subject: studentMessage.split(' ')[0] || 'general',
          language
        });

        if (nextResult.success) {
          nextTopic = {
            nextTopic: nextResult.nextTopic,
            reason: nextResult.reason
          };
          toolCallLog.push({ tool: 'suggest_next_topic', args: { currentTopic: mainTopic }, result: nextResult });
        }
      }
    } else if (isQuizRequest && !topicMatch) {
      // If user asks for quiz without topic, use last studied topic
      const lastTopic = summary.recentTopics && summary.recentTopics[0];
      if (lastTopic) {
        console.log(`[Agent] Generating quiz for last topic: ${lastTopic}`);
        const quizResult = await toolImplementations.generate_quiz({
          topic: lastTopic,
          level: level,
          numQuestions: 4,
          language
        });

        if (quizResult.success && quizResult.questions) {
          quiz = quizResult.questions;
          toolCallLog.push({ tool: 'generate_quiz', args: { topic: lastTopic, level, numQuestions: 4 }, result: quizResult });
        }
      }
    }

    const isOdia = language && (language.toLowerCase() === 'odia' || language.toLowerCase() === 'oriya');
    // Build final synthesized response
    const structured = {
      agentSummary: toolCallLog.length > 0 
        ? (isOdia
            ? `ମୁଁ ${toolCallLog.length} ଟି କାର୍ଯ୍ୟ ସମ୍ପୂର୍ଣ୍ଣ କରିଛି: ${toolCallLog.map(t => t.tool.replace(/_/g, ' ')).join(', ')}।`
            : `I've completed ${toolCallLog.length} tasks: ${toolCallLog.map(t => t.tool.replace(/_/g, ' ')).join(', ')}.`)
        : (isOdia ? 'ଆପଣଙ୍କୁ ଶିଖାଇବା ପାଇଁ ପ୍ରସ୍ତୁତ!' : 'Ready to help with your learning!'),
      toolsUsed: toolCallLog.map(t => t.tool),
      explanation: explanation || null,
      conceptMap: conceptMap || null,
      quiz: quiz || null,
      nextTopic: nextTopic || null,
      progressNote: generateProgressNote(summary, toolCallLog.length, language)
    };

    return {
      success: true,
      rawReply: JSON.stringify(structured),
      structured,
      toolCallLog,
      iterations: 1
    };

  } catch (err) {
    console.error('[Agent] Error:', err.message);
    return {
      success: false,
      rawReply: 'Agent encountered an error: ' + err.message,
      structured: null,
      toolCallLog,
      iterations: 1
    };
  }
}

// Generate encouraging progress note
function generateProgressNote(summary, toolsUsed, language = 'English') {
  const isOdia = language && (language.toLowerCase() === 'odia' || language.toLowerCase() === 'oriya');
  if (isOdia) {
    if (toolsUsed === 0) return 'ଆପଣ ବହୁତ ଭଲ କରୁଛନ୍ତି! ନୂଆ ବିଷୟଗୁଡ଼ିକ ଅନୁସନ୍ଧାନ ଜାରି ରଖନ୍ତୁ।';
    if (!summary || summary.totalTopicsStudied <= 1) return 'ଉତ୍ତମ ଆରମ୍ଭ! ଆପଣଙ୍କର ଶିକ୍ଷଣ ଯାତ୍ରା ଆରମ୍ଭ ହୋଇଛି।';
    if (summary.totalTopicsStudied < 5) return 'ଉତ୍ତମ ଅଗ୍ରଗତି! ଆପଣ ଏକ ଦୃଢ଼ ମୂଳଦୁଆ ଗଠନ କରୁଛନ୍ତି।';
    if (summary.weakAreas && summary.weakAreas.length === 0) return 'ଚମତ୍କାର! ଆପଣ ବିଷୟଗୁଡ଼ିକ ଶୀଘ୍ର ଆୟତ୍ତ କରୁଛନ୍ତି।';
    return 'ଆପଣ ନିରନ୍ତର ଶିଖୁଛନ୍ତି। ଧ୍ୟାନ ଦେଇ ପାଠ ପଢ଼ନ୍ତୁ!';
  }
  if (toolsUsed === 0) {
    return `You're doing great! Keep exploring new topics.`;
  }
  if (!summary || summary.totalTopicsStudied <= 1) {
    return `Great start! You've begun your learning journey.`;
  }
  if (summary.totalTopicsStudied < 5) {
    return `Nice progress! You're building solid foundations.`;
  }
  if (summary.weakAreas && summary.weakAreas.length === 0) {
    return `Impressive! You're mastering topics quickly.`;
  }
  return `You're learning steadily. Keep focused on weak areas!`;
}

// Execute a single tool call
async function executeTool(toolName, toolArgs) {
  const impl = toolImplementations[toolName];
  if (!impl) {
    return { error: `Tool "${toolName}" not found` };
  }
  try {
    const result = await impl(toolArgs);
    return result;
  } catch (err) {
    return { error: err.message };
  }
}

// Robust topic extractor supporting Odia and English
function extractCleanTopic(message) {
  if (!message) return 'science';
  const cleaned = message
    .replace(/(?:ସହଜ ଭାଷାରେ |ସରଳ ଭାଷାରେ |ସହଜରେ )?ବୁଝାଅ/gi, '')
    .replace(/(?:କ’ଣ|କଣ|କିପରି କାମ କରେ|କିପରି|କେମିତି|କହିପାରିବ କି|ବିଷୟରେ କୁହ|ବିଷୟରେ)/gi, '')
    .replace(/(?:explain|describe|what is|how does|teach me about|tell me about|work|in odia)/gi, '')
    .replace(/[?।!.,'"`]/g, '')
    .trim();
  return cleaned || message.replace(/[?।!.,]/g, '').trim() || 'science';
}

function extractTopic(message) {
  return extractCleanTopic(message);
}

// Fast parallel agent — runs independent tools concurrently
async function runParallelAgent(studentMessage, level, conversationHistory, language, studentId, studentName) {
  const isOdiaReq = isOdia(language) || containsOdiaScript(studentMessage);
  const effectiveLang = isOdiaReq ? 'Odia' : (language || 'English');
  setActiveLanguage(effectiveLang);
  console.log(`[Diagnostic: Request] Agent mode received request with language: "${effectiveLang}"`);

  const summary = getProgressSummary(studentId);
  const toolCallLog = [];

  try {
    // Step 1 — Ask Gemma to decide which tools to call (planning phase)
    console.log(`[Diagnostic: Prompt Construction] Agent planning phase prompt with language: "${effectiveLang}"`);
    const planningPrompt = `
You are a study planning agent. Given a student message, decide which tools to call.

Student message: "${studentMessage}"
Language requested: ${effectiveLang}
Student level: ${level}
Student's weak areas: ${summary.weakAreas.join(', ') || 'none yet'}
Recently studied: ${summary.recentTopics.join(', ') || 'nothing yet'}

Available tools:
- explain_topic(topic, level, context)  — use when student wants to learn something
- generate_quiz(topic, level, numQuestions) — use to test understanding after explaining
- track_progress(topic, level, quizScore) — ALWAYS include to save study activity
- suggest_next_topic(currentTopic, subject) — use to recommend what to study next

Respond ONLY with a valid JSON array of tool calls to make. No markdown. No explanation.
Example:
[
  { "name": "explain_topic",      "args": { "topic": "photosynthesis", "level": "beginner", "context": "" } },
  { "name": "generate_quiz",      "args": { "topic": "photosynthesis", "level": "beginner", "numQuestions": 3 } },
  { "name": "track_progress",     "args": { "topic": "photosynthesis", "level": "beginner" } },
  { "name": "suggest_next_topic", "args": { "currentTopic": "photosynthesis", "subject": "biology" } }
]
  `.trim();

    let planRes;
    const planModel = getModelForLanguage(effectiveLang);
    console.log(`[LLM]\nlanguage=${effectiveLang}\nmodel=${planModel}\ntask=agent-plan`);
    try {
      planRes = await fetch('http://localhost:11434/api/chat', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...reasoningWithDraft(planModel),
          model: planModel,
          messages: [
            { role: 'system', content: 'You are a tool planning agent. Respond only with a JSON array.' },
            { role: 'user',   content: planningPrompt }
          ],
          stream:   false,
          options:  { num_predict: 300, num_ctx: 4096, temperature: 0.2 }
        })
      });
    } catch (err) {
      console.error('[Agent] Planning fetch failed:', err.message);
      throw err;
    }

    if (!planRes.ok) {
      console.error('[Agent] Planning API returned status:', planRes.status);
      throw new Error(`Planning API error: ${planRes.status}`);
    }

    const planData = await planRes.json();
    let toolCalls  = [];

  try {
    const cleaned = planData.message.content
      .replace(/^```json\s*/i, '')
      .replace(/^```\s*/i, '')
      .replace(/```\s*$/i, '')
      .trim();
    toolCalls = JSON.parse(cleaned);
    if (!Array.isArray(toolCalls)) toolCalls = [];
    console.log('[Agent] Planning phase completed, tools to call:', toolCalls.map(t => t.name));
  } catch (err) {
    console.log('[Agent] Planning parse failed:', err.message);
    console.log('[Agent] Planning response was:', planData.message?.content?.substring(0, 200));
    // Planning failed — fall back to default tool set
    const topic = extractCleanTopic(studentMessage);
    toolCalls = [
      { name: 'explain_topic',      args: { topic, level, context: studentMessage, language } },
      { name: 'generate_quiz',      args: { topic, level, numQuestions: 2, language } },
      { name: 'track_progress',     args: { topic, level } },
      { name: 'suggest_next_topic', args: { currentTopic: topic, subject: '', language } }
    ];
    console.log('[Agent] Using fallback tools for topic:', topic);
  }

  // Step 2 — Separate track_progress (sync, file I/O only) from Ollama tools
  const syncTools  = toolCalls.filter(t => t.name === 'track_progress');
  const asyncTools = toolCalls.filter(t => t.name !== 'track_progress');

  // Step 3 — Run all Ollama tools IN PARALLEL
  const parallelResults = await Promise.all(
    asyncTools.map(async (call) => {
      const argsWithLang = { ...(call.args || {}), language: effectiveLang };
      console.log(`[Diagnostic: Tool Call] Agent executing tool "${call.name}" with language: "${effectiveLang}"`);
      const result = await executeTool(call.name, argsWithLang);
      toolCallLog.push({ tool: call.name, args: call.args, result });
      return { name: call.name, result };
    })
  );

  // Step 4 — Run sync tools sequentially (they are instant — file I/O only)
  for (const call of syncTools) {
    // Inject student identity so progress is saved under the correct student
    const args = { ...(call.args || {}), studentId, studentName };
    console.log(`[Diagnostic: Tool Call] Agent executing sync tool "${call.name}"`);
    const result = await executeTool(call.name, args);
    toolCallLog.push({ tool: call.name, args: call.args, result });
    parallelResults.push({ name: call.name, result });
  }

  // Step 5 — Ask Gemma to synthesise all results into a final response
  const toolResultsSummary = parallelResults
    .map(r => `Tool: ${r.name}\nResult: ${JSON.stringify(r.result, null, 2)}`)
    .join('\n\n---\n\n');

  const synthLangDirective = getLanguageDirective(effectiveLang, 'agent_synthesis');
  console.log(`[Diagnostic: Synthesis] Agent synthesis prompt constructed with language: "${effectiveLang}"`);

  const synthesisPrompt = `
${synthLangDirective}
You are StudyBuddy. A student at ${level} level asked: "${studentMessage}"

Tool execution summary:
${toolResultsSummary}

Now synthesise the session into an encouraging closing note and summary in ${effectiveLang}.
Respond ONLY with valid JSON — no markdown, no preamble:
{
  "agentSummary":  "${isOdiaReq ? 'ସତେଜ ସାରାଂଶ (Odia summary of what was covered)' : '1-2 sentence summary of what was covered in this session'}",
  "progressNote":  "${isOdiaReq ? 'ଉତ୍ସାହଜନକ ବାକ୍ୟ (one short encouraging sentence in Odia)' : 'one short encouraging sentence'}"
}
  `.trim();

  const synthModel = getModelForLanguage(effectiveLang);
  console.log(`[LLM]\nlanguage=${effectiveLang}\nmodel=${synthModel}\ntask=agent-synthesis`);
  const synthRes = await fetch('http://localhost:11434/api/chat', {
    method:  'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      ...reasoningWithDraft(synthModel),
      model: synthModel,
      messages: [
        { role: 'system', content: `You are a synthesis agent. ${synthLangDirective} Respond only with JSON.` },
        { role: 'user',   content: synthesisPrompt }
      ],
      stream:   false,
      format:   'json',
      options:  { num_predict: 400, num_ctx: 4096, temperature: 0.3, repeat_penalty: 1.15 }
    })
  });

  const synthData = await synthRes.json();
  let structured  = null;

  try {
    const rawContent = synthData.message?.content || '';
    const cleaned = rawContent
      .replace(/<think>[\s\S]*?<\/think>/gi, '')
      .replace(/^```json\s*/i, '')
      .replace(/^```\s*/i, '')
      .replace(/```\s*$/i, '')
      .trim();
    const parsed = JSON.parse(cleaned);
    structured = {
      agentSummary: parsed.agentSummary || 'Session completed.',
      toolsUsed:    parallelResults.map(r => r.name),
      explanation:  parallelResults.find(r => r.name === 'explain_topic')?.result?.explanation || null,
      quiz:         parallelResults.find(r => r.name === 'generate_quiz')?.result?.questions || null,
      nextTopic:    parallelResults.find(r => r.name === 'suggest_next_topic')?.result || null,
      progressNote: parsed.progressNote || 'Keep up the good work!'
    };
    console.log('[Agent] Synthesis phase completed successfully');
  } catch (err) {
    console.log('[Agent] Synthesis parse failed:', err.message);
    structured = {
      agentSummary: isOdiaReq ? 'ଆପଣଙ୍କ ପ୍ରଶ୍ନର ଅଧ୍ୟୟନ ସମ୍ପୂର୍ଣ୍ଣ ହୋଇଛି।' : 'Your question has been processed.',
      toolsUsed:    parallelResults.map(r => r.name),
      explanation:  parallelResults.find(r => r.name === 'explain_topic')?.result?.explanation || null,
      quiz:         parallelResults.find(r => r.name === 'generate_quiz')?.result?.questions || null,
      nextTopic:    parallelResults.find(r => r.name === 'suggest_next_topic')?.result || null,
      progressNote: isOdiaReq ? 'ଅଧ୍ୟୟନରେ ଉତ୍ତମ ପ୍ରଗତି ଜାରି ରଖନ୍ତୁ!' : 'Great work studying!'
    };
    console.log('[Agent] Using fallback synthesis');
  }

  // Validate Odia synthesis and attempt bounded corrective retry if model reverted to English
  if (isOdiaReq) {
    const sumVal  = validateOdiaContent(structured.agentSummary);
    const noteVal = validateOdiaContent(structured.progressNote);
    if (!sumVal.valid || !noteVal.valid) {
      console.warn(`[Agent] Odia synthesis validation failed (summary: ${sumVal.reason}, note: ${noteVal.reason}) — attempting 1 corrective retry...`);
      toolCallLog.push({ tool: 'synthesis_retry', status: 'attempted' });
      try {
        const retryRes = await fetch('http://localhost:11434/api/chat', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            ...reasoningWithDraft(synthModel),
            model: synthModel,
            messages: [
              { role: 'system', content: 'You are a synthesis agent. Respond only with JSON.' },
              { role: 'user',   content: synthesisPrompt },
              { role: 'assistant', content: synthData.message?.content || '' },
              { role: 'user',   content: 'CORRECTION: The student selected Odia. Your agentSummary and progressNote were in English. Rewrite agentSummary and progressNote in clear Odia (ଓଡ଼ିଆ) using the Odia script. Respond ONLY with raw JSON: {"agentSummary": "...", "progressNote": "..."}' }
            ],
            stream: false,
            options: { num_predict: 400, num_ctx: 4096, temperature: 0.3, repeat_penalty: 1.15 }
          })
        });
        if (retryRes.ok) {
          const retryData = await retryRes.json();
          const retryClean = (retryData.message?.content || '')
            .replace(/<think>[\s\S]*?<\/think>/gi, '')
            .replace(/^```json\s*/i, '').replace(/^```\s*/i, '').replace(/```\s*$/i, '').trim();
          const retryParsed = JSON.parse(retryClean);
          if (validateOdiaContent(retryParsed.agentSummary).valid) {
            structured.agentSummary = retryParsed.agentSummary;
            console.log('[Agent] Corrective retry produced valid Odia agentSummary');
          }
          if (validateOdiaContent(retryParsed.progressNote).valid) {
            structured.progressNote = retryParsed.progressNote;
            console.log('[Agent] Corrective retry produced valid Odia progressNote');
          }
        }
      } catch (retryErr) {
        console.warn('[Agent] Synthesis corrective retry failed:', retryErr.message);
      }
    }

    // Safe localized recovery if model still returned English after retry
    if (!validateOdiaContent(structured.agentSummary).valid) {
      structured.agentSummary = 'ଆପଣଙ୍କ ପ୍ରଶ୍ନର ଅଧ୍ୟୟନ ଏବଂ ଉତ୍ତର ସମ୍ପୂର୍ଣ୍ଣ ହୋଇଛି।';
    }
    if (!validateOdiaContent(structured.progressNote).valid) {
      structured.progressNote = 'ଅଧ୍ୟୟନରେ ଉତ୍ତମ ପ୍ରଗତି ଜାରି ରଖନ୍ତୁ!';
    }
  }

  // Predictive pre-warming — fire and forget
  if (structured?.nextTopic?.nextTopic) {
    const { explain_topic } = require('./tools').toolImplementations;
    preWarm(structured.nextTopic.nextTopic, level, explain_topic);
  }

  return {
    success:     true,
    rawReply:    synthData.message?.content || 'Your question has been processed.',
    structured,
    toolCallLog,
    iterations:  2   // planning + synthesis = 2 Gemma calls instead of 5+
  };
  } catch (err) {
    console.error('[Agent] Parallel agent error:', err.message);
    return {
      success: false,
      rawReply: 'Agent error: ' + err.message,
      structured: null,
      toolCallLog: []
    };
  }
}

// ─────────────────────────────────────────────────────────────
// SOCRATIC AGENT
// Drives a guided-discovery conversation instead of explaining.
// Each turn asks a question rather than giving the answer.
// ─────────────────────────────────────────────────────────────
async function runSocraticAgent(studentMessage, level, conversationHistory, explicitTurn, language, studentId, studentName) {
  setActiveLanguage(language);
  const toolCallLog = [];

  try {
    // Use the explicit turn from the frontend (accurate), fall back to history-based count
    const turnNumber = explicitTurn
      || Math.floor(conversationHistory.filter(m => m.role === 'user').length) + 1;

    // Extract topic from student message or last user message
    const topic = extractTopic(studentMessage);

    // Previous student response for context (empty on turn 1)
    const studentResponse = turnNumber > 1 ? studentMessage : '';

    const socrResult = await toolImplementations.ask_socratic_question({
      topic,
      level,
      studentResponse,
      turnNumber,
      language
    });

    toolCallLog.push({ tool: 'ask_socratic_question', args: { topic, level, turnNumber, language }, result: socrResult });

    // Track that the student is engaging with this topic
    const trackResult = toolImplementations.track_progress({ topic, level, quizScore: null, studentId, studentName });
    toolCallLog.push({ tool: 'track_progress', args: { topic, level }, result: trackResult });

    const structured = {
      mode:            'socratic',
      agentSummary:    `Socratic turn ${turnNumber} on "${topic}"`,
      toolsUsed:       toolCallLog.map(t => t.tool),
      acknowledgement: socrResult.acknowledgement || '',
      question:        socrResult.question || 'What do you already know about this topic?',
      hint:            socrResult.hint || '',
      isNearAnswer:    socrResult.isNearAnswer || false,
      isFinalTurn:     socrResult.isFinalTurn || false,
      summary:         socrResult.summary || '',
      topic,
      turn:            turnNumber,
      provider:        socrResult.provider || 'ollama',
      fallback:        socrResult.fallback || false,
      progressNote:    generateProgressNote(getProgressSummary(), toolCallLog.length)
    };

    return {
      success:    true,
      rawReply:   socrResult.question,
      structured,
      toolCallLog,
      iterations: 1
    };

  } catch (err) {
    console.error('[SocraticAgent] Error:', err.message);
    return {
      success:    false,
      rawReply:   'Socratic agent error: ' + err.message,
      structured: null,
      toolCallLog
    };
  }
}

module.exports = { runAgentLoop, runParallelAgent, runSocraticAgent };

const { toolDefinitions, toolImplementations, setActiveLanguage } = require('./tools');
const { getProgressSummary } = require('./progressStore');
const { preWarm } = require('./smartCache');
const { reasoningWithDraft } = require('./models');

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
    const isQuizRequest = /quiz|test|practice|question/.test(studentMessage.toLowerCase());
    const isProgressRequest = /progress|studied|weak|strong|next/.test(studentMessage.toLowerCase());

    let mainTopic = null;

    if (topicMatch && !isQuizRequest) {
      // Extract topic from the message
      mainTopic = topicMatch[1].trim();
      
      // STEP 1: Run explain_topic and generate_concept_map IN PARALLEL
      console.log(`[Agent] Running explain + concept map in parallel for: ${mainTopic}`);
      const [expResult, mapResult] = await Promise.all([
        toolImplementations.explain_topic({
          topic: mainTopic,
          level: level,
          context: studentMessage
        }),
        toolImplementations.generate_concept_map({
          topic: mainTopic,
          level: level
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
        console.log(`[Agent] Generating quiz for: ${mainTopic}`);
        const quizResult = await toolImplementations.generate_quiz({
          topic: mainTopic,
          level: level,
          numQuestions: 3
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
          subject: studentMessage.split(' ')[0] || 'general'
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
          numQuestions: 4
        });

        if (quizResult.success && quizResult.questions) {
          quiz = quizResult.questions;
          toolCallLog.push({ tool: 'generate_quiz', args: { topic: lastTopic, level, numQuestions: 4 }, result: quizResult });
        }
      }
    }

    // Build final synthesized response
    const structured = {
      agentSummary: toolCallLog.length > 0 
        ? `I've completed ${toolCallLog.length} tasks: ${toolCallLog.map(t => t.tool.replace(/_/g, ' ')).join(', ')}.`
        : 'Ready to help with your learning!',
      toolsUsed: toolCallLog.map(t => t.tool),
      explanation: explanation || null,
      conceptMap: conceptMap || null,
      quiz: quiz || null,
      nextTopic: nextTopic || null,
      progressNote: generateProgressNote(summary, toolCallLog.length)
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
function generateProgressNote(summary, toolsUsed) {
  if (toolsUsed === 0) {
    return `You're doing great! Keep exploring new topics.`;
  }
  if (summary.totalTopicsStudied === 1) {
    return `Great start! You've begun your learning journey.`;
  }
  if (summary.totalTopicsStudied < 5) {
    return `Nice progress! You're building solid foundations.`;
  }
  if (summary.weakAreas.length === 0) {
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

// Simple topic extractor fallback
function extractTopic(message) {
  const cleaned = message
    .toLowerCase()
    .replace(/explain|describe|what is|teach me|tell me about|i want to learn|help me with/gi, '')
    .trim();
  return cleaned.split(' ').slice(0, 3).join(' ') || 'the topic';
}

// Fast parallel agent — runs independent tools concurrently
async function runParallelAgent(studentMessage, level, conversationHistory, language, studentId, studentName) {
  setActiveLanguage(language);
  const summary = getProgressSummary(studentId);
  const toolCallLog = [];

  try {
    // Step 1 — Ask Gemma to decide which tools to call (planning phase)
    const planningPrompt = `
You are a study planning agent. Given a student message, decide which tools to call.

Student message: "${studentMessage}"
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
    try {
      planRes = await fetch('http://localhost:11434/api/chat', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...reasoningWithDraft(),
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
    const topic = extractTopic(studentMessage);
    toolCalls = [
      { name: 'explain_topic',      args: { topic, level, context: studentMessage } },
      { name: 'generate_quiz',      args: { topic, level, numQuestions: 2 } },
      { name: 'track_progress',     args: { topic, level } },
      { name: 'suggest_next_topic', args: { currentTopic: topic, subject: '' } }
    ];
    console.log('[Agent] Using fallback tools for topic:', topic);
  }

  // Step 2 — Separate track_progress (sync, file I/O only) from Ollama tools
  const syncTools  = toolCalls.filter(t => t.name === 'track_progress');
  const asyncTools = toolCalls.filter(t => t.name !== 'track_progress');

  // Step 3 — Run all Ollama tools IN PARALLEL
  const parallelResults = await Promise.all(
    asyncTools.map(async (call) => {
      const result = await executeTool(call.name, call.args || {});
      toolCallLog.push({ tool: call.name, args: call.args, result });
      return { name: call.name, result };
    })
  );

  // Step 4 — Run sync tools sequentially (they are instant — file I/O only)
  for (const call of syncTools) {
    // Inject student identity so progress is saved under the correct student
    const args = { ...(call.args || {}), studentId, studentName };
    const result = await executeTool(call.name, args);
    toolCallLog.push({ tool: call.name, args: call.args, result });
    parallelResults.push({ name: call.name, result });
  }

  // Step 5 — Ask Gemma to synthesise all results into a final response
  const toolResultsSummary = parallelResults
    .map(r => `Tool: ${r.name}\nResult: ${JSON.stringify(r.result, null, 2)}`)
    .join('\n\n---\n\n');

  const synthesisPrompt = `
You are StudyBuddy. A student at ${level} level asked: "${studentMessage}"

You ran several tools and got these results:
${toolResultsSummary}

Now synthesise everything into a single helpful response.
Respond ONLY with valid JSON — no markdown, no preamble:
{
  "agentSummary":  "1-2 sentence summary of this session",
  "toolsUsed":     ["tool1", "tool2"],
  "explanation":   { ...explanation object from explain_topic result, or null },
  "quiz":          [ ...questions array from generate_quiz result, or null ],
  "nextTopic":     { "nextTopic": "...", "reason": "..." } or null,
  "progressNote":  "one short encouraging sentence"
}
  `.trim();

  const synthRes = await fetch('http://localhost:11434/api/chat', {
    method:  'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      ...reasoningWithDraft(),
      messages: [
        { role: 'system', content: 'You are a synthesis agent. Respond only with JSON.' },
        { role: 'user',   content: synthesisPrompt }
      ],
      stream:   false,
      options:  { num_predict: 700, num_ctx: 4096, temperature: 0.6 }
    })
  });

  const synthData = await synthRes.json();
  let structured  = null;

  try {
    const cleaned = synthData.message.content
      .replace(/^```json\s*/i, '')
      .replace(/^```\s*/i, '')
      .replace(/```\s*$/i, '')
      .trim();
    structured = JSON.parse(cleaned);
    console.log('[Agent] Synthesis phase completed successfully');

    // Patch: if explanation is null but we have a direct result, inject it
    if (!structured.explanation) {
      const expResult = parallelResults.find(r => r.name === 'explain_topic');
      if (expResult?.result?.explanation) {
        structured.explanation = expResult.result.explanation;
        console.log('[Agent] Patched explanation from tool result');
      }
    }
    // Patch: if quiz is null but we have a direct result, inject it
    if (!structured.quiz) {
      const quizResult = parallelResults.find(r => r.name === 'generate_quiz');
      if (quizResult?.result?.questions?.length > 0) {
        structured.quiz = quizResult.result.questions;
        console.log('[Agent] Patched quiz from tool result');
      }
    }
    // Patch: if nextTopic is null but we have a direct result, inject it
    if (!structured.nextTopic) {
      const nextResult = parallelResults.find(r => r.name === 'suggest_next_topic');
      if (nextResult?.result?.nextTopic) {
        structured.nextTopic = nextResult.result;
        console.log('[Agent] Patched nextTopic from tool result');
      }
    }
  } catch (err) {
    console.log('[Agent] Synthesis parse failed:', err.message);
    console.log('[Agent] Synthesis response was:', synthData.message?.content?.substring(0, 200));
    // Fallback: synthesise from raw tool results
    structured = {
      agentSummary: 'Your question has been processed.',
      toolsUsed: parallelResults.map(r => r.name),
      explanation: parallelResults.find(r => r.name === 'explain_topic')?.result?.explanation || null,
      quiz: parallelResults.find(r => r.name === 'generate_quiz')?.result?.questions || null,
      nextTopic: parallelResults.find(r => r.name === 'suggest_next_topic')?.result || null,
      progressNote: 'Great work studying!'
    };
    console.log('[Agent] Using fallback synthesis');
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
      turnNumber
    });

    toolCallLog.push({ tool: 'ask_socratic_question', args: { topic, level, turnNumber }, result: socrResult });

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

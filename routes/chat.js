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
const { REASONING, reasoningWithDraft } = require('../agent/models');
const { requireAuth }  = require('./auth');

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
  // history may arrive as a JSON string (multipart) or a parsed array (JSON body)
  let history = [];
  try {
    const raw = req.body.history;
    history = typeof raw === 'string' ? JSON.parse(raw || '[]') : (raw || []);
    if (!Array.isArray(history)) history = [];
  } catch {
    history = [];
  }
  console.log(`\n⏱  [/chat] Started — level: ${level || 'beginner'}, lang: ${language || 'English'}, prompt: "${(message || '').slice(0, 60)}…"`);

  // SSE headers — keep connection open for streaming
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.setHeader('X-Accel-Buffering', 'no'); // Disable Nginx buffering if present
  res.flushHeaders();

  // Build the messages array for Gemma
  const messages = [
    { role: 'system', content: buildSystemPrompt(level || 'beginner', language) },
    ...history,                          // past conversation
    { role: 'user', content: message }  // new question
  ];
  mark('Build prompt', `${messages.length} messages, level=${level || 'beginner'}`);

  // Abort upstream Ollama generation if the client disconnects mid-stream.
  // Without this, Ollama keeps generating tokens nobody reads, holding the
  // GPU until natural stop — back-to-back demo retakes stall as a result.
  const upstreamAbort = new AbortController();

  try {
    // Call Ollama with streaming enabled
    const ollamaRes = await fetch('http://localhost:11434/api/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      signal: upstreamAbort.signal,
      body: JSON.stringify({
        ...reasoningWithDraft(),
        messages: messages,
        stream: true,
        options: { ...ollamaOptions('json'), num_ctx: 4096 }
      })
    });
    mark('Ollama API call', `model=${REASONING}, status=${ollamaRes.status}`);

    if (!ollamaRes.ok) {
      throw new Error(`Ollama API error: ${ollamaRes.status} ${ollamaRes.statusText}`);
    }

    // Read Ollama's NDJSON stream and relay each token as SSE
    let fullReply = '';
    let insideThink = false;   // Track <think> block state for live stripping

    const reader = ollamaRes.body.getReader();
    const decoder = new TextDecoder();
    let buffer = '';

    // Clean up reader + buffer + upstream fetch if the client disconnects early
    req.on('close', () => {
      try { reader.cancel(); } catch {}
      try { upstreamAbort.abort(); } catch {}
      buffer = '';
    });

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      // Ollama sends one JSON object per line (NDJSON)
      const lines = buffer.split('\n');
      buffer = lines.pop(); // Keep incomplete line in buffer

      for (const line of lines) {
        if (!line.trim()) continue;
        try {
          const chunk = JSON.parse(line);
          if (chunk.message && chunk.message.content) {
            let token = chunk.message.content;
            fullReply += token;

            // Live-strip <think>…</think> blocks so they never reach the client
            // Handle partial tags across chunk boundaries
            if (insideThink) {
              const endIdx = token.indexOf('</think>');
              if (endIdx !== -1) {
                insideThink = false;
                token = token.slice(endIdx + '</think>'.length);
              } else {
                token = ''; // Still inside think block, suppress
              }
            }
            // Check for opening <think> in remaining token
            if (!insideThink) {
              const startIdx = token.indexOf('<think>');
              if (startIdx !== -1) {
                const before = token.slice(0, startIdx);
                const afterStart = token.slice(startIdx + '<think>'.length);
                const endIdx = afterStart.indexOf('</think>');
                if (endIdx !== -1) {
                  // Entire think block in one token
                  token = before + afterStart.slice(endIdx + '</think>'.length);
                } else {
                  insideThink = true;
                  token = before;
                }
              }
            }

            // Only send non-empty tokens after stripping
            if (token) {
              res.write(`data: ${JSON.stringify({ token })}\n\n`);
            }
          }
        } catch (_) {
          // Skip malformed lines
        }
      }
    }
    mark('Stream complete', `${fullReply.length} chars total`);

    // Strip <think> blocks from full reply for structured parse
    let rawReply = fullReply.replace(/<think>[\s\S]*?<\/think>/gi, '').trim();

    // Parse structured response using robust parser (5 repair strategies)
    const structured = parseTutorResponse(rawReply);

    if (structured._parseMethod === 'plaintext_fallback') {
      console.warn('[/chat] parseTutorResponse used plaintext fallback');
    }
    mark('Parse structured JSON', `method=${structured._parseMethod}`);

    // Send final SSE event with structured data + raw reply, then close
    res.write(`data: ${JSON.stringify({ done: true, reply: rawReply, structured })}\n\n`);
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
    // Client disconnect raised AbortError via upstreamAbort.abort() — that's
    // expected, not a server-side failure. Don't log as ERROR or 500.
    if (err.name === 'AbortError') {
      flowTraces['/chat'] = {
        route: '/chat', ts: Date.now(), totalMs: Date.now() - chatStart, status: 'aborted',
        input: (message || '').slice(0, 80), steps
      };
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
    const langNote = language && language.toLowerCase() !== 'english'
      ? `\nCRITICAL: Respond ENTIRELY in ${language}. All fields (visual_summary, extracted_data, explanations, final_solution) MUST be in ${language}.\n`
      : '';
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

    // Call Ollama with vision-capable model
    const ollamaRes = await fetch('http://localhost:11434/api/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: REASONING,
        messages: messages,
        stream: false,
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

module.exports = router;

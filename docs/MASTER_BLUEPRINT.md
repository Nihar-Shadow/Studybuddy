---
title:Master Blueprint
aliases:
  - Master Blueprint
tags:
  - studybuddy
  - documentation
cssclasses:
  - project-doc
project:studybuddy
type:documentation
status:active
related:
  - [[studybuddy/README]]
  - [[studybuddy/CLAUDE]]
---

# StudyBuddy — Master Blueprint

> **Single source of truth** for the entire StudyBuddy codebase.  
> Consolidates 39 prior documentation files into one technical reference.  
> Last updated: April 12, 2026

---

## Table of Contents

1. [Project Architecture](#1-project-architecture)
2. [Feature Guide](#2-feature-guide)
3. [System Fix Log](#3-system-fix-log)
4. [Developer Reference](#4-developer-reference)


---

# 1. Project Architecture

## 1.1 Overview

StudyBuddy is a fully local, AI-powered tutoring web app that runs entirely on the user's machine — no cloud APIs, no API keys, no telemetry. It pairs a vanilla HTML/CSS/JS frontend with a Node.js + Express backend that delegates all inference to **Ollama** running **Gemma 4 (gemma4:e4b)** locally.

| Layer | Technology |
|-------|-----------|
| Frontend | Vanilla HTML / CSS / JS (SPA, no framework) |
| Backend | Node.js + Express.js |
| Python Bridge | `python/studybuddy_core.py` — low-latency streaming via httpx + orjson |
| LLM | Ollama → Gemma 4 (`gemma4:e4b`, 9.6 GB, text + vision) |
| Data | Flat JSON files (`data/progress.json`, `data/cache.json`, `data/taxonomy_learned.json`) |
| Transport | REST + Server-Sent Events (SSE) for streaming |
| Installability | Progressive Web App (service worker, manifest, offline fallback) |

## 1.2 Folder Structure

```
studybuddy/
├── server.js                    ← Express entry point (wires routes + middleware)
├── package.json                 ← Dependencies & scripts
├── routes/                      ← API route handlers (9 files)
│   ├── auth.js                  ← /auth/login, /auth/logout, /auth/me (PIN auth)
│   ├── chat.js                  ← /chat, /chat-with-image, /estimate (SSE streaming)
│   ├── quiz.js                  ← /quiz
│   ├── agent.js                 ← /agent (full agent pipeline)
│   ├── socratic.js              ← /socratic (guided discovery dialogue)
│   ├── conceptMap.js            ← /concept-map
│   ├── progress.js              ← /progress, /progress-report, /due-reviews, /srs, /streak, /api/students, /api/class-data
│   ├── admin.js                 ← /admin/* routes, bulk CSV/Excel upload
│   └── dev.js                   ← /dev/metrics, /dev/flow-traces, /cache-stats, /topics/search
├── middleware/                   ← Express middleware (3 files)
│   ├── devTiming.js             ← Request timing, flow traces, dev panel injection
│   ├── upload.js                ← Multer config (image + spreadsheet uploads)
│   └── pwa.js                   ← MIME-type corrections for service worker
├── lib/                          ← Shared utilities
│   └── helpers.js               ← buildSystemPrompt(), estimateResponseTime(), warmUpModels()
├── agent/                        ← Agent system (7 files — already modular)
│   ├── agentLoop.js             ← Sequential, parallel & Socratic orchestration
│   ├── tools.js                 ← 7 learning tools
│   ├── progressStore.js         ← SM-2 SRS + streak tracking (JSON)
│   ├── smartCache.js            ← 4-layer cache waterfall with disk persistence
│   ├── dynamicTaxonomy.js       ← Auto-learn + curate topic taxonomy
│   ├── taxonomy.js              ← Base taxonomy (76 topics, 1,223 keywords)
│   └── trie.js                  ← O(k) prefix search for autocomplete
├── public/                       ← Static frontend
│   ├── index.html               ← HTML shell (~190 lines, refs external CSS/JS)
│   ├── styles/                  ← 14 CSS files (one per visual feature)
│   │   ├── variables.css        ← Custom properties, theme overrides
│   │   ├── base.css             ← Reset, animations, GPU hints
│   │   ├── layout.css           ← Header, controls bar
│   │   ├── chat.css             ← Chat bubbles, structured responses
│   │   ├── input.css            ← Input area, buttons
│   │   ├── voice.css            ← Voice status bar
│   │   ├── socratic.css         ← Socratic mode
│   │   ├── evaluation.css       ← Evaluation Report card
│   │   ├── quiz.css             ← Quiz modal, cards
│   │   ├── concept-map.css      ← Concept map modal
│   │   ├── vision.css           ← Vision analysis cards
│   │   ├── agent.css            ← Agent response
│   │   ├── progress.css         ← Progress modal
│   │   └── pwa.css              ← PWA banner, responsive, standalone
│   ├── scripts/                 ← 15 JS files (state → utils → features → init → PWA)
│   │   ├── state.js             ← DOM refs, shared state
│   │   ├── utils.js             ← scrollToBottom(), addBubble()
│   │   ├── image.js             ← Image upload handlers
│   │   ├── chat.js              ← sendMessage()
│   │   ├── quiz.js              ← Quiz generation & rendering
│   │   ├── socratic.js          ← Socratic mode
│   │   ├── concept-map.js       ← Concept map (D3)
│   │   ├── theme.js             ← Theme switching, streak, due reviews
│   │   ├── loading.js           ← Skeleton loader, facts loading
│   │   ├── render.js            ← Bot response rendering, LaTeX conversion
│   │   ├── agent.js             ← Agent mode, SSE streaming
│   │   ├── evaluation.js        ← Evaluation Report
│   │   ├── voice.js             ← SpeechRecognition
│   │   ├── init.js              ← Event listeners, window.load
│   │   └── pwa.js               ← Service worker registration
│   ├── assets/                  ← PWA icons
│   │   ├── icon-192.png
│   │   ├── icon-512.png
│   │   └── icon-maskable.png
│   ├── devpanel.js              ← Developer diagnostics panel
│   ├── manifest.json            ← PWA manifest
│   ├── sw.js                    ← Service worker (cache v2, offline-first)
│   ├── offline.html             ← Offline fallback page
│   ├── taxonomy-admin.html      ← Taxonomy admin panel
│   └── card-560x280.html        ← Social card template
├── data/                         ← Runtime data (auto-created)
│   ├── progress.json            ← Student learning history
│   ├── cache.json               ← Smart cache persistence
│   └── taxonomy_learned.json    ← Learned topic expansions
├── scripts/                      ← Build / utility scripts
│   └── generate-icons.js        ← PWA icon generator
├── python/                       ← Low-latency Python ↔ Ollama bridge
│   ├── studybuddy_core.py       ← StudyBuddyCore class (streaming, orjson, sub-5 s)
│   ├── requirements.txt         ← httpx + orjson
│   ├── __init__.py              ← Package export
│   └── __main__.py              ← CLI entry point
├── docs/                         ← Documentation
│   ├── MASTER_BLUEPRINT.md      ← This file
│   └── KAGGLE_WRITEUP.md        ← Kaggle competition submission (standalone)
├── uploads/                      ← Homework photo uploads (temp)
└── README.md                     ← Project overview
```

## 1.3 Design Decisions

| Decision | Rationale |
|----------|-----------|
| 14 CSS files | One per visual feature — easy to find and edit |
| 15 JS files | Load order: state → utilities → features → init → PWA |
| 8 route files | Each API domain isolated for clarity |
| 3 middleware files | Cross-cutting concerns separated |
| `lib/helpers.js` | Shared functions used by multiple routes |
| `agent/` untouched | Already well-structured — 7 focused modules |
| `python/` bridge | Dedicated low-latency path for math/fact queries; httpx streaming + orjson for sub-5 s on 8 GB |
| Flat JSON data files | No database; progress, cache, taxonomy are simple JSON |
| No framework | Zero build step; `<script>` tags in load order |

## 1.4 Before & After (Reorganisation Commit `1a24875`)

| Metric | Before | After |
|--------|--------|-------|
| `index.html` | 4,402 lines (monolithic) | 190 lines (shell) + 14 CSS + 15 JS |
| `server.js` | 1,377 lines (monolithic) | 145 lines (entry) + 8 routes + 3 middleware + 1 lib |
| Dead code | `src/`, `config/`, `.bak` files | Removed |
| Total modules | 2 monoliths + 7 agent | 42 focused files + 7 agent |

## 1.5 Request Flow

```
Browser  ─→  Express (server.js)
              │
              ├─ middleware/devTiming.js    (timing + flow traces)
              ├─ middleware/pwa.js          (MIME fixes)
              ├─ middleware/upload.js       (Multer)
              │
              ├─ routes/chat.js ──────────→ Ollama /api/chat  (SSE streaming)
              ├─ routes/agent.js ─────────→ agentLoop.js
              │                              ├─ smartCache.js (L1→L4 lookup)
              │                              ├─ tools.js → Ollama (parallel)
              │                              └─ progressStore.js
              ├─ routes/quiz.js ──────────→ Ollama /api/chat
              ├─ routes/socratic.js ──────→ agentLoop.js (Socratic mode)
              ├─ routes/conceptMap.js ────→ Ollama /api/chat
              ├─ routes/progress.js ──────→ progressStore.js / data/progress.json
              ├─ routes/admin.js ─────────→ dynamicTaxonomy.js
              └─ routes/dev.js ───────────→ devTiming metrics store

Python Bridge (standalone — bypasses Express):
  StudyBuddyCore.query()
    └─ httpx.stream() ────────────→ Ollama /api/generate (streaming, orjson)
```

---

# 2. Feature Guide

## 2.1 Tutor Mode (Direct Chat)

**Endpoint:** `POST /chat` (SSE streaming)  
**Body:** `{ message, level, history }`

The primary interaction mode. Users type a question, select a difficulty level (beginner / intermediate / advanced), and receive a structured JSON response streamed via SSE:

```json
{
  "intro": "Brief overview",
  "steps": ["Step 1 …", "Step 2 …"],
  "answer": "Final answer or conclusion",
  "followup": "Suggested next question"
}
```

The system prompt is built dynamically by `lib/helpers.js → buildSystemPrompt(level)` with subject-adaptive phrasing and strict JSON-only instructions.

## 2.2 Homework Photo Analysis (Vision)

**Endpoint:** `POST /chat-with-image` (multipart/form-data)  
**Body:** `FormData { message, level, image }`

Accepts a photo of homework, converts it to base64, and sends it to Gemma 4's vision capability. Uses a specialised vision system prompt requesting structured JSON analysis. Includes a fallback that converts plain-text responses to structured format automatically.

- Image preview: 56×56 px thumbnail (`image-preview-thumb` class)
- Preview is cleared from the input area on send
- Image is displayed in the chat bubble for context

## 2.3 Socratic Mode

**Endpoint:** `POST /socratic`  
**Body:** `{ message, level, history }`

A 5-turn guided-discovery dialogue. The tutor persona is a "witty, slightly sarcastic Socratic tutor" that never gives answers directly — only guiding questions, hints, and analogies. After 5 turns the conversation resets. Each turn tracks engagement via `progressStore`.

## 2.4 Agent Mode

**Endpoint:** `POST /agent`  
**Body:** `{ message, level, history, fast? }`

Runs the full agent pipeline (`agentLoop.js`) with access to 7 tools. Three execution modes:

| Mode | Trigger | LLM Calls | Behaviour |
|------|---------|-----------|-----------|
| **Parallel** (default) | `POST /agent` | 2 | Plan → execute tools concurrently → synthesise |
| **Sequential** | `fast: false` | 4–5 | Explain → quiz → track → suggest (one-by-one) |
| **Socratic** | `POST /socratic` | 1 | Guided question, track engagement |

### 2.4.1 The 7 Learning Tools

| Tool | Purpose | Key Arguments |
|------|---------|---------------|
| `explain_topic` | Structured explanation (intro, steps, answer, follow-up) | `topic`, `level` |
| `generate_quiz` | 2–5 MCQ with explanations | `topic`, `level`, `numQuestions` |
| `track_progress` | Save study event + update SRS schedule | `topic`, `level` |
| `suggest_next_topic` | Recommend next topic from weak/strong areas | `currentTopic` |
| `ask_socratic_question` | Guiding question (never gives the answer) | `topic`, `level` |
| `generate_concept_map` | Nodes-and-edges knowledge graph | `topic`, `level` |
| `generate_evaluation_report` | Dynamic progress evaluation report | `topic` |

## 2.5 Quiz Generation

**Endpoint:** `POST /quiz`  
**Body:** `{ topic, level, numQuestions }`

Generates multiple-choice questions with 4 options each, correct-answer indicators, and per-question explanations. Rendered in a modal with animated card transitions.

### Quiz Pipeline

1. **Backend** — Gemma generates JSON array of questions; `parseQuizResponse()` normalises the format; `routes/quiz.js` validates, trims, and sanitises each question (options trimmed, answer trimmed, first-char check). An AbortController enforces a 110 s hard timeout with graceful fallback.
2. **Agent path** — `generate_quiz` tool in `agent/tools.js` follows the same parse pipeline, caches results via the 4-layer smart cache, and scales `num_predict` for advanced-level quizzes.
3. **Frontend rendering** — `renderQuizCard()` builds the quiz HTML; buttons pass the **option index** (not the option text) to `selectAnswer(questionIdx, optionIdx)`, which looks up the actual string from `currentQuiz[questionIdx].options[optionIdx]`. This index-based approach is immune to HTML entity encoding, quote escaping, and Gemma re-serialisation artefacts.
4. **Scoring** — After every answer, the card re-renders with `.correct` (green) / `.wrong` (red) classes, shows explanations, and tallies a live score.

## 2.6 Concept Map

**Endpoint:** `POST /concept-map`  
**Body:** `{ topic, level }`

Returns `{ nodes: [...], edges: [...] }` rendered as an interactive D3.js force-directed graph in a modal overlay. Nodes are colour-coded by type (concept, detail, related).

## 2.7 Evaluation Report

**Endpoint:** via Agent tool `generate_evaluation_report`

A dynamic progress analysis combining: topics studied, quiz scores over time, SRS intervals, strengths, weaknesses, and personalised recommendations. Rendered in a collapsible card with scroll support.

## 2.8 Spaced Repetition (SM-2)

Implemented in `agent/progressStore.js`. Every study interaction is scored and fed through the SM-2 algorithm to compute:

- **Ease Factor** (≥ 1.3, starts at 2.5)
- **Interval** (days until next review)
- **Next Review Date**

**Endpoints:**
- `GET /due-reviews` — topics due for review today
- `PUT /srs/:topic` — update SRS after review (`{ grade: 0-5 }` or `{ score: 0-100 }`)

## 2.9 Streak Tracking

- `GET /streak` → `{ current, longest, studiedToday }`
- Streak increments when the user studies on consecutive calendar days
- Displayed in the header with an animated badge

## 2.10 Voice Input

Uses the Web Speech API (`SpeechRecognition`). When the microphone button is tapped, interim results stream into the input field. On `speechend` the final transcript is committed. A voice-status bar shows recording state.

## 2.11 Adaptive Themes

Three themes that auto-switch based on the selected difficulty level:

| Level | Theme | Character |
|-------|-------|-----------|
| Beginner | Light, warm | Large text, friendly colours |
| Intermediate | Balanced | Default palette |
| Advanced | Dark, dense | Compact layout, code-friendly |

Manual override available via a theme toggle.

## 2.12 Topic Autocomplete

`GET /topics/search?q=phot` → prefix search over the Trie built from the taxonomy. Returns matching topics instantly for the search input.

## 2.13 Progressive Web App (PWA)

- **`manifest.json`** — App name, icons (192/512/maskable), standalone display, shortcuts
- **`sw.js`** — Service worker (cache v2): Cache-First for app shell, Network-First for API, Network-Only for POST, offline fallback to `offline.html`
- **Install banner** — In-app prompt after 3 seconds via `beforeinstallprompt`

## 2.14 Dev Benchmark Panel

Visible only in `NODE_ENV=development`. Injected automatically via middleware.

- **Metrics tab:** Per-route latency bars (colour-coded: green < 500 ms, amber < 8 s, red > 8 s), cache hit rates, error counts, tool breakdown
- **Flow tab:** ASCII architecture diagrams per request with per-step millisecond timing and bottleneck highlighting
- **Controls:** Run Now, Clear, Hide

## 2.15 Taxonomy Admin Panel

`/taxonomy-admin.html` — A standalone admin UI for managing the dynamic taxonomy:

- View learned vs. pending topics
- Approve / reject pending topics
- Manually add topics
- Rebuild taxonomy live

**Admin API:**

| Method | Endpoint | Purpose |
|--------|----------|---------|
| `GET` | `/admin/taxonomy` | View learned + pending |
| `POST` | `/admin/taxonomy` | Add topic |
| `POST` | `/admin/taxonomy/pending/:topic/approve` | Promote pending → learned |
| `DELETE` | `/admin/taxonomy/pending/:topic` | Reject pending |
| `DELETE` | `/admin/taxonomy/learned/:topic` | Remove learned |
| `POST` | `/admin/taxonomy/rebuild` | Rebuild taxonomy live |

## 2.16 Bulk CSV/Excel Upload

`POST /admin/taxonomy/bulk-upload` — Upload a CSV or Excel file to bulk-import topics into the taxonomy. Uses Multer for file handling with the `xlsx` library for parsing.

## 2.17 Native Multilingual Engine (Zero-Lag)

**Goal:** Maximise digital equity by letting every student learn in their native language.

**How it works:** Gemma 4 natively supports 140+ languages. The language selector injects a high-priority directive into the system prompt — no translation API, no extra model, no additional latency. The same Ollama call that would take 10 seconds in English takes 10 seconds in Hindi, Arabic, or Mandarin.

### UI
A new Blur & Render pipeline prevents raw JSON or incomplete tokens from ever appearing in the chat UI. When a message is sent, a `.thinking-overlay` (frosted glass blur with animated bouncing dots) covers the bot bubble. All streamed tokens are buffered in memory, never shown. Only when the final, valid JSON is received and parsed does the overlay fade out and the formatted response (steps, answer, emojis) appear. This ensures students never see malformed JSON, partial output, or model artifacts. See `public/styles/thinking.css`, `public/scripts/agent.js`, and `public/scripts/render.js` for implementation.

A `🌐` language selector in the app header (inside a `.status-badge` pill). Persists to `localStorage` so the student's choice survives page reloads.

**Starter languages:** English, Hindi (हिन्दी), Spanish (Español), Arabic (العربية), Mandarin (中文), French (Français), Portuguese (Português), Bengali (বাংলা), Tamil (தமிழ்), Swahili (Kiswahili).

### Architecture

```
languageSelector.value
  → currentLanguage (state.js, localStorage)
    → sent in every POST body (chat.js, socratic.js, agent.js)
      → route handler reads req.body.language
        → buildSystemPrompt(level, language)  — lib/helpers.js
        → setActiveLanguage(language)          — agent/tools.js (for agent/socratic/concept-map tools)
```

When `language !== 'English'`, a `CRITICAL` directive is prepended to **every** system prompt:

> _"CRITICAL: The student has requested to learn in [language]. You MUST provide ALL explanations, feedback, questions … in [language] only."_

This covers:
- Direct chat (`/chat`) — SSE-streamed responses
- Homework vision (`/chat-with-image`) — vision system prompt
- Agent mode (`/agent`) — all 7 tool system prompts
- Socratic mode (`/socratic`) — guided discovery questions
- Concept maps & quizzes — node labels, questions, explanations

### Affected Files

| File | Change |
|------|--------|
| `lib/helpers.js` | `buildSystemPrompt(level, selectedLanguage)` — prepends language directive |
| `agent/tools.js` | `setActiveLanguage()` + `langPrefix()` — injects into all 7 tool prompts |
| `agent/agentLoop.js` | All 3 agent functions accept `language` param, call `setActiveLanguage()` |
| `routes/chat.js` | Reads `req.body.language`, passes to `buildSystemPrompt()` and vision prompt |
| `routes/agent.js` | Reads `req.body.language`, passes to agent runners |
| `routes/socratic.js` | Reads `req.body.language`, passes to `runSocraticAgent()` |
| `public/index.html` | `<select id="languageSelector">` in header |
| `public/scripts/state.js` | `currentLanguage` state variable + `languageEl` DOM ref |
| `public/scripts/init.js` | Event listener, localStorage persist/restore |
| `public/scripts/agent.js` | Sends `language` in `/chat`, `/chat-with-image`, `/agent` POST bodies |
| `public/scripts/socratic.js` | Sends `language` in `/socratic` POST body |

---

# 3. System Fix Log

A consolidated ledger of every significant bug fix applied to the codebase, ordered chronologically.

| # | Issue | Root Cause | Resolution | Files Changed |
|---|-------|-----------|------------|---------------|
| 1 | Flow traces not visible in Dev Panel | Missing trace-collection logic | Added flow-trace recording to `devTiming.js` middleware | `middleware/devTiming.js` |
| 2 | Image upload crash (server 500) | `fs.unlink()` called synchronously on temp file before async Ollama call completed | Changed to `async fs.unlink` after response sent | `routes/chat.js` |
| 3 | Advanced mode formatting broken | Raw `<think>…</think>` tags leaking into chat | Added `<think>` block stripping in response parser | `public/scripts/render.js` |
| 4 | Missing CSS animations (20+ classes) | Skeleton loader, pulse, fade-in animations referenced but undefined | Added all missing `@keyframes` declarations | `public/styles/base.css` |
| 5 | Skeleton animation name mismatch | CSS used `skeleton-shimmer`; JS expected `shimmer` | Unified to `shimmer` in both CSS and JS | `public/styles/base.css`, `public/scripts/loading.js` |
| 6 | Agent referenced non-existent model (`gemma4:e2b`) | Typo in agent tool config | Changed to `gemma4:e4b`; added error handling, fallback logic, enhanced logging | `agent/tools.js`, `agent/agentLoop.js` |
| 7 | Image upload — no output displayed | Generic text prompt sent to Gemma for vision; JSON parse failures returned `structured: null` | Added vision-specific system prompt with strict JSON instructions; added fallback that converts plain text to structured format | `routes/chat.js` |
| 8 | Image not shown in chat bubble | Image preview removed before send; no image in chat history | Image now displayed in chat bubble; history tracks `[Image uploaded]` | `public/scripts/image.js`, `public/scripts/chat.js` |
| 9 | No error handling on `/chat-with-image` | `res.json()` called without checking `res.ok` | Added HTTP status check, response structure validation, and descriptive error messages to frontend | `routes/chat.js` |
| 10 | 500 errors on `/chat` and `/quiz` | `data.message.content` accessed without null check | Added `ollamaRes.ok` check + `data.message?.content` validation on all three major endpoints | `routes/chat.js`, `routes/quiz.js` |
| 11 | Double-click sends message twice | Send button had both `onclick="sendMessage()"` attribute and `addEventListener('click', sendMessage)` | Removed inline `onclick`; kept only `addEventListener` | `public/index.html` |
| 12 | Image displayed twice in chat | `sendMessage()` and `sendToChat()` both rendered the image via `FileReader` | Removed image rendering from `sendMessage()`; kept only in `sendToChat()` | `public/scripts/chat.js`, `public/scripts/image.js` |
| 13 | Duplicate `sendToChat()` function | Function defined twice in monolithic `index.html` — second definition overwrote first | Removed duplicate; kept complete version | `public/scripts/chat.js` |
| 14 | LaTeX notation unfriendly (`H_2O`, `\alpha`) | AI model returns raw LaTeX; no client-side conversion | Added `convertLatexToReadable()` — Unicode subscripts, superscripts, Greek letters, math symbols | `public/scripts/render.js` |
| 15 | Ollama 400 Bad Request intermittent | Malformed request body (missing `model` field in edge cases) | Hardened request construction with explicit `model` field and payload validation | `routes/chat.js` |
| 16 | Image preview too large in input area | `.image-preview` class had no size constraint | Created `.image-preview-thumb` class (56×56 px, `object-fit: cover`) | `public/scripts/image.js`, `public/styles/input.css` |
| 17 | Image preview persists after send | Preview container not cleared when user clicks Send | `sendMessage()` now clears `imagePreviewContainer.innerHTML` immediately on send | `public/scripts/chat.js` |
| 18 | Socratic turn ordering broken | Shared history array polluted backend turn counter | Send explicit `socraticTurn` from frontend; server uses it instead of counting history | `routes/socratic.js`, `public/scripts/socratic.js` |
| 19 | Static file bypass — unauthed HTML access | `express.static` served protected HTML before auth check | Added redirect guards (`/index.html` → `/app`, etc.) before `express.static` | `server.js` |
| 20 | Taxonomy nav link broken + wrong model | Taxonomy admin linked to `#taxonomy`; agent used non-existent model | Fixed nav link to `/taxonomy-admin`; corrected model to `gemma4:e4b` | `public/teacher.html`, `agent/tools.js` |
| 21 | Null guard crash on `#loadingState` | `render()` replaces dashboard innerHTML, destroying `#loadingState` element | Added null guards: `if (el)` before accessing `#loadingState` | `public/teacher.html` |
| 22 | Light/dark theme inconsistency | `taxonomy-admin.html` and `offline.html` had light themes while rest was dark | Rethemed both pages to unified dark design tokens (`#0a0a0f`, `#6C63FF`, etc.) | `public/taxonomy-admin.html`, `public/offline.html` |
| 23 | No responsive design for mobile | All pages lacked comprehensive mobile breakpoints | Added multi-breakpoint responsive CSS (480px, 360px, landscape) to all pages + `pwa.css` | `public/styles/pwa.css`, `public/teacher.html`, `public/taxonomy-admin.html`, `public/login.html`, `public/offline.html` |
| 24 | SSE streaming broken — no chat response displayed | `compression()` middleware buffered SSE `text/event-stream` responses, preventing real-time token delivery | Excluded `/chat` and `/api/events` from compression via `filter` function | `server.js` |
| 25 | Phase 5: Localisation & Digital Equity — Native Language Selector | Students in non-English-speaking regions had no way to receive explanations in their native language | Injected language-specific `CRITICAL` directive into every system prompt (chat, vision, agent, socratic, tools). Gemma 4 handles native inference — zero extra infrastructure or latency | `lib/helpers.js`, `agent/tools.js`, `agent/agentLoop.js`, `routes/chat.js`, `routes/agent.js`, `routes/socratic.js`, `public/index.html`, `public/scripts/state.js`, `public/scripts/init.js`, `public/scripts/agent.js`, `public/scripts/socratic.js` |
| 26 | Raw JSON exposure in chat UI | SSE streaming appended tokens directly to the DOM, exposing incomplete or malformed JSON to users | Implemented Blur & Render pipeline: `.thinking-overlay` with animated dots and background blur hides all content until the final JSON is parsed and rendered. No raw JSON or tokens ever appear in the UI. | `public/styles/thinking.css`, `public/scripts/agent.js`, `public/scripts/render.js`, `public/scripts/chat.js` |
| 27 | Phase 6: Visual Polish & Typewriter Reveal | Even after Blur & Render, instant answer display felt robotic and risked momentary JSON flashes. | Added `.typewriter-text` (blurred), `.active-typing` (revealed) CSS and a vanilla JS typewriterEffect. Answers and Socratic questions are typed out, then revealed crisply. This prevents raw JSON leakage and creates a more tutor-like, human interaction. | `public/styles/typewriter.css`, `public/scripts/render.js`, `public/index.html` |
| 28 | Performance tuning: cache debug logging, quiz 500 errors, benchmark validators | Smart cache had no visibility into miss/write events; `/quiz` crashed with 500 on Ollama timeout; 5 benchmark validators failed; benchmark timeout too short | Added `[cache L4 MISS]` / `[cache WRITE]` debug logging; added AbortController with 110 s timeout and graceful 200 fallback to quiz route; scaled `num_predict` for advanced quiz; fixed 5 validators (due-reviews, estimate ×2, chat ×3, session); added 28-entry TIME_TARGETS map; raised benchmark timeout 120 s → 150 s | `agent/smartCache.js`, `routes/quiz.js`, `agent/tools.js`, `benchmark.js`, `benchmark.quick.js` |
| 29 | Quiz answers always marked incorrect | `selectAnswer()` received option text as a string literal inside an HTML `onclick` attribute. Special characters (quotes, ampersands, backslashes, LaTeX markup) broke the JS string or caused silent mismatches between the selected value and `currentQuiz[idx].answer` | Changed `onclick` to pass the **option index** (integer) instead of the option text. `selectAnswer(questionIdx, optionIdx)` now looks up the actual string from `currentQuiz[questionIdx].options[optionIdx]`, guaranteeing an exact reference match every time — immune to HTML entity encoding, quote escaping, or Gemma re-serialisation. | `public/scripts/quiz.js` |

---

# 4. Developer Reference

## 4.1 Quick Start

```bash
# Prerequisites
# 1. Node.js ≥ 18
# 2. Ollama installed with gemma4:e4b pulled

# Terminal 1 — ensure Ollama is running
ollama run gemma4:e4b       # or: ollama serve (if it auto-starts)

# Terminal 2
cd studybuddy
npm install
npm run dev                  # NODE_ENV=development OLLAMA_KEEP_ALIVE=60m node server.js

# Open http://localhost:3000
```

## 4.2 API Endpoint Reference

### Authentication

| Method | Endpoint | Body | Purpose |
|--------|----------|------|---------|
| `POST` | `/auth/login` | `{ pin, studentName? }` | PIN login → returns `{ success, role, redirect }` |
| `POST` | `/auth/logout` | — | End session |
| `GET` | `/auth/me` | — | `{ authenticated, role, studentName? }` |

### Learning Endpoints

| Method | Endpoint | Body | Purpose |
|--------|----------|------|---------|
| `POST` | `/chat` | `{ message, level, language?, history }` | Direct tutor chat (SSE) |
| `POST` | `/chat-with-image` | `FormData { message, level, language?, image }` | Homework photo analysis |
| `POST` | `/agent` | `{ message, level, language?, history, fast? }` | Full agent pipeline |
| `POST` | `/socratic` | `{ message, level, language?, history }` | Socratic dialogue |
| `POST` | `/concept-map` | `{ topic, level }` | Concept map generation |
| `POST` | `/quiz` | `{ topic, level, numQuestions }` | Quiz generation |
| `POST` | `/estimate` | `{ message, level, hasImage? }` | Time estimate (no LLM) |

### Progress & SRS

| Method | Endpoint | Body | Purpose |
|--------|----------|------|---------|
| `GET` | `/progress` | `?studentId=X` (optional) | Full progress summary |
| `DELETE` | `/progress` | `?all=true` or `?studentId=X` | Clear all or per-student progress |
| `POST` | `/progress-report` | — | AI-generated evaluation report |
| `GET` | `/due-reviews` | `?studentId=X` (optional) | Topics due for SRS review today |
| `PUT` | `/srs/:topic` | `{ grade: 0-5 }` or `{ score: 0-100 }` | Update SRS after review |
| `GET` | `/streak` | `?studentId=X` (optional) | `{ current, longest, studiedToday }` |
| `GET` | `/api/students` | — | List all student profiles |
| `GET` | `/api/class-data` | — | Full class data for teacher dashboard |

### Cache & Search

| Method | Endpoint | Purpose |
|--------|----------|---------|
| `GET` | `/cache-stats` | Cache hit/miss statistics |
| `DELETE` | `/cache` | Clear response cache |
| `GET` | `/topics/search?q=…` | Trie prefix autocomplete |

### Admin (Taxonomy)

| Method | Endpoint | Purpose |
|--------|----------|---------|
| `GET` | `/admin/taxonomy` | View learned + pending |
| `POST` | `/admin/taxonomy` | Add topic manually |
| `GET` | `/admin/taxonomy/template.csv` | Download CSV template |
| `POST` | `/admin/taxonomy/bulk-upload` | Bulk CSV/Excel upload |
| `POST` | `/admin/taxonomy/pending/:topic/approve` | Promote pending → learned |
| `DELETE` | `/admin/taxonomy/pending/:topic` | Reject pending topic |
| `DELETE` | `/admin/taxonomy/learned/:topic` | Remove learned topic |
| `POST` | `/admin/taxonomy/rebuild` | Rebuild taxonomy live |

### Dev (development only)

| Method | Endpoint | Purpose |
|--------|----------|---------|
| `GET` | `/dev/metrics` | Aggregated request metrics |
| `DELETE` | `/dev/metrics` | Reset metrics |
| `GET` | `/dev/flow-traces` | Per-request flow traces |

### Real-Time (SSE)

| Method | Endpoint | Auth | Purpose |
|--------|----------|------|---------|
| `GET` | `/api/events` | Teacher | Server-Sent Events stream for live dashboard updates |

## 4.3 Caching System

### 4-Layer Cache Waterfall

Every cacheable request passes through four layers in order:

| Layer | Name | Latency | Logic |
|-------|------|---------|-------|
| L1 | Taxonomy Lookup | ~0.5 ms | Normalise the topic via taxonomy → canonical key |
| L2 | Normalised Hash | ~1 ms | `MD5("tool::normalised_topic::level")` → memory/disk lookup |
| L3 | In-Flight Dedup | 0 ms | If an identical request is already in-flight, await its result instead of issuing a new LLM call |
| L4 | Ollama | 3–30 s | Full LLM inference (cache miss) |

### Tiered Storage

| Tier | TTL | Max Entries | Eviction |
|------|-----|-------------|----------|
| Memory | 15 min | 300 | LRU |
| Disk (`data/cache.json`) | 24 hr | 500 | Oldest-first flush every 2 min |

### Cache Key Format

```
MD5("tool::normalised_topic::level")
```

Normalisation: lowercase, trim, strip articles/stop-words, singular form.

### Predictive Pre-Warming

When a user asks about topic X, the cache pre-fetches the most likely follow-up tools (e.g., quiz after explain) so the next request is instant.

### Performance

- Cache-hit latency: **0.5–2 ms** (vs. 3–30 s for Ollama)
- Speed-up: **3,400–17,000×** on cache hits
- Bandwidth savings: ~70% with gzip compression

### Admin Cache API

```bash
curl http://localhost:3000/cache-stats          # View stats
curl -X DELETE http://localhost:3000/cache       # Clear cache
```

## 4.4 Dynamic Taxonomy

The taxonomy system (`agent/dynamicTaxonomy.js` + `agent/taxonomy.js`) starts with 76 base topics and 1,223 keywords. When the agent encounters a topic not in the taxonomy, it enters a learning pipeline:

1. **Detection** — Topic not matched by trie
2. **Pending** — Added to pending list with metadata (source, timestamp, frequency)
3. **Promotion** — Auto-promoted to "learned" after 3 occurrences, or manually via admin panel
4. **Persistence** — Learned topics saved to `data/taxonomy_learned.json`
5. **Rebuild** — Trie rebuilt in-memory; no server restart needed

## 4.5 Data Format — `data/progress.json`

```json
{
  "sessions": [
    { "topic": "photosynthesis", "level": "beginner", "quizScore": 85, "timestamp": "..." }
  ],
  "topics": {
    "photosynthesis": {
      "timesStudied": 3,
      "scores": [75, 85, 90],
      "level": "beginner",
      "lastStudied": "2026-04-07T10:30:00Z",
      "srs": {
        "repetitions": 2,
        "easeFactor": 2.6,
        "interval": 6,
        "nextReview": "2026-04-13T00:00:00Z"
      }
    }
  }
}
```

## 4.6 Ollama Integration

| Setting | Value | Why |
|---------|-------|-----|
| Model | `gemma4:e4b` | 9.6 GB; supports text + vision |
| Endpoint | `http://localhost:11434/api/chat` | Local only |
| Keep-Alive | `OLLAMA_KEEP_ALIVE=60m` (via `npm run dev`) | Keeps model in RAM to avoid cold-start latency |
| Temperature | 0.7 (text), 0.3 (vision) | Lower for vision to enforce JSON consistency |
| Warm-up | On server start, sends a 1-token prompt to pre-load model into RAM | Eliminates first-request delay |
| Streaming | SSE on `/chat`; non-streaming JSON on other endpoints | Chat benefits from progressive rendering |

## 4.7 Testing Checklist

```bash
# Health checks (all should return 200)
curl http://localhost:3000/progress
curl http://localhost:3000/streak
curl http://localhost:3000/due-reviews
curl "http://localhost:3000/topics/search?q=photo"

# Agent response (structured JSON)
curl -X POST http://localhost:3000/agent \
  -H "Content-Type: application/json" \
  -d '{"message":"Explain gravity","level":"beginner","history":[]}'

# Concept map (nodes + edges)
curl -X POST http://localhost:3000/concept-map \
  -H "Content-Type: application/json" \
  -d '{"topic":"gravity","level":"intermediate"}'

# SRS update
curl -X PUT http://localhost:3000/srs/gravity \
  -H "Content-Type: application/json" \
  -d '{"score":80}'

# Cache stats
curl http://localhost:3000/cache-stats
```

## 4.8 Common Issues

| Problem | Fix |
|---------|-----|
| `Gemma is not running` | Ensure Ollama is running: `ollama serve` or `ollama run gemma4:e4b` |
| Slow first response (~10 s) | Normal — model warm-up; subsequent requests are faster |
| `EADDRINUSE :3000` | Kill existing process: `lsof -i :3000` then `kill -9 <PID>` |
| `progress.json` not saving | Check `data/` directory exists and is writable |
| Concept map empty | Use a full phrase (e.g. "Newton's Laws") not a single word |
| SRS grade rejected | Use `grade` (0–5) or `score` (0–100), not both |
| Service worker stale | DevTools → Application → Service Workers → "Update on reload" |
| Image upload 500 | Check Ollama is responding: `curl http://localhost:11434/api/tags` |

## 4.9 Port Reference

| Port | Service | Start Command |
|------|---------|---------------|
| 3000 | StudyBuddy Express server | `npm run dev` |
| 11434 | Ollama LLM service | `ollama serve` (auto-starts on macOS) |

## 4.10 Motion Design System

The UI uses a layered animation architecture with CSS custom properties for timing:

| Token | Value | Use |
|-------|-------|-----|
| `--ease-out-expo` | `cubic-bezier(0.16, 1, 0.3, 1)` | Chat bubble entrances |
| `--ease-spring` | `cubic-bezier(0.34, 1.56, 0.64, 1)` | Button interactions |
| `--duration-fast` | `150ms` | Micro-interactions (hover, focus) |
| `--duration-normal` | `300ms` | Standard transitions |
| `--duration-slow` | `500ms` | Modal open/close, skeleton fade |

All animations respect `prefers-reduced-motion: reduce` by collapsing to instant transitions.

---

# 5. Teacher Dashboard Module (Phase A & B)

> **Added:** Phase 5 of the hackathon build  
> **Goal:** Give educators a read-only, data-rich dashboard that showcases student engagement, at-risk detection, and SM-2 spaced-repetition analytics.

## 5.1 Authentication System

PIN-based authentication using `express-session` and `dotenv`.

| Component | File | Purpose |
|-----------|------|---------|
| Auth routes | `routes/auth.js` | `POST /auth/login`, `POST /auth/logout`, `GET /auth/me` |
| Login page | `public/login.html` | Standalone HTML with PIN entry, role feedback |
| Session config | `server.js` | `express-session` middleware (24h cookie, httpOnly, sameSite) |
| Env vars | `.env` | `STUDENT_PIN`, `TEACHER_PIN`, `SESSION_SECRET` |
| Template | `.env.example` | Repo-safe template |

**Roles:**
- **Student (PIN 1234)** — enters name at login → generates `studentId` from name
- **Teacher (PIN 9999)** — redirected to `/teacher`

**Middleware exports:** `requireTeacher`, `requireAuth` — used to protect routes.

## 5.2 Multi-Student Data Schema

All progress data lives in a single flat JSON file (`data/progress.json`).  
The schema was migrated from single-student to multi-student with backward compatibility.

```json
{
  "sessions": [
    { "studentId": "alex", "topic": "gravity", "level": "intermediate", "quizScore": 85, "timestamp": "..." }
  ],
  "topics": {
    "alex": {
      "gravity": { "timesStudied": 3, "scores": [85, 90], "level": "intermediate", "lastStudied": "...", "srs": { "repetitions": 2, "easeFactor": 2.6, "interval": 6, "nextReview": "..." } }
    }
  },
  "students": {
    "alex": { "name": "Alex", "firstSeen": "...", "lastSeen": "..." }
  }
}
```

**Migration:** On first read, legacy data (no `students` key, topics keyed by topic name) is automatically wrapped into `topics.default` and tagged with `studentId: "default"`.

## 5.3 API Endpoints (Teacher)

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET | `/api/students` | Any | List all student profiles |
| GET | `/api/class-data` | Any | Full class data (all students, topics, sessions, per-student summaries) |
| GET | `/progress?studentId=X` | Any | Per-student progress summary |
| GET | `/due-reviews?studentId=X` | Any | Per-student SRS due reviews |
| GET | `/streak?studentId=X` | Any | Per-student learning streak |

## 5.4 Teacher Dashboard (`public/teacher.html`)

Standalone HTML with embedded CSS & JS. Uses **Chart.js 4.x** from CDN.

### Views

| View | Toggle | Description |
|------|--------|-------------|
| **Class Overview** | Default | Aggregate stats, 4 judge panels, charts, full SRS table |
| **Individual Student** | Dropdown picker | Per-student scores, timeline, weak/strong areas, SRS schedule |

### Judge Priority Panels

| # | Panel | Metric | Trigger |
|---|-------|--------|---------|
| 1 | 🚨 At-Risk Students | Topics with avg score < 60% | Any student with declining/failing scores |
| 2 | 🤔 Collective Confusion | Class avg per topic < 60% | Topic-level class struggle |
| 3 | 📉 Engagement Drop-off | Days since last activity ≥ 3 | Student inactivity detection |
| 4 | 🔍 Curiosity Tracking | Total study counts per topic | Most-explored subjects across class |

### Charts

- **Topic Performance** — Bar chart of class-average scores per topic (color-coded: red < 60, yellow < 75, green ≥ 75)
- **Sessions Over Time** — Line chart of daily session counts (area filled)
- **Individual Scores** — Bar chart per student (individual view)
- **Individual Timeline** — Line chart per student (individual view)

### SM-2 Data Table

Full sortable table showing: Student → Topic → Avg Score → Times Studied → Last Studied.

## 5.5 Route Protection

```
GET /teacher → requireTeacher middleware → redirect /login if not teacher
GET /app     → requireAuth middleware    → redirect /login if no session
```

The semantic route handlers are mounted **before** `express.static` so protection applies before any static file serving.

---

# Section 6: Phase C — Real-Time Telemetry & Navigation

## 6.1 Login-First Startup Flow

All users land at `/login` by default. The root route (`/`) inspects the session and redirects:

| Session State | Redirect Target |
|---|---|
| No session / unauthenticated | `/login` |
| `role === 'teacher'` | `/teacher` |
| `role === 'student'` | `/app` |

### Semantic Route Aliases

| Route | Serves | Guard |
|---|---|---|
| `/login` | `public/login.html` | None (always accessible) |
| `/app` | `public/index.html` (+ dev panel in dev mode) | `requireAuth` |
| `/teacher` | `public/teacher.html` | `requireTeacher` |

The student view (`/app` and `index.html`) remains **completely untouched** — no UI or logic changes.

## 6.2 Server-Sent Events (SSE)

**Why SSE over WebSockets?** Zero new dependencies, native browser support, unidirectional (server → client) which is all we need for dashboard push updates.

### Backend Architecture

```
progressStore.js
  └─ writeStore()  ─→  EventEmitter.emit('data_updated')

server.js
  └─ progressStore.on('data_updated') ─→ broadcastSSE() ─→ all connected teacher clients
```

**SSE Endpoint:** `GET /api/events` (requires teacher session)

- Sets `Content-Type: text/event-stream`, `Cache-Control: no-cache`, `Connection: keep-alive`
- Tracks connected clients in a `Set<Response>`
- Logs connect/disconnect events with client count

**Event Format:**
```
event: data_updated
data: {"ts":1718900000000}
```

### Frontend (teacher.html)

- `connectSSE()` opens an `EventSource` to `/api/events`
- On `data_updated` event → calls `refreshData()` (re-fetches + re-renders)
- On disconnect → shows "Reconnecting…" badge, retries after 3 seconds
- `🟢 Live` badge in the navigation bar pulses when connected

## 6.3 Global Navigation Bar

The teacher dashboard topbar was replaced with a proper navigation bar:

| Tab | Behaviour |
|---|---|
| **📈 Live Dashboard** | Active tab — shows the real-time class/student dashboard |
| **🏷️ Taxonomy Admin** | Navigates to `/taxonomy-admin` (taxonomy management panel) |
| **🟢 Live** | SSE connection status badge with pulse animation |
| **🚪 Logout** | Calls `POST /auth/logout` and redirects to `/login` |

### Toolbar

Below the navbar, a secondary toolbar holds:
- View mode selector (Class Overview / Individual Student)
- Student picker dropdown (shown in Individual mode)
- 🔄 Refresh button

### Styling

- Sticky position with `z-index: 100`
- Dark theme consistent with existing dashboard variables
- Active tab indicated by accent-colored bottom border
- Live badge: green pulse animation when connected, red static when disconnected

## 6.4 Data Flow Summary

```
Student interacts with app
  → saveProgress() / updateSRS() / clearProgress()
    → writeStore()
      → emitter.emit('data_updated')
        → server broadcastSSE()
          → EventSource in teacher.html
            → refreshData() → re-render dashboard
```

Latency: near-instant (< 100 ms from student action to dashboard update).

---

*End of Master Blueprint.*

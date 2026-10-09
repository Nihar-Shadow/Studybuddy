---
title: Kaggle Writeup
aliases:
  - Kaggle Writeup
tags:
  - studybuddy
  - documentation
cssclasses:
  - project-doc
project: studybuddy
type: documentation
status: active
related:
  - "[[studybuddy/README]]"
  - "[[studybuddy/CLAUDE]]"
---

# StudyBuddy — Offline AI Tutor Powered by Gemma 4

**Subtitle:** Bringing frontier AI tutoring to every student, everywhere — no cloud, no cost, no internet required.

**Track:** Future of Education

---

## 1. The Problem

770 million adults worldwide are illiterate. Over 250 million children lack access to quality education. The barriers are systemic:

- **Cost.** Private tutoring runs $25–80/hour — out of reach for families earning under $5/day.
- **Connectivity.** 2.7 billion people lack reliable internet; cloud AI tutors are useless offline.
- **One-size-fits-all.** Most platforms deliver identical content regardless of age, background, or pace.
- **Privacy.** Many parents are reluctant to send their children's learning data to cloud servers.
- **Availability.** Help is missing exactly when students need it — late nights, weekends, rural areas with no signal.

A student in rural India doing homework at 10pm has no tutor, no Wi-Fi, no budget for an API subscription. The same student with a secondhand laptop and Ollama installed has a full AI tutor — **free, forever, zero data leaving the device.**

---

## 2. What StudyBuddy Does

**StudyBuddy** is a fully offline, privacy-first AI tutoring platform powered by **Gemma 4** running locally via Ollama. It combines seven learning tools into a single application that adapts to each student's level, tracks progress with spaced repetition, and works without internet after setup.

**Core features:**

- **3 Learning Modes** — Tutor (step-by-step), Socratic (5-question guided discovery), Agent (explain → quiz → track → suggest next).
- **Dynamic Progress Evaluation** — adaptive report with learning trajectory, cross-pollination connections, vocabulary heatmap, keystone topic, and a 2-minute micro-mission.
- **Homework Photo Analysis** — Gemma 4 vision returns extracted data, logic walkthrough, final solution, and confidence.
- **Interactive Concept Maps** — D3.js force-directed knowledge graphs generated from any topic.
- **Voice Input** — browser-native speech recognition with auto-restart and live preview.
- **SM-2 Spaced Repetition** — every quiz score feeds the SuperMemo-2 algorithm.
- **3 Adaptive Themes** — Beginner (emoji-rich), Intermediate (clean), Advanced (terminal monospace).
- **PWA + 140+ Languages** — installable, offline-first; Gemma 4 responds natively in 140+ languages, no translation API.
- **Teacher Dashboard** — live SSE classroom view with 4 AI judge panels: At-Risk, Confusion, Drop-off, Curiosity.

---

## 3. How Gemma 4 Is Used

StudyBuddy uses **Gemma 4 E4B** (efficient 4-bit quantised) as both the reasoning engine and the vision model. All inference runs locally through the Ollama HTTP API (`localhost:11434`). Zero external AI APIs are used.

### 3.1 Adaptive Prompting

Every request receives a dynamically built system prompt:

```
You are StudyBuddy, a friendly and patient tutor.
Adapt your explanation to level: {{level}}.
- beginner: simple words, fun analogies, emojis, short sentences
- intermediate: proper terminology with definitions, balanced depth
- advanced: technical depth, assume strong foundations, concise notation

Return valid JSON: { intro, steps: [{title, text, emoji}], answer, followup }
```

The JSON contract lets every response render with consistent UI components regardless of topic.

### 3.2 Vision (Homework Photos)

1. Image resized to 640px WebP via `sharp`.
2. Base64-encoded and sent to Gemma 4 via Ollama's multimodal API.
3. Gemma returns `{ visual_summary, extracted_data[], logic_steps[], final_solution, confidence }`.
4. Rendered as a vision card with scanning animation and section-by-section reveal.

### 3.3 `<think>` Block Handling

Gemma 4 emits `<think>…</think>` reasoning blocks. StudyBuddy:

- **Prompt-level:** instructs Gemma to keep think sections under 30 words.
- **Server-side:** strips think blocks via regex before JSON parsing.
- **4-stage extraction:** direct parse → strip code fences → find `{…}` → repair trailing commas → validate.
- **Client fallback:** `renderFormattedFallback()` converts plain text to rich HTML when JSON isn't available.

### 3.4 Tool-Calling Agent

Agent mode uses Gemma 4 as a planner that selects which tools to invoke:

```
1. explain_topic(topic, level)
2. generate_quiz(topic, level, numQuestions)
3. track_progress(topic, score, studentId)
4. suggest_next_topic(level)
5. ask_socratic_question(topic, history)
6. generate_concept_map(topic, level)
7. generate_evaluation_report(studentId)
```

Gemma plans the sequence; each tool calls Ollama independently; results are synthesised into one streamed response. `explain_topic` and `generate_concept_map` run concurrently via `Promise.all()`, halving latency for the two heaviest calls.

### 3.5 Witty Socratic Tutor

A 5-turn persona guides students through discovery:

```
Turn 1 → Energetic opener: activate prior knowledge
Turn 2–3 → Build momentum: react with enthusiasm, go deeper
Turn 4 → "Aha moment" setup: subtle nudge toward the answer
Turn 5 → THE FINALE: acknowledge answer + 🎯 Big Picture summary
```

Temperature is raised to **0.8** for varied responses. The tutor never gives the answer directly — it hints with analogies until the student arrives on their own.

### 3.6 Inference Optimisations

Speculative decoding with a `gemma2:2b` draft model (~30–50% faster generation), `num_predict: 500` to cap runaway responses, `num_ctx: 4096` for richer instructions, parallel tool execution via `Promise.all()` (halves agent latency), 640px WebP image downsize, and a 4-layer cache that lets ~70% of repeats skip Ollama entirely.

---

## 4. Architecture

```
┌──────────────────────────────────────────┐
│   Browser (Single-Page App / PWA)         │
│   Chat · Quiz · Concept Map · Image      │
│   Theme · Streak · Dev Panel              │
└───────────────────┬───────────────────────┘
                    │ HTTP :3000
┌───────────────────▼───────────────────────┐
│    Express.js Backend (server.js)          │
│  /chat /chat-with-image /quiz /agent      │
│  /socratic /concept-map /progress         │
│  /progress-report /streak /api/events     │
│                                            │
│  Agent Layer (agentLoop.js, 7 tools)      │
│  Smart 4-Layer Cache · Dynamic Taxonomy   │
│  Progress / SM-2 SRS · Trie Search        │
└───────────────────┬───────────────────────┘
                    │ HTTP :11434
┌───────────────────▼───────────────────────┐
│       Ollama (Local Inference)             │
│       Gemma 4 E4B — Text + Vision         │
│       (CPU, 8GB RAM minimum)              │
└───────────────────────────────────────────┘
```

**Smart 4-Layer Cache:** taxonomy resolve → normalised hash → in-flight dedup → disk persistence (48h TTL).

**Tech stack:** Node.js + Express, vanilla HTML/CSS/JS frontend, Sharp for image processing, Multer for uploads, SSE for the teacher dashboard, D3.js for concept maps, PWA service worker, PIN-based dual-role auth.

---

## 5. Technical Challenges & Solutions

- **`<think>` blocks break `JSON.parse()`.** Regex strip + 4-stage robust extraction pipeline.
- **Slow inference on 8GB CPU.** Skeleton loaders for instant UX, 4-layer cache (~70% skip), speculative decoding, parallel tool calls.
- **Voice input dies silently.** Auto-restart in `onend` unless explicit stop; no-speech retry; 2500ms silence timeout.
- **Socratic flow across 5 turns.** Progressive per-turn system prompts; temperature 0.8; explicit Big Picture trigger on Turn 5.
- **Evaluation Report hallucinating topics.** Full SM-2 snapshot in the system prompt; validation against studied material only.

---

## 6. Offline & Privacy-First by Design

Privacy is not a setting — it is the architecture.

- **Zero external AI APIs** — Gemma 4 runs entirely on the user's CPU.
- **Zero telemetry** — no analytics, no error reporting.
- **Zero cloud storage** — progress and SRS state live in a local JSON file.
- **Offline-first PWA** — service worker caches the shell; Ollama provides AI without internet.
- **On-device image processing** — base64 payloads never leave the machine.

**Setup:** any laptop with 8GB RAM + Node.js + Ollama. No account, no credit card, no data agreement.

---

## 7. Impact

Students without internet get a full AI tutor; low-income families pay nothing; privacy-conscious regions keep all data on-device; under-resourced schools deploy via USB. **Scale:** any 8GB laptop, 140+ languages, $0 to run. Potential reach: 100M+ students in offline regions.

> *12-year-old Priya in rural India has homework about photosynthesis. No internet, no tutor. She opens StudyBuddy, sees a colourful step-by-step explanation at Beginner level, takes a quiz, gets scheduled for review in 6 days. Confused about a diagram, she photographs it — Gemma 4 vision breaks it down. Zero internet, zero cost, zero data leaving her device.*

---

## 8. Live Demo & Walkthrough

**Live demo:** A hosted URL would defeat the point — StudyBuddy *is* the offline-first architecture. The video shows the full UX; the repo runs locally in ~2 minutes (Section 9).

**Video:** https://youtu.be/eo5syCtA5xE

Things to try after local setup:

1. Ask "What is photosynthesis?" at Beginner, then Advanced — notice depth shift.
2. Upload a homework photo (📎) → vision scanning animation and structured solution.
3. "Quiz me on gravity" → MCQ → SRS-tracked score, streak updates.
4. Click 🗺 → interactive concept map; click 📈 → Evaluation Report.
5. Switch to Socratic Mode → 5 guided questions → Big Picture on Turn 5.
6. Ask the same question twice → second response is instant (cache hit).
7. Ctrl+Shift+B → Developer Panel → flow traces and cache stats.

---

## 9. Links & Setup

| Resource | URL |
|---|---|
| GitHub | https://github.com/Christy-Varghese/studybuddy |
| Demo Video | https://youtu.be/eo5syCtA5xE |
| Ollama | https://ollama.ai |
| Gemma 4 | https://ollama.ai/library/gemma4 |

```bash
# Prerequisites: Ollama + Node.js 18+
ollama pull gemma4:e4b
ollama serve

# In a new terminal:
git clone https://github.com/Christy-Varghese/studybuddy.git
cd studybuddy && npm install && npm start

# Open http://localhost:3000
# Student PIN: student2026 | Teacher PIN: teacher2026
```

**Setup time: ~2 minutes** (excluding model download).

---

*StudyBuddy is open-source educational software — privacy-first, offline-capable.*

---
title:StudyBuddy — README
aliases:
  - StudyBuddy
  - StudyBuddy Overview
tags:
  - studybuddy
  - readme
  - project-root
cssclasses:
  - project-readme
  - project-hub
project:studybuddy
type:readme
status:active
related:
  - [[studybuddy/Dependencies]]
  - [[studybuddy/CLAUDE]]
---

# StudyBuddy 📚 — Offline AI Tutor Powered by Gemma 4

> **Private, local AI tutoring for students who cannot always depend on the cloud.**

A fully offline, privacy-first AI tutoring platform powered by **Google's Gemma 4** running locally via Ollama. No cloud, no API keys, no internet required after setup.

Built for the [Gemma 4 Good Hackathon](https://kaggle.com/competitions/gemma-4-good-hackathon) — **Future of Education** track.

---

## 📺 Demo Video

**▶ [Watch the 2-minute walkthrough on YouTube](https://youtu.be/eo5syCtA5xE)**

---

## 📸 Screenshots

| Feature | Preview |
|---------|---------|
| Beginner theme — step-by-step explanation | Chat with emoji-rich step cards |
| Advanced theme — technical depth | Terminal-style monospace explanation |
| Homework photo analysis | Vision card with scanning animation + extracted steps |
| Interactive quiz | MCQ cards with score tracking |
| Concept map | D3.js force-directed SVG knowledge graph |
| Socratic Mode — Turn 5 Big Picture | 🎯 Big Picture summary tying all turns together |
| Dynamic Progress Evaluation Report | 5-section adaptive learning report |
| Teacher Dashboard | Live SSE-powered class overview with AI judge panels |

> Screenshots available in the `/docs` folder and the Kaggle submission gallery.

---

## ✨ Features

### 🎓 Learning Modes
| Mode | How it works |
|------|-------------|
| **Tutor** (default) | Structured explanations with steps, follow-up questions, instant quizzes |
| **Socratic** | AI guides you through exactly 5 witty questions — never just tells you. Turn 5 delivers a 🎯 Big Picture summary |
| **Agent** | Full pipeline: explain + quiz + track progress + suggest next topic |

### Full Feature Set

| Feature | Description |
|---------|-------------|
| 🎭 **Witty Socratic Tutor** | 5-turn guided discovery, pop-culture references, Big Picture summary on Turn 5 |
| 📈 **Dynamic Progress Evaluation** | AI-generated 5-section report: narrative, cross-pollination, vocabulary heatmap, Big Domino, Micro-Mission |
| 📸 **Homework Photo Analysis** | Snap a photo → Gemma 4 vision → step-by-step solution |
| 🗺 **Interactive Concept Maps** | D3.js force-directed SVG knowledge graphs for any topic |
| 🎙 **Voice Input** | Auto-restart speech recognition with live voice preview bar |
| 📊 **SM-2 Spaced Repetition** | Quiz scores feed SM-2; topics scheduled at scientifically optimal intervals |
| 🔥 **Learning Streaks** | Consecutive study-day tracking with animated streak badge |
| 🧠 **Smart 4-Layer Cache** | ~70% of repeated queries skip Ollama entirely (48h TTL disk persistence) |
| 📚 **Dynamic Taxonomy** | 76 topics, 1,223 keywords across 9 subjects; auto-promotes frequently asked topics |
| 🎨 **3 Adaptive Themes** | Beginner (emoji-rich), Intermediate (clean), Advanced (terminal monospace) |
| 📱 **PWA** | Installable; service worker caches shell for offline-first use |
| 🌐 **140+ Languages** | Prompt-injection multilingual — Gemma 4 responds natively, no translation API |
| 👩‍🏫 **Teacher Dashboard** | Live SSE class view: At-Risk Detection, Collective Confusion, Engagement Drop-off, Curiosity Tracking |
| 🔍 **Developer Panel** | Per-route latency, cache hit rates, real-time flow traces (`Ctrl+Shift+B`) |

---

## 🏗 Architecture

```
┌─────────────────────────────────────────────────┐
│         Browser (Single-Page App / PWA)          │
│                                                   │
│  Chat UI ← → Quiz Modal ← → Concept Map SVG     │
│  Image Upload ← → Theme Switcher ← → Streak     │
│  Skeleton Loaders ← → Dev Panel (Metrics+Flow)  │
└──────────────────────┬────────────────────────────┘
                       │ HTTP (localhost:3000)
┌──────────────────────▼────────────────────────────┐
│           Express.js Backend (server.js)           │
│                                                     │
│  /chat  /chat-with-image  /quiz  /concept-map      │
│  /agent  /socratic  /progress  /progress-report    │
│  /due-reviews  /srs/:topic  /streak                │
│  /api/events (SSE)  /api/class-data                │
│  /dev/metrics  /dev/flow-traces                    │
│                                                     │
│  ┌────────────────────────────────────────────┐    │
│  │         Agent Layer (agentLoop.js)         │    │
│  │  7 Tools: explain, quiz, track, suggest,   │    │
│  │    socratic, concept-map, eval-report      │    │
│  ├────────────────────────────────────────────┤    │
│  │  Smart Cache  │  Taxonomy  │  Progress/SRS │    │
│  │  (4-layer)    │  (dynamic) │   (SM-2)      │    │
│  └───────────────┴──────┬─────┴───────────────┘    │
└─────────────────────────┼──────────────────────────┘
                          │ HTTP (localhost:11434)
┌─────────────────────────▼──────────────────────────┐
│              Ollama (Local Inference)                │
│         Gemma 4 E4B — Text + Vision                 │
│         (runs on CPU, 8GB RAM minimum)              │
└─────────────────────────────────────────────────────┘
```

---

## 🛠 Tech Stack

| Component | Technology |
|-----------|------------|
| AI Model | Gemma 4 E4B via Ollama (local inference, text + vision) |
| Backend | Node.js 18+ + Express.js |
| Frontend | Vanilla HTML/CSS/JS (SPA shell + 15 JS modules, 14 CSS files) |
| Auth | PIN-based dual-role (student / teacher) via `express-session` |
| Real-time | Server-Sent Events (SSE) for teacher dashboard live updates |
| Image Processing | `sharp` (resize to 640px WebP) |
| Upload Handling | `multer` |
| Compression | `compression` middleware (gzip; SSE excluded) |
| SRS Algorithm | SM-2 (SuperMemo 2) |
| Search | O(k) trie-based prefix autocomplete |
| PWA | Service worker + Web App Manifest |
| Concept Maps | D3.js force-directed SVG |
| Multilingual | Prompt-injection — Gemma 4 native 140+ languages |
| Python Bridge | `httpx` streaming + `orjson` for sub-5s low-latency queries |

---

## ⚙️ Gemma 4 & Ollama Setup

### 1. Install Ollama
Download from [ollama.ai](https://ollama.ai) and install for your OS.

### 2. Pull Gemma 4 E4B
```bash
ollama pull gemma4:e4b
```
> Model size: ~3.2 GB. Requires 8GB RAM minimum (16GB recommended).

### 3. Start Ollama
```bash
ollama serve
```
Ollama runs at `http://localhost:11434`. Keep this terminal open.

### Verify Ollama is working
```bash
curl http://localhost:11434/api/tags
```

---

## 🚀 How to Run Locally

### Prerequisites
- [Ollama](https://ollama.ai) with `gemma4:e4b` pulled and running
- Node.js 18+
- 8GB RAM minimum

### Steps

```bash
# 1. Clone the repo
git clone https://github.com/Christy-Varghese/studybuddy.git
cd studybuddy

# 2. Install dependencies
npm install

# 3. Start the server
npm start
```

Open **http://localhost:3000**

### Login PINs
| Role | PIN |
|------|-----|
| Student | `student2026` |
| Teacher | `teacher2026` |

### Optional: Python low-latency bridge
```bash
cd python
pip install -r requirements.txt
python -m python    # interactive REPL, sub-5s responses
```

> No `.env` configuration needed — the app ships with defaults. No API keys required.

---

## 📁 Project Structure

```
studybuddy/
├── server.js                   — Express entry point
├── routes/
│   ├── auth.js                 — PIN login, session, requireTeacher middleware
│   ├── chat.js                 — /chat, /chat-with-image, /estimate
│   ├── quiz.js                 — /quiz (with answer normalisation)
│   ├── agent.js                — /agent (full pipeline)
│   ├── socratic.js             — /socratic (5-turn guided discovery)
│   ├── conceptMap.js           — /concept-map
│   ├── progress.js             — /progress, /progress-report, /due-reviews,
│   │                             /srs, /streak, /progress/quiz-score,
│   │                             /api/class-data, /api/students
│   ├── admin.js                — /admin/* + bulk CSV/Excel taxonomy upload
│   └── dev.js                  — /dev/metrics, /dev/flow-traces, /cache-stats
├── middleware/
│   ├── devTiming.js            — Request timing + flow traces
│   ├── upload.js               — Multer config
│   └── pwa.js                  — PWA MIME type corrections
├── lib/
│   └── helpers.js              — buildSystemPrompt(), estimateResponseTime()
├── agent/
│   ├── agentLoop.js            — Sequential, parallel & Socratic agents
│   ├── tools.js                — 7 learning tools
│   ├── progressStore.js        — SM-2 SRS + multi-student progress (JSON)
│   ├── smartCache.js           — 4-layer cache waterfall
│   ├── dynamicTaxonomy.js      — Auto-learn + curate taxonomy
│   ├── taxonomy.js             — Base taxonomy (76 topics, 1,223 keywords)
│   └── trie.js                 — O(k) prefix autocomplete
├── public/
│   ├── index.html              — Student SPA shell
│   ├── login.html              — PIN login (two-step: PIN → name)
│   ├── teacher.html            — Live teacher dashboard (SSE-powered)
│   ├── taxonomy-admin.html     — Taxonomy curation panel
│   ├── styles/                 — 14 CSS files
│   ├── scripts/                — 15 JS modules
│   ├── assets/                 — PWA icons + logo SVGs
│   ├── manifest.json           — PWA manifest
│   ├── sw.js                   — Service worker
│   └── devpanel.js             — Developer diagnostics panel
├── data/                       — Runtime data (auto-created)
│   ├── progress.json           — Multi-student learning history
│   ├── cache.json              — Cache persistence
│   └── taxonomy_learned.json   — Learned topics
├── python/                     — Low-latency Python ↔ Ollama bridge
│   ├── studybuddy_core.py
│   ├── requirements.txt
│   ├── __init__.py
│   └── __main__.py
└── docs/
    ├── KAGGLE_WRITEUP.md       — Kaggle submission writeup
    └── MASTER_BLUEPRINT.md     — Full technical reference
```

---

## 📡 API Reference

| Method | Endpoint | Purpose |
|--------|----------|---------|
| `POST` | `/auth/login` | PIN login — returns role + redirect |
| `POST` | `/auth/logout` | Destroy session |
| `GET`  | `/auth/me` | Current session (role, name, studentId) |
| `POST` | `/chat` | Structured Gemma 4 chat (SSE streaming) |
| `POST` | `/chat-with-image` | Vision: homework photo analysis |
| `POST` | `/agent` | Full agent pipeline |
| `POST` | `/socratic` | Socratic dialogue mode |
| `POST` | `/concept-map` | Generate concept map (nodes + edges) |
| `POST` | `/quiz` | Standalone quiz generation |
| `POST` | `/estimate` | Response time prediction |
| `POST` | `/progress-report` | AI-generated Dynamic Progress Evaluation |
| `POST` | `/progress/quiz-score` | Save completed quiz score + update SRS |
| `GET`  | `/progress` | Student progress summary |
| `DELETE` | `/progress` | Clear progress |
| `GET`  | `/due-reviews` | Topics due for SRS review |
| `PUT`  | `/srs/:topic` | Update SRS after review session |
| `GET`  | `/streak` | Current + longest learning streak |
| `GET`  | `/api/students` | List all student profiles (teacher only) |
| `GET`  | `/api/class-data` | Full class data for teacher dashboard (teacher only) |
| `GET`  | `/api/events` | SSE stream for live teacher dashboard |
| `GET`  | `/topics/search?q=` | Trie-based topic autocomplete |
| `GET`  | `/cache-stats` | Cache performance stats |
| `DELETE` | `/cache` | Clear response cache |
| `GET`  | `/dev/metrics` | Latency, cache stats per route |
| `GET`  | `/dev/flow-traces` | Per-route flow traces with step timing |

---

## 🧰 The 7 Learning Tools

| Tool | What it does |
|------|-------------|
| `explain_topic` | Structured explanation: intro + steps + answer + follow-up |
| `generate_quiz` | 2–5 MCQ questions with 3-priority answer normalisation |
| `track_progress` | Saves study event + updates SM-2 schedule per student |
| `suggest_next_topic` | Personalised recommendation based on weak/strong areas |
| `ask_socratic_question` | 5-turn witty discovery dialogue with Big Picture summary |
| `generate_concept_map` | Nodes + edges knowledge graph for D3.js rendering |
| `generate_evaluation_report` | 5-section adaptive learning report per student |

---

## 🧪 Quick Smoke Test

```bash
# Is Ollama up?
curl http://localhost:11434/api/tags

# Is the server up?
curl http://localhost:3000/auth/me

# Explain a topic
curl -X POST http://localhost:3000/chat \
  -H "Content-Type: application/json" \
  -d '{"message":"Explain gravity","level":"beginner","history":[]}'

# Generate a quiz
curl -X POST http://localhost:3000/quiz \
  -H "Content-Type: application/json" \
  -d '{"topic":"photosynthesis","level":"intermediate","numQuestions":3}'

# Concept map
curl -X POST http://localhost:3000/concept-map \
  -H "Content-Type: application/json" \
  -d '{"topic":"photosynthesis","level":"beginner"}'
```

---

## ⚠️ Known Limitations

| Limitation | Detail |
|---|---|
| **Inference speed** | Gemma 4 on CPU: 20–90s per response. Not suitable for <8GB RAM devices |
| **Initial setup** | Requires Node.js, Ollama, and ~3GB model download |
| **No real-time collaboration** | Students work independently; no shared live sessions |
| **Single-machine default** | Designed for local use; classroom multi-student requires local network config |
| **Model accuracy** | Gemma 4 E4B can hallucinate on niche topics; verify answers for high-stakes use |
| **Vision quality** | Handwritten text recognition depends on image clarity |
| **MemoryStore sessions** | Sessions reset on server restart (no Redis persistence) |

---

## 🔭 Future Roadmap

- [ ] **Lighter model support** — Gemma 3 1B/2B for 4GB RAM devices
- [ ] **USB classroom bundle** — pre-packaged installer for offline school deployment
- [ ] **Curriculum alignment** — map topics to CBSE, Common Core, Cambridge IGCSE syllabi
- [ ] **Parent/guardian dashboard** — weekly progress digest generated locally
- [ ] **Collaborative Socratic sessions** — two students, one AI tutor
- [ ] **Adaptive difficulty auto-detection** — infer level from first response
- [ ] **PDF study guide export** — export session explanations as a formatted study sheet
- [ ] **Redis session store** — persistent sessions across server restarts

---

## 📖 Documentation

| Document | What it covers |
|----------|----------------|
| [docs/KAGGLE_WRITEUP.md](./docs/KAGGLE_WRITEUP.md) | Competition writeup — problem, solution, architecture, impact |
| [docs/MASTER_BLUEPRINT.md](./docs/MASTER_BLUEPRINT.md) | Full technical reference — architecture, fix log, developer guide |

---

## 📄 License

[![License: CC BY 4.0](https://img.shields.io/badge/License-CC%20BY%204.0-lightgrey.svg)](https://creativecommons.org/licenses/by/4.0/)

This project is licensed under the **Creative Commons Attribution 4.0 International (CC BY 4.0)** license.

You are free to share and adapt this work for any purpose, even commercially, as long as you give appropriate credit to the original author.

> Copyright (c) 2026 Christy Varghese  
> Full license text: [LICENSE](LICENSE) · [CC BY 4.0 Legal Code](https://creativecommons.org/licenses/by/4.0/legalcode)

---

## 🔗 Links

| Resource | URL |
|------|-----|
| **GitHub Repository** | https://github.com/Christy-Varghese/studybuddy |
| **Demo Video** | https://youtu.be/eo5syCtA5xE |
| **Kaggle Submission** | https://kaggle.com/competitions/gemma-4-good-hackathon |
| **Ollama** | https://ollama.ai |
| **Gemma 4 Model** | https://ollama.ai/library/gemma4 |

---

*Built with ❤️ to make quality education accessible to every student — everywhere.*
*Privacy-first. Offline-capable. Powered by Google's Gemma 4.*

# StudyBuddy 📚 — Offline AI Tutor Powered by Gemma 4

An intelligent, fully offline tutoring platform that runs entirely on your device using **Gemma 4 via Ollama**. No cloud, no API keys, no internet required after setup.

Built for the [Gemma 4 Good Hackathon](https://kaggle.com/competitions/gemma-4-good-hackathon) — Future of Education track.

---

## 🚀 Quick Start

### Prerequisites
- **Ollama** with `gemma4:e4b` — download from [ollama.ai](https://ollama.ai)
- **Node.js 18+**
- **Python 3.10+** (only for the low-latency Python bridge — optional)
- **8GB RAM** minimum (16GB recommended for best performance)

### Setup (2 minutes)

```bash
# Terminal 1 — start Gemma 4
ollama run gemma4:e4b

# Terminal 2 — start StudyBuddy
cd studybuddy
npm install
npm start          # or: npm run dev

# (Optional) Terminal 3 — Python bridge setup
cd python
pip install -r requirements.txt
python -m python   # interactive REPL for low-latency queries
```

Open **http://localhost:3000** — that's it. No `.env`, no API keys, fully local.

---

## ✨ Features

### 🎓 Learning Modes
| Mode | How it works |
|------|-------------|
| **Tutor Mode** (default) | Structured explanations with steps, follow-up questions, instant quizzes |
| **Socratic Mode** | AI guides you to *discover* the answer through exactly 5 witty questions — never just tells you. Turn 5 delivers a 🎯 Big Picture summary. |
| **Agent Mode** | Full pipeline: explain + quiz + track + suggest next topic in one request |

### 🎭 Witty Socratic Tutor
The Socratic tutor is a high-energy, pop-culture-savvy AI that guides discovery through **exactly 5 questions**. Each question builds on your previous answer, nudging you closer to the concept without ever giving it away. On Turn 5, you get a 🎯 **Big Picture** summary tying all your answers together.

### 📈 Dynamic Progress Evaluation Report
Click the **📈 Evaluation Report** button to get a personalised 5-section learning analysis:
- **Learning Trajectory** — how your focus is shifting over time
- **Cross-Pollination** — hidden connections between your studied topics
- **Vocabulary Heatmap** — how your language is evolving
- **Big Domino** — the ONE keystone topic that would unlock the most progress
- **Micro-Mission** — a specific 2-minute task to do right now

### 🗺 Concept Maps
Generate an interactive knowledge graph for any topic. Gemma 4 produces a nodes-and-edges map showing how concepts connect, rendered as an animated force-directed graph using D3.js.

### 📊 Spaced Repetition (SM-2)
Every quiz score feeds the SM-2 algorithm. Topics are scheduled for review at scientifically optimal intervals (Day 1 → 6 → exponential). A **"Due for Review"** banner appears automatically on your study days.

### 🔥 Learning Streaks
Tracks consecutive study days. Streak badge appears in the header — turns orange at 3+ days.

### 🧠 Smart 4-Layer Cache
1. Live taxonomy resolution
2. Normalised hash lookup (catches varied phrasing)
3. In-flight deduplication
4. Disk persistence (48-hour TTL)

~70% bandwidth reduction via gzip. Predictive pre-warming caches your next suggested topic in the background.

### 📚 Dynamic Topic Taxonomy
76 topics with 1,223 keywords across 9 subjects. Topics asked 2+ times are auto-promoted to the learned taxonomy. Admin panel at `/taxonomy-admin` for manual curation + bulk CSV/Excel upload.

### 📸 Homework Photo Analysis
Upload a photo of any homework problem — Gemma 4's vision capability explains it step-by-step. Robust error handling with defensive retry logic, async file cleanup, and multer error boundaries. Collapsible sections for easy scanning.

### 🎙 Voice Input
Click the microphone icon and speak your question. Features auto-restart on unexpected session end, no-speech error recovery, 2500ms silence timeout, and a live voice preview status bar with ✓ (send) and ✕ (cancel) buttons.

### 🔍 Developer Diagnostics Panel
Built-in **Metrics** and **Flow** tabs (press the 🛠 button):
- **Metrics**: Request counts, latency percentiles, cache hit rates per route
- **Flow**: Real-time flow traces showing every internal step (taxonomy lookup → cache check → Ollama call → JSON parse) with millisecond-level timing and bottleneck detection

### 🌐 Native Multilingual Engine (Zero-Lag)
Learn in any of 140+ languages. Select your language from the 🌐 header dropdown — the system prompt is dynamically rewritten so Gemma 4 responds entirely in your chosen language. No translation API, no extra model, no additional latency. Starter set: English, Hindi, Spanish, Arabic, Mandarin, French, Portuguese, Bengali, Tamil, Swahili.

### 📝 Advanced Formatting Engine
- Strips `<think>…</think>` reasoning blocks emitted by Gemma models before parsing
- Robust JSON extraction: direct parse → code-fence strip → brace extraction → trailing-comma repair
- Rich fallback renderer converts markdown-like text to formatted HTML (headers, bold, italic, code blocks, inline code, lists) when structured JSON isn't available

### 🎨 Three Adaptive Themes
- **Beginner** (ages 8–12): playful, colourful, emoji-rich
- **Intermediate** (high school): clean, professional
- **Advanced** (university): terminal-style, monospace

### 📱 Progressive Web App
Install on any device directly from the browser. Works fully offline — the shell is cached by the service worker, Ollama runs locally.

### 🐍 Low-Latency Python Bridge (`python/`)
A standalone Python module (`StudyBuddyCore`) that talks directly to the local Ollama instance for sub-5-second response times on an 8 GB MacBook Air. Key design choices:

- **Streaming-first** — tokens print to stdout the instant they arrive via `httpx` streaming
- **orjson decoding** — minimal CPU overhead when parsing Ollama's newline-delimited JSON chunks
- **Hard-capped generation** — `num_predict: 100`, `temperature: 0.1` for deterministic, tight answers
- **Model pinned in RAM** — `keep_alive: -1` prevents re-loading between queries
- **Sprint/Think routing** — a strict system prompt forces the model to classify queries as `[SPRINT]` (direct answer) or `[THINK]` (3-step Socratic hint, max 50 words), returning compact `{"m": "S"|"T", "a": "..."}` JSON

---

## 📁 Project Structure

```
studybuddy/
├── server.js                   — Express entry point (wires routes + middleware)
├── routes/                     — API route handlers
│   ├── chat.js                 — /chat, /chat-with-image, /estimate (SSE streaming)
│   ├── quiz.js                 — /quiz
│   ├── agent.js                — /agent (full pipeline)
│   ├── socratic.js             — /socratic (guided discovery)
│   ├── conceptMap.js           — /concept-map
│   ├── progress.js             — /progress, /progress-report, /due-reviews, /srs, /streak
│   ├── admin.js                — /admin/* + bulk CSV/Excel upload
│   └── dev.js                  — /dev/metrics, /dev/flow-traces, /cache-stats, /topics/search
├── middleware/
│   ├── devTiming.js            — Request timing, dev metrics, flow traces
│   ├── upload.js               — Multer config (image + spreadsheet uploads)
│   └── pwa.js                  — PWA MIME type corrections
├── lib/
│   └── helpers.js              — buildSystemPrompt(), estimateResponseTime(), warmUpModels()
├── agent/
│   ├── agentLoop.js            — Sequential, parallel & Socratic agents
│   ├── tools.js                — 7 learning tools (explain, quiz, track, suggest, socratic, concept-map, evaluation-report)
│   ├── progressStore.js        — SM-2 SRS + streak tracking (JSON-based)
│   ├── smartCache.js           — 4-layer cache waterfall
│   ├── dynamicTaxonomy.js      — Auto-learn + curate topic taxonomy
│   ├── taxonomy.js             — Base topic taxonomy (76 topics, 1,223 keywords)
│   └── trie.js                 — O(k) prefix search for autocomplete
├── public/
│   ├── index.html              — HTML shell (~190 lines, references external CSS/JS)
│   ├── styles/                 — 14 CSS files (variables, base, layout, chat, input, voice, etc.)
│   ├── scripts/                — 15 JS files (state, utils, chat, quiz, render, agent, voice, etc.)
│   ├── assets/                 — PWA icons (icon-192, icon-512, icon-maskable)
│   ├── devpanel.js             — Developer diagnostics panel (Metrics + Flow tabs)
│   ├── manifest.json           — PWA manifest
│   ├── sw.js                   — Service worker (offline-first)
│   ├── offline.html            — Offline fallback page
│   └── taxonomy-admin.html     — Topic taxonomy admin panel
├── data/                       — Runtime data (auto-created)
│   ├── progress.json           — Student learning history
│   ├── cache.json              — Smart cache persistence
│   └── taxonomy_learned.json   — Learned topic expansions
├── scripts/
│   └── generate-icons.js       — PWA icon generator
├── python/                     — Low-latency Python ↔ Ollama bridge
│   ├── studybuddy_core.py      — StudyBuddyCore class (streaming, orjson)
│   ├── requirements.txt        — httpx + orjson dependencies
│   ├── __init__.py             — Package export
│   └── __main__.py             — CLI entry point (python -m python)
└── docs/                       — Full documentation (see docs/MASTER_BLUEPRINT.md)
```

---

## 📡 API Reference

| Method | Endpoint | Purpose |
|--------|----------|---------|
| `POST` | `/auth/login` | PIN-based login (returns role + redirect) |
| `POST` | `/auth/logout` | End session |
| `GET`  | `/auth/me` | Current session info (role, name) |
| `POST` | `/chat` | Direct Gemma 4 chat with structured response (SSE streaming) |
| `POST` | `/chat-with-image` | Vision: homework photo analysis |
| `POST` | `/agent` | Full agent pipeline (explain + quiz + track + suggest) |
| `POST` | `/socratic` | Socratic dialogue — guided discovery mode |
| `POST` | `/concept-map` | Generate concept map (nodes + edges JSON) |
| `POST` | `/quiz` | Standalone quiz generation |
| `POST` | `/estimate` | Response time prediction (no LLM call) |
| `POST` | `/progress-report` | Dynamic Progress Evaluation Report (AI-generated) |
| `GET`  | `/progress` | Student progress summary (`?studentId=X` optional) |
| `DELETE` | `/progress` | Clear progress (`?all=true` or `?studentId=X`) |
| `GET`  | `/due-reviews` | Topics due for spaced repetition review |
| `PUT`  | `/srs/:topic` | Update SRS state after a review session |
| `GET`  | `/streak` | Current + longest learning streak |
| `GET`  | `/api/students` | List all student profiles |
| `GET`  | `/api/class-data` | Full class data for teacher dashboard |
| `GET`  | `/topics/search?q=` | Trie-based topic autocomplete |
| `GET`  | `/cache-stats` | Cache performance metrics |
| `DELETE` | `/cache` | Clear response cache |
| `GET`  | `/dev/metrics` | Developer diagnostics: latency, cache stats |
| `GET`  | `/dev/flow-traces` | Per-route flow traces with step timing |
| `GET`  | `/admin/taxonomy` | View learned + pending topics |
| `POST` | `/admin/taxonomy` | Add topic manually |
| `POST` | `/admin/taxonomy/bulk-upload` | Bulk CSV/Excel upload |
| `GET`  | `/api/events` | SSE stream for live teacher dashboard |

---

## 🧰 The 7 Learning Tools

| Tool | What it does |
|------|-------------|
| `explain_topic` | Structured explanation: intro + steps + key answer + follow-up |
| `generate_quiz` | 2–5 multiple choice questions with explanations |
| `track_progress` | Saves study event, updates SRS schedule |
| `suggest_next_topic` | Personalised next topic based on weak/strong areas |
| `ask_socratic_question` | 5-turn witty guided discovery dialogue with Big Picture summary |
| `generate_concept_map` | Builds nodes + edges knowledge graph |
| `generate_evaluation_report` | AI-generated 5-section adaptive learning report |

---

## 🤖 Models

| Model | Role |
|-------|------|
| `gemma4:e4b` | Primary — planning, explanation, synthesis, vision |
| `gemma4:e4b` (via Python bridge) | Low-latency math/fact queries — sub-5 s streaming |

---

## 📖 Documentation

| Document | What it covers |
|----------|----------------|
| [docs/MASTER_BLUEPRINT.md](./docs/MASTER_BLUEPRINT.md) | Complete technical reference — architecture, features, fix log, developer guide |
| [docs/KAGGLE_WRITEUP.md](./docs/KAGGLE_WRITEUP.md) | Kaggle competition submission writeup |

---

## 🛡 Reliability & Performance

| Area | Detail |
|------|--------|
| **Quiz answer matching** | Frontend uses index-based option selection (not string literals in HTML onclick), immune to HTML entity encoding, quote escaping, and LLM re-serialisation artefacts |
| **Quiz timeout resilience** | AbortController with 110 s hard timeout; graceful 200 fallback instead of 500 error |
| **Cache observability** | `[cache L4 MISS]` / `[cache WRITE]` debug logging for diagnosing cache behaviour |
| **Benchmark suite** | `node benchmark.js` — 28 endpoints with per-route time targets; 150 s timeout; robust validators |

---

## 🧪 Test It Works

```bash
# Gemma 4 responding?
curl http://localhost:11434/api/tags

# Backend healthy?
curl http://localhost:3000/progress

# Explain a topic
curl -X POST http://localhost:3000/chat \
  -H "Content-Type: application/json" \
  -d '{"message":"Explain gravity","level":"beginner","history":[]}'

# Socratic mode
curl -X POST http://localhost:3000/socratic \
  -H "Content-Type: application/json" \
  -d '{"message":"gravity","level":"intermediate","history":[]}'

# Evaluation Report
curl -X POST http://localhost:3000/progress-report

# Concept map
curl -X POST http://localhost:3000/concept-map \
  -H "Content-Type: application/json" \
  -d '{"topic":"photosynthesis","level":"beginner"}'

# Due reviews
curl http://localhost:3000/due-reviews
```

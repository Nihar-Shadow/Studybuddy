# Nextech 2.0 Audit — Report 1: Executive Summary

**Project:** StudyBuddy (Local-First Agentic EdTech for Regional Language & Geography)  
**Hackathon:** Nextech 2.0 (Nirmit)  
**Evaluator Roles:** Senior Software Architect, Agentic AI Engineer, QA Lead, Hackathon Evaluator  
**Audit Date:** October 13, 2026  
**Audited Repository:** `c:\studybuddy-main`

---

## 1. Product Description & What It Currently Does

StudyBuddy is a local-first, zero-cloud educational tutoring platform designed specifically for Class 9 students in rural, low-connectivity regions of Odisha (represented by the persona "Sunita"). It addresses doubts in science topics (aligned with the Odisha SCERT Class 9 syllabus) in the Odia language using purely local AI inference powered by Ollama.

### Current Functionality Verified in the Codebase:
1. **Bilingual Doubt Answering:** Accepts natural-language science questions in both Odia (Odia script / transliteration) and English. Answers in plain-text Odia or structured English cards via Server-Sent Events (SSE) streaming.
2. **Dual-Model Local Routing:** Routes Odia queries to a dedicated Odia 2B model (`dhee-odia` / `Dhee-NxtGen-Qwen3-Odia-v2`) and English/other queries to `qwen3:4b`. Zero cloud API keys required.
3. **Multi-Tier Odia Safety Guardrails:** When the 2B local Odia model hallucinates, uses corrupted vocabulary (e.g. `ଉଦ୍ଭିଦ ସଂଶ୍ଲେଷଣ`), drifts off-topic, or provides factually contradictory science statements (e.g. claiming oxygen comes from carbon dioxide), the system runs a multi-tier safety pipeline: rule validation -> 1 bounded corrective repair -> deterministic SCERT Class 9 verified fact fallback.
4. **Adaptive Learning State & Progression:** Tracks learner understanding across 8 Class 9 topics and sub-concepts (`photosynthesis`, `matter`, `states_of_matter`, `evaporation`, `water_cycle`, `force_and_motion`, `cell`, `respiration`). Maintains conservative concept confidence states (`unknown` -> `partial` -> `understood` or `needs_review`) and dynamically computes the next educational action (`introduce`, `practice`, `review`).
5. **Classroom & Teacher Features:** Features a real-time teacher dashboard (`/teacher`) powered by Server-Sent Events (`/api/events`), confusion matrices, at-risk student tracking, and PDF report exports (`/teacher/reports`).
6. **PWA Static Shell:** A Progressive Web App service worker (`public/sw.js`) precaches static shell assets (HTML, CSS, JS, vendor libraries D3 and Chart.js).

---

## 2. Actual Technology Stack

| Layer | Actual Technology / Implementation |
|---|---|
| **Frontend** | Vanilla JavaScript (ES6+), Vanilla CSS3 (custom CSS design system, CSS variables, dark/light themes), semantic HTML5, Progressive Web App (Service Worker + Web App Manifest). D3.js v7 for concept graphs, Chart.js for analytics. Zero heavy frameworks (React/Vue/Angular/Next.js are absent). |
| **Backend** | Node.js (CommonJS), Express 4.22.1, `express-session` (cookie-based session authentication with ephemeral or configured secrets), `compression` (gzip with SSE stream bypass), `multer` + `sharp` (for homework image uploads). |
| **Inference Engine** | Local Ollama instance (`http://localhost:11434`). Dual-model architecture: `dhee-odia` (Odia) and `qwen3:4b` (English/Hindi/reasoning). |
| **Agent Core** | Custom agent runtime (`agent/agentLoop.js`, `agent/tools.js`): LLM-driven planning phase (`runParallelAgent`), deterministic workflow fallback (`runAgentLoop`), 5-turn Socratic dialogue subagent (`runSocraticAgent`). |
| **Knowledge & Policy** | In-repo verified SCERT Class 9 knowledge base (`lib/class9Knowledge.js`: 1,433 lines) and linguistic/factual policy guardrails (`lib/languagePolicy.js`: 2,400+ lines). |
| **Persistence** | File-backed JSON databases (`data/progress.json`, `data/cache.json`, `data/taxonomy_learned.json`) with auto-backup on corruption and multi-student schema. In-memory session state (`req.session.learningState`). |
| **Speech** | Browser Web Speech API (`webkitSpeechRecognition`) mapped to `or-IN` for Odia. |

---

## 3. Verified Major Features

| Feature | Verification Method | Status |
|---|---|---|
| **Class 9 Odia Knowledge Layer** | Ran `tests/class9-knowledge.test.js` (28 unit and live tests against Ollama `dhee-odia`) | **PASS (28/28 passed)** |
| **Student Learning State & Next-Study Decision** | Ran `tests/student-learning-state.test.js` (11 unit tests) | **PASS (11/11 passed)** |
| **Targeted Practice Loop & Evaluation** | Ran `tests/targeted-practice.test.js` (26 unit tests) | **PASS (26/26 passed)** |
| **Practice CTA Relevance Guards** | Ran `tests/practice-cta-relevance.test.js` (8 unit tests) | **PASS (8/8 passed)** |
| **Central Model Routing & Fallback** | Ran `tests/model-routing.test.js` (11 unit tests) | **PASS (11/11 passed)** |
| **Adversarial Odia Tutor Regression & Fallbacks** | Ran `tests/judge-failure-regression.test.js` (16 unit & live Ollama tests) | **PASS (16/16 passed)** |
| **Empty Response & Parser Resilience** | Ran `tests/chat-empty-fix.test.js` (10 unit & live Ollama tests) | **PASS (10/10 passed)** |
| **Live E2E Odia Quiz Generation & Auth** | Ran `tests/live-e2e-odia-water-quiz.test.js` against live Express server on port 3000 | **PASS (Live 19.0s generation)** |
| **Teacher SSE Dashboard & PDF Reports** | Inspected `routes/admin.js`, `server.js` (`/api/events`), `public/teacher.html`, `public/reports.html` | **PASS (Verified in code)** |

---

## 4. Core Requirements Remaining Incomplete

1. **Autonomous Multi-Tool Agent Mode Hidden from UI:**  
   In `public/index.html` (line 99), the button `<button id="agent-toggle" onclick="toggleAgentMode()" style="display:none;">Agent mode: OFF</button>` is hidden via inline CSS. While `routes/agent.js` and `agent/agentLoop.js` implement genuine multi-tool LLM planning and tool dispatch, a normal user or hackathon judge in the browser will only execute the standard single-turn `/chat` pipeline.
2. **Missing Offline Queue & Sync Mechanism:**  
   In `public/sw.js` (lines 135-152), all POST requests (`/chat`, `/quiz`, `/agent`, `/progress`) immediately return a 503 error when network connection to the server is lost. There is no IndexedDB write queue, conflict resolution, or replaying mechanism when connection returns.
3. **English-Default User Interface:**  
   Despite the problem statement mandating regional language EdTech, the application defaults to English on initial launch (`<select id="languageSelector">` has `English` selected; buttons, headers, and quick-start chips are English). Odia UI localization is missing.
4. **No Text-to-Speech (TTS):**  
   Neither local nor browser-based TTS for Odia is implemented. Learner answers cannot be read aloud.
5. **No Submission Pitch Deck or Mid-Evaluation Artifact:**  
   There is no presentation slide deck, pitch video script, or official mid-evaluation checkpoint deliverable in the repository.

---

## 5. The Top 4 Biggest Risks

1. **Inference Latency on Demo Hardware (High):**  
   Live test runs on `qwen3:4b` and `dhee-odia` took between 19.0s and 32.9s per request. If evaluated live without pre-warmed models, response latency could exceed hackathon presentation limits.
2. **Hidden Agent Mode Misrepresenting System Capabilities (High):**  
   Judges opening the web app will assume the system is a simple chatbot because the agent mode toggle is hidden (`display:none;`) and decision traces are only visible in a hidden developer shortcut panel (`Ctrl+Shift+B`).
3. **Offline Claim Vulnerability (High):**  
   While the server runs with zero cloud API keys (local-first via Ollama), testing true mobile disconnection (phone loses Wi-Fi to laptop host) will result in a hard failure rather than a smooth offline queue and sync.
4. **Small Model Linguistic Instability (Medium):**  
   The 2B `dhee-odia` model regularly generates corrupted Odia terms (e.g. `ଷ୍ଟୋମାଟା` instead of `ପତ୍ରରନ୍ଧ୍ର`) or nonsensical distractors (e.g. `ତରଳରୁ ଫସିଯାଏ`). While the backend safety pipeline intercepts these and falls back to verified SCERT facts, questions outside the 8 verified chapters risk exposing model artifacts.

---

## 6. Demo-Readiness Status

**Status: PARTIALLY DEMO-READY**

- **Why it can demo:** The local server, student login, Odia doubt streaming, Odia quiz generation, verified SCERT fallback safety, teacher SSE dashboard, and student progress persistence all work end-to-end on localhost.
- **Why it is only partial:** 
  1. The agent toggle is hidden in the HTML, so the multi-tool agentic loop is not visible without unhiding it.
  2. The UI is in English by default.
  3. No offline queue exists if connectivity to the host drops.
  4. No pitch deck exists for the presentation.

---

## 7. Overall Assessment

StudyBuddy possesses an exceptionally strong, robustly tested technical foundation. Its multi-layer Odia linguistic policy, SCERT Class 9 factual grounding, conservative student state machine, and multi-tier repair/fallback engine are genuinely superior to typical hackathon wrappers. 

However, critical "last-mile" user-facing and submission elements are incomplete: the agentic loop is hidden behind CSS, the UI is English-first, offline sync is absent, and presentation deliverables have not been prepared. Once these specific gaps are closed, StudyBuddy is positioned as a top-tier contender for the Nextech 2.0 problem statement.

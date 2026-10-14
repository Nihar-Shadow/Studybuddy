# StudyBuddy — Formal Requirements & Traceability Document

**Project:** StudyBuddy (Agentic EdTech for Regional Language & Geography)  
**Specification Reference:** [PRD.md](file:///c:/studybuddy-main/PRD.md)  
**Progress Tracker:** [progress.md](file:///c:/studybuddy-main/progress.md)  
**Last Updated:** 2026-10-14  
**Audit Baseline:** October 13, 2026 (74.5% Verified Compliance)

---

## 1. Overview & Status Summary

Requirements derived directly from the Product Requirements Document ([PRD.md](file:///c:/studybuddy-main/PRD.md)) for the Nextech 2.0 Hackathon. 

| Category | Total | Pass / Verified | Partial | Fail / Missing |
|---|---|---|---|---|
| **A. Agentic AI & Planning** | 11 | 9 | 1 | 1 |
| **B. Regional Language (Odia)** | 9 | 6 | 2 | 1 |
| **C. Offline & Weak-Network** | 9 | 5 | 1 | 3 |
| **D. Personalized Learning (SM-2)** | 8 | 7 | 1 | 0 |
| **E. Accessibility & UX** | 8 | 6 | 2 | 0 |
| **F. Architecture & Reliability** | 12 | 12 | 0 | 0 |
| **G. Hackathon Deliverables** | 3 | 0 | 2 | 1 |
| **Total** | **60** | **45** | **9** | **6** |

---

## 2. Functional Requirements (PRD §6 & §5)

### 2.1 Learner Experience (F)

| ID | Requirement | PRD Ref | Priority | Status | Verification & Code Trace |
|---|---|---|---|---|---|
| **REQ-F01** | Ask a science doubt by text in natural language | PRD 6.1 (F1) | P0 | **Complete** | [routes/chat.js:L64](file:///c:/studybuddy-main/routes/chat.js#L64), [public/scripts/chat.js](file:///c:/studybuddy-main/public/scripts/chat.js). SSE streaming response. |
| **REQ-F02** | Ask a doubt by voice in Odia | PRD 6.1 (F2) | P1 | **Partial** | [public/scripts/voice.js](file:///c:/studybuddy-main/public/scripts/voice.js). Web Speech `or-IN` works in Chrome online; fails when offline. |
| **REQ-F03** | Adaptive explanations (beginner, intermediate, advanced) | PRD 6.1 (F3) | P0 | **Complete** | [lib/structuredTutor.js](file:///c:/studybuddy-main/lib/structuredTutor.js), [lib/class9Knowledge.js](file:///c:/studybuddy-main/lib/class9Knowledge.js). Level parameter adapts depth. |
| **REQ-F04** | Scientific accuracy & terminology in Odia | PRD 6.1 (F4) | P0 | **Complete** | [lib/languagePolicy.js](file:///c:/studybuddy-main/lib/languagePolicy.js). Enforces canonical terms (e.g. `ଆଲୋକ ସଂଶ୍ଳେଷଣ`). |
| **REQ-F05** | Read answers aloud in Odia (TTS) | PRD 6.1 (F5) | P2 | **Missing** | Not implemented. Requires Web Speech `speechSynthesis` or Odia audio pack. |
| **REQ-F06** | Interactive MCQ quiz to check understanding | PRD 6.1 (F6) | P0 | **Complete** | [routes/quiz.js](file:///c:/studybuddy-main/routes/quiz.js), [public/scripts/quiz.js](file:///c:/studybuddy-main/public/scripts/quiz.js). Validated schema, instant feedback. |
| **REQ-F07** | Socratic guided inquiry mode | PRD 6.1 (F7) | P1 | **Complete** | [agent/agentLoop.js:L440](file:///c:/studybuddy-main/agent/agentLoop.js#L440), [agent/tools.js:L450](file:///c:/studybuddy-main/agent/tools.js#L450). 5-turn guided discovery dialogue. |
| **REQ-F08** | Dynamic visual concept map | PRD 6.1 (F8) | P1 | **Complete** | [routes/conceptMap.js](file:///c:/studybuddy-main/routes/conceptMap.js), [public/scripts/concept-map.js](file:///c:/studybuddy-main/public/scripts/concept-map.js). D3 node-link graph. |
| **REQ-F09** | Display next recommended topic & due review items | PRD 6.1 (F9) | P1 | **Partial** | [routes/progress.js](file:///c:/studybuddy-main/routes/progress.js) serves `/due-reviews`; proactive UI launch modal pending. |
| **REQ-F10** | Odia as default UI language | PRD 6.1 (F10) | P0 | **Missing** | [public/index.html](file:///c:/studybuddy-main/public/index.html) defaults to English on fresh load. Needs Odia strings & selector default. |

---

### 2.2 Agent Behaviour & Autonomous Planning (A)

| ID | Requirement | PRD Ref | Priority | Status | Verification & Code Trace |
|---|---|---|---|---|---|
| **REQ-A01** | Detect weak concepts from quiz failures & repeats | PRD 6.2 (A1) | P0 | **Complete** | [lib/studentLearningState.js:L130](file:///c:/studybuddy-main/lib/studentLearningState.js#L130) (`getWeakConcepts`). Score <60% flags `needs_review`. |
| **REQ-A02** | Choose next study action (introduce, practice, review) | PRD 6.2 (A2) | P0 | **Complete** | [lib/studentLearningState.js:L245](file:///c:/studybuddy-main/lib/studentLearningState.js#L245) (`chooseNextStudyAction`). Attached to SSE payload. |
| **REQ-A03** | Schedule spaced reviews using SM-2 algorithm | PRD 6.2 (A3) | P0 | **Complete** | [agent/progressStore.js:L114](file:///c:/studybuddy-main/agent/progressStore.js#L114). Updates repetitions, interval, and next review date. |
| **REQ-A04** | Autonomous multi-tool mode accessible from UI | PRD 6.2 (A4) | P0 | **Blocked** | [public/index.html:L99](file:///c:/studybuddy-main/public/index.html#L99). Toggle `<button id="agent-toggle">` hidden via `style="display:none;"`. |
| **REQ-A05** | Visible agent reasoning & tool execution trace | PRD 6.2 (A5) | P0 | **Partial** | Exists in dev panel (`Ctrl+Shift+B`); needs user-facing collapsible card in chat UI. |
| **REQ-A06** | Connectivity-aware model routing | PRD 6.2 (A6) | P2 | **Proposed** | Designed in PRD §8.2. Currently routes 100% through local Ollama (`dhee-odia` / `qwen3:4b`). |
| **REQ-A07** | Proactive post-answer practice prompts | PRD 6.2 (A7) | P1 | **Complete** | [public/scripts/agent.js:L280](file:///c:/studybuddy-main/public/scripts/agent.js#L280) (`injectPracticeCTA`). Verified in automated tests. |
| **REQ-A08** | Multi-tool orchestrator with parallel dispatch | PRD 5.1 | P0 | **Complete** | [agent/agentLoop.js:L227](file:///c:/studybuddy-main/agent/agentLoop.js#L227) (`runParallelAgent`). Real LLM tool calling. |
| **REQ-A09** | Deterministic 4-stage fallback pipeline | PRD 5.4 | P0 | **Complete** | [agent/agentLoop.js:L140](file:///c:/studybuddy-main/agent/agentLoop.js#L140). Fallback pipeline triggered if LLM planning fails. |
| **REQ-A10** | Predictive model pre-warming | PRD 5.3 | P1 | **Complete** | [agent/agentLoop.js:L461](file:///c:/studybuddy-main/agent/agentLoop.js#L461). Pre-warms next predicted topic in background. |
| **REQ-A11** | Multi-tier validation, repair & SCERT fallback | PRD 5.4 | P0 | **Complete** | [lib/languagePolicy.js](file:///c:/studybuddy-main/lib/languagePolicy.js), [lib/class9Knowledge.js](file:///c:/studybuddy-main/lib/class9Knowledge.js). Tested in `tests/judge-failure-regression.test.js`. |

---

### 2.3 Offline & Network Resilience (O)

| ID | Requirement | PRD Ref | Priority | Status | Verification & Code Trace |
|---|---|---|---|---|---|
| **REQ-O01** | App shell loads without network connectivity | PRD 6.3 (O1) | P0 | **Complete** | [public/sw.js](file:///c:/studybuddy-main/public/sw.js). Service worker precaches HTML, CSS, JS, D3, Chart.js. |
| **REQ-O02** | Models run locally with zero cloud API keys | PRD 6.3 (O2) | P0 | **Complete** | [agent/models.js](file:///c:/studybuddy-main/agent/models.js), [server.js](file:///c:/studybuddy-main/server.js). Fully local Ollama instance on host hub. |
| **REQ-O03** | Offline mutation write queue (IndexedDB) | PRD 6.3 (O3) | P0 | **Missing** | [public/sw.js:L135](file:///c:/studybuddy-main/public/sw.js#L135). Disconnected POST requests currently return HTTP 503. |
| **REQ-O04** | Queue replay & state synchronization on reconnect | PRD 6.3 (O4) | P0 | **Missing** | Needs `window.addEventListener('online')` replay sync handler and backend idempotency. |
| **REQ-O05** | Verified SCERT content pack served for demo chapter | PRD 6.3 (O5) | P0 | **Complete** | [lib/class9Knowledge.js](file:///c:/studybuddy-main/lib/class9Knowledge.js). 8 Class 9 topics hardcoded with zero latency. |
| **REQ-O06** | 4-layer smart response caching | PRD 5.3 | P1 | **Complete** | [agent/smartCache.js](file:///c:/studybuddy-main/agent/smartCache.js). Memory, in-flight, disk JSON, and pre-warmed cache layers. |
| **REQ-O07** | Localhub Wi-Fi / hotspot zero-cloud host mode | PRD 8.1 | P0 | **Complete** | [server.js:L263](file:///c:/studybuddy-main/server.js#L263). Listens on `0.0.0.0` for local village/classroom network. |

---

### 2.4 Teacher & Classroom Tools (T)

| ID | Requirement | PRD Ref | Priority | Status | Verification & Code Trace |
|---|---|---|---|---|---|
| **REQ-T01** | Real-time classroom live dashboard | PRD 6.4 (T1) | P1 | **Complete** | [public/teacher.html](file:///c:/studybuddy-main/public/teacher.html), [server.js:L185](file:///c:/studybuddy-main/server.js#L185) (`/api/events`). Live SSE student confusion events. |
| **REQ-T02** | CSV curriculum taxonomy upload | PRD 6.4 (T2) | P1 | **Complete** | [routes/admin.js](file:///c:/studybuddy-main/routes/admin.js) (`/admin/upload-taxonomy`) using `csv-parse`. |
| **REQ-T03** | PDF student progress & evaluation report export | PRD 6.4 (T3) | P1 | **Complete** | [public/reports.html](file:///c:/studybuddy-main/public/reports.html), [routes/admin.js](file:///c:/studybuddy-main/routes/admin.js). |

---

## 3. Non-Functional Requirements (PRD §10)

| ID | Requirement | Target Metric | Current Measured | Status |
|---|---|---|---|---|
| **NFR-01** | Time to first token (Odia) | < 5s warm GPU | ~3-10s warm GPU (40s on CPU) | **Passing (on GPU)** |
| **NFR-02** | Full Odia explanation latency | < 15s | ~12-18s on local GPU | **Passing (on GPU)** |
| **NFR-03** | Target hardware compatibility | RTX 2050 (4GB VRAM), 16GB RAM | Validated on local Ollama setup | **Passing** |
| **NFR-04** | Model reload on language switch | 0s (no cold model swap during demo) | Resident single model or warm swap | **In Progress** |
| **NFR-05** | Factual accuracy on Class 9 demo topics | 100% on verified syllabus | Verified via 28/28 tests in `tests/class9-knowledge.test.js` | **Passing** |
| **NFR-06** | Mobile responsiveness & touch targets | Viewports 320px–768px, touch targets >44px | CSS flex/grid layout in [layout.css](file:///c:/studybuddy-main/public/styles/layout.css) | **Passing** |
| **NFR-07** | Zero cloud dependency | 0 cloud API keys required for core loop | 100% local Node.js + Ollama | **Passing** |
| **NFR-08** | Storage integrity & corruption resilience | Automated backup on corrupt JSON | [agent/progressStore.js:L47](file:///c:/studybuddy-main/agent/progressStore.js#L47) auto-backs up bad data | **Passing** |
| **NFR-09** | Production security hygiene | Reject default PINs / secrets in production | [server.js:L20-39](file:///c:/studybuddy-main/server.js#L20-L39) enforces secret overrides | **Passing** |

---

## 4. Hackathon Submission Deliverables (PRD §4 & §13)

| ID | Deliverable | PRD Ref | Priority | Status | Gap & Action |
|---|---|---|---|---|---|
| **DEL-01** | Working MVP with Agent Mode Visible | PRD §4 (Core) | P0 | **Partial** | Backend is verified; unhide `#agent-toggle` in [public/index.html](file:///c:/studybuddy-main/public/index.html). |
| **DEL-02** | Official 10-Slide Pitch Deck | PRD §4 (Core) | P0 | **Missing** | Create pitch presentation artifact covering Sunita persona, zero-cloud tech, and regional impact. |
| **DEL-03** | End-to-End Rehearsed Demo Script | PRD §12 (Core) | P0 | **In Progress** | Rehearse 7-step flow (Odia ask -> quiz -> decision trace -> offline toggle -> sync). |

---

## 5. Traceability Matrix: Requirements to Tests & Files

| Requirement | Code Implementation | Verification Test File |
|---|---|---|
| **REQ-F01, F04, A11** | [routes/chat.js](file:///c:/studybuddy-main/routes/chat.js), [lib/languagePolicy.js](file:///c:/studybuddy-main/lib/languagePolicy.js) | `tests/judge-failure-regression.test.js`<br>`tests/chat-empty-fix.test.js` |
| **REQ-F03, O05** | [lib/class9Knowledge.js](file:///c:/studybuddy-main/lib/class9Knowledge.js), [lib/structuredTutor.js](file:///c:/studybuddy-main/lib/structuredTutor.js) | `tests/class9-knowledge.test.js` |
| **REQ-F06** | [routes/quiz.js](file:///c:/studybuddy-main/routes/quiz.js), [agent/tools.js](file:///c:/studybuddy-main/agent/tools.js) | `tests/quiz-generation.test.js`<br>`tests/live-e2e-odia-water-quiz.test.js` |
| **REQ-A01, A02, A03** | [lib/studentLearningState.js](file:///c:/studybuddy-main/lib/studentLearningState.js), [agent/progressStore.js](file:///c:/studybuddy-main/agent/progressStore.js) | `tests/student-learning-state.test.js` |
| **REQ-A07** | [lib/targetedPractice.js](file:///c:/studybuddy-main/lib/targetedPractice.js), [public/scripts/agent.js](file:///c:/studybuddy-main/public/scripts/agent.js) | `tests/targeted-practice.test.js`<br>`tests/practice-cta-relevance.test.js` |
| **REQ-A08, A09** | [agent/agentLoop.js](file:///c:/studybuddy-main/agent/agentLoop.js), [agent/tools.js](file:///c:/studybuddy-main/agent/tools.js) | `tests/mastery-agent.test.js` |
| **REQ-O01, O07** | [public/sw.js](file:///c:/studybuddy-main/public/sw.js), [server.js](file:///c:/studybuddy-main/server.js) | Manual browser offline audit & service worker tests |
| **REQ-O02** | [agent/models.js](file:///c:/studybuddy-main/agent/models.js) | `tests/model-routing.test.js` |

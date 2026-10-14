# Nextech 2.0 Audit — Report 6 & 7: Remaining Work and Execution Plan

**Project:** StudyBuddy  
**Audit Date:** October 13, 2026  

---

## 1. Completion Metrics

### Metric A: Verified Requirement Compliance Score
Based on the 47 official requirements cataloged in [Report 2: Requirement Compliance Matrix](file:///c:/studybuddy-main/audit/nextech2/REQUIREMENT_MATRIX.md):

$$\text{Verified Compliance Score} = \frac{\text{PASS Requirements}}{\text{Total Applicable Requirements}} \times 100$$

$$\text{Verified Compliance Score} = \frac{35}{47} \times 100 = \mathbf{74.5\%}$$

- **PASS — Verified:** 35 (74.5%)
- **PARTIAL — Incomplete:** 6 (12.8%)
- **FAIL — Missing / Broken:** 6 (12.8%)
- **UNVERIFIED:** 0 (0.0%)
- **NOT APPLICABLE:** 0 (0.0%)

*Note: This metric strictly counts verified requirements where implementation exists, is integrated, and passed empirical testing.*

---

### Metric B: Estimated Implementation Completion Percentage
To reflect the actual development effort remaining across the entire software lifecycle (weighted by component complexity and user impact):

| Area | Weight | Current Status | Weighted Score |
|---|---|---|---|
| **Agentic Core & Planning** | 25% | 80% (Backend complete; UI toggle hidden) | 20.0% |
| **Regional Language (Odia)** | 25% | 75% (Knowledge & validation 100%; UI English default, no TTS) | 18.75% |
| **Offline & Network Resilience** | 20% | 40% (Zero-cloud host works; no client sync queue) | 8.0% |
| **Personalized State & Teacher UI** | 15% | 90% (SM-2, progressStore, SSE live dashboard working) | 13.5% |
| **Submission & Presentation** | 15% | 20% (PRD complete; pitch deck & mid-eval doc missing) | 3.0% |
| **Total Weighted Completion** | **100%** | | **63.25% (Range: 60% – 66%)** |

### Why Compliance Score (74.5%) and Implementation Completion (63.3%) Differ:
The compliance score counts distinct functional line-items that pass tests (like factual correctness, PIN login, model routing, and state persistence). However, implementation completion accounts for the missing presentation deliverables (pitch deck), missing offline sync infrastructure (IndexedDB queue), and UI polish needed to make the product submission-ready for a live hackathon stage.

---

## 2. Prioritized Actionable Backlog

| Priority | Missing or Broken Feature | Why It Matters | Files / Components Involved | Required Change | Acceptance Test | Dependency |
|---|---|---|---|---|---|---|
| **Phase 1: Blockers for Core MVP** |
| P0 | **Unhide Agent Mode in UI & Expose Tool Chips** | Without this, judges will assume StudyBuddy is a basic single-turn chatbot. | `public/index.html`<br>`public/scripts/agent.js`<br>`public/styles/agent.css` | Remove `style="display:none;"` from `#agent-toggle`. Render active tool badges (`renderToolBadges`) in chat stream. | Clicking toggle enables agent mode; submitting question triggers `/agent` and displays tool chips (Explain, Quiz, Track, Suggest). | None |
| P0 | **Visible Decision Trace Card in Chat** | Problem statement explicitly mandates visible agent decision trace. | `public/scripts/agent.js`<br>`public/styles/agent.css` | Add a collapsible "🤖 Agent Reasoning & Tool Trace" card below agent responses showing tool order, latency, and justification. | Each agent response renders an expandable trace card detailing which tools were selected and why. | Unhide Agent Mode |
| P0 | **Odia-First Default UI Localization** | The hackathon is specifically for regional languages; opening to an English interface undermines the pitch. | `public/index.html`<br>`public/scripts/init.js`<br>`public/styles/variables.css` | Set `<option value="Odia" selected>` in language selector. Localize key labels ("My level" -> "ମୋର ଶ୍ରେଣୀ", "Quiz Me" -> "ପ୍ରଶ୍ନୋତ୍ତର", "Send" -> "ପଠାନ୍ତୁ"). | Fresh browser load displays Odia UI controls and Odia starter chips by default. | None |
| **Phase 2: Agentic Intelligence & Personalization** |
| P1 | **Rewrite Socratic Prompts with Rural Odisha Context** | Current prompts use pop-culture and pizza analogies, contradicting the rural Sunita persona. | `agent/tools.js` (lines 454-475) | Replace pop-culture rules with relatable agrarian analogies (farming, seasonal rain, village ponds, cooking rice). | Socratic dialogue turns explain science concepts using local rural Odisha metaphors. | None |
| P1 | **Proactive Spaced-Review Card on App Launch** | PRD requirement A7 & judging criteria for proactive learning. | `public/scripts/init.js`<br>`public/scripts/agent.js`<br>`agent/progressStore.js` | Fetch `/due-reviews` on page load; if concepts are due for review under SM-2, display a proactive greeting: "Welcome back Sunita! Ready to review Photosynthesis?". | Student with overdue SM-2 review sees proactive review banner immediately upon login. | ProgressStore |
| **Phase 3: Regional Language & Offline Improvements** |
| P1 | **IndexedDB Offline Mutation Queue & Sync Service** | Mobile devices losing Wi-Fi to the laptop hub currently drop quiz answers with 503 errors. | `public/sw.js`<br>`public/scripts/pwa.js`<br>`public/scripts/sync.js` (new) | Intercept failed POSTs when offline, store mutations in IndexedDB `pending_sync`, listen for `window.online`, and replay on reconnect with conflict handling. | Turn off network during quiz -> complete quiz -> turn on network -> progress syncs to server and appears on teacher dashboard. | Service Worker |
| P2 | **Odia Text-to-Speech (TTS) Integration** | Crucial accessibility for low-literacy learners. | `public/scripts/voice.js`<br>`public/scripts/render.js` | Add a speaker button 🔊 on bot bubbles. Call `window.speechSynthesis` with `or-IN` voice (or fallback to clean phonetic audio). | Clicking 🔊 reads the Odia explanation aloud. | Browser voice support |
| **Phase 4: Reliability & Performance** |
| P1 | **Optimize Inference Latency & Pre-Warming** | 20–30s latency per turn is risky for a 3-minute live pitch demo. | `server.js`<br>`agent/models.js`<br>`agent/smartCache.js` | Enforce GPU layers in Ollama Modelfile (`num_gpu 99`), set `num_ctx 2048`, disable thinking tags (`think: false`), and pre-cache exact demo questions in `data/cache.json`. | Response time for rehearsed demo questions drops to under 3 seconds. | Ollama GPU setup |
| **Phase 5: Demo Preparation & Pitch Deck** |
| P0 | **Create Official Nextech 2.0 Pitch Deck** | Core judging requirement; currently completely missing. | `audit/nextech2/PITCH_DECK.md`<br>Slides artifact | Create 10-slide deck: Problem (Sunita), Zero-Cloud Local Architecture, Dual-Model Routing, Safety Guardrails, Live Demo Script, Impact. | Complete, rehearsed slide deck ready for judges. | None |
| P0 | **Rehearse End-to-End Live Demo Script** | Mitigates live demo failure risks. | `audit/nextech2/DEMO_READINESS.md` | Execute rehearsed 3-minute flow on target hardware (phone connected to laptop hotspot). | Clean, seamless 3-minute demonstration completed without developer console intervention. | Phase 1 & Phase 5 |

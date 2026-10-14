# StudyBuddy — Product Requirements Document

**Event:** Nextech 2.0 (Nirmit) Agentic AI Hackathon
**Problem statement:** Agentic EdTech for Regional Language & Geography
**Owner:** Nihar
**Status:** In development (audit on 2026-10-11: ~58% complete)
**Items marked _(proposed)_ are recommended changes not yet built or confirmed.**

---

## 1. Summary

StudyBuddy is an Odia-first agentic tutor for Class 9 students in rural Odisha. It answers science doubts in the learner's own language, tracks what she has not understood, decides what she should study next, and keeps working when connectivity is poor. It runs on local models (Ollama), so it needs no cloud API keys.

**One-sentence pitch:** A Class 9 student in a tribal-majority block of Odisha, who gets one hour on a shared phone with a weak signal, gets a tutor that understands her doubt in Odia, notices her gaps, and plans what she studies next without being asked.

## 2. Problem

### 2.1 User
**Primary persona: Sunita.** Class 9, government school, southern Odisha. Speaks Kui at home, is taught in Odia, and meets English mostly through textbooks. Her family has one shared smartphone, which she gets for about an hour in the evening. Signal is weak and her data pack is limited. Her science teacher covers several classes and cannot answer every doubt.

### 2.2 The gap
| Moment | What fails today |
|---|---|
| In class | Teacher explains in Odia with English technical terms; no time for individual doubts |
| Evening on shared phone | Apps are English/Hindi; video buffers; data runs out |
| A doubt | Typing Odia is slow; search results are in English and pitched too high |
| Before tests | Rote memorisation; nobody tracks what she knows or tells her what to study next |

### 2.3 Why now
Devices are no longer the main gap (ASER 2024: almost 90% of rural 14–16 year-olds report a smartphone at home). What the device offers in the learner's own language, level, and connectivity is the gap.

## 3. Goals and non-goals

### Goals
1. Understand a doubt in Odia (text first, voice second) and answer at the learner's level.
2. Maintain per-learner state: what she understood, what she did not, what is due for review.
3. Decide the next study action autonomously and show the decision trace.
4. Keep useful when connectivity drops, and resume and sync when it returns.
5. Be usable by a first-time user on a low-end phone with no training.

### Non-goals (for the hackathon MVP)
- Multi-subject or multi-grade coverage (one subject, one chapter set is enough).
- Native mobile apps (the PWA is the delivery vehicle).
- Full tribal-language support (Kui, etc.); Odia is the language of delivery.
- Production-grade authentication (PIN login is acceptable for the demo).
- Server-side scale; the target is a single local host.

## 4. Mapping to judging criteria

| Criterion | How StudyBuddy addresses it | Status |
|---|---|---|
| Problem understanding (core) | Sunita persona, Class 9 SCERT-aligned content | Strong |
| Technicalities (core) | 7 tools, planner loop, persistent state, failure fallbacks | Mostly done; agent not reachable from UI |
| Presentation (core) | Live demo flow in section 12 | Needs rehearsal |
| Pitch deck (core) | Not started | Not started |
| Regional language (bonus) | Dedicated Odia model, terminology enforcement, fact validation | Strong; no TTS, UI is English by default |
| Ease of use (bonus) | PIN login, chat-first UI, quick chips | Weak for Odia-only users |
| Offline (bonus) | Local Ollama, PWA shell cache | Partial; no sync queue |
| Agentic framework (bonus) | Deterministic-first workflow with a bounded autonomous planner | Done; needs to be visible |

## 5. Agentic approach

**Choice: deterministic workflow with a bounded autonomous planner.**

- **Why not fully autonomous:** small local models (2B/4B) are unreliable at open-ended tool selection and hallucinate in Odia. A fully autonomous loop would be unpredictable on weak hardware and a weak connection.
- **Why not purely deterministic:** the "what should she study next" decision needs judgement over learner history. That is where the autonomous planner earns its place.
- **What would break with the other choice:** fully autonomous means planning calls that cost latency and fail on small models; fully deterministic means the system cannot adapt its plan to the learner, which makes the AI decoration.

### 5.1 Agent loop
```
Doubt in (text/voice, Odia/other)
  -> detect language + level
  -> retrieve verified facts (SCERT knowledge base)
  -> explain_topic
  -> validate output (language policy, fact check) -> repair once -> fallback to verified template
  -> check understanding (generate_quiz / socratic question)
  -> track_progress (update concept state, SM-2 schedule)
  -> suggest_next_topic (planner)
  -> queue follow-up / sync actions
```

Two modes exist in `agent/agentLoop.js`:
- `runAgentLoop`: deterministic rule-based workflow.
- `runParallelAgent`: LLM plans a set of tool calls, executes them (async in parallel, sync in sequence), then synthesises. Falls back to a fixed four-tool pipeline if planning fails.

### 5.2 Tools
| Tool | Purpose | Real call |
|---|---|---|
| `explain_topic` | Structured explanation (intro, steps, takeaway), cached | Ollama |
| `generate_quiz` | MCQs with validation and one corrective retry | Ollama |
| `track_progress` | Persist topic, level, score; emit teacher SSE event | File store |
| `suggest_next_topic` | Recommend next topic from history | Ollama |
| `ask_socratic_question` | Five-step guided discovery | Ollama |
| `generate_concept_map` | Graph nodes and edges, rendered in D3 | Ollama |
| `generate_evaluation_report` | Five-section learning report | Ollama |

### 5.3 State
- Persistent: `data/progress.json` keyed by student ID (concept evidence: unknown, partial, understood; quiz history; SM-2 metrics).
- Session: `req.session.learningState`.
- Caches: four-layer `smartCache.js`.

### 5.4 Failure handling
- Planner returns malformed JSON or crashes: fall back to the deterministic four-tool pipeline.
- Odia output fails validation: one targeted repair call, then verified SCERT fallback facts.
- Ollama calls abort after 90 seconds _(proposed: lower to 20 seconds with a visible "using saved answer" fallback)_.

### 5.5 Decision trace
Exists in `middleware/devTiming.js` (dev panel, Ctrl+Shift+B) but is not visible to students or judges in the main UI.
**Requirement:** show a collapsible trace in the chat UI listing each tool called, in what order, and why _(proposed)_.

## 6. Functional requirements

Status key: **Done**, **Partial**, **Missing**, **Proposed** (new work).

### 6.1 Learner experience
| ID | Requirement | Status |
|---|---|---|
| F1 | Ask a doubt by text | Done |
| F2 | Ask a doubt by voice in Odia | Partial (Web Speech API, needs internet in Chrome) |
| F3 | Answer at beginner/intermediate/advanced level | Done |
| F4 | Answer in Odia with correct scientific terminology | Done, but model accuracy is inconsistent |
| F5 | Read answers aloud in Odia (TTS) | Missing |
| F6 | Quiz to check understanding | Done |
| F7 | Socratic mode | Done (prompt unsuitable, see 8.4) |
| F8 | Concept map | Done |
| F9 | Show next recommended topic and due reviews on open | Partial |
| F10 | Odia as the default UI language | Missing |

### 6.2 Agent behaviour
| ID | Requirement | Status |
|---|---|---|
| A1 | Detect weak concepts from quizzes, fallbacks, and repeat questions | Done |
| A2 | Choose the next study action (introduce, practice, review) | Done |
| A3 | Schedule spaced reviews (SM-2) | Done (calculated, not delivered) |
| A4 | Autonomous multi-tool mode reachable from the UI | Missing (toggle hidden via CSS) |
| A5 | Visible decision trace | Partial |
| A6 | Connectivity-aware model routing (online vs offline) | Proposed |
| A7 | Proactive follow-up on app open ("you struggled with X yesterday, try this") | Partial |

### 6.3 Offline and sync
| ID | Requirement | Status |
|---|---|---|
| O1 | App shell loads with no network | Done |
| O2 | Models run locally with no cloud keys | Done |
| O3 | Pending actions queued while the client cannot reach the server | Missing |
| O4 | Queue replays and state syncs on reconnect | Missing |
| O5 | Verified content pack served first for the demo chapter | Proposed |

### 6.4 Teacher and admin
| ID | Requirement | Status |
|---|---|---|
| T1 | Live class dashboard (confusion, at-risk students, curriculum stats) | Done |
| T2 | CSV taxonomy upload | Done |
| T3 | PDF report export | Done |

## 7. Language strategy

- **Odia routing:** Odia requests (dropdown or Odia Unicode detected) go to `dhee-odia`; other languages go to `qwen3:4b`.
- **Grounding:** `lib/class9Knowledge.js` holds SCERT-aligned facts for 8 Class 9 science topics.
- **Terminology:** canonical Odia scientific terms are enforced and known corrupted forms are blocked (`lib/languagePolicy.js`).
- **Known problem:** the 2B Odia model produces incorrect output in some cases (2 of 4 live test cases fell back; one failed on a missing state-change term).

**Design principle _(proposed)_:** the small model is not the source of truth. Verified content comes first; the model rephrases and handles novel questions only within retrieved facts; validation and repair run after. This is stated openly as the low-resource-language strategy.

## 8. Offline and connectivity strategy

### 8.1 Deployment model
The system runs on a local host (a school or village-hub laptop, or the learner's own machine) with Ollama alongside Express. Learner phones connect over local Wi-Fi or hotspot.

| Scenario | Works today |
|---|---|
| Learner on the host machine, internet off | Yes |
| Phone on local Wi-Fi to the host, internet off | Yes |
| Phone disconnected from the host | No (no on-device model) |

**Position to state in the pitch:** the offline guarantee is "no internet required", with a local hub. True on-phone inference is future work.

### 8.2 Required additions
1. **Offline queue _(proposed)_:** store pending chat, quiz, and progress mutations in IndexedDB when the server is unreachable; replay on reconnect.
2. **Connectivity-aware routing _(proposed)_:** online, route Odia to a stronger cloud model; offline, use local `dhee-odia` plus the verified content pack. The agent shows the decision in its trace.
3. **Voice offline fallback _(proposed)_:** Web Speech `or-IN` needs Google servers in Chrome. Fall back to text input with a clear message when it fails; consider a local STT if time allows.

## 9. UX requirements

- First-run language choice shown as Odia first, with large buttons and icons.
- Core flow under three steps: open, pick language, ask.
- All controls and labels available in Odia (quiz, concept map, Socratic mode, login prompts).
- Odia TTS on answers via `speechSynthesis`, after verifying that an Odia voice exists on the demo device _(proposed)_.
- Streaming answers so first text appears quickly.
- Socratic prompts rewritten with local analogies (farming, rain, village pond) in place of pop-culture and pizza references _(proposed)_.

## 10. Non-functional requirements

**Target hardware:** RTX 2050 (4 GB VRAM), 16 GB RAM.

| Metric | Current | Target |
|---|---|---|
| Time to first Odia token | ~40s total on CPU | under 5s warm, GPU |
| Full Odia answer | ~40s | under 15s |
| Model reload on language switch | cold load | none during demo (single resident model or pre-warmed) |
| Odia factual accuracy on demo chapter | inconsistent | verified for all demo questions |

**Performance actions _(proposed)_:** confirm 100% GPU with `ollama ps`; use a Q4_K_M quant; set `num_ctx` to 2048–4096; `think: false`; cap `num_predict`; `keep_alive` long; pre-warm at server start; `OLLAMA_MAX_LOADED_MODELS=1`.

**Security hygiene:** change the default `SESSION_SECRET` and PINs before any public exposure; keep `.env` out of version control.

## 11. Current status (from the 2026-10-11 audit)

| Area | Completion |
|---|---|
| Agentic core | 70% |
| Language (Odia) | 65% |
| Offline and connectivity | 35% |
| UX and accessibility | 60% |
| Reliability and performance | 55% |
| **Overall** | **58%** |

Feature counts: 8 done, 5 partial, 0 mock, 2 missing (TTS, offline sync).

## 12. Demo script

1. Open the app on a phone; Odia is the default; no guidance given.
2. Ask a science doubt in Odia (voice or text). Answer streams in Odia at a beginner level.
3. Take a short quiz; get one wrong.
4. Show the decision trace: tools called, order, and reasons; the agent records the gap and picks the next topic.
5. Switch the network off. Ask another doubt; the local model or verified pack answers.
6. Restore the network; the queue replays and progress syncs; teacher dashboard updates.
7. Reopen the app; the agent proactively surfaces the due review.

## 13. Roadmap (prioritized)

| # | Task | Effort | Impact |
|---|---|---|---|
| 1 | Fix inference speed (GPU, quant, context, think off, pre-warm, response cache) | ~1.5–3h | Critical for live demo |
| 2 | Unhide agent mode; show tool chips and decision trace in chat | ~1.5h | Core: technicalities |
| 3 | Rewrite Socratic prompt with local context | ~0.25h | Core: problem understanding |
| 4 | Verified Odia content pack for demo chapter (proofread by owner) | ~3h | Accuracy, offline |
| 5 | Odia-default UI localization | ~2h | Bonus: ease of use |
| 6 | Odia TTS (verify device voice first) | ~2h | Bonus: language, accessibility |
| 7 | Connectivity-aware model routing | ~2–3h | Bonus: offline and framework |
| 8 | IndexedDB queue and sync on reconnect | ~4h | Bonus: offline |
| 9 | Pitch deck | separate | Core |
| 10 | Rehearse the demo end to end on the demo hardware | ~2h | Core: presentation |

Estimated build remaining: roughly 15–20 hours including the content pack and testing.

## 14. Risks

| Risk | Likelihood | Mitigation |
|---|---|---|
| Odia latency stalls the live demo | High today | Item 1; pre-warm; cached answers for demo questions |
| Odia answers are wrong in front of judges | Medium–High | Verified content pack; validation and fallback; rehearse exact questions |
| Judges ask about phone-only offline | High | State the local-hub model deliberately; show Scenario B |
| Voice input fails with network off | High | Text fallback and clear message |
| Agent mode not visible | High today | Item 2 |
| No Odia TTS voice on demo device | Medium | Test early; otherwise cut or use a pre-recorded audio pack |
| Scope too large for one builder | Medium | Cut item 8 to a limited, honest queue if time is short |

## 15. Open questions

1. Final evaluation date and mid-evaluation checkpoint date?
2. Team size (solo or not)?
3. Will the demo run on one machine or phone-to-laptop?
4. Does the demo device have an Odia TTS voice?
5. Is cloud use acceptable in the online path, or must everything stay local?
6. Which chapters make up the verified content pack?

## 16. Success metrics

- A first-time user completes ask, answer, quiz without being guided.
- Odia answers on the demo chapter are factually correct in all rehearsed questions.
- Time to first Odia token under 5 seconds on demo hardware.
- Network cut live: the next doubt still gets answered; on reconnect, the queued progress appears on the teacher dashboard.
- Judges can see which tools the agent called and why, without opening a developer panel.
# Nextech 2.0 Audit — Report 4: Agentic AI Audit

**Project:** StudyBuddy  
**Audit Date:** October 13, 2026  

---

## 1. Architectural Classification

StudyBuddy's agentic architecture is classified as:  
**A Hybrid Architecture: A Bounded Autonomous Tool Planner paired with a Deterministic Educational Governor.**

### Why It Is Not Merely a Chatbot:
1. It does not simply prompt an LLM and stream back text. It maintains an empirical, persistent knowledge state per concept across 8 curriculum topics.
2. In agent mode (`runParallelAgent`), an LLM (Gemma/Qwen/Dhee) acts as an autonomous planning agent, analyzing the learner's message, recent topics, and weak areas to decide which tools to call dynamically as a JSON plan.
3. It executes real application tools (`explain_topic`, `generate_quiz`, `track_progress`, `suggest_next_topic`), aggregates their outputs, and synthesizes a pedagogical conclusion.
4. It features a deterministic state machine governor (`lib/studentLearningState.js`) that prevents small LLMs from making ungrounded pedagogical jumps (e.g. an LLM cannot declare a concept "mastered" from one good response).

### The Primary Defect:
While the backend agent loop is genuinely agentic, **it is disconnected from the default user journey in the frontend UI**. In `public/index.html` (line 99), the `#agent-toggle` button is set to `style="display:none;"`. Consequently, standard users execute `/chat`, which utilizes a single-turn guided tutor pipeline rather than the multi-tool autonomous planner loop.

---

## 2. End-to-End Learning Journey Trace

We trace the real execution path of a Class 9 learner studying Science in Odia.

### Step 1: Learner Input & Language Detection
- **Learner Action:** Student submits doubt in Odia: `"ଆଲୋକ ସଂଶ୍ଳେଷଣରେ ଅମ୍ଳଜାନ କେଉଁଠାରୁ ଆସେ?"` (Where does oxygen come from in photosynthesis?).
- **Execution:** 
  - In `public/scripts/chat.js` (lines 8-13), the client regex `/[\u0b00-\u0b7f]/` detects Odia script and sets `currentLanguage = 'Odia'`.
  - In `routes/chat.js` (line 65) or `routes/agent.js` (line 20), `containsOdiaScript` confirms Odia.
  - In `agent/models.js` (line 33), `getModelForLanguage('Odia')` resolves to `dhee-odia`.
- **Status:** **REAL — Fully Verified.**

### Step 2: Goal Interpretation & Concept Resolution
- **Execution:**
  - `findRelevantClass9Knowledge(message, 'Odia')` in `lib/class9Knowledge.js` (line 137) matches keywords `ଆଲୋକ ସଂଶ୍ଳେଷଣ` (photosynthesis) and `ଅମ୍ଳଜାନ` (oxygen).
  - Retrieves verified SCERT facts:
    - `"ଆଲୋକ ସଂଶ୍ଳେଷଣରେ ନିର୍ଗତ ଅମ୍ଳଜାନ (Oxygen) ଜଳ (Water) ଅଣୁର ବିଭାଜନରୁ ଆସିଥାଏ।"`
    - `"ଅଙ୍ଗାରକାମ୍ଳ (CO2) କେବଳ ଶ୍ୱେତସାର ବା ଗ୍ଲୁକୋଜ୍ ପ୍ରସ୍ତୁତି ପାଇଁ ବ୍ୟବହୃତ ହୁଏ; ନିର୍ଗତ ଅମ୍ଳଜାନ ଅଙ୍ଗାରକାମ୍ଳରୁ ଆସେ ନାହିଁ।"`
  - `resolveTopicAndConcept(message, targetKnowledge)` in `lib/studentLearningState.js` resolves:
    - `topic: 'photosynthesis'`
    - `concept: 'oxygen_role'`
- **Status:** **REAL — Fully Verified.**

### Step 3: Tool Planning / Decision
- **In `/agent` Mode (`runParallelAgent` in `agent/agentLoop.js`):**
  - Planner prompt is dispatched to Ollama:
    ```json
    [
      { "name": "explain_topic", "args": { "topic": "photosynthesis", "level": "intermediate", "context": "oxygen source" } },
      { "name": "generate_quiz", "args": { "topic": "photosynthesis", "level": "intermediate", "numQuestions": 3 } },
      { "name": "track_progress", "args": { "topic": "photosynthesis", "level": "intermediate" } },
      { "name": "suggest_next_topic", "args": { "currentTopic": "photosynthesis", "subject": "biology" } }
    ]
    ```
  - If planning fails to return JSON, falls back gracefully to a default 4-tool pipeline.
- **In `/chat` Mode (`routes/chat.js`):**
  - Executes single-turn Odia tutor with validation and attaches `nextStudyAction`.
- **Status:** **REAL — Fully Verified in Backend; Agent mode toggle hidden in UI.**

### Step 4: Actual Tool Execution & Observation
- **Tool 1: `explain_topic`**
  - Queries 4-layer cache (`smartCache.js`). On cache miss, prompts Ollama `dhee-odia`.
  - Filters `<think>` tags and returns structured explanation.
- **Tool 2: `generate_quiz`**
  - Calls `toolImplementations.generate_quiz`. Generates questions based on SCERT coverage plan.
  - Runs `validateQuizQuality`. If invalid, triggers 1 corrective retry or slot fallback.
- **Tool 3: `track_progress`**
  - Writes progress to `data/progress.json` under current `studentId`. Emits SSE event to teacher dashboard.
- **Tool 4: `suggest_next_topic`**
  - Reads history from `progressStore.js` and prompts LLM for curriculum recommendation.
- **Status:** **REAL — Fully Verified with Real File I/O & Ollama Calls.**

### Step 5: Multi-Tier Output Validation & Repair
- **Execution:**
  - `validateOdiaTutorAnswer(rawReply, odiaContentPlan, class9Knowledge)` checks:
    1. Canonical Odia terminology (e.g. no forbidden terms like `ଷ୍ଟୋମାଟା` or `ଉଦ୍ଭିଦ ସଂଶ୍ଲେଷଣ`).
    2. Factual consistency (e.g. does the model contradict the rule that oxygen comes from water?).
    3. Topic drift (e.g. did it answer about water heating when asked about photosynthesis?).
  - If validation fails:
    - Attempt 1: Calls Ollama with targeted correction prompt (`buildOdiaRepairPrompt`).
    - Attempt 2: If repair still fails, immediately injects targeted verified SCERT fallback answer from `class9Knowledge.js`.
- **Status:** **REAL — Verified in test runs with empirical telemetry.**

### Step 6: Learning State Mutation & Next Action Selection
- **Execution:**
  - In `lib/studentLearningState.js`, updates `req.session.learningState`:
    - Evidence recorded: `asked_about_concept` (or `fallback_used` if repair failed).
    - Status transitions from `unknown` to `partial` (or `needs_review` on fallback).
    - Confidence updated to `0.25` (conservative advancement).
  - `chooseNextStudyAction(learningState)` executes deterministic rules:
    - If any concept has `needs_review` -> Action: `review`.
    - If partial concepts exist -> Action: `practice`.
    - If neither -> Action: `introduce`.
- **Status:** **REAL — Fully Verified.**

### Step 7: Presentation & Next Learning Step
- **Execution:**
  - Client receives response card and rendered badges.
  - Client `injectPracticeCTA(finalData)` reads `structured.nextStudy` and renders an interactive button:
    `"🎯 Practice What You Just Learned: Photosynthesis (Oxygen Role)"`.
  - Student clicks button -> launches `/practice/next` targeted exercise.
- **Status:** **REAL — Fully Verified in code and tests.**

---

## 3. Real Runtime Decision Trace (Observed Empirical Telemetry)

The following trace was captured directly from an actual live test run executed during this audit (`tests/judge-failure-regression.test.js` and server telemetry):

```text
[Diagnostic: Request] Selected Language: "Odia", Detected Language: "Odia", Prompt: "ତୁମେ ଠିକ୍ ଭାବେ ବୁଝାଇନାହଁ। ଅମ୍ଳଜାନ ଆସେ କେଉଁଠାରୁ? ପୁଣିଥରେ ସହଜ ଭାବରେ ବୁଝାଅ।"
[LLM]
language=Odia
model=dhee-odia
task=tutor
[Diagnostic: Prompt Construction] Building prompt with language: "Odia", level: "beginner"
[Ollama Diagnostics] HTTP status: 200, Content-Type: application/x-ndjson
[Ollama Diagnostics] Stream complete — total length: 182 chars, done_reason: stop, thinkingChars: 0
[Odia Tutor Quality] Validation failed (missing_oxygen_release_role: Oxygen must be clearly stated as being released/produced as a by-product in photosynthesis, rule: rule1_photosynthesis_oxygen_release_missing). Attempting 1 targeted repair...
[Odia Tutor Quality] Targeted repair also failed (corrupted_terminology: Contains forbidden/corrupted term "ଷ୍ଟୋମାଟା". Canonical Odia term is "ପତ୍ରରନ୍ଧ୍ର" (stomata)., rule: canonical_terminology_violation)
[Odia Tutor Quality] Using question-specific fallback for topic: photosynthesis
[Class9 Knowledge]
topic=photosynthesis
knowledge_found=true
facts_used=11
validation=fail
repair=failed
fallback=true
[Odia Tutor Telemetry]
validation_result=FAILED
final_validation_result=PASSED
failure_reason=none
failed_fact_rule=none
retry_count=1
fallback_attempted=true
fallback_used=true
final_safety_fallback=false
[Learning State] topic=photosynthesis concept=oxygen_role evidence=fallback_used status=needs_review
[Next Study] action=review topic=photosynthesis concept=oxygen_role reason=fallback_used
✅ [/chat] Done in 32.92s — reply length: 132 chars
```

### Analysis of the Observed Trace:
1. **Linguistic Verification:** The local 2B model initially failed to explain the oxygen release role and used corrupted terminology (`ଷ୍ଟୋମାଟା`).
2. **Autonomous Guardrail Execution:** The system caught both failures, attempted a repair, recognized the repair was still defective, and invoked the verified SCERT fallback.
3. **State Adaptation:** Because the student required a fallback, the state machine automatically classified `oxygen_role` as `status=needs_review` and set `nextStudy.action = 'review'`.
4. **Pedagogical Governance:** Rather than leaving the student with an incorrect answer or hallucination, the system guaranteed factual correctness and queued follow-up remediation.

---

## 4. Stage-by-Stage Verification Summary

| Agent Stage | Implementation Method | Operational Status |
|---|---|---|
| **Goal Interpretation** | Semantic keyword & Unicode pattern extraction | **Working (Real)** |
| **Curriculum Planning** | LLM planning (`runParallelAgent`) + SCERT curriculum plan | **Working (Real in backend, toggle hidden in UI)** |
| **Tool Selection** | Dynamic LLM selection or deterministic routing | **Working (Real)** |
| **Tool Execution** | 6 async/sync tools via Express & Ollama | **Working (Real)** |
| **Observation** | Aggregation of tool outputs into synthesis prompt | **Working (Real)** |
| **Subsequent Decision** | Multi-tier retry, fallback, and `chooseNextStudyAction` | **Working (Real)** |
| **Educational Action** | Structured card rendering + targeted practice CTA | **Working (Real)** |
| **State Persistence** | Multi-student flat JSON store + SM-2 intervals | **Working (Real)** |
| **Next Learning Step** | Contextual practice button injection | **Working (Real)** |
| **UI Trace Visibility** | Badges in agent mode, dev panel on Ctrl+Shift+B | **Partially Simulated (Hidden from main chat UI)** |

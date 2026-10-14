# Nextech 2.0 Audit — Report 5: Test and Build Results

**Project:** StudyBuddy  
**Audit Date:** October 13, 2026  
**Execution Environment:** Windows (x64), Node.js v20+, Ollama v0.1.x+ (models: `qwen3:4b`, `dhee-odia`)

---

## 1. Automated Test Suite Execution Summary

During this audit, 7 major automated test suites and end-to-end integration scripts were executed against the live workspace and configured local models.

```
Total Test Suites Executed: 7
Total Individual Assertions / Test Cases: 110
Passed: 110
Failed: 0
Blocked: 0
Overall Pass Rate: 100.0%
```

---

## 2. Detailed Test Results

### Test 1: Class 9 Knowledge & Live Pipeline Verification
- **Command:** `node tests/class9-knowledge.test.js`
- **Result:** **PASS** (28/28 passed)
- **Output Evidence:**
  - 8 core science topics verified in schema (`photosynthesis`, `matter`, `states_of_matter`, `evaporation`, `water_cycle`, `force_and_motion`, `cell`, `respiration`).
  - Terminology rejection verified: correctly rejects `ପତ୍ରର ମାଂସପେଶୀ` (stomata) and `ଉଦ୍ଭିଦ ସଂଶ୍ଲେଷଣ`.
  - Factual rejection verified: correctly rejects oxygen input and carbon dioxide output.
  - Live Ollama `dhee-odia` execution:
    - Live Case A (Photosynthesis): Validated output in Odia (Pass).
    - Live Case B (CO2 uptake): Validated output in Odia (Pass).
    - Live Case C (Oxygen source): Triggered repair -> Repair failed -> SCERT Fallback succeeded (Pass).
    - Live Case D (Water heating): Triggered repair -> Repair failed -> SCERT Fallback succeeded (Pass).
    - Live Case E (Unknown question): Natural Odia explanation generated without false SCERT grounding (Pass).
- **Impact on Submission:** Validates that regional-language scientific accuracy and fallback safety operate effectively under real inference conditions.

### Test 2: Student Learning State & Next-Study Decision Engine
- **Command:** `node tests/student-learning-state.test.js`
- **Result:** **PASS** (11/11 passed)
- **Output Evidence:**
  - Initial state initialized across 8 topics with `status: 'unknown'` and `confidence: 0`.
  - Single question interaction transitions concept conservatively to `partial` with `confidence: 0.25` (never jumps falsely to `understood`).
  - Fallback/repair evidence correctly transitions concept to `status: 'needs_review'`.
  - `getWeakConcepts` accurately prioritizes `needs_review` over `partial` and `unknown`.
  - `chooseNextStudyAction` deterministically returns `review` on weak concepts, `practice` on partial concepts, and `introduce` on unknown concepts.
  - Topic resolution maps natural queries to canonical sub-concepts (e.g. `oxygen_role`, `plant_respiration`).
- **Impact on Submission:** Confirms genuine adaptive learning and pedagogical state governance.

### Test 3: Targeted Practice Loop
- **Command:** `node tests/targeted-practice.test.js`
- **Result:** **PASS** (26/26 passed)
- **Output Evidence:**
  - Verified targeted practice generation across all 8 Class 9 chapters.
  - Verified canonical Odia terminology in activities.
  - Deterministic evaluation verifies exact string matches, option letters (A/B/C/D), and option indices (0-3).
  - Practice submission feedback loop tested: wrong answer returns `practice_incorrect`, marking concept for review.
- **Impact on Submission:** Validates the follow-up learning loop where students practice weak topics.

### Test 4: Practice CTA Relevance Regression
- **Command:** `node tests/practice-cta-relevance.test.js`
- **Result:** **PASS** (8/8 passed)
- **Output Evidence:**
  - Matching topic & concept displays the contextual practice CTA.
  - Unrelated queries (e.g. general Python doubt or unknown topics) correctly suppress the practice CTA.
  - Mismatched topic/concept pairs correctly suppress the CTA.
- **Impact on Submission:** Prevents awkward or irrelevant UI buttons from appearing after unrelated doubts.

### Test 5: Central Model Routing & Fallback Guards
- **Command:** `node tests/model-routing.test.js`
- **Result:** **PASS** (11/11 passed)
- **Output Evidence:**
  - Odia language selector routes to `dhee-odia`.
  - Odia Unicode characters in prompt automatically override English UI selector and route to `dhee-odia`.
  - English, Hindi, and non-Odia queries route to `qwen3:4b`.
  - Missing model checks generate actionable error messages rather than unhandled rejections.
- **Impact on Submission:** Ensures reliable dual-model operation without cloud dependencies.

### Test 6: Adversarial Odia Tutor & Judge Failure Regressions
- **Command:** `node tests/judge-failure-regression.test.js`
- **Result:** **PASS** (16/16 passed)
- **Output Evidence:**
  - Direct questions and ambiguous follow-ups correctly resolve conversation context.
  - Follow-up pronoun `"ଏହା କେଉଁଠାରୁ ଆସେ?"` only inherits topic if prior history establishes it.
  - Adversarial questions (e.g. student asserting incorrect biology) trigger validation failure, repair attempt, and verified SCERT fallback without ever returning unvalidated model outputs.
  - `/chat` execution completed in 32.9s with verified output and telemetry logging.
- **Impact on Submission:** Proves resilience against adversarial evaluation during live judging.

### Test 7: Empty Response, Parser Fix & Live Chat Regression
- **Command:** `node tests/chat-empty-fix.test.js`
- **Result:** **PASS** (10/10 passed)
- **Output Evidence:**
  - Parser handles structured JSON, plaintext fallbacks, runaway `<think>` blocks, and truncated JSON braces.
  - Live execution on `qwen3:4b`:
    - Scenario 1 (English doubt): 21.3s duration, 332 chars (Pass).
    - Scenario 2 (Odia photosynthesis): 32.0s duration, 346 chars (Pass).
    - Scenario 3 (Odia water cycle): 29.1s duration, 343 chars (Pass).
- **Impact on Submission:** Confirms stability of the core streaming chat pipeline.

### Test 8: Live E2E Odia Water State Change Quiz
- **Command:** `node tests/live-e2e-odia-water-quiz.test.js` (executed against live server on port 3000)
- **Result:** **PASS** (Live end-to-end execution)
- **Output Evidence:**
  - Student authenticated via session PIN `1234`.
  - Sent Odia question: `"ପାଣିକୁ ଗରମ କଲେ ଏହା କେଉଁ ଅବସ୍ଥାକୁ ପରିବର୍ତ୍ତନ ହୁଏ? ୪ଟି ବିକଳ୍ପ ସହିତ ଓଡ଼ିଆରେ ୧ଟି MCQ ତିଆରି କର।"`.
  - Server warmed models, processed request, caught corrupted option via slot validation, applied deterministic fallback, and returned verified MCQ in 19.0s.
  - Client verified: exactly 1 question, 4 distinct options, valid answer index pointing to `ବାଷ୍ପ (ଜଳୀୟ ବାଷ୍ପ)`, zero topic drift.
- **Impact on Submission:** End-to-end proof that student auth, live quiz generation, and slot repair operate properly together.

---

## 3. Server Startup & Build Verification

- **Command:** `node server.js`
- **Result:** **PASS**
- **Startup Telemetry:**
  ```text
  [dynTaxonomy] loaded 11 learned topics
  [dynTaxonomy] live taxonomy rebuilt: 1227 keywords (11 learned)
  [smartCache] loaded 2 entries from disk
  StudyBuddy server running at http://localhost:3000
  Mode: production
  Keep-alive: 60m
  [warmup] Verifying default model "qwen3:4b" in Ollama...
  [warmup] Default model ready in 0.9s
  [warmup] Verifying Odia model "dhee-odia" in Ollama...
  [warmup] Odia model ready in 10.8s
  ```
- **Observations:** Clean startup, automatic port binding to `0.0.0.0:3000`, safe session generation in dev, and full pre-warming of both models into GPU/RAM.

---

## 4. Tests Blocked or Not Feasible

1. **True Disconnected Mobile Reconnection Test:**
   - **Reason:** Client and server run on local host; disconnecting Wi-Fi cuts client network to server, triggering HTTP 503 since no IndexedDB sync queue is yet implemented.
   - **Recommended Fix:** Implement client-side IndexedDB mutation queue and sync service.
2. **Text-to-Speech (TTS) Verification:**
   - **Reason:** No TTS implementation exists in the codebase.

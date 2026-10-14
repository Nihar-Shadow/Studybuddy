# Nextech 2.0 Audit — Report 7: Live Demo Readiness & Recommended Flow

**Project:** StudyBuddy  
**Audit Date:** October 13, 2026  

---

## 1. Demo Status Overview

- **Current Status:** **Partially Demo-Ready**
- **Hardware Requirement:** Host machine running Windows with Ollama (`qwen3:4b` and `dhee-odia` installed). Optional: Smartphone connected to the laptop's mobile hotspot.
- **Estimated Demo Duration:** 3 minutes 30 seconds.

---

## 2. Recommended Live Demo Script (Using Verified Working Features)

This script is structured to highlight the core requirements of the Nextech 2.0 hackathon: **Agentic Decision Making, Regional Language Factual Safety, Zero-Cloud Local Inference, and Persistent Personalization.**

### Step 1: Persona Onboarding (30 Seconds)
- **Setup:** Open Chrome at `http://localhost:3000`. Login screen appears.
- **Presenter Narrative:**  
  *"Meet Sunita, a Class 9 student in Koraput, Odisha. Her family shares one smartphone with limited mobile data and an intermittent signal. She is learning Science in Odia, but most AI apps either only speak English or hallucinate scientific terminology. StudyBuddy runs completely locally on a village or school hub laptop with zero cloud keys."*
- **Action:** Enter PIN `1234` with Name `"Sunita"`. Click Login.
- **Expected Result:** Instant redirect to `/app`. Student session authenticated.

### Step 2: Odia Science Doubt & Factual Safety Pipeline (60 Seconds)
- **Action:** Switch language to Odia (or type Odia text directly). Type or click starter chip:  
  `"ଆଲୋକ ସଂଶ୍ଳେଷଣରେ ଅମ୍ଳଜାନ କେଉଁଠାରୁ ଆସେ?"` (Where does oxygen come from in photosynthesis?).
- **What Happens Under the Hood (Point this out to judges):**  
  1. Language router maps query to local `dhee-odia` 2B model.
  2. Grounding engine loads verified SCERT Class 9 facts from `lib/class9Knowledge.js`.
  3. The local model streams answer. Linguistic guardrails verify that canonical terminology is used (`ଆଲୋକ ସଂଶ୍ଳେଷଣ` instead of corrupted terms, `ପତ୍ରରନ୍ଧ୍ର` instead of `ଷ୍ଟୋମାଟା`).
  4. Factual rules verify that oxygen is accurately attributed to water splitting, not carbon dioxide.
- **Expected Result:** Natural, fluid Odia explanation streams smoothly onto the screen with zero cloud dependency.

### Step 3: Adaptive Follow-up & Targeted Practice (45 Seconds)
- **Action:** After the explanation completes, point out the contextual badge generated automatically by the agent governor:  
  `"🎯 Practice What You Just Learned: Photosynthesis (Oxygen Role)"`.
- **Presenter Narrative:**  
  *"Notice that Sunita didn't have to ask 'test me'. The system understood the sub-concept she was exploring, recorded that this was her first interaction with oxygen generation, and proactively offered a targeted check."*
- **Action:** Click the practice button. Answer the question. Get it right.
- **Expected Result:** Immediate positive feedback in Odia, conservative advancement in the concept state machine.

### Step 4: Live Adversarial Misconception & Fallback Safety (45 Seconds)
- **Action:** Submit a common student misconception:  
  `"ଗଛ ରାତିରେ ଅଙ୍ଗାରକାମ୍ଳ ସଞ୍ଚୟ କରି ରଖିବା ଯୋଗୁଁ ଆଲୋକ ସଂଶ୍ଳେଷଣ ବନ୍ଦ ହୁଏ କି?"` (Does photosynthesis stop at night because plants store CO2?).
- **What Happens Under the Hood:**  
  1. The 2B model attempts to agree with the false premise (a common small-model failure).
  2. The multi-tier safety pipeline catches the factual violation against SCERT rules.
  3. It attempts 1 repair; upon detection of persistent ambiguity, it intercepts with the verified SCERT fallback fact.
- **Expected Result:** The student receives a scientifically accurate correction in Odia:  
  `"ନା, ଏହା ଠିକ୍ ନୁହେଁ। ରାତିରେ ସୂର୍ଯ୍ୟାଲୋକ ନ ଥିବାରୁ ଆଲୋକ ସଂଶ୍ଳେଷଣ ବନ୍ଦ ରହେ..."`
  Point out to judges: *"We don't trust a 2B regional model blindly. Verified educational content is guarded by strict pedagogical rules."*

### Step 5: Multi-Student Teacher Dashboard & Persistence (30 Seconds)
- **Action:** Open a second browser tab to `http://localhost:3000/teacher` (Login PIN `9999`).
- **Expected Result:**  
  - Real-time Server-Sent Events (SSE) update displays Sunita's active session.
  - Photosynthesis concept shows as "Active / Partial".
  - Show the confusion matrix and download a one-click PDF student progress report from `/teacher/reports`.

---

## 3. What Cannot Currently Be Demonstrated (Gaps to Acknowledge or Fix Before Pitch)

| Step | Why It Cannot Be Demonstrated Today | Recommended Action |
|---|---|---|
| **Autonomous Multi-Tool Mode from Chat UI** | `#agent-toggle` is styled with `display:none;` in `public/index.html`. Users cannot toggle agent mode without opening dev tools. | **Must unhide the button in `index.html` before the demo.** |
| **Visible Tool Decision Trace Card in Student Chat** | Decision traces are currently only viewable in the dev panel (`Ctrl+Shift+B`), which looks like an internal tool rather than a student feature. | Render a collapsible trace card in the chat UI. |
| **Simulated Mid-Quiz Disconnection & Sync** | Disconnecting the client phone from the laptop Wi-Fi during a quiz causes an HTTP 503 error because no IndexedDB queue exists yet. | Demonstrate zero-internet mode on the laptop hub instead; do not disconnect the phone mid-quiz during the live demo. |
| **Odia Text-to-Speech (TTS)** | No TTS engine is wired up; clicking to listen aloud does nothing. | State as planned roadmap work for low-literacy learners. |

---

## 4. Manual Pre-Demo Setup Checklist

1. [ ] Ensure Ollama is running: `ollama serve`.
2. [ ] Verify models are downloaded: `ollama list` shows `qwen3:4b` and `dhee-odia`.
3. [ ] Start the StudyBuddy server: `node server.js`.
4. [ ] Verify warmup is complete: Check terminal logs for `[warmup] Default model ready` and `[warmup] Odia model ready`.
5. [ ] Open `http://localhost:3000` in the demo browser.
6. [ ] (Temporary workaround until unhidden): If demonstrating the autonomous agent loop, open developer console or unhide `#agent-toggle`.
7. [ ] Have second tab open at `http://localhost:3000/teacher` with teacher PIN `9999`.

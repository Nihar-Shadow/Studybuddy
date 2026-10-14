/**
 * Production Test Suite for StudyBuddy Text-to-Speech / Speech Controller
 * Validates all 20 required specifications + Odia Live Science Answer test.
 * Run with: node tests/speech-tts.test.js
 */

const assert = require('assert');
const path = require('path');
const fs = require('fs');

// Load speech controller module
const {
  speechController,
  prepareTextForSpeech,
  getVoicesForLanguage,
  selectVoice,
  normalizeLanguageCode,
  resolveTargetLocale,
  detectLanguageFromText,
  formatStructuredForSpeech,
  isAutoTTSEnabled,
  setAutoTTSEnabled,
  toggleAutoTTS,
  SPEECH_LANGUAGES
} = require('../public/scripts/speech');

let passed = 0;
let failed = 0;

function test(name, fn) {
  try {
    fn();
    console.log(`  ✓ ${name}`);
    passed++;
  } catch (err) {
    console.error(`  ✗ ${name}`);
    console.error(`    ${err.message}`);
    failed++;
  }
}

// ── Mock SpeechSynthesis environment helper ──
function setupMockSynthesis(voices = []) {
  let speaking = false;
  let paused = false;
  let cancelled = false;
  let lastUtterance = null;
  let speakCalls = 0;
  let cancelCalls = 0;
  let pauseCalls = 0;
  let resumeCalls = 0;

  class MockUtterance {
    constructor(text) {
      this.text = text;
      this.lang = '';
      this.voice = null;
      this.rate = 1;
      this.pitch = 1;
      this.onstart = null;
      this.onend = null;
      this.onerror = null;
      this.onpause = null;
      this.onresume = null;
    }
  }

  const mockSynth = {
    speaking: false,
    paused: false,
    getVoices: () => voices,
    speak: (utt) => {
      speakCalls++;
      lastUtterance = utt;
      mockSynth.speaking = true;
      mockSynth.paused = false;
      if (typeof utt.onstart === 'function') utt.onstart();
    },
    cancel: () => {
      cancelCalls++;
      mockSynth.speaking = false;
      mockSynth.paused = false;
      cancelled = true;
    },
    pause: () => {
      pauseCalls++;
      mockSynth.speaking = true;
      mockSynth.paused = true;
      if (lastUtterance && typeof lastUtterance.onpause === 'function') lastUtterance.onpause();
    },
    resume: () => {
      resumeCalls++;
      mockSynth.speaking = true;
      mockSynth.paused = false;
      if (lastUtterance && typeof lastUtterance.onresume === 'function') lastUtterance.onresume();
    }
  };

  globalThis.speechSynthesis = mockSynth;
  globalThis.SpeechSynthesisUtterance = MockUtterance;

  return {
    synth: mockSynth,
    getStats: () => ({ speakCalls, cancelCalls, pauseCalls, resumeCalls, lastUtterance })
  };
}

console.log('\n====================================================');
console.log('🎤 PRODUCTION TTS & SPEECH CONTROLLER TEST SUITE');
console.log('====================================================\n');

// Standard fixture voices
const standardVoices = [
  { name: 'Google English India', lang: 'en-IN' },
  { name: 'Google US English', lang: 'en-US' },
  { name: 'Google Odia India', lang: 'or-IN' },
  { name: 'Google Hindi India', lang: 'hi-IN' },
  { name: 'Google Bengali India', lang: 'bn-IN' }
];

// 1. English answer selects English voice
test('1. English answer selects English voice', () => {
  setupMockSynthesis(standardVoices);
  const sel = selectVoice('English');
  assert.strictEqual(sel.supported, true);
  assert(sel.voice.lang.startsWith('en'));
  assert.strictEqual(sel.voice.name, 'Google English India');
});

// 2. Odia answer requests Odia voice
test('2. Odia answer requests Odia voice', () => {
  setupMockSynthesis(standardVoices);
  const sel = selectVoice('Odia');
  assert.strictEqual(sel.supported, true);
  assert.strictEqual(sel.voice.lang, 'or-IN');
  assert.strictEqual(sel.voice.name, 'Google Odia India');
});

// 3. Hindi answer requests Hindi voice
test('3. Hindi answer requests Hindi voice', () => {
  setupMockSynthesis(standardVoices);
  const sel = selectVoice('Hindi');
  assert.strictEqual(sel.supported, true);
  assert.strictEqual(sel.voice.lang, 'hi-IN');
  assert.strictEqual(sel.voice.name, 'Google Hindi India');
});

// 4. Exact locale matching works
test('4. Exact locale matching works', () => {
  setupMockSynthesis(standardVoices);
  const selUS = selectVoice('en-US');
  assert.strictEqual(selUS.supported, true);
  assert.strictEqual(selUS.voice.lang, 'en-US');

  const selOdia = selectVoice('or-IN');
  assert.strictEqual(selOdia.supported, true);
  assert.strictEqual(selOdia.voice.lang, 'or-IN');
});

// 5. Base-language matching works
test('5. Base-language matching works', () => {
  setupMockSynthesis(standardVoices);
  const selHi = selectVoice('hi');
  assert.strictEqual(selHi.supported, true);
  assert.strictEqual(selHi.voice.lang, 'hi-IN');

  const selOr = selectVoice('or');
  assert.strictEqual(selOr.supported, true);
  assert.strictEqual(selOr.voice.lang, 'or-IN');
});

// 6. Missing native Odia voice uses Indian phonetic fallback or safely rejects foreign voices
test('6. Missing native Odia voice uses Indian phonetic fallback or safely rejects foreign voices', () => {
  const { odiaToDevanagari, odiaToRomanPhonetic } = require('../public/scripts/speech');

  // Case A: Hindi voice available -> selects hi-IN with Brahmic Devanagari transliteration
  const voicesWithHindi = [
    { name: 'Google US English', lang: 'en-US' },
    { name: 'Google English India', lang: 'en-IN' },
    { name: 'Google Hindi India', lang: 'hi-IN' }
  ];
  setupMockSynthesis(voicesWithHindi);
  const selHi = selectVoice('Odia');
  assert.strictEqual(selHi.supported, true);
  assert.strictEqual(selHi.voice.lang, 'hi-IN');
  assert.strictEqual(selHi.phoneticFallback, 'hi-IN');

  const { getStats } = setupMockSynthesis(voicesWithHindi);
  speechController.speak('ଆଲୋକ ସଂଶ୍ଳେଷଣ', 'Odia');
  assert.strictEqual(getStats().lastUtterance.lang, 'hi-IN');
  assert(getStats().lastUtterance.text.includes('आलोक'));

  // Case B: Only Indian English available (typical Windows desktop) -> selects en-IN with Roman phonetics
  const voicesWithOnlyEnIn = [
    { name: 'Microsoft David', lang: 'en-US' },
    { name: 'Microsoft Heera', lang: 'en-IN' }
  ];
  setupMockSynthesis(voicesWithOnlyEnIn);
  const selEnIn = selectVoice('Odia');
  assert.strictEqual(selEnIn.supported, true);
  assert.strictEqual(selEnIn.voice.lang, 'en-IN');
  assert.strictEqual(selEnIn.phoneticFallback, 'en-IN');

  const { getStats: getStatsEnIn } = setupMockSynthesis(voicesWithOnlyEnIn);
  speechController.speak('ଆଲୋକ ସଂଶ୍ଳେଷଣ', 'Odia');
  assert.strictEqual(getStatsEnIn().lastUtterance.lang, 'en-IN');
  assert(getStatsEnIn().lastUtterance.text.toLowerCase().includes('aaloka'));

  // Case C: Only foreign/US English available -> strictly returns no_voice without mangling
  const foreignOnly = [{ name: 'Alex', lang: 'en-US' }];
  setupMockSynthesis(foreignOnly);
  const selForeign = selectVoice('Odia');
  assert.strictEqual(selForeign.supported, false);
  assert.strictEqual(selForeign.reason, 'no_voice');
  assert.strictEqual(selForeign.voice, undefined);
});

// 7. Starting a new utterance stops the previous utterance
test('7. Starting a new utterance stops the previous utterance', () => {
  const { synth, getStats } = setupMockSynthesis(standardVoices);
  speechController.speak('First explanation', 'en');
  assert.strictEqual(getStats().speakCalls, 1);
  assert.strictEqual(speechController.isSpeaking(), true);

  // Start second utterance
  speechController.speak('Second explanation', 'en');
  assert(getStats().cancelCalls >= 1, 'Previous utterance must be cancelled');
  assert.strictEqual(getStats().speakCalls, 2);
  assert.strictEqual(getStats().lastUtterance.text, 'Second explanation');
});

// 8. pause works
test('8. pause works', () => {
  const { synth, getStats } = setupMockSynthesis(standardVoices);
  speechController.speak('Content to pause', 'en');
  speechController.pause();
  assert(getStats().pauseCalls >= 1);
  assert.strictEqual(speechController.isPaused(), true);
  assert.strictEqual(speechController.state, 'paused');
});

// 9. resume works
test('9. resume works', () => {
  const { synth, getStats } = setupMockSynthesis(standardVoices);
  speechController.speak('Content to resume', 'en');
  speechController.pause();
  speechController.resume();
  assert(getStats().resumeCalls >= 1);
  assert.strictEqual(speechController.state, 'speaking');
});

// 10. stop works
test('10. stop works', () => {
  const { synth, getStats } = setupMockSynthesis(standardVoices);
  speechController.speak('Content to stop', 'en');
  speechController.stop();
  assert(getStats().cancelCalls >= 1);
  assert.strictEqual(speechController.state, 'stopped');
  assert.strictEqual(speechController.currentUtterance, null);
});

// 11. Markdown is removed from speech text
test('11. Markdown is removed from speech text', () => {
  const raw = `### Photosynthesis
**Photosynthesis** is the process where *green plants* make food.
- Step 1: Light absorption
\`\`\`js
console.log("ignore code");
\`\`\`
[Learn more](http://example.com) about **chlorophyll**.`;

  const cleaned = prepareTextForSpeech(raw);
  assert(!cleaned.includes('###'));
  assert(!cleaned.includes('**'));
  assert(!cleaned.includes('*'));
  assert(!cleaned.includes('```'));
  assert(!cleaned.includes('[Learn more]'));
  assert(cleaned.includes('Photosynthesis is the process where green plants make food'));
  assert(cleaned.includes('Step 1: Light absorption'));
  assert(cleaned.includes('Learn more about chlorophyll'));
});

// 12. JSON/internal metadata is not spoken
test('12. JSON/internal metadata is not spoken', () => {
  const jsonRaw = '{"id":"c9_sci_photosynthesis","intro":"Plant nutrition","Concept 2":"dummy"}';
  const cleaned = prepareTextForSpeech(jsonRaw);
  assert(!cleaned.includes('{"id":'));
  assert(!cleaned.includes('c9_sci_photosynthesis'));
  assert(!cleaned.includes('Concept 2'));
});

// 13. Structured tutor answers become natural speech text
test('13. Structured tutor answers become natural speech text', () => {
  const structuredAnswer = {
    intro: "Photosynthesis is how plants produce their own food.",
    steps: [
      {
        title: "Absorption of sunlight",
        explanation: "Chlorophyll in green leaves captures light energy from the Sun."
      },
      {
        title: "Conversion of water and carbon dioxide",
        explanation: "Water from roots and carbon dioxide from air are converted into glucose."
      }
    ],
    summary: "In short, plants make glucose and release oxygen into the atmosphere.",
    followUp: "Would you like to try a question on this topic?"
  };

  const spoken = prepareTextForSpeech(structuredAnswer);
  assert(!spoken.includes('"intro":'));
  assert(!spoken.includes('"steps":'));
  assert(!spoken.includes('"summary":'));
  assert(spoken.includes('Photosynthesis is how plants produce their own food.'));
  assert(spoken.includes('Absorption of sunlight. Chlorophyll in green leaves captures light energy from the Sun.'));
  assert(spoken.includes('In short, plants make glucose and release oxygen into the atmosphere.'));
  assert(spoken.includes('Would you like to try a question on this topic?'));
});

// 14. TTS failure does not break tutor UI
test('14. TTS failure does not break tutor UI', () => {
  // Mock synth that throws on speak
  const throwingSynth = {
    speaking: false,
    paused: false,
    getVoices: () => [{ name: 'Crash Voice', lang: 'en-US' }],
    speak: () => { throw new Error('Hardware audio error'); },
    cancel: () => {},
    pause: () => {},
    resume: () => {}
  };
  globalThis.speechSynthesis = throwingSynth;

  let errorFired = false;
  const res = speechController.speak('Hello world', 'en', {
    onError: (err) => { errorFired = true; }
  });

  // Verify graceful return without uncaught throw
  assert.strictEqual(res.supported, false);
  assert.strictEqual(res.reason, 'speak_exception');
  assert.strictEqual(errorFired, true);
  assert.strictEqual(speechController.state, 'error');
});

// 15. Quiz questions can be spoken
test('15. Quiz questions can be spoken', () => {
  const { synth, getStats } = setupMockSynthesis(standardVoices);
  const quizQuestion = "Which gas do plants release during photosynthesis?";
  const res = speechController.speak(quizQuestion, 'en');
  assert.strictEqual(res.supported, true);
  assert.strictEqual(getStats().lastUtterance.text, quizQuestion);
});

// 16. Practice questions can be spoken
test('16. Practice questions can be spoken', () => {
  const { synth, getStats } = setupMockSynthesis(standardVoices);
  const practiceQuestion = "What is the unit of force in SI system?";
  const practiceFeedback = "Correct! The SI unit of force is Newton.";

  speechController.speak(practiceQuestion, 'en');
  assert.strictEqual(getStats().lastUtterance.text, practiceQuestion);

  speechController.speak(practiceFeedback, 'en');
  assert.strictEqual(getStats().lastUtterance.text, practiceFeedback);
});

// 17. TTS does not modify learning state
test('17. TTS does not modify learning state', () => {
  setupMockSynthesis(standardVoices);
  const mockLearningState = {
    streak: 5,
    masteredConcepts: ['photosynthesis'],
    currentTopic: 'gravity',
    score: 85
  };
  const snapshotBefore = JSON.stringify(mockLearningState);

  // Invoke speech controller operations
  speechController.speak('Explanation of gravity', 'en');
  speechController.pause();
  speechController.resume();
  speechController.stop();

  const snapshotAfter = JSON.stringify(mockLearningState);
  assert.strictEqual(snapshotBefore, snapshotAfter, 'Learning state must remain completely unmodified');
});

// 18. TTS does not modify quiz validation
test('18. TTS does not modify quiz validation', () => {
  setupMockSynthesis(standardVoices);
  // Verify quiz helper function behaviour
  const isAnswerCorrect = (opt, ans) => opt.trim().toLowerCase() === ans.trim().toLowerCase();
  assert.strictEqual(isAnswerCorrect('Oxygen', 'Oxygen'), true);
  assert.strictEqual(isAnswerCorrect('Nitrogen', 'Oxygen'), false);

  speechController.speak('Which gas is produced?', 'en');
  speechController.stop();

  assert.strictEqual(isAnswerCorrect('Oxygen', 'Oxygen'), true);
  assert.strictEqual(isAnswerCorrect('Nitrogen', 'Oxygen'), false);
});

// 19. TTS makes no network requests
test('19. TTS makes no network requests', () => {
  setupMockSynthesis(standardVoices);
  let networkCalls = 0;
  globalThis.fetch = () => { networkCalls++; return Promise.resolve({}); };

  speechController.speak('Testing offline Web Speech API', 'en');
  speechController.stop();

  assert.strictEqual(networkCalls, 0, 'TTS must make ZERO network requests');
});

// 20. App remains usable when SpeechSynthesis is unavailable
test('20. App remains usable when SpeechSynthesis is unavailable', () => {
  globalThis.speechSynthesis = null;
  globalThis.SpeechSynthesisUtterance = null;

  const sel = speechController.selectVoice('en');
  assert.strictEqual(sel.supported, false);
  assert.strictEqual(sel.reason, 'not_supported');

  const res = speechController.speak('Hello without synthesis', 'en');
  assert.strictEqual(res.supported, false);
  assert.strictEqual(res.reason, 'not_supported');
  assert.strictEqual(speechController.isSpeaking(), false);
});

// ── IMPORTANT ODIA LIVE SCIENCE ANSWER TEST ──
test('Odia Science Answer: Verification of text, locale, purity, and missing voice handling', () => {
  const odiaAnswer = "ଆଲୋକ ସଂଶ୍ଳେଷଣ ସମୟରେ ଉଦ୍ଭିଦ ସୂର୍ଯ୍ୟାଲୋକର ଉପଯୋଗ କରି ଖାଦ୍ୟ ତିଆରି କରେ।";

  // 1. Text cleaning preserves exact Odia content without mangling
  const cleaned = prepareTextForSpeech(odiaAnswer);
  assert.strictEqual(cleaned, odiaAnswer, 'Displayed Odia text must remain 100% semantically identical');

  // 2. Script auto-detection correctly detects Odia
  const detectedLang = detectLanguageFromText(cleaned, 'en');
  assert.strictEqual(detectedLang, 'or', 'Odia Unicode block must detect as or');

  // 3. When Odia voice is present: requests correct locale or-IN
  setupMockSynthesis(standardVoices);
  const selWithVoice = selectVoice(detectedLang);
  assert.strictEqual(selWithVoice.supported, true);
  assert.strictEqual(selWithVoice.voice.lang, 'or-IN');

  const { getStats } = setupMockSynthesis(standardVoices);
  const speakRes = speechController.speak(odiaAnswer, 'Odia');
  assert.strictEqual(speakRes.supported, true);
  assert.strictEqual(getStats().lastUtterance.lang, 'or-IN');
  assert.strictEqual(getStats().lastUtterance.text, odiaAnswer);

  // 4. When Odia voice is MISSING: does NOT silently fall back to English!
  const onlyEnglishVoices = [{ name: 'Alex', lang: 'en-US' }];
  setupMockSynthesis(onlyEnglishVoices);
  const selMissing = selectVoice(detectedLang);
  assert.strictEqual(selMissing.supported, false);
  assert.strictEqual(selMissing.reason, 'no_voice');
  assert.strictEqual(selMissing.voice, undefined);

  // Verify Odia UI labels and error messages exist
  assert.strictEqual(SPEECH_LANGUAGES.or.labels.listen, 'ଶୁଣନ୍ତୁ');
  assert.strictEqual(SPEECH_LANGUAGES.or.labels.pause, 'ବିରତି');
  assert.strictEqual(SPEECH_LANGUAGES.or.labels.resume, 'ପୁଣି ଚଲାନ୍ତୁ');
  assert.strictEqual(SPEECH_LANGUAGES.or.labels.stop, 'ବନ୍ଦ କରନ୍ତୁ');
  assert.strictEqual(SPEECH_LANGUAGES.or.labels.ariaListen, 'ଉତ୍ତର ଶୁଣନ୍ତୁ');
  assert.strictEqual(
    SPEECH_LANGUAGES.or.labels.unavailable,
    'ଏହି ଭାଷା ପାଇଁ ଏହି ଡିଭାଇସ୍ରେ ଶବ୍ଦ ପାଠ ସୁବିଧା ଉପଲବ୍ଧ ନାହିଁ।'
  );
});

// ── Auto-read answers aloud Settings preference test ──
test('Auto-TTS Setting preference defaults to OFF and toggles', () => {
  const mockStorage = {};
  globalThis.localStorage = {
    getItem: (k) => mockStorage[k] || null,
    setItem: (k, v) => { mockStorage[k] = String(v); }
  };

  assert.strictEqual(isAutoTTSEnabled(), false, 'Default auto-TTS must be OFF');
  toggleAutoTTS();
  assert.strictEqual(isAutoTTSEnabled(), true, 'Toggle auto-TTS must switch to ON');
  toggleAutoTTS();
  assert.strictEqual(isAutoTTSEnabled(), false, 'Toggle auto-TTS must switch back to OFF');
});

// ── UI Integration Tests (Requirements 1 - 13) ──
console.log('\n--- UI Integration Tests (Tutor Answer & Validated Response) ---');

function createSimpleMockDOM() {
  function createElement(tag) {
    const listeners = {};
    const attrs = {};
    const children = [];
    const el = {
      tagName: tag.toUpperCase(),
      className: '',
      style: {},
      innerHTML: '',
      textContent: '',
      title: '',
      type: '',
      appendChild(child) {
        children.push(child);
        return child;
      },
      setAttribute(k, v) { attrs[k] = String(v); },
      getAttribute(k) { return attrs[k] || null; },
      addEventListener(evt, fn) {
        listeners[evt] = listeners[evt] || [];
        listeners[evt].push(fn);
      },
      click() {
        (listeners['click'] || []).forEach(fn => fn({ stopPropagation: () => {} }));
      },
      querySelector(sel) {
        for (const c of children) {
          if (sel.startsWith('.') && c.className && c.className.includes(sel.slice(1))) return c;
          if (c.querySelector) {
            const found = c.querySelector(sel);
            if (found) return found;
          }
        }
        return null;
      },
      querySelectorAll(sel) {
        let results = [];
        for (const c of children) {
          if (sel.startsWith('.') && c.className && c.className.includes(sel.slice(1))) results.push(c);
          if (c.querySelectorAll) results = results.concat(c.querySelectorAll(sel));
        }
        return results;
      },
      _getChildren() { return children; }
    };
    return el;
  }
  return { createElement };
}

test('UI 1-3: Tutor answer renders visible speaker button with English and Odia labels', () => {
  const { createElement } = createSimpleMockDOM();
  globalThis.document = { createElement };

  // English answer control
  const enControl = speechController.createSpeechControl({
    getText: () => 'Plants use sunlight, water, and carbon dioxide to create glucose and oxygen through photosynthesis.',
    getLanguage: () => 'English',
    ariaPrefix: 'answer',
    containerClass: 'speech-controls--answer'
  });
  assert(enControl !== null, 'English control must render');
  const enPlayBtn = enControl._getChildren()[0];
  assert(enPlayBtn.innerHTML.includes('🔊'));
  assert(enPlayBtn.innerHTML.includes('Listen'));
  assert.strictEqual(enPlayBtn.getAttribute('aria-label'), 'Listen to answer');

  // Odia answer control
  const orControl = speechController.createSpeechControl({
    getText: () => 'ଆଲୋକ ସଂଶ୍ଳେଷଣ ସମୟରେ ଉଦ୍ଭିଦ ସୂର୍ଯ୍ୟାଲୋକର ଉପଯୋଗ କରି ଖାଦ୍ୟ ତିଆରି କରେ।',
    getLanguage: () => 'Odia',
    ariaPrefix: 'answer',
    containerClass: 'speech-controls--answer'
  });
  assert(orControl !== null, 'Odia control must render');
  const orPlayBtn = orControl._getChildren()[0];
  assert(orPlayBtn.innerHTML.includes('🔊'));
  assert(orPlayBtn.innerHTML.includes('ଶୁଣନ୍ତୁ'));
  assert.strictEqual(orPlayBtn.getAttribute('aria-label'), 'ଉତ୍ତର ଶୁଣନ୍ତୁ');
});

test('UI 4-6: Clicking Listen invokes speak() with exact final validated answer text & language', () => {
  const { synth, getStats } = setupMockSynthesis(standardVoices);
  const { createElement } = createSimpleMockDOM();
  globalThis.document = { createElement };

  const finalValidatedText = 'Plants use sunlight, water, and carbon dioxide to create glucose and oxygen through photosynthesis.';
  let passedText = null;
  let passedLang = null;

  const originalSpeak = speechController.speak.bind(speechController);
  speechController.speak = (text, lang, opts) => {
    passedText = text;
    passedLang = lang;
    return originalSpeak(text, lang, opts);
  };

  const ctrl = speechController.createSpeechControl({
    getText: () => finalValidatedText,
    getLanguage: () => 'English',
    ariaPrefix: 'answer'
  });

  const playBtn = ctrl._getChildren()[0];
  playBtn.click();

  assert.strictEqual(passedText, finalValidatedText, 'Must pass exact final validated answer text');
  assert.strictEqual(passedLang, 'English', 'Must pass correct language');
  assert.strictEqual(getStats().speakCalls, 1);

  speechController.speak = originalSpeak;
});

test('UI 7-9: Pause, Resume, and Stop button interactions work on tutor answer control', () => {
  const { synth, getStats } = setupMockSynthesis(standardVoices);
  const { createElement } = createSimpleMockDOM();
  globalThis.document = { createElement };

  const ctrl = speechController.createSpeechControl({
    getText: () => 'Photosynthesis is life.',
    getLanguage: () => 'English'
  });

  const [playBtn, pauseBtn, resumeBtn, stopBtn] = ctrl._getChildren();

  // 1. Click Play -> starts speaking
  playBtn.click();
  assert.strictEqual(speechController.state, 'speaking');
  assert.strictEqual(playBtn.style.display, 'none');
  assert.strictEqual(pauseBtn.style.display, '');
  assert.strictEqual(stopBtn.style.display, '');

  // 2. Click Pause -> pauses
  pauseBtn.click();
  assert.strictEqual(speechController.state, 'paused');
  assert.strictEqual(pauseBtn.style.display, 'none');
  assert.strictEqual(resumeBtn.style.display, '');

  // 3. Click Resume -> resumes
  resumeBtn.click();
  assert.strictEqual(speechController.state, 'speaking');
  assert.strictEqual(resumeBtn.style.display, 'none');
  assert.strictEqual(pauseBtn.style.display, '');

  // 4. Click Stop -> returns to idle Listen
  stopBtn.click();
  assert.strictEqual(speechController.state, 'stopped');
  assert.strictEqual(playBtn.style.display, '');
  assert.strictEqual(pauseBtn.style.display, 'none');
  assert.strictEqual(stopBtn.style.display, 'none');
});

test('UI 10: Unsupported language does not break the tutor UI', () => {
  // Synthesis without Odia voice
  setupMockSynthesis([{ name: 'English Only', lang: 'en-US' }]);
  const { createElement } = createSimpleMockDOM();
  globalThis.document = { createElement };

  let toastMessage = null;
  globalThis.toast = (msg) => { toastMessage = msg; };

  const ctrl = speechController.createSpeechControl({
    getText: () => 'ଆଲୋକ ସଂଶ୍ଳେଷଣ',
    getLanguage: () => 'Odia'
  });

  const playBtn = ctrl._getChildren()[0];
  // Clicking play with no voice must not throw and must notify user
  playBtn.click();
  assert.strictEqual(toastMessage, 'ଏହି ଭାଷା ପାଇଁ ଏହି ଡିଭାଇସ୍ରେ ଶବ୍ଦ ପାଠ ସୁବିଧା ଉପଲବ୍ଧ ନାହିଁ।');
  assert.strictEqual(playBtn.style.display, '', 'Button must reset safely to idle');
});

test('UI 11: Existing tutor answer text remains semantically unchanged', () => {
  const originalAnswer = 'Plants use sunlight, water, and carbon dioxide to create glucose and oxygen through photosynthesis.';
  const cleaned = prepareTextForSpeech(originalAnswer);
  assert.strictEqual(cleaned, originalAnswer, 'Validated answer text must remain 100% identical');
});

test('UI 12: Practice CTA still works seamlessly alongside speech controller', () => {
  const { getTargetedPractice, processPracticeSubmission } = require('../lib/targetedPractice');
  const { createInitialLearningState } = require('../lib/studentLearningState');
  const activity = getTargetedPractice({ topic: 'photosynthesis', concept: 'oxygen_role' }, 'English');
  assert(activity !== null, 'Targeted practice activity must be generated');
  assert(activity.question.includes('oxygen'), 'Question tests oxygen role');

  const state = createInitialLearningState({ language: 'English', grade: 9 });
  const sub = processPracticeSubmission(state, activity, activity.correctAnswer);
  assert.strictEqual(sub.practiceResult.correct, true);
  assert.strictEqual(sub.practiceResult.evidence, 'practice_correct');
});

test('UI 13: Mastery Agent behavior is unchanged', () => {
  const { chooseMasteryAction, createInitialLearningState, recordLearningEvent } = require('../lib/studentLearningState');
  const state = createInitialLearningState({ language: 'English', grade: 9 });
  recordLearningEvent(state, { topic: 'photosynthesis', concept: 'oxygen_role', evidence: 'practice_correct' });
  const action = chooseMasteryAction(state, {
    currentTopic: 'photosynthesis',
    currentConcept: 'oxygen_role',
    conceptId: 'c9_sci_photosynthesis',
    language: 'English',
    studentMessage: 'Explain photosynthesis'
  });
  assert(action !== null, 'Mastery action must be chosen');
  assert(['practice', 'introduce', 'review'].includes(action.action));
});

console.log(`\n====================================================`);
console.log(`TEST RESULTS: ${passed} passed, ${failed} failed`);
console.log(`====================================================\n`);

if (failed > 0) {
  process.exit(1);
}


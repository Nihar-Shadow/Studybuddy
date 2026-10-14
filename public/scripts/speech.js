/**
 * StudyBuddy Speech Controller (Text-to-Speech)
 * Dedicated client-side Web Speech API controller.
 * Consumes final validated presentation-layer text.
 * No LLM calls. No external TTS APIs or network requests.
 */

// Supported language definitions
const SPEECH_LANGUAGES = {
  en: {
    base: 'en',
    defaultLocale: 'en-IN',
    regionalLocales: ['en-IN', 'en-US', 'en-GB'],
    name: 'English',
    labels: {
      listen: 'Listen',
      pause: 'Pause',
      resume: 'Resume',
      stop: 'Stop',
      ariaListen: 'Listen to answer',
      ariaPause: 'Pause speech',
      ariaResume: 'Resume speech',
      ariaStop: 'Stop speech',
      unavailable: 'Speech is not available for this language on this device.'
    }
  },
  or: {
    base: 'or',
    defaultLocale: 'or-IN',
    regionalLocales: ['or-IN', 'ory-IN', 'or'],
    name: 'Odia',
    labels: {
      listen: 'ଶୁଣନ୍ତୁ',
      pause: 'ବିରତି',
      resume: 'ପୁଣି ଚଲାନ୍ତୁ',
      stop: 'ବନ୍ଦ କରନ୍ତୁ',
      ariaListen: 'ଉତ୍ତର ଶୁଣନ୍ତୁ',
      ariaPause: 'ବିରତି',
      ariaResume: 'ପୁଣି ଚଲାନ୍ତୁ',
      ariaStop: 'ବନ୍ଦ କରନ୍ତୁ',
      unavailable: 'ଏହି ଭାଷା ପାଇଁ ଏହି ଡିଭାଇସ୍ରେ ଶବ୍ଦ ପାଠ ସୁବିଧା ଉପଲବ୍ଧ ନାହିଁ।'
    }
  },
  hi: {
    base: 'hi',
    defaultLocale: 'hi-IN',
    regionalLocales: ['hi-IN', 'hi'],
    name: 'Hindi',
    labels: {
      listen: 'सुनें',
      pause: 'विराम',
      resume: 'फिर चलाएं',
      stop: 'रोकें',
      ariaListen: 'उत्तर सुनें',
      ariaPause: 'विराम',
      ariaResume: 'फिर चलाएं',
      ariaStop: 'रोकें',
      unavailable: 'Speech is not available for this language on this device.'
    }
  },
  bn: {
    base: 'bn',
    defaultLocale: 'bn-IN',
    regionalLocales: ['bn-IN', 'bn-BD', 'bn'],
    name: 'Bengali',
    labels: {
      listen: 'শুনুন',
      pause: 'বিরতি',
      resume: 'আবার চালান',
      stop: 'বন্ধ করুন',
      ariaListen: 'উত্তর শুনুন',
      ariaPause: 'বিরতি',
      ariaResume: 'আবার চালান',
      ariaStop: 'বন্ধ করুন',
      unavailable: 'Speech is not available for this language on this device.'
    }
  },
  te: {
    base: 'te',
    defaultLocale: 'te-IN',
    regionalLocales: ['te-IN', 'te'],
    name: 'Telugu',
    labels: {
      listen: 'వినండి',
      pause: 'విరామం',
      resume: 'పునఃప్రారంభించు',
      stop: 'ఆపు',
      ariaListen: 'సమాధానం వినండి',
      ariaPause: 'విరామం',
      ariaResume: 'పునఃప్రారంభించు',
      ariaStop: 'ఆపు',
      unavailable: 'Speech is not available for this language on this device.'
    }
  },
  ta: {
    base: 'ta',
    defaultLocale: 'ta-IN',
    regionalLocales: ['ta-IN', 'ta'],
    name: 'Tamil',
    labels: {
      listen: 'கேளுங்கள்',
      pause: 'இடைநிறுத்து',
      resume: 'தொடரவும்',
      stop: 'நிறுத்து',
      ariaListen: 'பதிலைக் கேளுங்கள்',
      ariaPause: 'இடைநிறுத்து',
      ariaResume: 'தொடரவும்',
      ariaStop: 'நிறுத்து',
      unavailable: 'Speech is not available for this language on this device.'
    }
  },
  mr: {
    base: 'mr',
    defaultLocale: 'mr-IN',
    regionalLocales: ['mr-IN', 'mr'],
    name: 'Marathi',
    labels: {
      listen: 'ऐका',
      pause: 'विराम',
      resume: 'पुन्हा सुरू करा',
      stop: 'थांबवा',
      ariaListen: 'उत्तर ऐका',
      ariaPause: 'विराम',
      ariaResume: 'पुन्हा सुरू करा',
      ariaStop: 'थांबवा',
      unavailable: 'Speech is not available for this language on this device.'
    }
  },
  gu: {
    base: 'gu',
    defaultLocale: 'gu-IN',
    regionalLocales: ['gu-IN', 'gu'],
    name: 'Gujarati',
    labels: {
      listen: 'સાંભળો',
      pause: 'વિરામ',
      resume: 'ફરીથી શરૂ કરો',
      stop: 'બંધ કરો',
      ariaListen: 'જવાબ સાંભળો',
      ariaPause: 'વિરામ',
      ariaResume: 'ફરીથી શરૂ કરો',
      ariaStop: 'બંધ કરો',
      unavailable: 'Speech is not available for this language on this device.'
    }
  }
};

/**
 * Normalizes input language string or BCP-47 tag to base language code.
 */
function normalizeLanguageCode(lang) {
  if (!lang || typeof lang !== 'string') return 'en';
  const clean = lang.trim().toLowerCase();
  if (clean === 'odia' || clean === 'oriya' || clean.startsWith('or') || clean.startsWith('ory')) return 'or';
  if (clean === 'hindi' || clean.startsWith('hi')) return 'hi';
  if (clean === 'bengali' || clean === 'bangla' || clean.startsWith('bn')) return 'bn';
  if (clean === 'telugu' || clean.startsWith('te')) return 'te';
  if (clean === 'tamil' || clean.startsWith('ta')) return 'ta';
  if (clean === 'marathi' || clean.startsWith('mr')) return 'mr';
  if (clean === 'gujarati' || clean.startsWith('gu')) return 'gu';
  if (clean === 'english' || clean.startsWith('en')) return 'en';
  return clean.split(/[-_]/)[0];
}

/**
 * Resolves target BCP-47 locale tag from language code or locale string.
 */
function resolveTargetLocale(lang) {
  if (!lang || typeof lang !== 'string') return 'en-IN';
  const trimmed = lang.trim();
  if (trimmed.includes('-') || trimmed.includes('_')) {
    return trimmed.replace('_', '-');
  }
  const base = normalizeLanguageCode(trimmed);
  return SPEECH_LANGUAGES[base]?.defaultLocale || 'en-IN';
}

/**
 * Detects language from script characters in text when language is unknown or default.
 */
function detectLanguageFromText(text, fallbackLang = 'en') {
  if (!text || typeof text !== 'string') return fallbackLang;
  if (/[\u0b00-\u0b7f]/.test(text)) return 'or';
  if (/[\u0980-\u09ff]/.test(text)) return 'bn';
  if (/[\u0c00-\u0c7f]/.test(text)) return 'te';
  if (/[\u0b80-\u0bff]/.test(text)) return 'ta';
  if (/[\u0a80-\u0aff]/.test(text)) return 'gu';
  if (/[\u0900-\u097f]/.test(text)) {
    const norm = normalizeLanguageCode(fallbackLang);
    return norm === 'mr' ? 'mr' : 'hi';
  }
  return fallbackLang;
}

/**
 * Safe accessor for window.speechSynthesis
 */
function getSpeechSynthesis() {
  if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
    return window.speechSynthesis;
  }
  if (typeof globalThis !== 'undefined' && 'speechSynthesis' in globalThis) {
    return globalThis.speechSynthesis;
  }
  return null;
}

/**
 * Retrieves voices for a language from available system voices.
 */
function getVoicesForLanguage(lang) {
  const synth = getSpeechSynthesis();
  if (!synth || typeof synth.getVoices !== 'function') return [];
  const voices = synth.getVoices() || [];
  const base = normalizeLanguageCode(lang);
  const targetLocale = resolveTargetLocale(lang).toLowerCase();

  return voices.filter(v => {
    const vLang = (v.lang || '').toLowerCase().replace('_', '-');
    const vBase = vLang.split('-')[0];
    return vLang === targetLocale || vBase === base;
  });
}

/**
 * Transliterates Odia Unicode script to Devanagari script for Brahmic phonetic rendering.
 * Used when a Hindi (hi-IN) voice is available but native Odia voice is not installed.
 */
function odiaToDevanagari(text) {
  if (!text || typeof text !== 'string') return '';
  return text.replace(/[\u0b00-\u0b7f]/g, (ch) => {
    const code = ch.charCodeAt(0);
    if (code === 0x0B71) return '\u0935'; // Odia Wa -> Devanagari Va
    if (code === 0x0B5F) return '\u092F'; // Odia Ya -> Devanagari Ya
    return String.fromCharCode(code - 0x0B00 + 0x0900);
  });
}

const ODIA_TO_ROMAN_MAP = {
  '\u0B05': 'a', '\u0B06': 'aa', '\u0B07': 'i', '\u0B08': 'ee', '\u0B09': 'u', '\u0B0A': 'oo',
  '\u0B0B': 'ri', '\u0B0F': 'e', '\u0B10': 'ai', '\u0B13': 'o', '\u0B14': 'au',
  '\u0B15': 'ka', '\u0B16': 'kha', '\u0B17': 'ga', '\u0B18': 'gha', '\u0B19': 'nga',
  '\u0B1A': 'cha', '\u0B1B': 'chha', '\u0B1C': 'ja', '\u0B1D': 'jha', '\u0B1E': 'nya',
  '\u0B1F': 'ta', '\u0B20': 'tha', '\u0B21': 'da', '\u0B22': 'dha', '\u0B23': 'na',
  '\u0B24': 'ta', '\u0B25': 'tha', '\u0B26': 'da', '\u0B27': 'dha', '\u0B28': 'na',
  '\u0B2A': 'pa', '\u0B2B': 'pha', '\u0B2C': 'ba', '\u0B2D': 'bha', '\u0B2E': 'ma',
  '\u0B2F': 'ya', '\u0B30': 'ra', '\u0B32': 'la', '\u0B33': 'la', '\u0B35': 'va',
  '\u0B36': 'sha', '\u0B37': 'sha', '\u0B38': 'sa', '\u0B39': 'ha',
  '\u0B5C': 'da', '\u0B5D': 'dha', '\u0B5F': 'ya', '\u0B71': 'wa'
};
const ODIA_VOWEL_SIGNS_MAP = {
  '\u0B3E': 'aa', '\u0B3F': 'i', '\u0B40': 'ee', '\u0B41': 'u', '\u0B42': 'oo',
  '\u0B43': 'ri', '\u0B47': 'e', '\u0B48': 'ai', '\u0B4B': 'o', '\u0B4C': 'au'
};

/**
 * Transliterates Odia Unicode script to clean Roman phonetic text.
 * Used when an Indian English (en-IN) voice is available but native Odia voice is not installed.
 */
function odiaToRomanPhonetic(text) {
  if (!text || typeof text !== 'string') return '';
  let out = '';
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (ODIA_VOWEL_SIGNS_MAP[ch]) {
      if (out.endsWith('a')) out = out.slice(0, -1);
      out += ODIA_VOWEL_SIGNS_MAP[ch];
    } else if (ch === '\u0B4D') {
      if (out.endsWith('a')) out = out.slice(0, -1);
    } else if (ch === '\u0B02') {
      out += 'ng';
    } else if (ch === '\u0B01') {
      out += 'n';
    } else if (ch === '\u0B03') {
      out += 'h';
    } else if (ODIA_TO_ROMAN_MAP[ch]) {
      out += ODIA_TO_ROMAN_MAP[ch];
    } else {
      out += ch;
    }
  }
  return out;
}

/**
 * Selects the best system voice matching priority rules:
 * 1. Exact locale match (e.g. or-IN)
 * 2. Base language match (e.g. or)
 * 3. Appropriate regional locale (e.g. en-IN or hi-IN)
 * 4. Odia phonetic fallback using an Indian voice (hi-IN with Brahmic Devanagari mapping or en-IN with Roman phonetic mapping)
 * 5. If no matching voice exists:
 *    Return: { supported: false, reason: "no_voice" }
 */
function selectVoice(lang) {
  const synth = getSpeechSynthesis();
  if (!synth || typeof synth.getVoices !== 'function') {
    return { supported: false, reason: 'not_supported' };
  }

  const voices = synth.getVoices() || [];
  if (!voices.length) {
    return { supported: false, reason: 'no_voice' };
  }

  const base = normalizeLanguageCode(lang);
  const targetLocale = resolveTargetLocale(lang).toLowerCase();
  const config = SPEECH_LANGUAGES[base];

  // Candidates strictly matching the base language
  const candidates = voices.filter(v => {
    const vLang = (v.lang || '').toLowerCase().replace('_', '-');
    const vBase = vLang.split('-')[0];
    return vBase === base;
  });

  // Priority 1: Exact locale match
  const exactMatch = candidates.find(v => {
    const vLang = (v.lang || '').toLowerCase().replace('_', '-');
    return vLang === targetLocale;
  });
  if (exactMatch) {
    return { supported: true, voice: exactMatch, lang: exactMatch.lang };
  }

  // Priority 2 & 3: Regional preferred locale match
  if (config && Array.isArray(config.regionalLocales)) {
    for (const reg of config.regionalLocales) {
      const regMatch = candidates.find(v => {
        const vLang = (v.lang || '').toLowerCase().replace('_', '-');
        return vLang === reg.toLowerCase();
      });
      if (regMatch) {
        return { supported: true, voice: regMatch, lang: regMatch.lang };
      }
    }
  }

  // Priority 4: Fallback within the SAME base language
  if (candidates.length) {
    const baseMatch = candidates[0];
    return { supported: true, voice: baseMatch, lang: baseMatch.lang };
  }

  // Priority 5: Odia phonetic fallback on devices without a native or-IN voice
  // Uses Indian voices with accurate Brahmic / phonetic articulation instead of failing.
  if (base === 'or') {
    // 1. Check for Hindi voice (speaks Brahmic Devanagari transliteration)
    const hiVoice = voices.find(v => {
      const vLang = (v.lang || '').toLowerCase().replace('_', '-');
      return vLang === 'hi-in' || vLang === 'hi';
    });
    if (hiVoice) {
      return { supported: true, voice: hiVoice, lang: hiVoice.lang, phoneticFallback: 'hi-IN' };
    }

    // 2. Check for Indian English voice (e.g. Microsoft Heera/Ravi on Windows, speaks Roman phonetic text)
    const enInVoice = voices.find(v => {
      const vLang = (v.lang || '').toLowerCase().replace('_', '-');
      return vLang === 'en-in';
    });
    if (enInVoice) {
      return { supported: true, voice: enInVoice, lang: enInVoice.lang, phoneticFallback: 'en-IN' };
    }
  }

  return { supported: false, reason: 'no_voice' };
}

/**
 * Natural speech representation from structured tutor answer objects.
 * intro → step title + explanation → next step → summary
 * Does NOT speak internal field names or UI labels.
 */
function formatStructuredForSpeech(obj) {
  if (!obj || typeof obj !== 'object') return '';
  const parts = [];

  if (obj.intro && typeof obj.intro === 'string') {
    const intro = obj.intro.trim();
    if (intro) parts.push(intro);
  }

  const steps = Array.isArray(obj.steps) ? obj.steps : [];
  steps.forEach(step => {
    if (!step) return;
    const title = typeof step.title === 'string' ? step.title.trim() : '';
    const body = typeof step.explanation === 'string'
      ? step.explanation.trim()
      : (typeof step.text === 'string' ? step.text.trim() : '');

    if (title && body) {
      const sep = /[.!?;:।]$/.test(title) ? ' ' : '. ';
      parts.push(title + sep + body);
    } else if (title) {
      parts.push(title);
    } else if (body) {
      parts.push(body);
    }
  });

  const summary = typeof obj.summary === 'string'
    ? obj.summary.trim()
    : (typeof obj.answer === 'string' ? obj.answer.trim() : '');
  if (summary && !parts.includes(summary)) {
    parts.push(summary);
  }

  const followUp = typeof obj.followUp === 'string'
    ? obj.followUp.trim()
    : (typeof obj.followup === 'string' ? obj.followup.trim() : '');
  if (followUp && !parts.includes(followUp)) {
    parts.push(followUp);
  }

  return parts.join('\n\n');
}

/**
 * prepareTextForSpeech(text)
 * Removes UI-only formatting, Markdown, internal JSON, metadata, and concept IDs.
 * Preserves educational answer semantics.
 */
function prepareTextForSpeech(text) {
  if (text === null || text === undefined) return '';

  // Handle structured answer object
  if (typeof text === 'object') {
    const extracted = text.structured || text;
    if (extracted.steps || extracted.intro || extracted.summary || extracted.answer) {
      return prepareTextForSpeech(formatStructuredForSpeech(extracted));
    }
    return '';
  }

  if (typeof text !== 'string') text = String(text);
  let str = text.trim();

  // Handle serialized JSON
  if (str.startsWith('{') && (str.includes('"') || str.includes(':'))) {
    try {
      const jsonMatch = str.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        const parsed = JSON.parse(jsonMatch[0]);
        if (parsed.steps || parsed.intro || parsed.summary || parsed.answer) {
          return prepareTextForSpeech(formatStructuredForSpeech(parsed));
        }
      }
    } catch (_) {}
  }

  // Strip <think> tags
  str = str.replace(/<think>[\s\S]*?<\/think>/gi, '');
  str = str.replace(/<think>[\s\S]*$/gi, '');

  // Strip Markdown code fences and inline code
  str = str.replace(/```[a-z]*\s*([\s\S]*?)```/gi, '$1');
  str = str.replace(/`([^`]+)`/g, '$1');

  // Strip Markdown bold and italics
  str = str.replace(/\*\*([^*]+)\*\*/g, '$1');
  str = str.replace(/__([^_]+)__/g, '$1');
  str = str.replace(/\*([^*]+)\*/g, '$1');
  str = str.replace(/_([^_]+)_/g, '$1');

  // Strip Markdown headers
  str = str.replace(/^#{1,6}\s+(.+)$/gm, '$1.');

  // Strip Markdown list bullets & numbers
  str = str.replace(/^[\s*+-]+\s+(.+)$/gm, '$1.');
  str = str.replace(/^\d+\.\s+(.+)$/gm, '$1.');

  // Strip Markdown links: [label](url) -> label
  str = str.replace(/\[([^\]]+)\]\([^)]+\)/g, '$1');

  // Strip Markdown blockquotes
  str = str.replace(/^>\s+(.+)$/gm, '$1');

  // Strip HTML tags
  str = str.replace(/<[^>]+>/g, ' ');

  // Strip internal concept placeholders & IDs (e.g. "Concept 2", "c9_sci_photosynthesis")
  str = str.replace(/\bConcept\s+\d+\b/gi, '');
  str = str.replace(/\bc\d+_[a-z0-9_]+\b/gi, '');

  // Strip decorative UI-only emojis so screen reader / TTS does not speak symbol names
  str = str.replace(/[🔊⏸⏹▶🧠📚✨🎯🔍📝🔬📋📖✅❌⚠️👋🔥💡]/g, '');

  // Normalize punctuation and whitespace
  str = str.replace(/[ \t]+/g, ' ');
  str = str.replace(/\s+([.,!?;:।])/g, '$1');
  str = str.replace(/([.,!?;:।]){2,}/g, '$1');
  str = str.replace(/\n\s*\n+/g, '\n\n');

  return str.trim();
}

/**
 * Safe telemetry logger: only logs safe metadata, never student answer text.
 */
function logSpeechTelemetry(event, meta = {}) {
  const safeData = {
    event,
    timestamp: Date.now(),
    language: meta.language || null,
    voice_available: Boolean(meta.voice_available),
    reason: meta.reason || null
  };
  // Dispatch custom event for telemetry listeners
  if (typeof window !== 'undefined' && typeof window.dispatchEvent === 'function') {
    try {
      window.dispatchEvent(new CustomEvent('studybuddy:speech_telemetry', { detail: safeData }));
    } catch (_) {}
  }
  if (typeof console !== 'undefined' && console.debug) {
    console.debug('[TTS Telemetry]', safeData.event, safeData.language, safeData.voice_available);
  }
}

/**
 * Speech Controller Singleton
 */
const speechController = {
  state: 'supported', // 'supported' | 'unsupported' | 'speaking' | 'paused' | 'stopped' | 'error'
  defaultRate: 0.9,
  defaultPitch: 1.0,
  currentUtterance: null,
  activeControl: null,

  isSpeaking() {
    const synth = getSpeechSynthesis();
    if (!synth) return false;
    return this.state === 'speaking' || (Boolean(synth.speaking) && !synth.paused);
  },

  isPaused() {
    const synth = getSpeechSynthesis();
    if (!synth) return false;
    return this.state === 'paused' || Boolean(synth.paused);
  },

  getAvailableVoices(language) {
    if (language) {
      return getVoicesForLanguage(language);
    }
    const synth = getSpeechSynthesis();
    return synth && typeof synth.getVoices === 'function' ? synth.getVoices() : [];
  },

  isLanguageSupported(language) {
    const selection = selectVoice(language);
    return Boolean(selection && selection.supported);
  },

  prepareTextForSpeech(text) {
    return prepareTextForSpeech(text);
  },

  getVoicesForLanguage(lang) {
    return getVoicesForLanguage(lang);
  },

  selectVoice(lang) {
    return selectVoice(lang);
  },

  /**
   * Main speak method
   * If an utterance is already active, stops previous utterance and starts new one.
   */
  speak(text, language, options = {}) {
    const synth = getSpeechSynthesis();
    if (!synth) {
      this.state = 'unsupported';
      logSpeechTelemetry('speech_failed', { language, voice_available: false, reason: 'no_speech_synthesis' });
      return { supported: false, reason: 'not_supported' };
    }

    // Always stop previous utterance if one is playing
    if (this.currentUtterance || synth.speaking || synth.paused) {
      this.stop();
    }

    const cleanedText = prepareTextForSpeech(text);
    if (!cleanedText) {
      return { supported: true, reason: 'empty_text' };
    }

    // Detect language from script if not specified or English default
    const effectiveLang = detectLanguageFromText(cleanedText, language || 'en');
    const voiceSelection = selectVoice(effectiveLang);

    if (!voiceSelection.supported) {
      this.state = 'unsupported';
      logSpeechTelemetry('speech_failed', { language: effectiveLang, voice_available: false, reason: voiceSelection.reason });
      if (typeof options.onError === 'function') {
        options.onError({ reason: voiceSelection.reason, language: effectiveLang });
      }
      return { supported: false, reason: voiceSelection.reason, language: effectiveLang };
    }

    // Create and configure SpeechSynthesisUtterance
    const UtteranceConstructor = typeof SpeechSynthesisUtterance !== 'undefined'
      ? SpeechSynthesisUtterance
      : (typeof globalThis !== 'undefined' && globalThis.SpeechSynthesisUtterance ? globalThis.SpeechSynthesisUtterance : null);

    if (!UtteranceConstructor) {
      this.state = 'unsupported';
      return { supported: false, reason: 'no_utterance_constructor' };
    }

    // Prepare speech text according to voice capability
    let speechText = cleanedText;
    if (voiceSelection.phoneticFallback === 'hi-IN') {
      speechText = odiaToDevanagari(cleanedText);
    } else if (voiceSelection.phoneticFallback === 'en-IN') {
      speechText = odiaToRomanPhonetic(cleanedText);
    }

    const utterance = new UtteranceConstructor(speechText);
    utterance.voice = voiceSelection.voice;
    utterance.lang = voiceSelection.lang || resolveTargetLocale(effectiveLang);
    utterance.rate = typeof options.rate === 'number'
      ? options.rate
      : (voiceSelection.phoneticFallback ? 0.88 : this.defaultRate);
    utterance.pitch = typeof options.pitch === 'number' ? options.pitch : this.defaultPitch;

    this.currentUtterance = utterance;
    if (options.control) {
      this.activeControl = options.control;
    }

    utterance.onstart = () => {
      this.state = 'speaking';
      logSpeechTelemetry('speech_started', { language: utterance.lang, voice_available: true });
      if (typeof options.onStart === 'function') options.onStart();
    };

    utterance.onend = () => {
      this.state = 'stopped';
      if (this.currentUtterance === utterance) {
        this.currentUtterance = null;
      }
      logSpeechTelemetry('speech_completed', { language: utterance.lang, voice_available: true });
      if (typeof options.onEnd === 'function') options.onEnd();
    };

    utterance.onerror = (e) => {
      // Ignore user-initiated cancel errors
      if (e && e.error === 'canceled') {
        this.state = 'stopped';
        return;
      }
      this.state = 'error';
      if (this.currentUtterance === utterance) {
        this.currentUtterance = null;
      }
      logSpeechTelemetry('speech_failed', { language: utterance.lang, voice_available: true, reason: e?.error || 'error' });
      if (typeof options.onError === 'function') options.onError(e);
    };

    utterance.onpause = () => {
      this.state = 'paused';
      if (typeof options.onPause === 'function') options.onPause();
    };

    utterance.onresume = () => {
      this.state = 'speaking';
      if (typeof options.onResume === 'function') options.onResume();
    };

    try {
      synth.speak(utterance);
      this.state = 'speaking';
      return { supported: true, utterance, language: utterance.lang };
    } catch (err) {
      this.state = 'error';
      this.currentUtterance = null;
      logSpeechTelemetry('speech_failed', { language: utterance.lang, voice_available: true, reason: err.message });
      if (typeof options.onError === 'function') options.onError(err);
      return { supported: false, reason: 'speak_exception', error: err };
    }
  },

  pause() {
    const synth = getSpeechSynthesis();
    if (synth && (synth.speaking || this.state === 'speaking')) {
      try {
        synth.pause();
        this.state = 'paused';
      } catch (_) {}
    }
  },

  resume() {
    const synth = getSpeechSynthesis();
    if (synth && (synth.paused || this.state === 'paused')) {
      try {
        synth.resume();
        this.state = 'speaking';
      } catch (_) {}
    }
  },

  stop() {
    const synth = getSpeechSynthesis();
    if (synth) {
      try {
        synth.cancel();
      } catch (_) {}
    }
    this.currentUtterance = null;
    this.state = 'stopped';
    if (this.activeControl && typeof this.activeControl.resetToIdle === 'function') {
      this.activeControl.resetToIdle();
      this.activeControl = null;
    }
  },

  /**
   * UI Component Builder
   * Creates an accessible speech control with:
   * [ 🔊 Listen ] → While speaking: [ ⏸ Pause ] [ ⏹ Stop ] → While paused: [ ▶ Resume ] [ ⏹ Stop ]
   * Works for English, Odia, Hindi, and extensible languages.
   */
  createSpeechControl(config = {}) {
    if (typeof document === 'undefined') return null;

    const {
      getText,
      getLanguage,
      ariaPrefix = 'answer',
      containerClass = ''
    } = config;

    const resolveLang = () => {
      let l = typeof getLanguage === 'function' ? getLanguage() : getLanguage;
      if (!l && typeof currentLanguage !== 'undefined') l = currentLanguage;
      const rawText = typeof getText === 'function' ? getText() : getText;
      return detectLanguageFromText(rawText, l || 'en');
    };

    const container = document.createElement('div');
    container.className = `speech-controls ${containerClass}`.trim();
    container.setAttribute('role', 'group');

    // Play / Listen button
    const playBtn = document.createElement('button');
    playBtn.type = 'button';
    playBtn.className = 'speech-btn speech-btn-play';

    // Pause button
    const pauseBtn = document.createElement('button');
    pauseBtn.type = 'button';
    pauseBtn.className = 'speech-btn speech-btn-pause';
    pauseBtn.style.display = 'none';

    // Resume button
    const resumeBtn = document.createElement('button');
    resumeBtn.type = 'button';
    resumeBtn.className = 'speech-btn speech-btn-resume';
    resumeBtn.style.display = 'none';

    // Stop button
    const stopBtn = document.createElement('button');
    stopBtn.type = 'button';
    stopBtn.className = 'speech-btn speech-btn-stop';
    stopBtn.style.display = 'none';

    function updateLabels() {
      const base = normalizeLanguageCode(resolveLang());
      const langConfig = SPEECH_LANGUAGES[base] || SPEECH_LANGUAGES.en;
      const labels = langConfig.labels;

      playBtn.innerHTML = `<span class="speech-btn-icon" aria-hidden="true">🔊</span> <span class="speech-btn-label">${labels.listen}</span>`;
      playBtn.title = labels.ariaListen;
      playBtn.setAttribute('aria-label', labels.ariaListen);

      pauseBtn.innerHTML = `<span class="speech-btn-icon" aria-hidden="true">⏸</span> <span class="speech-btn-label">${labels.pause}</span>`;
      pauseBtn.title = labels.ariaPause;
      pauseBtn.setAttribute('aria-label', labels.ariaPause);

      resumeBtn.innerHTML = `<span class="speech-btn-icon" aria-hidden="true">▶</span> <span class="speech-btn-label">${labels.resume}</span>`;
      resumeBtn.title = labels.ariaResume;
      resumeBtn.setAttribute('aria-label', labels.ariaResume);

      stopBtn.innerHTML = `<span class="speech-btn-icon" aria-hidden="true">⏹</span> <span class="speech-btn-label">${labels.stop}</span>`;
      stopBtn.title = labels.ariaStop;
      stopBtn.setAttribute('aria-label', labels.ariaStop);
    }

    updateLabels();

    const controlInstance = {
      container,
      resetToIdle() {
        playBtn.style.display = '';
        pauseBtn.style.display = 'none';
        resumeBtn.style.display = 'none';
        stopBtn.style.display = 'none';
        updateLabels();
      },
      setSpeaking() {
        playBtn.style.display = 'none';
        pauseBtn.style.display = '';
        resumeBtn.style.display = 'none';
        stopBtn.style.display = '';
      },
      setPaused() {
        playBtn.style.display = 'none';
        pauseBtn.style.display = 'none';
        resumeBtn.style.display = '';
        stopBtn.style.display = '';
      }
    };

    playBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      const textToSpeak = typeof getText === 'function' ? getText() : getText;
      const langToUse = resolveLang();
      const base = normalizeLanguageCode(langToUse);
      const langConfig = SPEECH_LANGUAGES[base] || SPEECH_LANGUAGES.en;

      const result = speechController.speak(textToSpeak, langToUse, {
        control: controlInstance,
        onStart: () => controlInstance.setSpeaking(),
        onEnd: () => controlInstance.resetToIdle(),
        onPause: () => controlInstance.setPaused(),
        onResume: () => controlInstance.setSpeaking(),
        onError: (err) => {
          controlInstance.resetToIdle();
          const reason = err?.reason;
          if (reason === 'no_voice' || reason === 'not_supported') {
            const msg = langConfig.labels.unavailable;
            if (typeof toast === 'function') {
              toast(msg, 'error');
            } else if (typeof announceToScreenReader === 'function') {
              announceToScreenReader(msg);
            } else {
              console.warn(msg);
            }
          }
        }
      });

      if (!result.supported && (result.reason === 'no_voice' || result.reason === 'not_supported')) {
        controlInstance.resetToIdle();
        const msg = langConfig.labels.unavailable;
        if (typeof toast === 'function') {
          toast(msg, 'error');
        } else if (typeof announceToScreenReader === 'function') {
          announceToScreenReader(msg);
        } else {
          console.warn(msg);
        }
      }
    });

    pauseBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      speechController.pause();
      controlInstance.setPaused();
    });

    resumeBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      speechController.resume();
      controlInstance.setSpeaking();
    });

    stopBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      speechController.stop();
      controlInstance.resetToIdle();
    });

    container.appendChild(playBtn);
    container.appendChild(pauseBtn);
    container.appendChild(resumeBtn);
    container.appendChild(stopBtn);

    return container;
  }
};

/**
 * Settings: Auto Read Answers Aloud preference
 * Default: OFF
 */
function isAutoTTSEnabled() {
  if (typeof localStorage === 'undefined') return false;
  try {
    return localStorage.getItem('studybuddy-auto-tts') === 'true';
  } catch (_) {
    return false;
  }
}

function setAutoTTSEnabled(enabled) {
  if (typeof localStorage === 'undefined') return;
  try {
    localStorage.setItem('studybuddy-auto-tts', enabled ? 'true' : 'false');
  } catch (_) {}
}

function toggleAutoTTS() {
  const current = isAutoTTSEnabled();
  const next = !current;
  setAutoTTSEnabled(next);
  updateAutoTTSButtonUI();
  return next;
}

function updateAutoTTSButtonUI() {
  if (typeof document === 'undefined') return;
  const btn = document.getElementById('auto-tts-toggle');
  if (!btn) return;
  const enabled = isAutoTTSEnabled();
  btn.textContent = enabled ? '🔊 Read aloud: ON' : '🔊 Read aloud: OFF';
  btn.setAttribute('aria-label', `Auto read answers aloud: ${enabled ? 'ON' : 'OFF'}`);
  btn.classList.toggle('active', enabled);
}

// Listen for browser voices changed (Chromium / Firefox / Safari async loading)
if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
  const synth = window.speechSynthesis;
  const reloadVoices = () => {
    if (synth && typeof synth.getVoices === 'function') {
      synth.getVoices();
    }
  };
  synth.addEventListener('voiceschanged', reloadVoices);
  synth.onvoiceschanged = reloadVoices;
  reloadVoices();
}

// Browser globals & CommonJS exports
if (typeof window !== 'undefined') {
  window.speechController = speechController;
  window.prepareTextForSpeech = prepareTextForSpeech;
  window.getVoicesForLanguage = getVoicesForLanguage;
  window.selectVoice = selectVoice;
  window.odiaToDevanagari = odiaToDevanagari;
  window.odiaToRomanPhonetic = odiaToRomanPhonetic;
  window.isAutoTTSEnabled = isAutoTTSEnabled;
  window.setAutoTTSEnabled = setAutoTTSEnabled;
  window.toggleAutoTTS = toggleAutoTTS;
  window.updateAutoTTSButtonUI = updateAutoTTSButtonUI;
  window.SPEECH_LANGUAGES = SPEECH_LANGUAGES;
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    speechController,
    prepareTextForSpeech,
    getVoicesForLanguage,
    selectVoice,
    odiaToDevanagari,
    odiaToRomanPhonetic,
    normalizeLanguageCode,
    resolveTargetLocale,
    detectLanguageFromText,
    formatStructuredForSpeech,
    isAutoTTSEnabled,
    setAutoTTSEnabled,
    toggleAutoTTS,
    updateAutoTTSButtonUI,
    SPEECH_LANGUAGES
  };
}

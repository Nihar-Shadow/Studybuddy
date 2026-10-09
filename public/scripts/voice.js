/* Voice input feature */
// ── Voice Input Feature ──
const SILENCE_MS = 2500;
let recognition = null;
let isListening = false;
let voiceTranscript = '';
let silenceTimer = null;
let userExplicitStop = false;   // true when user clicks mic to stop
let lastSpeechTime = 0;         // track when speech last detected

// Initialize Web Speech API
try {
  const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
  if (SpeechRecognition) {
    recognition = new SpeechRecognition();
    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.maxAlternatives = 1;
    
    // Set default language
    const defaultLang = getVoiceLanguage();
    recognition.lang = defaultLang;
    
    console.log('[Voice] Web Speech API initialized with language:', defaultLang);

    recognition.onstart = () => {
      isListening = true;
      voiceTranscript = '';
      userExplicitStop = false;
      setMicState('listening');
      const statusText = document.getElementById('voice-status-text');
      if (statusText) {
        statusText.style.color = '';   // reset any error colour
        const theme = document.documentElement.getAttribute('data-theme');
        statusText.textContent = theme === 'beginner' ? '🎤 Listening...' : 'Listening... speak your question';
      }
      console.log('[Voice] Recognition started');
      announceToScreenReader('Voice input started, listening for your question');
    };

    recognition.onresult = (event) => {
      lastSpeechTime = Date.now();
      let interim = '';
      for (let i = event.resultIndex; i < event.results.length; i++) {
        const transcript = event.results[i][0].transcript;
        if (event.results[i].isFinal) {
          voiceTranscript += transcript + ' ';
          console.log('[Voice] Final result:', transcript);
        } else {
          interim += transcript;
        }
      }
      // Show live preview in the status bar
      const preview = voiceTranscript + interim;
      updateVoicePreview(preview);
      // Restart silence timer on each result
      clearTimeout(silenceTimer);
      silenceTimer = setTimeout(finaliseVoiceInput, SILENCE_MS);
    };

    recognition.onend = () => {
      console.log('[Voice] Recognition ended. isListening:', isListening, 'userExplicitStop:', userExplicitStop);
      clearTimeout(silenceTimer);

      // If there's accumulated text and we're being finalized, don't restart
      if (!isListening) return;

      // If user explicitly stopped, don't restart
      if (userExplicitStop) {
        isListening = false;
        userExplicitStop = false;
        return;
      }

      // Browser killed recognition spontaneously (no-speech timeout, network blip, etc.)
      // Auto-restart to keep listening
      console.log('[Voice] Auto-restarting recognition (browser stopped it unexpectedly)');
      try {
        recognition.start();
      } catch (e) {
        console.warn('[Voice] Auto-restart failed:', e);
        // Retry once after short delay
        setTimeout(() => {
          try { recognition.start(); }
          catch (e2) {
            console.error('[Voice] Auto-restart retry failed:', e2);
            isListening = false;
            setMicState('idle');
            hideVoiceStatusBar();
          }
        }, 300);
      }
    };

    recognition.onerror = (event) => {
      console.warn('[Voice] Recognition error:', event.error);
      
      // no-speech: browser fires this after ~5s silence. Auto-restart via onend.
      if (event.error === 'no-speech') {
        console.log('[Voice] No speech detected — will auto-restart via onend');
        document.getElementById('voice-status-text').textContent = 'Still listening... speak when ready';
        return; // onend will auto-restart
      }

      // aborted: we called .stop() ourselves; ignore
      if (event.error === 'aborted') {
        console.log('[Voice] Recognition aborted (expected)');
        return;
      }

      // network: retry automatically
      if (event.error === 'network') {
        console.log('[Voice] Network error — will auto-restart via onend');
        document.getElementById('voice-status-text').textContent = 'Reconnecting...';
        announceToScreenReader('Network error, reconnecting');
        return; // onend will auto-restart
      }

      // Fatal errors — stop listening and show error
      let errorMessage = '';
      let screenReaderMsg = '';

      if (event.error === 'audio-capture') {
        errorMessage = 'Microphone not available. Please check your device.';
        screenReaderMsg = 'Microphone not found or permission denied';
      } else if (event.error === 'not-allowed') {
        errorMessage = 'Microphone permission denied. Please enable in browser settings.';
        screenReaderMsg = 'Microphone permission not granted';
      } else if (event.error === 'service-not-allowed') {
        errorMessage = 'Voice input not available in your browser.';
        screenReaderMsg = 'Voice input service not available';
      } else {
        errorMessage = `Voice error: ${event.error}`;
        screenReaderMsg = `Voice recognition error: ${event.error}`;
      }

      // For fatal errors, force stop
      isListening = false;
      userExplicitStop = true; // prevent onend restart
      announceToScreenReader(screenReaderMsg);
      console.error('[Voice]', errorMessage);
      const statusText = document.getElementById('voice-status-text');
      if (statusText) {
        statusText.textContent = errorMessage;
        statusText.style.color = 'var(--error, #EF4444)';
      }
      setTimeout(() => {
        setMicState('idle');
        hideVoiceStatusBar();
        if (statusText) statusText.style.color = '';
      }, 3000);
    };
  } else {
    // Web Speech API not supported — hide mic button
    const micBtn = document.getElementById('mic-btn');
    if (micBtn) micBtn.style.display = 'none';
  }
} catch (e) {
  console.error('Voice API init error:', e);
  const micBtn = document.getElementById('mic-btn');
  if (micBtn) micBtn.style.display = 'none';
}

function startVoice() {
  if (!recognition) return;
  try {
    voiceTranscript = '';
    lastSpeechTime = 0;
    userExplicitStop = false;
    const lang = getVoiceLanguage();
    recognition.lang = lang;
    console.log('[Voice] Starting recognition with language:', lang);
    recognition.start();
  } catch (e) {
    console.warn('[Voice] Voice start error:', e);
    setTimeout(() => {
      try {
        recognition.start();
      } catch (e2) {
        console.error('[Voice] Retry failed:', e2);
        setMicState('idle');
      }
    }, 300);
  }
}

function stopVoice() {
  if (!recognition) return;
  userExplicitStop = true;
  isListening = false;
  clearTimeout(silenceTimer);
  try {
    recognition.stop();
  } catch (e) {
    console.warn('Voice stop error:', e);
  }
}

function toggleVoice() {
  if (isListening) {
    // If there's captured text, finalize and send it
    const pendingText = voiceTranscript.trim();
    if (pendingText) {
      clearTimeout(silenceTimer);
      finaliseVoiceInput();
    } else {
      stopVoice();
      setMicState('idle');
      hideVoiceStatusBar();
      hideVoicePreview();
    }
  } else {
    startVoice();
  }
}

function finaliseVoiceInput() {
  clearTimeout(silenceTimer);
  const finalText = voiceTranscript.trim();
  console.log('[Voice] Finalising input with text:', finalText);

  // Stop recognition properly
  userExplicitStop = true;
  isListening = false;
  try { recognition.stop(); } catch (e) { /* already stopped */ }

  if (finalText) {
    setMicState('processing');
    // Set text into textarea
    const inputElement = document.getElementById('input');
    if (inputElement) {
      inputElement.value = finalText;

      // Reset mic immediately — clear preview, go idle, hide status bar
      voiceTranscript = '';
      hideVoicePreview();
      hideVoiceStatusBar();
      setMicState('idle');

      // Send the message
      setTimeout(async () => {
        try {
          await sendMessage();
          console.log('[Voice] sendMessage() completed');
        } catch (e) {
          console.error('[Voice] Error calling sendMessage:', e);
          addBubble('⚠️ Voice message failed to send. Please try again.', 'bot');
          announceToScreenReader('Voice message failed to send');
        }
      }, 100);
    } else {
      console.error('[Voice] Input element not found!');
      setMicState('idle');
    }
  } else {
    announceToScreenReader('No speech was recognized. Tap mic to try again.');
    setMicState('idle');
    hideVoiceStatusBar();
    hideVoicePreview();
  }
}

function setMicState(state) {
  const micBtn = document.getElementById('mic-btn');
  if (!micBtn) return;
  micBtn.classList.remove('listening', 'processing');
  const bar = document.getElementById('voice-status-bar');
  if (state === 'listening') {
    micBtn.classList.add('listening');
    if (bar) bar.classList.add('active');
  } else if (state === 'processing') {
    micBtn.classList.add('processing');
  } else {
    if (bar) bar.classList.remove('active');
  }
}

function updateVoicePreview(text) {
  const barPreview = document.getElementById('voice-preview-bar');
  if (barPreview) {
    barPreview.textContent = text || '';
  }
  // Also update status text when we have interim text
  if (text && text.trim()) {
    const statusText = document.getElementById('voice-status-text');
    if (statusText) statusText.textContent = '🎤 Listening...';
  }
}

function hideVoicePreview() {
  const barPreview = document.getElementById('voice-preview-bar');
  if (barPreview) barPreview.textContent = '';
}

function hideVoiceStatusBar() {
  const bar = document.getElementById('voice-status-bar');
  if (bar) {
    bar.classList.remove('active');
  }
}

function getVoiceLanguage() {
  const levelEl = document.getElementById('level');
  // Default to en-US; could extend with more logic later
  return 'en-US';
}

function announceToScreenReader(message) {
  const announcer = document.getElementById('sr-announcer');
  if (announcer) {
    announcer.textContent = message;
  }
}

// Clean up voice state - reset after message is processed
// Simple cleanup without wrapping sendMessage

// ── On load: streak, due reviews, SW registration ──
window.addEventListener('load', () => {
  loadStreak();
  loadDueReviews();
});

// Close concept map modal on Escape
document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape') {
    document.getElementById('concept-map-modal').classList.remove('active');
  }
});

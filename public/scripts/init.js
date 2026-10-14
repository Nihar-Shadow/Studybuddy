/* Event listeners & initialization */
// ============ Event Listeners ============
levelEl.addEventListener('change', (e) => {
  const newTheme = e.target.value;
  applyTheme(newTheme);
});

function updateLanguageIndicator(lang) {
  const badge = document.getElementById('languageBadge');
  if (badge) {
    if (lang === 'Odia') {
      badge.classList.add('odia-active');
      badge.title = 'ଭାଷା: ଓଡ଼ିଆ (Odia Active)';
    } else {
      badge.classList.remove('odia-active');
      badge.title = `Response language: ${lang}`;
    }
  }

  if (inputEl) {
    if (lang === 'Odia') {
      inputEl.placeholder = "ଏକ ପ୍ରଶ୍ନ ପଚାରନ୍ତୁ... ଯେପରିକି, ମାଧ୍ୟାକର୍ଷଣ କ'ଣ?";
    } else {
      inputEl.placeholder = "Ask a question... e.g. What is gravity?";
    }
  }
}

// ── Language selector — persist to localStorage ──
if (languageEl) {
  // Ensure Odia option exists even if an older cached DOM was served
  if (!languageEl.querySelector('option[value="Odia"]')) {
    const odiaOpt = document.createElement('option');
    odiaOpt.value = 'Odia';
    odiaOpt.textContent = 'ଓଡ଼ିଆ (Odia)';
    const englishOpt = languageEl.querySelector('option[value="English"]');
    if (englishOpt && englishOpt.nextSibling) {
      languageEl.insertBefore(odiaOpt, englishOpt.nextSibling);
    } else {
      languageEl.appendChild(odiaOpt);
    }
  }

  // Restore saved language on load
  languageEl.value = currentLanguage;
  updateLanguageIndicator(currentLanguage);
  languageEl.addEventListener('change', (e) => {
    currentLanguage = e.target.value;
    localStorage.setItem('studybuddy-language', currentLanguage);
    updateLanguageIndicator(currentLanguage);
  });
}

sendBtn.addEventListener('click', sendMessage);
inputEl.addEventListener('keydown', (e) => {
  if (e.key === 'Enter' && !e.shiftKey) {
    e.preventDefault();
    sendMessage();
  }
});

// Close modal on Escape
document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape') {
    closeQuizModal();
  }
});

// ── Quick-start chips: fill composer (don't auto-send), then focus ──
const quickStartsEl = document.getElementById('quick-starts');
if (quickStartsEl) {
  quickStartsEl.addEventListener('click', (e) => {
    const chip = e.target.closest('.quick-start-chip');
    if (!chip) return;
    const prompt = chip.dataset.prompt || chip.textContent.trim();
    inputEl.value = prompt;
    inputEl.focus();
    quickStartsEl.classList.add('hidden');
  });
  // Hide chips once the user starts typing or a real exchange begins
  inputEl.addEventListener('input', () => {
    if (inputEl.value.length > 0) quickStartsEl.classList.add('hidden');
  });
}

// ── AI Provider Status Badge ──
function updateAIStatusBadge(info) {
  const textEl = document.getElementById('aiStatusText');
  const dotEl = document.getElementById('aiStatusDot');
  if (!textEl || !dotEl) return;

  dotEl.className = 'status-dot';
  if (info.provider === 'online' || info.status === 'online') {
    textEl.textContent = 'Online AI';
  } else if (info.fallback || info.status === 'online_fallback') {
    textEl.textContent = 'Using offline AI';
    dotEl.classList.add('fallback');
  } else {
    textEl.textContent = 'Offline AI';
    dotEl.classList.add('offline');
  }
}

try {
  fetch('/api/provider-status')
    .then(r => r.ok ? r.json() : null)
    .then(data => { if (data) updateAIStatusBadge(data); })
    .catch(() => {});
} catch (_) {}

// ── Initialize Read Aloud (Auto-TTS) UI ──
if (typeof updateAutoTTSButtonUI === 'function') {
  updateAutoTTSButtonUI();
}


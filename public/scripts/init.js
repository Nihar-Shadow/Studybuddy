/* Event listeners & initialization */
// ============ Event Listeners ============
levelEl.addEventListener('change', (e) => {
  const newTheme = e.target.value;
  applyTheme(newTheme);
});

// ── Language selector — persist to localStorage ──
if (languageEl) {
  // Restore saved language on load
  languageEl.value = currentLanguage;
  languageEl.addEventListener('change', (e) => {
    currentLanguage = e.target.value;
    localStorage.setItem('studybuddy-language', currentLanguage);
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

/* sendMessage dispatcher */
// ============ Send Message Handler ============
async function sendMessage() {
  const message = inputEl.value.trim();
  if (!message && !pendingImage) return;

  // Auto-detect Odia script and align state if not already set
  if (/[\u0b00-\u0b7f]/.test(message) && currentLanguage !== 'Odia') {
    currentLanguage = 'Odia';
    if (languageEl) languageEl.value = 'Odia';
    try { localStorage.setItem('studybuddy-language', 'Odia'); } catch (_) {}
    if (typeof updateLanguageIndicator === 'function') updateLanguageIndicator('Odia');
  }

  inputEl.value = '';
  sendBtn.disabled = true;

  // Hide quick-start chips once the conversation has begun
  const qs = document.getElementById('quick-starts');
  if (qs) qs.classList.add('hidden');

  // Clear image preview from input area immediately on send
  imagePreviewContainer.innerHTML = '';
  attachBtn.classList.remove('active');

  // Clear unclicked next-study recommendation cards on new user turn
  document.querySelectorAll('.next-study-card, .practice-cta').forEach(el => {
    if (!el.closest('.inline-mcq')) el.remove();
  });

  // Show user message with optional image (handled by sendToChat)
  if (!pendingImage) {
    addBubble(message, 'user');
  }
  // If there's an image, sendToChat will handle displaying it

  if (socraticMode) {
    await sendToSocratic(message);
  } else if (agentMode) {
    await sendToAgent(message);
  } else {
    await sendToChat(message);
  }

  sendBtn.disabled = false;
  inputEl.focus();
}

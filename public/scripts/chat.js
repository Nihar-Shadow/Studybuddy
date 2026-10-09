/* sendMessage dispatcher */
// ============ Send Message Handler ============
async function sendMessage() {
  const message = inputEl.value.trim();
  if (!message && !pendingImage) return;

  inputEl.value = '';
  sendBtn.disabled = true;

  // Hide quick-start chips once the conversation has begun
  const qs = document.getElementById('quick-starts');
  if (qs) qs.classList.add('hidden');

  // Clear image preview from input area immediately on send
  imagePreviewContainer.innerHTML = '';
  attachBtn.classList.remove('active');

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

/* Socratic mode toggle, send, render */
// ============ Socratic Mode ============
function toggleSocraticMode() {
  socraticMode = !socraticMode;
  socraticTurn = 0;
  socraticTopic = '';
  const btn = document.getElementById('socratic-toggle');
  if (socraticMode) {
    btn.textContent = '🔍 Socratic: ON';
    btn.classList.add('active');
    // Disable agent mode if on
    if (agentMode) toggleAgentMode();
    addBubble('🧠 Socratic mode activated! I\'ll ask you exactly 5 questions to guide you to the answer — with a few laughs along the way. Tell me: what topic are we tackling today?', 'system').classList.add('system-msg');
  } else {
    btn.textContent = '🔍 Socratic Mode';
    btn.classList.remove('active');
    addBubble('💬 Back to tutor mode — I\'ll explain topics directly again.', 'system').classList.add('system-msg');
  }
}

async function sendToSocratic(message) {
  socraticTurn += 1;
  if (socraticTurn === 1) {
    socraticTopic = message.replace(/^(explain|what is|tell me about|teach me|i want to learn)\s+/i, '').trim() || message;
  }

  const thinkingMsgs = [
    '🤔 Cooking up a question...',
    '� Thinking of how to stump you...',
    '💭 Crafting the perfect question...',
    '🎯 Loading next brain teaser...',
    '⚡ Preparing your next challenge...'
  ];
  const thinkingBubble = addBubble(thinkingMsgs[Math.min(socraticTurn - 1, thinkingMsgs.length - 1)], 'thinking');

  try {
    const res = await fetch('/socratic', {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        message,
        level:    levelEl.value,
        language: currentLanguage,
        history:  history.slice(-12),
        turn:     socraticTurn
      })
    });
    thinkingBubble.remove();
    const data = await res.json();
    if (data.success && data.structured) {
      renderSocraticResponse(data.structured);
      // Auto-reset after Turn 5 (the finale)
      if (data.structured.isFinalTurn) {
        setTimeout(() => {
          addBubble('🎓 Session complete! Want to explore another topic? Just type it in, or toggle Socratic mode off.', 'system').classList.add('system-msg');
          socraticTurn = 0;
          socraticTopic = '';
        }, 1000);
      }
    } else {
      addBubble('⚠️ Socratic agent failed. Try again.', 'bot');
    }
    history.push({ role: 'user',      content: message });
    history.push({ role: 'assistant', content: data.rawReply });
  } catch (err) {
    thinkingBubble.remove();
    addBubble('⚠️ Could not reach server.', 'bot');
  }
}

function renderSocraticResponse(s) {
  const bubble = document.createElement('div');
  bubble.className = 'bubble socratic';

  let html = '';

  // Progress dots (1-5)
  const totalTurns = 5;
  const currentTurn = s.turn || socraticTurn;
  html += '<div class="socratic-progress-dots">';
  for (let i = 1; i <= totalTurns; i++) {
    const cls = i < currentTurn ? 'filled' : i === currentTurn ? 'current' : '';
    html += `<div class="socratic-dot ${cls}"></div>`;
  }
  html += '</div>';

  // Turn badge
  html += `<div class="socratic-turn-badge">Question ${currentTurn} of ${totalTurns}</div>`;

  // Near-answer badge
  if (s.isNearAnswer && !s.isFinalTurn) {
    html += `<div class="near-answer-badge">💡 You're getting warm!</div>`;
  }

  // Acknowledgement
  if (s.acknowledgement) {
    html += `<div class="socratic-ack">${escapeHtml(s.acknowledgement)}</div>`;
  }

  // The question
  html += `<div class="socratic-question">${escapeHtml(s.question)}</div>`;

  // Hint
  if (s.hint) {
    html += `<div class="socratic-hint">💡 ${escapeHtml(s.hint)}</div>`;
  }

  // Big Picture summary (Turn 5)
  if (s.isFinalTurn && s.summary) {
    html += `<div class="socratic-summary">
      <div class="socratic-summary-title">🎯 The Big Picture</div>
      <div class="socratic-summary-text">${escapeHtml(s.summary)}</div>
    </div>`;
  }

  bubble.innerHTML = html;
  chatEl.appendChild(bubble);
  chatEl.scrollTop = chatEl.scrollHeight;
}

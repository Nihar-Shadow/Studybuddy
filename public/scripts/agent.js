/* Agent mode, sendToChat, sendToAgent, showProgress, tool badges */
// ============ Event Listeners ============
function toggleAgentMode() {
  agentMode = !agentMode;
  const btn = document.getElementById('agent-toggle');
  btn.textContent = agentMode ? '⬤ Agent mode: ON' : 'Agent mode: OFF';
  btn.style.background    = agentMode ? 'var(--primary)' : 'transparent';
  btn.style.color         = agentMode ? '#fff' : 'var(--text-secondary)';

  // Show system message in chat
  const msg = agentMode
    ? '🤖 Agent mode ON — I will now explain, quiz you, track your progress, and suggest what to study next. All in one!'
    : '💬 Back to standard chat mode.';
  
  const msgBubble = addBubble(msg, 'system');
  msgBubble.classList.add('system-msg');
}

async function sendToChat(message) {
  // Existing chat logic
  let estimateBadge = null;
  let countdownInterval = null;
  try {
    const estimateRes = await fetch('/estimate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        message,
        level: levelEl.value,
        hasImage: !!pendingImage
      })
    });

    if (estimateRes.ok) {
      const estimate = await estimateRes.json();
      const { badge, interval } = showEstimateBadge(estimate);
      estimateBadge = badge;
      countdownInterval = interval;
    }
  } catch (e) {
    // Silently fail estimate - it's optional
  }

  try {
    if (pendingImage) {
      // Defensive image flow: capture file locally so pendingImage can't be mutated mid-flight
      const fileForUpload = pendingImage;
      // Capture image data URL for vision response thumbnail
      let capturedImageDataUrl = null;

      // Display user message with image first (non-blocking)
      const reader = new FileReader();
      const imageLoadPromise = new Promise((resolve) => {
        reader.onload = (e) => {
          capturedImageDataUrl = e.target.result;

          try {
            const bubbleContainer = document.createElement('div');
            bubbleContainer.style.cssText = `
              display: flex;
              flex-direction: column;
              gap: 6px;
              align-self: flex-end;
              max-width: 65%;
            `;

            const imageBubble = document.createElement('img');
            imageBubble.src = e.target.result;
            imageBubble.className = 'bubble-image';
            imageBubble.loading = 'lazy'; // Lazy load for performance
            imageBubble.decoding = 'async'; // Non-blocking decode
            imageBubble.style.cssText = `
              width: 120px;
              height: 120px;
              border-radius: 8px;
              object-fit: cover;
            `;
            bubbleContainer.appendChild(imageBubble);

            if (message) {
              const textBubble = document.createElement('div');
              textBubble.className = 'bubble user';
              textBubble.textContent = message;
              bubbleContainer.appendChild(textBubble);
            }

            chatEl.appendChild(bubbleContainer);
            scrollToBottom();
          } catch (e) {
            console.error('[Image UI] failed to render preview:', e);
          }
          resolve();
        };
        reader.onerror = (err) => {
          console.warn('[Image] FileReader error', err);
          resolve();
        };
      });
      try {
        reader.readAsDataURL(fileForUpload);
        // Wait for image to be read (preview)
        await imageLoadPromise;

        // Show engaging facts loading screen for image processing
        showFactsLoading();

        // Use /chat-with-image endpoint
        const formData = new FormData();
        formData.append('message', message);
        formData.append('level', levelEl.value);
        formData.append('language', currentLanguage);
        formData.append('history', JSON.stringify(history));
        formData.append('image', fileForUpload);

        let res;
        try {
          res = await fetch('/chat-with-image', {
            method: 'POST',
            body: formData
          });
        } catch (networkErr) {
          // Network level failure
          hideFactsLoading();
          addBubble('❌ Network error while uploading image. Check connection.', 'bot');
          throw networkErr;
        }

        // Hide facts loading when response arrives
        hideFactsLoading();

        if (!res.ok) {
          let errorText = 'Failed to process image';
          try {
            const errorJson = await res.json();
            errorText = errorJson.error || errorText;
          } catch (e) {}
          addBubble('❌ Error: ' + errorText, 'bot');
          throw new Error(errorText);
        }

        let data = null;
        try {
          data = await res.json();
        } catch (e) {
          addBubble('❌ Error parsing server response for image.', 'bot');
          throw e;
        }

        // Only clear pendingImage after successful upload and parsing
        pendingImage = null;
        imagePreviewContainer.innerHTML = '';

        if (estimateBadge) estimateBadge.triggerShrinkFade();
        if (countdownInterval) clearInterval(countdownInterval);

        // Ensure we have a valid response to render - pass image data URL for vision card
        if (data && (data.structured || data.reply)) {
          try { renderBotResponse(data, capturedImageDataUrl); } catch (e) { console.error('[Image] render error', e); addBubble('❌ Error rendering image response', 'bot'); }
        } else {
          addBubble('Unable to process image. Please try again.', 'bot');
        }

        history.push({ role: 'user', content: message || '[Image uploaded]' });
        history.push({ role: 'assistant', content: data?.reply || 'Image analyzed' });
      } finally {
        // Ensure loading UI is hidden in unexpected cases
        hideFactsLoading();
      }
    } else {
      // Use /chat endpoint with SSE streaming
      showFactsLoading();
      const res = await fetch('/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message,
          level: levelEl.value,
          language: currentLanguage,
          history
        })
      });

      if (!res.ok) {
        hideFactsLoading();
        let errorText = 'Failed to get response';
        try { const ej = await res.json(); errorText = ej.error || errorText; } catch (_) {}
        addBubble('❌ Error: ' + errorText, 'bot');
        throw new Error(errorText);
      }

      // ── Blur & Render Pipeline ──
      // Create a "thinking-host" bubble with a blurred overlay.
      // Stream tokens are buffered silently — NO raw text shown.
      // Only when the final JSON arrives do we fade the overlay and render rich cards.
      const thinkingBubble = document.createElement('div');
      thinkingBubble.className = 'bubble bot thinking-host';

      // Thinking overlay (blurred glass + bouncing dots)
      const overlay = document.createElement('div');
      overlay.className = 'thinking-overlay';
      overlay.innerHTML = `
        <div class="thinking-dots">
          <span></span><span></span><span></span>
        </div>
        <div class="thinking-label">Thinking</div>
      `;
      thinkingBubble.appendChild(overlay);

      // Hidden content container — will receive the final rendered response
      const contentDiv = document.createElement('div');
      contentDiv.className = 'content-hidden';
      thinkingBubble.appendChild(contentDiv);

      chatEl.appendChild(thinkingBubble);
      scrollToBottom();

      // SSE reader — buffer tokens silently, never display raw text
      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let sseBuffer = '';
      let fullStreamedText = '';
      let finalData = null;

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        sseBuffer += decoder.decode(value, { stream: true });
        const sseLines = sseBuffer.split('\n');
        sseBuffer = sseLines.pop(); // Keep incomplete line in buffer

        for (const line of sseLines) {
          if (!line.startsWith('data: ')) continue;
          const jsonStr = line.slice(6);
          try {
            const evt = JSON.parse(jsonStr);
            if (evt.error) {
              // Server-side error during stream
              hideFactsLoading();
              overlay.classList.add('fade-out');
              contentDiv.classList.add('revealed');
              contentDiv.classList.remove('content-hidden');
              contentDiv.innerHTML = '❌ Error: ' + escapeHtml(evt.error);
              throw new Error(evt.error);
            }
            if (evt.done) {
              // Final event with structured data
              finalData = evt;
            } else if (evt.token) {
              // Buffer silently — do NOT render to DOM
              fullStreamedText += evt.token;
            }
          } catch (parseErr) {
            if (parseErr.message && !parseErr.message.startsWith('❌')) {
              // Ignore JSON parse errors on malformed SSE lines
            }
          }
        }
      }

      // Stream finished — hide loading UI
      hideFactsLoading();
      if (estimateBadge) estimateBadge.triggerShrinkFade();
      if (countdownInterval) clearInterval(countdownInterval);

      // ── The Reveal: fade overlay, render structured content ──
      thinkingBubble.remove(); // Remove the thinking placeholder

      if (finalData && finalData.structured && finalData.structured.steps) {
        // Structured JSON → rich card rendering via renderResponse
        renderResponse(finalData.structured);
      } else if (finalData && finalData.reply) {
        // Fallback: server sent a reply but no structured steps
        renderFormattedFallback(finalData.reply);
      } else if (fullStreamedText) {
        // Last resort: render whatever was streamed as formatted text
        renderFormattedFallback(fullStreamedText);
      }

      const replyText = finalData ? (finalData.reply || fullStreamedText) : fullStreamedText;
      history.push({ role: 'user', content: message });
      history.push({ role: 'assistant', content: replyText });
    }
  } catch (err) {
    // Clean up any loading states
    hideFactsLoading();
    if (estimateBadge) estimateBadge.triggerShrinkFade();
    if (countdownInterval) clearInterval(countdownInterval);
    alert('⚠️ Could not reach StudyBuddy. Is the server running?');
  }
}

async function sendToAgent(message) {
  // Show estimate first
  let estimateBadge = null;
  let countdownInterval = null;
  try {
    const estimateRes = await fetch('/estimate', {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ message, level: levelEl.value, hasImage: false })
    });
    if (estimateRes.ok) {
      const estimate = await estimateRes.json();
      const { badge, interval } = showEstimateBadge(estimate);
      estimateBadge = badge;
      countdownInterval = interval;
    }
  } catch (e) {
    // Silently fail estimate
  }

  // Skeleton placeholder: agent path has no SSE, so show shimmer until response lands.
  const skeletonBubble = document.createElement('div');
  skeletonBubble.className = 'bubble bot';
  skeletonBubble.innerHTML = '<div class="skeleton-loader"><div class="skeleton-line"></div><div class="skeleton-line"></div><div class="skeleton-line"></div></div>';
  chatEl.appendChild(skeletonBubble);
  scrollToBottom();

  try {
    const res = await fetch('/agent', {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        message,
        level:    levelEl.value,
        language: currentLanguage,
        history:  history.slice(-6)   // last 3 turns only — keep context manageable
      })
    });

    const data = await res.json();
    skeletonBubble.remove();
    if (estimateBadge) {
      estimateBadge.triggerShrinkFade();
    }
    if (countdownInterval) clearInterval(countdownInterval);

    if (!data.success && !data.structured) {
      addBubble('⚠️ Agent could not complete the request. Try again.', 'bot');
      return;
    }

    // Show tools-used badge row
    if (data.toolCallLog && data.toolCallLog.length > 0) {
      renderToolBadges(data.toolCallLog);
    }

    // Render the structured agent response
    if (data.structured) {
      renderAgentResponse(data.structured);
    } else {
      addBubble(escapeHtml(data.rawReply), 'bot');
    }

    // Add to history
    history.push({ role: 'user',      content: message });
    history.push({ role: 'assistant', content: data.rawReply });

  } catch (err) {
    if (skeletonBubble.isConnected) {
      skeletonBubble.innerHTML = '<div class="bubble bot" style="margin:0">⚠️ Failed to get response. Please try again.</div>';
      skeletonBubble.className = '';
    }
    if (estimateBadge) {
      estimateBadge.triggerShrinkFade();
    }
    if (countdownInterval) clearInterval(countdownInterval);
  }
}

function renderToolBadges(toolCallLog) {
  const wrapper = document.createElement('div');
  wrapper.style.cssText = `
    display: flex;
    flex-wrap: wrap;
    gap: 6px;
    align-self: flex-start;
    margin-bottom: 4px;
    animation: fadeInUp 0.2s ease forwards;
  `;

  const toolLabels = {
    explain_topic:          { icon: '📖', label: 'Explained topic' },
    generate_quiz:          { icon: '📝', label: 'Quiz generated' },
    track_progress:         { icon: '📊', label: 'Progress saved' },
    suggest_next_topic:     { icon: '🧭', label: 'Next topic suggested' },
    ask_socratic_question:  { icon: '🔍', label: 'Socratic question' },
    generate_concept_map:   { icon: '🗺', label: 'Concept map built' }
  };

  toolCallLog.forEach(({ tool }) => {
    const meta  = toolLabels[tool] || { icon: '🔧', label: tool };
    const badge = document.createElement('span');
    badge.style.cssText = `
      font-size: 11px;
      padding: 3px 10px;
      border-radius: 12px;
      border: 0.5px solid var(--border, #E5E7EB);
      color: var(--text-secondary, #6B7280);
      background: var(--bg, #F8F7FF);
      white-space: nowrap;
    `;
    badge.textContent = `${meta.icon} ${meta.label}`;
    wrapper.appendChild(badge);
  });

  chatEl.appendChild(wrapper);
  scrollToBottom();
}

function renderAgentResponse(s) {
  // 1. Render explanation if present (reuse existing renderStructuredResponse)
  if (s.explanation && s.explanation.steps && s.explanation.steps.length > 0) {
    renderStructuredResponse(s.explanation);
  }

  // 2. Render quiz if present (reuse existing quiz card rendering)
  if (s.quiz && s.quiz.length > 0) {
    currentQuiz = s.quiz;
    quizAnswers = {};
    renderQuizCard();
  }

  // 3. Render next topic suggestion card
  if (s.nextTopic) {
    const card = document.createElement('div');
    card.style.cssText = `
      align-self: flex-start;
      max-width: 78%;
      padding: 12px 16px;
      border-radius: 12px;
      border: 0.5px solid var(--border, #E5E7EB);
      background: var(--surface, #fff);
      animation: fadeInUp 0.3s ease forwards;
      margin-top: 4px;
    `;

    const label = document.createElement('div');
    label.style.cssText = 'font-size: 11px; color: var(--text-secondary); margin-bottom: 6px; text-transform: uppercase; letter-spacing: 0.06em;';
    label.textContent   = '🧭 Study next';

    const topic = document.createElement('div');
    topic.style.cssText = 'font-size: 15px; font-weight: 600; color: var(--text-primary); margin-bottom: 4px;';
    topic.textContent   = s.nextTopic.nextTopic;

    const reason = document.createElement('div');
    reason.style.cssText = 'font-size: 13px; color: var(--text-secondary); line-height: 1.5;';
    reason.textContent   = s.nextTopic.reason;

    card.appendChild(label);
    card.appendChild(topic);
    card.appendChild(reason);
    chatEl.appendChild(card);
  }

  // 4. Render progress note
  if (s.progressNote) {
    const note = document.createElement('div');
    note.style.cssText = `
      align-self: flex-start;
      font-size: 12px;
      font-style: italic;
      color: var(--text-secondary);
      padding: 6px 12px;
      animation: fadeInUp 0.3s ease 0.1s forwards;
      opacity: 0;
    `;
    note.textContent = s.progressNote;
    chatEl.appendChild(note);
  }

  scrollToBottom();
}

async function showProgress() {
  const res  = await fetch('/progress');
  const data = await res.json();
  const theme = document.body.getAttribute('data-theme') || 'intermediate';
  const isAdvanced = theme === 'advanced';

  // Theme-aware colors
  const weakBg = isAdvanced ? 'rgba(248, 81, 73, 0.15)' : '#FCEBEB';
  const weakText = isAdvanced ? '#F85149' : '#A32D2D';
  const strongBg = isAdvanced ? 'rgba(63, 185, 80, 0.15)' : '#EAF3DE';
  const strongText = isAdvanced ? '#3FB950' : '#27500A';
  const resetColor = isAdvanced ? '#F85149' : '#A32D2D';

  const card = document.createElement('div');
  card.style.cssText = `
    align-self: center;
    width: 90%;
    max-width: 480px;
    padding: 16px 20px;
    border-radius: 16px;
    border: 0.5px solid var(--border, #E5E7EB);
    background: var(--surface, #fff);
    animation: fadeInUp 0.3s ease forwards;
    margin: 8px 0;
  `;

  const streakEl = data.streak && data.streak.current > 0
    ? `<div style="display:flex;align-items:center;gap:8px;margin-bottom:10px;padding:8px 12px;border-radius:10px;background:${data.streak.current >= 3 ? '#fff7ed' : 'var(--bg)'};border:1px solid ${data.streak.current >= 3 ? '#f97316' : 'var(--border)'}">
        <span style="font-size:18px;">${data.streak.current >= 3 ? '🔥' : '⭐'}</span>
        <div>
          <div style="font-size:13px;font-weight:700;color:${data.streak.current >= 3 ? '#c2410c' : 'var(--text-primary)'};">${data.streak.current}-day streak!</div>
          <div style="font-size:11px;color:var(--text-secondary);">Longest: ${data.streak.longest} days</div>
        </div>
      </div>` : '';

  const dueEl = data.dueReviews > 0
    ? `<div style="margin-bottom:8px;padding:8px 12px;border-radius:10px;background:#fef9c3;border:1px solid #f59e0b;font-size:13px;color:#78350f;">
        📅 <strong>${data.dueReviews}</strong> topic${data.dueReviews > 1 ? 's' : ''} ready for spaced review
      </div>` : '';

  card.innerHTML = `
    <div style="font-size:13px;font-weight:600;margin-bottom:12px;color:var(--text-primary)">
      📊 Your progress — ${data.totalTopicsStudied} topics studied
    </div>
    ${streakEl}
    ${dueEl}
    ${data.weakAreas.length > 0 ? `
      <div style="margin-bottom:8px;">
        <span style="font-size:11px;color:var(--text-secondary);text-transform:uppercase;letter-spacing:0.06em;">Needs review</span><br>
        ${data.weakAreas.map(t => `<span style="display:inline-block;margin:3px 4px 3px 0;padding:2px 10px;border-radius:10px;font-size:12px;background:${weakBg};color:${weakText};">⬤ ${t}</span>`).join('')}
      </div>` : ''}
    ${data.strongAreas.length > 0 ? `
      <div style="margin-bottom:8px;">
        <span style="font-size:11px;color:var(--text-secondary);text-transform:uppercase;letter-spacing:0.06em;">Mastered</span><br>
        ${data.strongAreas.map(t => `<span style="display:inline-block;margin:3px 4px 3px 0;padding:2px 10px;border-radius:10px;font-size:12px;background:${strongBg};color:${strongText};">⬤ ${t}</span>`).join('')}
      </div>` : ''}
    ${data.recentTopics.length > 0 ? `
      <div>
        <span style="font-size:11px;color:var(--text-secondary);text-transform:uppercase;letter-spacing:0.06em;">Recently studied</span><br>
        <span style="font-size:13px;color:var(--text-secondary);">${data.recentTopics.join(' → ')}</span>
      </div>` : ''}
    <div style="margin-top:12px;text-align:right;">
      <button onclick="resetProgress()" style="font-size:12px;color:${resetColor};background:none;border:none;cursor:pointer;padding:0;">Reset progress</button>
    </div>
  `;

  chatEl.appendChild(card);
  scrollToBottom();
}

async function resetProgress() {
  await fetch('/progress', { method: 'DELETE' });
  const msgBubble = addBubble('Progress has been reset.');
  msgBubble.classList.add('system-msg');
}

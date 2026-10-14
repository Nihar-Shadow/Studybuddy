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

      // ── Next-study → contextual practice CTA ──
      injectPracticeCTA(finalData);

      if (finalData && typeof updateAIStatusBadge === 'function') {
        updateAIStatusBadge(finalData);
      }

      const replyText = finalData ? (finalData.reply || fullStreamedText) : fullStreamedText;
      history.push({ role: 'user', content: message });
      history.push({ role: 'assistant', content: replyText });
    }
  } catch (err) {
    console.error('[agent.js error]', err);
    // Clean up any loading states
    hideFactsLoading();
    if (estimateBadge) estimateBadge.triggerShrinkFade();
    if (countdownInterval) clearInterval(countdownInterval);
    if (err instanceof TypeError || err.message?.includes('render')) {
      alert(`⚠️ Display Error: ${err.message}`);
    } else {
      alert('⚠️ Could not reach StudyBuddy. Is the server running?');
    }
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

    // Next-study → contextual practice/review/introduce CTA
    injectPracticeCTA(data);

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
  console.log('[Diagnostic: Final Rendering] renderAgentResponse called with language:', typeof currentLanguage !== 'undefined' ? currentLanguage : 'unknown');

  // 0. Render agent summary card if present
  if (s.agentSummary) {
    const summaryCard = document.createElement('div');
    summaryCard.className = 'agent-summary-card';
    summaryCard.style.cssText = `
      align-self: flex-start;
      max-width: 78%;
      padding: 10px 14px;
      border-radius: 10px;
      background: var(--surface, #fff);
      border: 1px solid var(--border, #E5E7EB);
      font-size: 14px;
      line-height: 1.5;
      margin-bottom: 6px;
      animation: fadeInUp 0.25s ease forwards;
    `;
    summaryCard.textContent = s.agentSummary;
    chatEl.appendChild(summaryCard);
  }

  // 1. Render explanation if present (reuse existing renderStructuredResponse)
  if (s.explanation && ((s.explanation.steps && s.explanation.steps.length > 0) || s.explanation.answer)) {
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

// ── Contextual Next-Study Decision CTA ───────────────────────────────────────────
// Injected below tutor response and inline MCQ submission when backend signals
// action=practice | review | introduce for the active topic & concept.
// Reuses existing /practice/next, /practice/submit, and tutor pipeline.
// No new learning logic — backend remains the single source of truth.

function shouldShowPracticeCTA(structured) {
  if (!structured) return false;
  const ns = structured.nextStudy;
  if (!ns) return false;
  if (!structured.knowledgeFound) return false;
  if (ns.action !== 'practice' && ns.action !== 'review' && ns.action !== 'introduce') return false;
  if (ns.topic !== structured.currentTopic || ns.concept !== structured.currentConcept) return false;
  return true;
}

const CONCEPT_LABELS = {
  photosynthesis: {
    name: 'ଆଲୋକ ସଂଶ୍ଳେଷଣ',
    en: 'Photosynthesis',
    concepts: {
      oxygen_role: { od: 'ଆଲୋକ ସଂଶ୍ଳେଷଣରେ ଅମ୍ଳଜାନର ଭୂମିକା', en: 'role of oxygen in photosynthesis' },
      carbon_dioxide_role: { od: 'ଆଲୋକ ସଂଶ୍ଳେଷଣରେ ଅଙ୍ଗାରକାମ୍ଳର ଭୂମିକା', en: 'role of carbon dioxide in photosynthesis' },
      carbon_dioxide: { od: 'ଆଲୋକ ସଂଶ୍ଳେଷଣରେ ଅଙ୍ଗାରକାମ୍ଳ', en: 'role of carbon dioxide in photosynthesis' },
      sunlight: { od: 'ଆଲୋକ ସଂଶ୍ଳେଷଣରେ ସୂର୍ଯ୍ୟାଲୋକର ଭୂମିକା', en: 'role of sunlight in photosynthesis' },
      water: { od: 'ଆଲୋକ ସଂଶ୍ଳେଷଣରେ ଜଳର ଭୂମିକା', en: 'role of water in photosynthesis' },
      chlorophyll: { od: 'ଆଲୋକ ସଂଶ୍ଳେଷଣରେ ପତ୍ରହରିତ', en: 'chlorophyll in photosynthesis' },
      chloroplast: { od: 'ହରିତକଣିକା', en: 'chloroplast in photosynthesis' },
      stomata: { od: 'ପତ୍ରରନ୍ଧ୍ର', en: 'stomata in photosynthesis' }
    }
  },
  respiration: {
    name: 'ଶ୍ୱାସକ୍ରିୟା',
    en: 'Respiration',
    concepts: {
      plant_respiration: { od: 'ଉଦ୍ଭିଦ ଶ୍ୱାସକ୍ରିୟା', en: 'plant respiration' },
      human_breathing: { od: 'ମଣିଷର ଶ୍ୱାସକ୍ରିୟା', en: 'human breathing' },
      inhalation_oxygen: { od: 'ଶ୍ୱାସକ୍ରିୟାରେ ଅମ୍ଳଜାନ ଗ୍ରହଣ', en: 'inhalation of oxygen in respiration' },
      exhalation_co2: { od: 'ଶ୍ୱାସକ୍ରିୟାରେ ଅଙ୍ଗାରକାମ୍ଳ ତ୍ୟାଗ', en: 'exhalation of carbon dioxide in respiration' }
    }
  },
  cell: {
    name: 'କୋଷ',
    en: 'Cell',
    concepts: {
      mitochondria_powerhouse: { od: 'କୋଷର ଶକ୍ତି କେନ୍ଦ୍ର ମାଇଟୋକଣ୍ଡ୍ରିଆ', en: 'mitochondria powerhouse of cell' },
      cell_wall: { od: 'କୋଷ ଭିତ୍ତି', en: 'cell wall' },
      nucleus: { od: 'କୋଷର ନ୍ୟୁକ୍ଲିଅସ', en: 'cell nucleus' }
    }
  },
  states_of_matter: {
    name: 'ପଦାର୍ଥର ଅବସ୍ଥା',
    en: 'States of Matter',
    concepts: {
      heating_water: { od: 'ଗରମ ଜଳର ଅବସ୍ଥା ପରିବର୍ତ୍ତନ', en: 'heating water and changes of state' },
      boiling_point: { od: 'ଜଳର ସ୍ଫୁଟନାଙ୍କ', en: 'boiling point of water' },
      melting_point: { od: 'ବରଫର ଗଳନାଙ୍କ', en: 'melting point of ice' },
      water_states: { od: 'ଜଳର ତିନୋଟି ଅବସ୍ଥା', en: 'three states of water' }
    }
  },
  force_and_motion: {
    name: 'ବଳ ଓ ଗତି',
    en: 'Force and Motion',
    concepts: {
      inertia_first_law: { od: 'ଜଡ଼ତା ଏବଂ ଗତିର ପ୍ରଥମ ନିୟମ', en: 'inertia and first law of motion' },
      momentum_second_law: { od: 'ସଂବେଗ ଏବଂ ଗତିର ଦ୍ୱିତୀୟ ନିୟମ', en: 'momentum and second law of motion' },
      action_reaction_third_law: { od: 'ପ୍ରତିକ୍ରିୟା ଏବଂ ଗତିର ତୃତୀୟ ନିୟମ', en: 'action reaction third law of motion' }
    }
  },
  evaporation: {
    name: 'ବାଷ୍ପୀଭବନ',
    en: 'Evaporation',
    concepts: {
      cooling_effect: { od: 'ବାଷ୍ପୀଭବନ ଦ୍ୱାରା ଶୀତଳତା', en: 'cooling effect of evaporation' },
      liquid_to_gas: { od: 'ତରଳରୁ ବାଷ୍ପରେ ପରିଣତ', en: 'liquid to gas evaporation' }
    }
  },
  water_cycle: {
    name: 'ଜଳଚକ୍ର',
    en: 'Water Cycle',
    concepts: {
      condensation_clouds: { od: 'ଘନୀଭବନ ଏବଂ ମେଘ ସୃଷ୍ଟି', en: 'condensation and clouds in water cycle' },
      precipitation_rain: { od: 'ବର୍ଷା ଏବଂ ଅବକ୍ଷେପଣ', en: 'precipitation and rain in water cycle' },
      evaporation_stage: { od: 'ଜଳଚକ୍ରରେ ବାଷ୍ପୀଭବନ', en: 'evaporation stage in water cycle' }
    }
  },
  matter: {
    name: 'ପଦାର୍ଥ',
    en: 'Matter',
    concepts: {
      particles_atoms: { od: 'ପଦାର୍ଥର କଣିକା ଓ ଅଣୁ', en: 'particles and atoms of matter' },
      mass_and_space: { od: 'ପଦାର୍ଥର ବସ୍ତୁତ୍ୱ ଓ ସ୍ଥାନ', en: 'mass and space of matter' }
    }
  }
};

function getIntroduceQuery(topic, concept, isOdiaUI) {
  const topInfo = CONCEPT_LABELS[topic];
  const conceptInfo = topInfo?.concepts?.[concept];
  if (isOdiaUI) {
    const term = conceptInfo?.od || topInfo?.name || topic;
    return `${term} ବିଷୟରେ ସହଜ ଭାବରେ ବୁଝାଅ।`;
  } else {
    const term = conceptInfo?.en || topInfo?.en || topic;
    return `Please explain ${term} in a simple and concise way.`;
  }
}

function injectPracticeCTA(finalData) {
  const s  = finalData?.structured;
  if (!shouldShowPracticeCTA(s)) return;
  const ns = s.nextStudy;

  if (typeof chatEl !== 'undefined' && chatEl) {
    chatEl.querySelectorAll('.next-study-card, .practice-cta').forEach(el => {
      if (!el.closest('.inline-mcq')) el.remove();
    });
  }

  const isOdiaUI = typeof currentLanguage !== 'undefined' && currentLanguage === 'Odia';

  let titleText = '';
  let descText = '';
  let btnLabel = '';

  if (ns.action === 'practice') {
    titleText = isOdiaUI ? '🧠 ଏବେ କ\'ଣ କରିବା?' : '🧠 What should we do next?';
    if (ns.reason === 'partially_understood') {
      descText = isOdiaUI
        ? '🧠 ତୁମେ ଏହି ବିଷୟଟି ବିଷୟରେ ପଚାରିଛ। ଆହୁରି ଭଲଭାବେ ବୁଝିବା ପାଇଁ ଗୋଟିଏ ପ୍ରଶ୍ନ କରିବା।'
        : 'You asked about this topic. Let\'s practice a question to understand it better.';
    } else {
      descText = isOdiaUI
        ? 'ଏହି ବିଷୟଟି ଆହୁରି ଭଲଭାବେ ବୁଝିବା ପାଇଁ ଅଭ୍ୟାସ କରିବା।'
        : 'Let\'s practice a question to strengthen your understanding.';
    }
    btnLabel = isOdiaUI ? '📝 ଗୋଟିଏ ପ୍ରଶ୍ନ କରିବା' : '📝 Practice a question';
  } else if (ns.action === 'review') {
    titleText = isOdiaUI ? '🔄 ପୁଣିଥରେ ଅଭ୍ୟାସ କରିବା' : '🔄 Review and practice again';
    if (ns.reason === 'practice_incorrect') {
      descText = isOdiaUI
        ? 'ଏହି ପ୍ରଶ୍ନର ଉତ୍ତରଟି ଭୁଲ ହୋଇଛି। ଚାଲ, ଏହି ଧାରଣାଟିକୁ ପୁଣିଥରେ ଅଭ୍ୟାସ କରିବା।'
        : 'This answer was incorrect. Let\'s practice this concept again.';
    } else if (ns.reason === 'recent_confusion') {
      descText = isOdiaUI
        ? 'ତୁମେ ଏହି ବିଷୟଟିକୁ ପୁଣିଥରେ ପଚାରିଛ। ଚାଲ, ଏହାକୁ ଆଉଥରେ ଅଭ୍ୟାସ କରିବା।'
        : 'You asked about this topic again. Let\'s practice it once more.';
    } else if (ns.reason === 'fallback_used' || ns.reason === 'needed_repair') {
      descText = isOdiaUI
        ? 'ଏହି ବିଷୟଟିକୁ ଆଉଥରେ ଭଲଭାବେ ଅଭ୍ୟାସ କରିବା।'
        : 'Let\'s practice this topic again to understand it clearly.';
    } else {
      descText = isOdiaUI
        ? 'ତୁମର ଉତ୍ତରରେ ଟିକେ ଭୁଲ ହୋଇଛି। ଆଉଥରେ ଅଭ୍ୟାସ କଲେ ଏହା ଭଲଭାବେ ବୁଝିପାରିବ।'
        : 'Let\'s review and practice this concept again to build confidence.';
    }
    btnLabel = isOdiaUI ? '🔄 ପୁଣିଥରେ ଅଭ୍ୟାସ କରିବା' : '🔄 Practice again';
  } else if (ns.action === 'introduce') {
    titleText = isOdiaUI ? '📚 ପ୍ରଥମେ ଏହାକୁ ଶିଖିବା' : '📚 Learn this first';
    descText = isOdiaUI
      ? 'ଚାଲ, ଏହି ବିଷୟଟିକୁ ସହଜ ଭାବରେ ବୁଝିବା।'
      : 'Let\'s learn this topic step-by-step in a simple way.';
    btnLabel = isOdiaUI ? '📖 ଶିଖିବା ଆରମ୍ଭ କର' : '📖 Start learning';
  }

  const card = document.createElement('div');
  card.className = 'next-study-card';

  const titleEl = document.createElement('div');
  titleEl.className = 'next-study-card__title';
  titleEl.textContent = titleText;
  card.appendChild(titleEl);

  const descEl = document.createElement('p');
  descEl.className = 'next-study-card__text';
  descEl.textContent = descText;
  card.appendChild(descEl);

  const cta = document.createElement('button');
  cta.className = 'next-study-card__btn practice-cta';
  cta.textContent = btnLabel;
  cta.setAttribute('aria-label', btnLabel);
  card.appendChild(cta);

  if (typeof chatEl !== 'undefined' && chatEl) {
    chatEl.appendChild(card);
    scrollToBottom();
  }

  cta.addEventListener('click', async () => {
    cta.disabled = true;
    cta.textContent = isOdiaUI ? '⏳ ଲୋଡ ହେଉଛି...' : '⏳ Loading...';

    if (ns.action === 'introduce') {
      card.remove();
      const query = getIntroduceQuery(ns.topic, ns.concept, isOdiaUI);
      if (typeof addBubble === 'function') addBubble(query, 'user');
      if (typeof sendToChat === 'function') await sendToChat(query);
      return;
    }

    try {
      const r = await fetch('/practice/next', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: { action: ns.action, topic: ns.topic, concept: ns.concept },
          language: currentLanguage,
          excludeQuestion: s.lastQuestion || null
        })
      });
      if (!r.ok) throw new Error('practice/next failed');
      const data = await r.json();

      card.remove();

      if (data.exhausted) {
        const revCard = document.createElement('div');
        revCard.className = 'practice-completed-msg';
        const explText = data.explanation || data.message || '';
        revCard.innerHTML = `<strong>${isOdiaUI ? '📖 ବିଷୟ ସାରାଂଶ:' : '📖 Review Summary:'}</strong> <p>${explText}</p>`;
        if (typeof chatEl !== 'undefined' && chatEl) {
          chatEl.appendChild(revCard);
          scrollToBottom();
        }
        return;
      }

      const { activity } = data;
      if (!activity) throw new Error('No activity returned');

      console.log('[Practice] /practice/next activity:', JSON.stringify(activity));
      renderInlineMCQ(activity);
    } catch (e) {
      cta.disabled = false;
      cta.textContent = btnLabel;
      toast(isOdiaUI ? 'ପ୍ରଶ୍ନ ଲୋଡ ହେଲା ନାହିଁ। ପୁନଃ ଚେଷ୍ଟା କରନ୍ତୁ।' : 'Could not load question. Try again.', 'error');
    }
  });
}

function getActivityFingerprint(activity) {
  if (!activity) return '';
  if (activity.id) return activity.id;
  const top = activity.topic || '';
  const con = activity.concept || '';
  const q = (activity.question || '').replace(/\s+/g, ' ').trim();
  return `${top}:${con}:${q}`;
}

function renderInlineMCQ(activity) {
  if (!activity) return;
  const fp = getActivityFingerprint(activity);
  const safeId = fp.replace(/[^a-zA-Z0-9_\u0b00-\u0b7f:-]/g, '_');

  if (typeof chatEl !== 'undefined' && chatEl) {
    const existing = chatEl.querySelector(`.inline-mcq[data-activity-id="${safeId}"]`);
    if (existing) {
      console.warn('[Practice] Duplicate activity detected, skipping render:', fp);
      existing.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
      return;
    }
  }

  const isOdiaUI = typeof currentLanguage !== 'undefined' && currentLanguage === 'Odia';

  const card = document.createElement('div');
  card.className = 'inline-mcq';
  card.setAttribute('data-activity-id', safeId);

  const qEl = document.createElement('p');
  qEl.className = 'inline-mcq__question';
  qEl.textContent = activity.question;
  card.appendChild(qEl);

  if (typeof speechController !== 'undefined' && typeof speechController.createSpeechControl === 'function') {
    const qSpeech = speechController.createSpeechControl({
      getText: () => activity.question,
      getLanguage: () => (typeof currentLanguage !== 'undefined' ? currentLanguage : 'English'),
      ariaPrefix: 'practice question'
    });
    if (qSpeech) card.appendChild(qSpeech);
  }

  const opts = document.createElement('div');
  opts.className = 'inline-mcq__options';

  (activity.options || []).forEach(opt => {
    const btn = document.createElement('button');
    btn.className = 'inline-mcq__option';
    btn.textContent = opt;
    btn.addEventListener('click', () => submitInlineMCQ(activity, opt, card));
    opts.appendChild(btn);
  });

  card.appendChild(opts);
  if (typeof chatEl !== 'undefined' && chatEl) {
    chatEl.appendChild(card);
    scrollToBottom();
  }
}

async function submitInlineMCQ(activity, selectedOption, card) {
  const isOdiaUI = typeof currentLanguage !== 'undefined' && currentLanguage === 'Odia';

  // Disable all option buttons immediately
  card.querySelectorAll('.inline-mcq__option').forEach(b => { b.disabled = true; });

  const reqBody = { activity, studentAnswer: selectedOption };
  console.log('[Practice] POST /practice/submit', JSON.stringify(reqBody).slice(0, 300));
  console.log('[Practice] submit activity:', JSON.stringify(activity));

  let r;
  try {
    r = await fetch('/practice/submit', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(reqBody)
    });
  } catch (networkErr) {
    console.error('[Practice] Network error calling /practice/submit:', networkErr);
    card.querySelectorAll('.inline-mcq__option').forEach(b => { b.disabled = false; });
    toast(isOdiaUI ? 'ନେଟୱାର୍କ ତ୍ରୁଟି। ପୁନଃ ଚେଷ୍ଟା କରନ୍ତୁ।' : 'Network error. Please try again.', 'error');
    return;
  }

  console.log('[Practice] /practice/submit status:', r.status);

  if (!r.ok) {
    const errText = await r.text().catch(() => '(unreadable)');
    console.error('[Practice] /practice/submit failed:', r.status, errText);
    card.querySelectorAll('.inline-mcq__option').forEach(b => { b.disabled = false; });
    toast(isOdiaUI ? 'ଦାଖଲ ବିଫଳ ହେଲା। ପୁନଃ ଚେଷ୍ଟା କରନ୍ତୁ।' : 'Submit failed. Please try again.', 'error');
    return;
  }

  let result;
  try {
    result = await r.json();
    console.log('[Practice] submit response:', JSON.stringify(result));
  } catch (parseErr) {
    console.error('[Practice] /practice/submit JSON parse error:', parseErr);
    card.querySelectorAll('.inline-mcq__option').forEach(b => { b.disabled = false; });
    toast(isOdiaUI ? 'ଅଜ୍ଞାତ ଉତ୍ତର। ପୁନଃ ଚେଷ୍ଟା କରନ୍ତୁ।' : 'Invalid response. Please try again.', 'error');
    return;
  }

  // /practice/submit returns { practiceResult, learningState, nextStudy }
  const pr = result.practiceResult;
  console.log('[Practice] /practice/submit response:', JSON.stringify({ correct: pr?.correct, evidence: pr?.evidence, nextStudy: result.nextStudy }));

  if (!pr) {
    console.error('[Practice] Missing practiceResult in response:', result);
    card.querySelectorAll('.inline-mcq__option').forEach(b => { b.disabled = false; });
    toast(isOdiaUI ? 'ଅଜ୍ଞାତ ଉତ୍ତର।' : 'Unexpected response.', 'error');
    return;
  }

  // Highlight correct / incorrect options
  card.querySelectorAll('.inline-mcq__option').forEach(b => {
    if (b.textContent === activity.correctAnswer) {
      b.classList.add('inline-mcq__option--correct');
    } else if (b.textContent === selectedOption && !pr.correct) {
      b.classList.add('inline-mcq__option--wrong');
    }
  });

  // Show feedback
  const fb = document.createElement('div');
  fb.className = 'inline-mcq__feedback';
  const icon = pr.correct ? '✅' : '❌';
  const verdict = pr.correct
    ? (isOdiaUI ? 'ସଠିକ୍!' : 'Correct!')
    : (isOdiaUI ? 'ଭୁଲ।' : 'Incorrect.');
  fb.innerHTML = `<strong>${icon} ${verdict}</strong>`;
  if (pr.feedback) {
    const exp = document.createElement('p');
    exp.textContent = pr.feedback;
    fb.appendChild(exp);
  }

  if (typeof speechController !== 'undefined' && typeof speechController.createSpeechControl === 'function') {
    const feedbackText = `${verdict}. ${pr.feedback || ''}`.trim();
    const fbSpeech = speechController.createSpeechControl({
      getText: () => feedbackText,
      getLanguage: () => (typeof currentLanguage !== 'undefined' ? currentLanguage : 'English'),
      ariaPrefix: 'practice feedback'
    });
    if (fbSpeech) fb.appendChild(fbSpeech);
  }

  card.appendChild(fb);

  // Clean up any stale CTA card in chat
  if (typeof chatEl !== 'undefined' && chatEl) {
    chatEl.querySelectorAll('.next-study-card, .practice-cta').forEach(el => el.remove());
  }

  // Requirement C: Correct Answer -> Concept completed, show completion message and NO CTA
  if (pr.correct) {
    const comp = document.createElement('div');
    comp.className = 'practice-completed-msg';
    comp.innerHTML = isOdiaUI
      ? '<span>🎉 ବହୁତ ବଢ଼ିଆ! ଏହି ଧାରଣାଟି ସଫଳତାର ସହ ଅଭ୍ୟାସ ହୋଇଗଲା।</span>'
      : '<span>🎉 Great job! Concept practiced successfully.</span>';
    card.appendChild(comp);
    scrollToBottom();
    return;
  }

  scrollToBottom();

  // Requirement A: Wrong Answer -> Show ONE Review CTA with lastQuestion passed
  if (result.nextStudy && (result.nextStudy.action === 'review' || result.nextStudy.action === 'practice')) {
    injectPracticeCTA({
      structured: {
        knowledgeFound: true,
        currentTopic: activity.topic,
        currentConcept: activity.concept,
        nextStudy: result.nextStudy,
        lastQuestion: activity.question
      }
    });
  }
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    shouldShowPracticeCTA,
    injectPracticeCTA,
    CONCEPT_LABELS,
    getIntroduceQuery,
    getActivityFingerprint,
    renderInlineMCQ
  };
}

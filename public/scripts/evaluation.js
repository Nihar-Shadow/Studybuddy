/* Evaluation Report */
/* Evaluation report */
// ============ Evaluation Report ============
async function showEvaluationReport() {
  const btn = document.getElementById('evaluation-btn');
  btn.disabled = true;
  btn.textContent = '📈 Generating...';

  // Show loading card
  const card = document.createElement('div');
  card.className = 'evaluation-report';
  card.innerHTML = `<div class="evo-loading"><span class="evo-spinner"></span> Analyzing your learning journey...</div>`;
  chatEl.appendChild(card);
  scrollToBottom();

  try {
    const res  = await fetch('/progress-report', { method: 'POST' });
    const data = await res.json();

    if (!data.success || !data.report) {
      card.innerHTML = `<div class="evo-loading">⚠️ Could not generate report. Study some topics first!</div>`;
      btn.disabled = false;
      btn.textContent = '📈 Evaluation Report';
      return;
    }

    const r = data.report;
    let html = '';

    // Header
    html += `<div class="evo-header">
      <h3>📈 Dynamic Progress Evaluation Report</h3>
      <div class="evo-subtitle">Adaptive analysis of your learning journey</div>
    </div>`;

    // 1. Evaluation Narrative
    html += `<div class="evo-section">
      <div class="evo-section-title"><span class="evo-section-icon">🧭</span> Evaluation Narrative</div>
      <div class="evo-section-body">${escapeHtml(r.narrative) || 'No narrative available yet.'}</div>
    </div>`;

    // 2. Intelligence Cross-Pollination
    if (r.crossPollination && r.crossPollination.topicA) {
      html += `<div class="evo-section">
        <div class="evo-section-title"><span class="evo-section-icon">🔗</span> Hidden Connection</div>
        <div class="evo-section-body">
          <span class="evo-connection-badge">${escapeHtml(r.crossPollination.topicA)}</span>
          ↔
          <span class="evo-connection-badge">${escapeHtml(r.crossPollination.topicB)}</span>
          <div style="margin-top:6px;">${escapeHtml(r.crossPollination.connection)}</div>
        </div>
      </div>`;
    }

    // 3. Vocabulary Heatmap
    if (r.vocabularyHeatmap) {
      html += `<div class="evo-section">
        <div class="evo-section-title"><span class="evo-section-icon">🌡️</span> Vocabulary Heatmap</div>
        <div class="evo-section-body">${escapeHtml(r.vocabularyHeatmap)}</div>
      </div>`;
    }

    // 4. One Big Domino
    if (r.bigDomino && r.bigDomino.topic) {
      html += `<div class="evo-section">
        <div class="evo-section-title"><span class="evo-section-icon">🎯</span> One Big Domino</div>
        <div class="evo-domino-box">
          <div class="evo-domino-topic">🧱 ${escapeHtml(r.bigDomino.topic)}</div>
          <div class="evo-domino-reason">${escapeHtml(r.bigDomino.reasoning)}</div>
        </div>
      </div>`;
    }

    // 5. Micro-Mission
    if (r.microMission && r.microMission.task) {
      html += `<div class="evo-section">
        <div class="evo-section-title"><span class="evo-section-icon">⚡</span> Your Micro-Mission (2 min)</div>
        <div class="evo-mission-box">
          <div class="evo-mission-task">${escapeHtml(r.microMission.task)}</div>
          <div class="evo-mission-target">Targets: ${escapeHtml(r.microMission.topic)}</div>
        </div>
      </div>`;
    }

    card.innerHTML = html;
    // Multi-stage scroll to ensure chat scrolls past tall report
    scrollToBottom();
    setTimeout(scrollToBottom, 300);
    setTimeout(scrollToBottom, 800);

  } catch (err) {
    card.innerHTML = `<div class="evo-loading">⚠️ Network error. Please try again.</div>`;
    console.error('[EvaluationReport]', err);
  }

  btn.disabled = false;
  btn.textContent = '📈 Evaluation Report';
}

(function() {
  'use strict';

  // ── Config ──
  const REFRESH_MS  = 2000;    // auto-refresh interval
  const MAX_BAR_MS  = 30000;   // 30s = 100% bar width
  const PANEL_KEY   = 'sb_devpanel_open';  // localStorage key for open/closed state

  // ── Colour helpers ──
  function colour(ms) {
    if (ms === null || ms === undefined) return '#484F58';
    if (ms <  500)  return '#3FB950';   // green  — fast
    if (ms < 8000)  return '#F59E0B';   // amber  — medium
    return '#F85149';                   // red    — slow
  }

  function barWidth(ms) {
    if (!ms) return 0;
    return Math.min(100, Math.round((ms / MAX_BAR_MS) * 100));
  }

  function fmt(ms) {
    if (ms === null || ms === undefined) return '—';
    if (ms < 1000) return ms + 'ms';
    return (ms / 1000).toFixed(1) + 's';
  }

  // ── Build panel HTML ──
  function createPanel() {
    const panel = document.createElement('div');
    panel.id = 'sb-dev-panel';
    panel.style.cssText = `
      position: fixed;
      top: 10px;
      right: 10px;
      z-index: 99999;
      font-family: 'JetBrains Mono', 'Courier New', monospace;
      font-size: 11px;
      user-select: none;
    `;

    // ── Collapsed tab ──
    const tab = document.createElement('div');
    tab.id = 'sb-dev-tab';
    tab.style.cssText = `
      background: #0D1117;
      border: 1px solid #30363D;
      border-radius: 6px;
      padding: 5px 10px;
      cursor: pointer;
      display: flex;
      align-items: center;
      gap: 6px;
      color: #E6EDF3;
      white-space: nowrap;
    `;
    tab.innerHTML = `
      <div id="sb-dot" style="width:6px;height:6px;border-radius:50%;background:#3FB950;flex-shrink:0;"></div>
      <span style="color:#8B949E;">DEV</span>
      <span id="sb-tab-time" style="color:#F59E0B;">—</span>
      <span id="sb-tab-arrow" style="color:#484F58;font-size:9px;">▼</span>
    `;
    tab.addEventListener('click', togglePanel);

    // ── Expanded panel ──
    const expanded = document.createElement('div');
    expanded.id = 'sb-dev-expanded';
    expanded.style.cssText = `
      background: #0D1117;
      border: 1px solid #30363D;
      border-radius: 8px;
      width: 340px;
      margin-top: 4px;
      overflow: hidden;
      display: none;
    `;
    expanded.innerHTML = `
      <div style="background:#161B22;border-bottom:1px solid #30363D;
                  padding:6px 10px;display:flex;align-items:center;gap:6px;">
        <div id="sb-hdr-dot" style="width:8px;height:8px;border-radius:50%;
                                     background:#3FB950;flex-shrink:0;"></div>
        <span style="color:#8B949E;flex:1;">StudyBuddy Diagnostics</span>
        <span style="background:#1C2128;border:1px solid #30363D;border-radius:4px;
                     padding:1px 6px;font-size:10px;color:#8B949E;">DEV</span>
        <span id="sb-close" style="color:#484F58;cursor:pointer;font-size:9px;
                                    margin-left:4px;">✕</span>
      </div>

      <!-- Tab bar -->
      <div id="sb-tab-bar" style="display:flex;border-bottom:1px solid #21262D;background:#0D1117;">
        <div class="sb-tab active" data-tab="metrics"
             style="flex:1;text-align:center;padding:5px 0;font-size:10px;
                    cursor:pointer;color:#E6EDF3;border-bottom:2px solid #388BFD;">
          📊 Metrics
        </div>
        <div class="sb-tab" data-tab="flow"
             style="flex:1;text-align:center;padding:5px 0;font-size:10px;
                    cursor:pointer;color:#484F58;border-bottom:2px solid transparent;">
          🔀 Flow
        </div>
      </div>

      <div id="sb-body" style="padding:8px 0;">
        <div style="padding:6px 10px;color:#484F58;font-size:10px;">Loading metrics...</div>
      </div>

      <div id="sb-flow-body" style="padding:8px 0;display:none;max-height:420px;overflow-y:auto;">
        <div style="padding:6px 10px;color:#484F58;font-size:10px;">No flow traces yet. Send a chat, quiz, or generate a map first.</div>
      </div>

      <div style="border-top:1px solid #21262D;padding:4px 10px;
                  display:flex;align-items:center;gap:8px;color:#484F58;font-size:9px;">
        <span>auto-refresh 2s</span>
        <div style="margin-left:auto;display:flex;gap:10px;">
          <span id="sb-run-now" style="cursor:pointer;color:#388BFD;">run now</span>
          <span id="sb-clear"   style="cursor:pointer;">clear</span>
          <span id="sb-collapse" style="cursor:pointer;">▲ hide</span>
        </div>
      </div>
    `;

    panel.appendChild(tab);
    panel.appendChild(expanded);
    document.body.appendChild(panel);

    // Wire up buttons
    document.getElementById('sb-close').addEventListener('click',    closePanel);
    document.getElementById('sb-collapse').addEventListener('click', closePanel);
    document.getElementById('sb-run-now').addEventListener('click',  () => { fetchAndRender(); fetchFlowTraces(); });
    document.getElementById('sb-clear').addEventListener('click',    clearMetrics);

    // Wire up tab switching
    document.querySelectorAll('#sb-tab-bar .sb-tab').forEach(t => {
      t.addEventListener('click', () => switchTab(t.dataset.tab));
    });

    // Restore open/closed state from localStorage
    const wasOpen = localStorage.getItem(PANEL_KEY) === 'true';
    if (wasOpen) openPanel();
  }

  // ── Panel open/close ──
  function togglePanel() {
    const exp = document.getElementById('sb-dev-expanded');
    if (exp.style.display === 'none') openPanel();
    else closePanel();
  }

  function openPanel() {
    document.getElementById('sb-dev-expanded').style.display = 'block';
    document.getElementById('sb-tab-arrow').textContent = '▲';
    localStorage.setItem(PANEL_KEY, 'true');
    if (activeTab === 'metrics') fetchAndRender();
    else fetchFlowTraces();
  }

  function closePanel() {
    document.getElementById('sb-dev-expanded').style.display = 'none';
    document.getElementById('sb-tab-arrow').textContent = '▼';
    localStorage.setItem(PANEL_KEY, 'false');
  }

  // ── Fetch metrics and render ──
  async function fetchAndRender() {
    try {
      const res  = await fetch('/dev/metrics');
      const data = await res.json();
      updateTab(data);
      renderBody(data);
    } catch {
      document.getElementById('sb-tab-time').textContent = 'ERR';
      document.getElementById('sb-tab-time').style.color = '#F85149';
    }
  }

  function updateTab(data) {
    const ms  = data.lastRequestMs;
    const tab = document.getElementById('sb-tab-time');
    if (tab) {
      tab.textContent = fmt(ms);
      tab.style.color = colour(ms);
    }
    // Update status dot colour
    const dot    = document.getElementById('sb-dot');
    const hdrDot = document.getElementById('sb-hdr-dot');
    const dotCol = data.totalErrors > 0 ? '#F85149' : '#3FB950';
    if (dot)    dot.style.background    = dotCol;
    if (hdrDot) hdrDot.style.background = dotCol;
  }

  function renderBody(data) {
    const body = document.getElementById('sb-body');
    if (!body) return;

    // Route order for display
    const routeOrder = ['/estimate', '/chat', '/quiz', '/agent', '/progress'];
    const routeMap   = {};
    data.routes.forEach(r => routeMap[r.route] = r);

    // Build rows for known routes + any others seen
    const allRoutes = [
      ...routeOrder.filter(r => routeMap[r]),
      ...data.routes.filter(r => !routeOrder.includes(r.route)).map(r => r.route)
    ];

    // Summary stats row
    let html = `
      <div style="display:flex;gap:1px;padding:4px 10px 6px;">
        ${statCell(fmt(data.lastRequestMs), 'last req', colour(data.lastRequestMs))}
        ${statCell(data.totalCacheHits,     'cache hits', '#3FB950')}
        ${statCell(data.totalRequests,      'requests',  '#8B949E')}
        ${statCell(data.totalErrors,        'errors',    data.totalErrors > 0 ? '#F85149' : '#8B949E')}
      </div>

      <div style="border-top:1px solid #21262D;"></div>
      <div style="font-size:9px;color:#484F58;padding:4px 10px 2px;
                  text-transform:uppercase;letter-spacing:.08em;">routes — last 60s</div>
    `;

    // Route rows
    for (const route of allRoutes) {
      const r = routeMap[route];
      if (!r) continue;
      const isAgent  = route === '/agent';
      const label    = route + (r.cacheHits > 0 ? ' ✦' : '');
      html += metricRow(label, r.last, r.avg, r.count, isAgent);
    }

    // Tool breakdown
    if (data.toolBreakdown && data.toolBreakdown.length > 0) {
      html += `
        <div style="border-top:1px solid #21262D;margin-top:4px;"></div>
        <div style="font-size:9px;color:#484F58;padding:4px 10px 2px;
                    text-transform:uppercase;letter-spacing:.08em;">tool breakdown — last agent</div>
      `;
      for (const t of data.toolBreakdown) {
        html += toolRow(t.tool, t.ms, t.cached);
      }
    }

    // Cache stats section (if available)
    if (data.cache) {
      const c = data.cache;
      html += `
        <div style="border-top:1px solid #21262D;"></div>
        <div style="font-size:9px;color:#484F58;padding:4px 10px 2px;
                    text-transform:uppercase;letter-spacing:.08em;">smart cache + taxonomy</div>
        <div style="display:flex;gap:1px;padding:4px 10px 6px;">
          ${statCell(c.memEntries,    'mem entries', '#3FB950')}
          ${statCell(c.inFlight,      'in-flight',   '#F0B429')}
          ${statCell(c.liveKeywords,  'keywords',    '#388BFD')}
          ${statCell(c.pendingTopics, 'pending',     c.pendingTopics > 0 ? '#F0B429' : '#3FB950')}
        </div>
        ${c.pendingTopics > 0 ? `
          <div style="padding:2px 10px 4px;font-size:9px;color:#F0B429;">
            ${c.pendingTopics} topic(s) waiting for admin review →
            <span style="cursor:pointer;color:#388BFD;text-decoration:underline;" onclick="window.open('/admin')">open admin</span>
          </div>` : ''}
      `;
    }

    // Parse metrics section (if available)
    if (data.parseMetrics) {
      const pm = data.parseMetrics;
      const total = Object.values(pm).reduce((a, b) => a + b, 0) || 1;
      html += `
        <div style="border-top:1px solid #21262D;"></div>
        <div style="font-size:9px;color:#484F58;padding:4px 10px 2px;
                    text-transform:uppercase;letter-spacing:.08em;">json parse methods</div>
        <div style="padding:4px 10px 6px;font-size:10px;font-family:monospace;
                    display:flex;flex-direction:column;gap:2px;">
          ${Object.entries(pm).map(([method, count]) => {
            const pct   = Math.round((count / total) * 100);
            const color = method === 'direct'             ? '#3FB950' :
                          method === 'plaintext_fallback' ? '#E0504A' : '#F0B429';
            return '<div style="display:flex;align-items:center;gap:6px;">' +
              '<span style="color:' + color + ';min-width:150px;">' + method + '</span>' +
              '<div style="flex:1;height:4px;background:#21262D;border-radius:2px;">' +
                '<div style="width:' + pct + '%;height:4px;background:' + color + ';border-radius:2px;"></div>' +
              '</div>' +
              '<span style="color:#8B949E;min-width:24px;text-align:right;">' + count + '</span>' +
            '</div>';
          }).join('')}
        </div>
      `;
    }

    // Uptime footer
    html += `
      <div style="border-top:1px solid #21262D;margin-top:4px;"></div>
      <div style="font-size:9px;color:#484F58;padding:4px 10px;display:flex;gap:8px;">
        <span>uptime ${formatUptime(data.uptime)}</span>
        <span style="margin-left:auto;">${new Date().toLocaleTimeString()}</span>
      </div>
    `;

    body.innerHTML = html;
  }

  // ── HTML helpers ──

  function statCell(val, label, col) {
    return `
      <div style="flex:1;background:#161B22;border:1px solid #21262D;border-radius:4px;
                  padding:4px 6px;text-align:center;margin:0 1px;">
        <div style="font-size:12px;font-weight:600;color:${col};">${val}</div>
        <div style="font-size:9px;color:#484F58;margin-top:1px;">${label}</div>
      </div>
    `;
  }

  function metricRow(label, lastMs, avgMs, count, highlight) {
    const c     = colour(lastMs);
    const bw    = barWidth(lastMs);
    const border = highlight ? 'border-left:2px solid #388BFD;' : '';
    return `
      <div style="display:flex;align-items:center;padding:3px 10px;gap:6px;
                  ${border}cursor:default;"
           title="avg: ${fmt(avgMs)} | calls: ${count}">
        <span style="color:#8B949E;flex:1;font-size:10px;overflow:hidden;
                     text-overflow:ellipsis;white-space:nowrap;">${label}</span>
        <div style="width:64px;height:3px;background:#21262D;border-radius:2px;flex-shrink:0;">
          <div style="width:${bw}%;height:3px;border-radius:2px;background:${c};"></div>
        </div>
        <span style="font-size:10px;min-width:44px;text-align:right;color:${c};">
          ${fmt(lastMs)}
        </span>
      </div>
    `;
  }

  function toolRow(name, ms, cached) {
    const c  = ms ? colour(ms) : '#3FB950';
    const bw = ms ? barWidth(ms) : 1;
    const label = name.replace(/_/g, '_​');   // zero-width space for wrapping
    const suffix = cached ? ' ✦' : '';
    return `
      <div style="display:flex;align-items:center;padding:2px 10px 2px 18px;gap:6px;">
        <span style="color:#484F58;flex:1;font-size:10px;">${label}${suffix}</span>
        <div style="width:64px;height:3px;background:#21262D;border-radius:2px;flex-shrink:0;">
          <div style="width:${bw}%;height:3px;border-radius:2px;background:${c};"></div>
        </div>
        <span style="font-size:10px;min-width:44px;text-align:right;color:${c};">
          ${ms ? fmt(ms) : 'sync'}
        </span>
      </div>
    `;
  }

  function formatUptime(secs) {
    if (secs < 60)   return secs + 's';
    if (secs < 3600) return Math.floor(secs / 60) + 'm ' + (secs % 60) + 's';
    return Math.floor(secs / 3600) + 'h ' + Math.floor((secs % 3600) / 60) + 'm';
  }

  // ── Clear metrics ──
  async function clearMetrics() {
    await fetch('/dev/metrics', { method: 'DELETE' });
    fetchAndRender();
  }

  // ── Tab switching ──
  let activeTab = 'metrics';

  function switchTab(tabName) {
    activeTab = tabName;
    const metricsBody = document.getElementById('sb-body');
    const flowBody    = document.getElementById('sb-flow-body');
    if (!metricsBody || !flowBody) return;

    document.querySelectorAll('#sb-tab-bar .sb-tab').forEach(t => {
      const isActive = t.dataset.tab === tabName;
      t.style.color = isActive ? '#E6EDF3' : '#484F58';
      t.style.borderBottomColor = isActive ? '#388BFD' : 'transparent';
    });

    if (tabName === 'metrics') {
      metricsBody.style.display = 'block';
      flowBody.style.display    = 'none';
      fetchAndRender();
    } else {
      metricsBody.style.display = 'none';
      flowBody.style.display    = 'block';
      fetchFlowTraces();
    }
  }

  // ── Flow Traces ──
  async function fetchFlowTraces() {
    try {
      const res  = await fetch('/dev/flow-traces');
      const data = await res.json();
      renderFlowBody(data);
    } catch {
      const fb = document.getElementById('sb-flow-body');
      if (fb) fb.innerHTML = '<div style="padding:10px;color:#F85149;font-size:10px;">Failed to load flow traces</div>';
    }
  }

  function renderFlowBody(traces) {
    const fb = document.getElementById('sb-flow-body');
    if (!fb) return;

    const routes = ['/chat', '/quiz', '/concept-map'];
    const icons  = { '/chat': '💬', '/quiz': '🧠', '/concept-map': '🗺️' };
    const labels = { '/chat': 'Chat', '/quiz': 'Quiz', '/concept-map': 'Concept Map' };

    let html = '';

    // Architecture overview — static flow diagram
    html += `
      <div style="padding:6px 10px 2px;">
        <div style="font-size:9px;color:#484F58;text-transform:uppercase;letter-spacing:.08em;margin-bottom:6px;">
          Architecture Overview
        </div>
        <pre style="font-family:'JetBrains Mono',monospace;font-size:9px;line-height:1.5;
                    color:#8B949E;margin:0;white-space:pre;overflow-x:auto;padding:6px 0;">` +
`<span style="color:#388BFD;">┌─────────────┐</span>     <span style="color:#388BFD;">┌──────────────┐</span>     <span style="color:#A371F7;">┌──────────────┐</span>
<span style="color:#388BFD;">│   Browser   │</span>────▶<span style="color:#388BFD;">│  Express.js  │</span>────▶<span style="color:#A371F7;">│  Ollama API  │</span>
<span style="color:#388BFD;">│  (Frontend) │</span>◀────<span style="color:#388BFD;">│   Server     │</span>◀────<span style="color:#A371F7;">│  gemma4:e4b  │</span>
<span style="color:#388BFD;">└─────────────┘</span>     <span style="color:#388BFD;">└──────┬───────┘</span>     <span style="color:#A371F7;">└──────────────┘</span>
                           <span style="color:#484F58;">│</span>
                    <span style="color:#484F58;">┌──────┴───────┐</span>
                    <span style="color:#484F58;">│  Post-process│</span>
                    <span style="color:#484F58;">│  JSON parse  │</span>
                    <span style="color:#484F58;">│  Validation  │</span>
                    <span style="color:#484F58;">└──────────────┘</span></pre>
      </div>
      <div style="border-top:1px solid #21262D;margin:6px 0;"></div>
    `;

    // Per-route flow diagrams
    let hasTraces = false;
    for (const route of routes) {
      const trace = traces[route];
      if (!trace) continue;
      hasTraces = true;

      const icon  = icons[route] || '📡';
      const label = labels[route] || route;
      const statusIcon = trace.status === 'ok' ? '✅' : '❌';
      const statusCol  = trace.status === 'ok' ? '#3FB950' : '#F85149';
      const ago = formatAgo(trace.ts);

      html += `
        <div style="padding:6px 10px;">
          <div style="display:flex;align-items:center;gap:6px;margin-bottom:4px;">
            <span>${icon}</span>
            <span style="color:#E6EDF3;font-weight:600;font-size:11px;">${label}</span>
            <span style="color:${statusCol};font-size:10px;">${statusIcon} ${fmt(trace.totalMs)}</span>
            <span style="margin-left:auto;color:#484F58;font-size:9px;">${ago}</span>
          </div>
          <div style="color:#484F58;font-size:9px;margin-bottom:6px;">
            Input: <span style="color:#8B949E;">${escHtml(trace.input || '—')}</span>
          </div>
      `;

      // Render the step-by-step flow
      html += renderStepFlow(trace.steps, trace.totalMs);
      html += `</div><div style="border-top:1px solid #21262D;margin:2px 0;"></div>`;
    }

    if (!hasTraces) {
      html += `
        <div style="padding:16px 10px;text-align:center;">
          <div style="color:#484F58;font-size:11px;margin-bottom:4px;">No flow traces yet</div>
          <div style="color:#30363D;font-size:10px;">Send a chat message, generate a quiz, or create a concept map to see the flow.</div>
        </div>
      `;
    }

    fb.innerHTML = html;
  }

  function renderStepFlow(steps, totalMs) {
    if (!steps || steps.length === 0) return '<div style="color:#484F58;font-size:9px;padding:4px 0;">No steps recorded</div>';

    let html = '<div style="font-family:\'JetBrains Mono\',monospace;font-size:9.5px;line-height:1.7;">';

    for (let i = 0; i < steps.length; i++) {
      const step = steps[i];
      const prevMs = i > 0 ? steps[i - 1].ms : 0;
      const delta  = step.ms - prevMs;
      const isLast = i === steps.length - 1;
      const isError = step.name === 'ERROR';

      // Determine colour based on delta (time since previous step)
      const deltaCol = isError ? '#F85149' : delta < 50 ? '#3FB950' : delta < 5000 ? '#F59E0B' : '#F85149';
      const nameCol  = isError ? '#F85149' : '#E6EDF3';

      // Bar: proportional to time taken for this step relative to total
      const pct = totalMs > 0 ? Math.min(100, Math.round((delta / totalMs) * 100)) : 0;

      // Connector line
      const connector = isLast ? '└' : '├';
      const pipe = isLast ? ' ' : '│';

      html += `
        <div style="display:flex;align-items:flex-start;gap:0;">
          <span style="color:#30363D;min-width:14px;">${connector}─</span>
          <div style="flex:1;">
            <div style="display:flex;align-items:center;gap:6px;">
              <span style="color:${nameCol};">${escHtml(step.name)}</span>
              <span style="color:${deltaCol};font-size:9px;font-weight:600;">+${fmt(delta)}</span>
              <span style="color:#484F58;font-size:8px;">@ ${fmt(step.ms)}</span>
            </div>
            ${step.detail ? `<div style="color:#484F58;font-size:8px;margin-top:1px;">${escHtml(step.detail)}</div>` : ''}
            <div style="width:100%;height:3px;background:#21262D;border-radius:2px;margin:2px 0 1px;">
              <div style="width:${pct}%;height:3px;border-radius:2px;background:${deltaCol};
                          transition:width 0.3s ease;"></div>
            </div>
          </div>
        </div>
      `;
    }

    // Summary: which step took the longest?
    if (steps.length > 1) {
      let maxDelta = 0, bottleneck = '';
      for (let i = 0; i < steps.length; i++) {
        const prevMs = i > 0 ? steps[i - 1].ms : 0;
        const delta  = steps[i].ms - prevMs;
        if (delta > maxDelta) {
          maxDelta = delta;
          bottleneck = steps[i].name;
        }
      }
      if (bottleneck) {
        const bnCol = maxDelta < 5000 ? '#F59E0B' : '#F85149';
        html += `
          <div style="margin-top:4px;padding:3px 6px;background:#161B22;border:1px solid #21262D;
                      border-radius:4px;font-size:9px;">
            <span style="color:#484F58;">⚡ Bottleneck:</span>
            <span style="color:${bnCol};font-weight:600;">${escHtml(bottleneck)}</span>
            <span style="color:${bnCol};">(${fmt(maxDelta)} — ${totalMs > 0 ? Math.round((maxDelta / totalMs) * 100) : 0}% of total)</span>
          </div>
        `;
      }
    }

    html += '</div>';
    return html;
  }

  function formatAgo(ts) {
    const diff = Date.now() - ts;
    if (diff < 5000)  return 'just now';
    if (diff < 60000) return Math.round(diff / 1000) + 's ago';
    if (diff < 3600000) return Math.round(diff / 60000) + 'm ago';
    return Math.round(diff / 3600000) + 'h ago';
  }

  function escHtml(str) {
    if (!str) return '';
    return String(str).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  }

  // ── Auto-refresh loop ──
  function startAutoRefresh() {
    setInterval(() => {
      // Only fetch if panel is expanded — no background polling when collapsed
      const exp = document.getElementById('sb-dev-expanded');
      if (exp && exp.style.display !== 'none') {
        if (activeTab === 'metrics') fetchAndRender();
        else fetchFlowTraces();
      } else {
        // Still update the tab time even when collapsed
        fetch('/dev/metrics')
          .then(r => r.json())
          .then(updateTab)
          .catch(() => {});
      }
    }, REFRESH_MS);
  }

  // ── Keyboard shortcut: Ctrl+Shift+B toggles panel ──
  document.addEventListener('keydown', (e) => {
    if (e.ctrlKey && e.shiftKey && (e.key === 'B' || e.key === 'b')) {
      e.preventDefault();
      togglePanel();
    }
  });

  // ── Init ──
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
      createPanel();
      startAutoRefresh();
    });
  } else {
    createPanel();
    startAutoRefresh();
  }

})();

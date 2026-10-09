/* Utility functions: scrollToBottom, addBubble, escapeHtml */

// ============ XSS Guard ============
function escapeHtml(str) {
  if (typeof str !== 'string') return '';
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

// ============ Performance: Batched Scroll Helper ============
// Uses requestAnimationFrame to batch scroll updates and prevent layout thrashing
let scrollRAF = null;
function scrollToBottom() {
  if (scrollRAF) return; // Already scheduled
  scrollRAF = requestAnimationFrame(() => {
    chatEl.scrollTop = chatEl.scrollHeight;
    scrollRAF = null;
  });
}

// ============ Message Bubble Helper ============
function addBubble(content, role, isHTML = false, autoScroll = true) {
  const div = document.createElement('div');
  div.className = `bubble ${role}`;
  if (isHTML) {
    div.innerHTML = content;
  } else {
    div.textContent = content;
  }
  chatEl.appendChild(div);
  if (autoScroll) scrollToBottom();
  return div;
}

// ============ Toast (replaces alert() for non-blocking errors) ============
function toast(message, kind = 'error', durationMs = 4500) {
  let host = document.getElementById('toast-host');
  if (!host) {
    host = document.createElement('div');
    host.id = 'toast-host';
    document.body.appendChild(host);
  }
  const el = document.createElement('div');
  el.className = `toast toast--${kind}`;
  el.setAttribute('role', kind === 'error' ? 'alert' : 'status');
  el.setAttribute('aria-live', kind === 'error' ? 'assertive' : 'polite');
  const icon = kind === 'error' ? '⚠️' : kind === 'success' ? '✅' : 'ℹ️';
  el.innerHTML = `<span class="toast__icon">${icon}</span><span class="toast__msg"></span>`;
  el.querySelector('.toast__msg').textContent = message;
  host.appendChild(el);
  requestAnimationFrame(() => el.classList.add('toast--in'));
  setTimeout(() => {
    el.classList.remove('toast--in');
    el.classList.add('toast--out');
    setTimeout(() => el.remove(), 250);
  }, durationMs);
}

/* Keyboard shortcuts overlay: ? to open, Esc to close, Cmd/Ctrl+K focus input,
   Cmd/Ctrl+/ cycle theme. Suppressed when focus is in an editable element. */
class ShortcutManager {
  constructor() {
    this.overlay = null;
    this.isVisible = false;
    this.init();
  }
  init() {
    this.createOverlay();
    document.addEventListener('keydown', (e) => {
      if (this.isInputFocused(e.target)) {
        if (e.key === 'Escape' && this.isVisible) { e.preventDefault(); this.hide(); }
        return;
      }
      if (e.key === '?' && !e.ctrlKey && !e.metaKey && !e.altKey) {
        e.preventDefault(); this.toggle(); return;
      }
      if (e.key === 'Escape' && this.isVisible) {
        e.preventDefault(); this.hide(); return;
      }
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        const input = document.getElementById('input');
        if (input) input.focus();
        return;
      }
      if ((e.metaKey || e.ctrlKey) && e.key === '/') {
        e.preventDefault(); this.cycleTheme(); return;
      }
    });
  }
  isInputFocused(t) {
    if (!t) return false;
    return t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.isContentEditable;
  }
  createOverlay() {
    const isMac = navigator.platform.includes('Mac');
    const mod = isMac ? '⌘' : 'Ctrl';
    this.overlay = document.createElement('div');
    this.overlay.className = 'shortcuts-overlay';
    this.overlay.setAttribute('role', 'dialog');
    this.overlay.setAttribute('aria-modal', 'true');
    this.overlay.setAttribute('aria-label', 'Keyboard shortcuts');
    this.overlay.innerHTML = `
      <div class="shortcuts-modal">
        <div class="shortcuts-header">
          <h3>Keyboard Shortcuts</h3>
          <button class="shortcuts-close" aria-label="Close">×</button>
        </div>
        <div class="shortcuts-body">
          <div class="shortcut-section">General</div>
          <div class="shortcut-row"><span>Show shortcuts</span><span class="shortcut-keys"><kbd>?</kbd></span></div>
          <div class="shortcut-row"><span>Focus chat input</span><span class="shortcut-keys"><kbd>${mod}</kbd><span>+</span><kbd>K</kbd></span></div>
          <div class="shortcut-row"><span>Cycle level (Beginner → Intermediate → Advanced)</span><span class="shortcut-keys"><kbd>${mod}</kbd><span>+</span><kbd>/</kbd></span></div>
          <div class="shortcut-section">Learning</div>
          <div class="shortcut-row"><span>Send message</span><span class="shortcut-keys"><kbd>Enter</kbd></span></div>
          <div class="shortcut-row"><span>New line</span><span class="shortcut-keys"><kbd>Shift</kbd><span>+</span><kbd>Enter</kbd></span></div>
          <div class="shortcut-section">Accessibility</div>
          <div class="shortcut-row"><span>Close / Cancel</span><span class="shortcut-keys"><kbd>Esc</kbd></span></div>
        </div>
      </div>`;
    document.body.appendChild(this.overlay);
    this.overlay.querySelector('.shortcuts-close').addEventListener('click', () => this.hide());
    this.overlay.addEventListener('click', (e) => { if (e.target === this.overlay) this.hide(); });
  }
  toggle() { this.isVisible ? this.hide() : this.show(); }
  show() {
    this.overlay.classList.add('active');
    this.isVisible = true;
    const closeBtn = this.overlay.querySelector('.shortcuts-close');
    if (closeBtn) closeBtn.focus();
  }
  hide() {
    this.overlay.classList.remove('active');
    this.isVisible = false;
  }
  cycleTheme() {
    const select = document.getElementById('level');
    const order = ['beginner', 'intermediate', 'advanced'];
    const cur = select ? select.value : (document.body.dataset.theme || 'intermediate');
    const next = order[(order.indexOf(cur) + 1) % order.length];
    if (select) {
      select.value = next;
      // Fire change so any existing listeners (e.g. estimate, persistence) run.
      select.dispatchEvent(new Event('change', { bubbles: true }));
    }
    if (typeof applyTheme === 'function') applyTheme(next);
    else document.body.setAttribute('data-theme', next);
  }
}
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => new ShortcutManager());
} else {
  new ShortcutManager();
}

/* Streak counter pop + confetti when count increases.
   Uses MutationObserver instead of polling to react instantly to any
   code path that updates the count (initial fetch, post-quiz refresh, etc.). */
class StreakAnimator {
  constructor() {
    this.badge = document.getElementById('streak-badge');
    this.countEl = document.getElementById('streak-count');
    this.lastCount = 0;
    this.initialized = false;
    if (this.badge && this.countEl) this.init();
  }
  init() {
    this.lastCount = parseInt(this.countEl.textContent || '0', 10) || 0;
    this.initialized = true;
    const observer = new MutationObserver(() => {
      const newCount = parseInt(this.countEl.textContent, 10) || 0;
      if (newCount > this.lastCount) this.animate(newCount);
      this.lastCount = newCount;
    });
    observer.observe(this.countEl, { childList: true, characterData: true, subtree: true });
  }
  animate(count) {
    this.badge.classList.add('pop');
    this.spawnConfetti(6);
    setTimeout(() => this.badge.classList.remove('pop'), 800);
    this.announce(`Streak updated! ${count} days.`);
  }
  spawnConfetti(count) {
    const colors = ['#fb923c', '#fbbf24', '#34d399', '#60a5fa'];
    const rect = this.badge.getBoundingClientRect();
    for (let i = 0; i < count; i++) {
      const p = document.createElement('div');
      const left = rect.left + rect.width / 2 + (Math.random() - 0.5) * 30;
      p.style.cssText = `position:fixed;left:${left}px;top:${rect.top}px;width:5px;height:5px;border-radius:50%;background:${colors[i % colors.length]};pointer-events:none;z-index:9999;`;
      p.animate(
        [
          { transform: 'translateY(0) rotate(0deg)', opacity: 1 },
          { transform: 'translateY(35px) rotate(180deg)', opacity: 0 }
        ],
        { duration: 700, easing: 'ease-out' }
      );
      document.body.appendChild(p);
      setTimeout(() => p.remove(), 750);
    }
  }
  announce(msg) {
    let el = document.getElementById('sr-announcer');
    if (!el) {
      el = document.createElement('div');
      el.id = 'sr-announcer';
      el.setAttribute('aria-live', 'polite');
      el.style.cssText = 'position:absolute;left:-10000px;width:1px;height:1px;overflow:hidden;';
      document.body.appendChild(el);
    }
    el.textContent = msg;
  }
}
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => new StreakAnimator());
} else {
  new StreakAnimator();
}

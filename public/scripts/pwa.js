/* PWA Service Worker registration & install banner */
(function() {
  'use strict';

  // ── Service Worker Registration ────────────────────
  if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
      navigator.serviceWorker.register('/sw.js', { scope: '/' })
        .then(reg => {
          console.log('[PWA] Service Worker registered:', reg.scope);
          setInterval(() => {
            reg.update().catch(err => console.warn('[PWA] SW update check failed:', err));
          }, 5 * 60 * 1000);
        })
        .catch(err => console.warn('[PWA] Service Worker registration failed:', err));
    });

    navigator.serviceWorker.addEventListener('controllerchange', () => {
      console.log('[PWA] New Service Worker took control');
    });
  }

  // ── Standalone Mode Detection ────────────────────
  if (window.matchMedia('(display-mode: standalone)').matches) {
    document.body.classList.add('pwa-standalone');
    console.log('[PWA] Running in standalone mode');
  }

  // ── Install Prompt Banner ────────────────────
  let deferredPrompt = null;
  const banner     = document.getElementById('pwa-install-banner');
  const installBtn = document.getElementById('pwa-install-btn');
  const dismissBtn = document.getElementById('pwa-dismiss-btn');

  window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault();
    deferredPrompt = e;
    setTimeout(() => {
      if (banner && !banner.classList.contains('show')) banner.classList.add('show');
    }, 3000);
  });

  if (installBtn) {
    installBtn.addEventListener('click', () => {
      if (!deferredPrompt) return;
      deferredPrompt.prompt();
      deferredPrompt.userChoice.then((result) => {
        if (result.outcome === 'accepted') hideBanner();
        deferredPrompt = null;
      });
    });
  }

  if (dismissBtn) dismissBtn.addEventListener('click', hideBanner);

  function hideBanner() { if (banner) banner.classList.remove('show'); }

  window.addEventListener('appinstalled', () => {
    console.log('[PWA] App installed successfully');
    hideBanner();
  });
})();

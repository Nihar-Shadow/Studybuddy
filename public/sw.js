const CACHE_VERSION   = 'studybuddy-v6';
const SHELL_CACHE     = `${CACHE_VERSION}-shell`;
const RUNTIME_CACHE   = `${CACHE_VERSION}-runtime`;

// App shell — these files are cached on install
// They are the minimum needed to show the UI offline
const SHELL_ASSETS = [
  '/',
  '/index.html',
  '/offline.html',
  '/manifest.json',
  '/assets/icon-192.png',
  '/assets/icon-512.png',
  '/assets/icon-maskable.png',
  // Stylesheets
  '/styles/variables.css',
  '/styles/base.css',
  '/styles/layout.css',
  '/styles/chat.css',
  '/styles/input.css',
  '/styles/voice.css',
  '/styles/socratic.css',
  '/styles/evaluation.css',
  '/styles/quiz.css',
  '/styles/concept-map.css',
  '/styles/vision.css',
  '/styles/agent.css',
  '/styles/progress.css',
  '/styles/pwa.css',
  // Scripts
  '/scripts/state.js',
  '/scripts/utils.js',
  '/scripts/image.js',
  '/scripts/chat.js',
  '/scripts/quiz.js',
  '/scripts/socratic.js',
  '/scripts/concept-map.js',
  '/scripts/theme.js',
  '/scripts/loading.js',
  '/scripts/render.js',
  '/scripts/agent.js',
  '/scripts/evaluation.js',
  '/scripts/voice.js',
  '/scripts/init.js',
  '/scripts/pwa.js',
  // Vendor scripts (precached for offline)
  '/vendor/d3.min.js',
  '/vendor/chart.umd.min.js',
  // Typography is system-fonts — no external font request to cache.
];

// Routes that should NEVER be cached (always need live server)
const NEVER_CACHE = [
  '/dev/metrics',
  '/admin',
  '/admin/taxonomy',
  '/cache-stats',
  '/devpanel.js',
];

// API routes — try network first, cache response as fallback
const API_ROUTES = [
  '/chat',
  '/quiz',
  '/estimate',
  '/progress',
  '/topics/search',
  // New routes: Socratic mode, concept maps, SRS, streaks
  '/agent',
  '/socratic',
  '/concept-map',
  '/due-reviews',
  '/streak',
  '/srs',
];

// ── Install event — cache the app shell ────────────────────
self.addEventListener('install', (event) => {
  console.log('[SW] Installing...');
  event.waitUntil(
    caches.open(SHELL_CACHE)
      .then(cache => {
        console.log('[SW] Caching app shell');
        // Use individual adds so one failure doesn't break everything
        return Promise.allSettled(
          SHELL_ASSETS.map(url => cache.add(url).catch(err => {
            console.warn(`[SW] Failed to cache: ${url}`, err.message);
          }))
        );
      })
      .then(() => {
        console.log('[SW] Shell cached. Activating immediately.');
        return self.skipWaiting();  // activate new SW without waiting
      })
  );
});

// ── Activate event — clean up old caches ──────────────────
self.addEventListener('activate', (event) => {
  console.log('[SW] Activating...');
  event.waitUntil(
    caches.keys()
      .then(cacheNames => {
        return Promise.all(
          cacheNames
            .filter(name => name.startsWith('studybuddy-') && name !== SHELL_CACHE && name !== RUNTIME_CACHE)
            .map(name => {
              console.log(`[SW] Deleting old cache: ${name}`);
              return caches.delete(name);
            })
        );
      })
      .then(() => {
        console.log('[SW] Activated. Claiming clients.');
        return self.clients.claim();  // take control of all open tabs immediately
      })
  );
});

// ── Fetch event — intercept all network requests ──────────
self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);

  // Only handle requests to our own origin. Typography is system-fonts now,
  // so there's no third-party origin we want to mediate.
  if (url.origin !== self.location.origin) return;

  // Never cache dev/admin routes — always go to network
  if (NEVER_CACHE.some(route => url.pathname.startsWith(route))) {
    return; // no event.respondWith = default browser behaviour
  }

  // POST requests (API calls like /chat, /agent) — network only
  // We cannot cache POST responses meaningfully
  if (event.request.method === 'POST') {
    event.respondWith(
      fetch(event.request).catch(() => {
        // If network fails on a POST (truly offline), return a helpful JSON error
        return new Response(
          JSON.stringify({
            error: 'offline',
            message: 'You are offline. The AI model needs to be reachable on your local network.',
            offline: true
          }),
          {
            status: 503,
            headers: { 'Content-Type': 'application/json' }
          }
        );
      })
    );
    return;
  }

  // GET API routes — network first, then cache, then offline page
  if (API_ROUTES.some(route => url.pathname.startsWith(route))) {
    event.respondWith(networkFirst(event.request));
    return;
  }

  // App shell assets — cache first (fastest for repeat loads)
  event.respondWith(cacheFirst(event.request));
});

// ── Cache strategies ───────────────────────────────────────

// Cache First: serve from cache immediately, update cache in background
async function cacheFirst(request) {
  const cached = await caches.match(request);
  if (cached) {
    // Update cache in background without blocking response
    updateCacheInBackground(request);
    return cached;
  }
  // Not in cache — fetch and cache for next time
  return fetchAndCache(request, SHELL_CACHE);
}

// Network First: try network, fall back to cache, then offline page
async function networkFirst(request) {
  try {
    const response = await fetch(request);
    // Cache successful GET responses
    if (response.ok) {
      const cache = await caches.open(RUNTIME_CACHE);
      cache.put(request, response.clone());
    }
    return response;
  } catch {
    // Network failed — try cache
    const cached = await caches.match(request);
    if (cached) return cached;
    // Nothing in cache either — return offline page for navigation requests
    if (request.mode === 'navigate') {
      return caches.match('/offline.html');
    }
    return new Response('Offline', { status: 503 });
  }
}

// Fetch a resource and store it in the specified cache
async function fetchAndCache(request, cacheName) {
  try {
    const response = await fetch(request);
    if (response.ok && response.status < 400) {
      const cache = await caches.open(cacheName);
      cache.put(request, response.clone());
    }
    return response;
  } catch {
    // Network failed completely
    if (request.mode === 'navigate') {
      const offlinePage = await caches.match('/offline.html');
      return offlinePage || new Response('<h1>Offline</h1>', {
        headers: { 'Content-Type': 'text/html' }
      });
    }
    return new Response('Network error', { status: 503 });
  }
}

// Background cache update — doesn't block the response
function updateCacheInBackground(request) {
  fetch(request)
    .then(response => {
      if (response.ok) {
        caches.open(SHELL_CACHE).then(cache => cache.put(request, response));
      }
    })
    .catch(() => {}); // silently ignore background update failures
}

// ── Message handler — allow pages to control the SW ───────
self.addEventListener('message', (event) => {
  if (event.data?.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
  if (event.data?.type === 'GET_VERSION') {
    event.ports[0].postMessage({ version: CACHE_VERSION });
  }
});

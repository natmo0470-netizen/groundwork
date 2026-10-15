/* Groundwork — offline support. Caches the app shell so it opens without a connection.
   Bump VERSION whenever app files change so phones pick up the update. */
const VERSION = 'groundwork-v1.15.0';
const SHELL = [
  './', './index.html', './manifest.webmanifest', './css/styles.css',
  './js/exercises.js', './js/foods.js', './js/recipes.js', './js/mealplan.js', './js/scanner.js', './js/anim.js', './js/store.js',
  './js/calc.js', './js/planner.js', './js/programs.js', './js/reminders.js', './js/ui.js', './js/app.js',
  './js/screens.js', './js/actions.js', './js/mealui.js', './js/guide.js', './js/advanced.js', './js/safety.js', './js/coach.js', './js/native.js', './js/health.js', './js/meals.js', './js/cloud-config.js', './js/cloud.js', './js/join.js', './js/coachstart.js', './icons/icon-192.png', './icons/icon-512.png',
];
self.addEventListener('install', e => {
  e.waitUntil(caches.open(VERSION).then(c => c.addAll(SHELL)).then(() => self.skipWaiting()));
});
self.addEventListener('activate', e => {
  e.waitUntil(caches.keys().then(keys => Promise.all(keys.filter(k => k !== VERSION).map(k => caches.delete(k)))).then(() => self.clients.claim()));
});
self.addEventListener('fetch', e => {
  const url = new URL(e.request.url);
  if (e.request.method !== 'GET' || url.origin !== location.origin) return; // food search, fonts, CDN: network only
  // Stale-while-revalidate: answer from cache instantly, refresh the cache in the background.
  e.respondWith(caches.open(VERSION).then(async cache => {
    const hit = await cache.match(e.request, { ignoreSearch: true });
    const net = fetch(e.request).then(res => { if (res.ok) cache.put(e.request, res.clone()); return res; }).catch(() => hit);
    return hit || net;
  }));
});

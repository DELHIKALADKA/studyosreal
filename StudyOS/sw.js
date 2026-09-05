/* ============================================================
   StudyOS — service worker
   Offline-first: every app shell file is precached on install, so
   after the first visit StudyOS opens with no network at all.

   Strategy:
     - navigations  -> cache-first on index.html (instant cold start)
     - same-origin  -> cache-first, then network, then cache the copy
     - cross-origin -> passed straight through (there are none by design)

   Bump CACHE when you ship changes; the old cache is dropped on activate.
   ============================================================ */
const CACHE = "studyos-v2";

const SHELL = [
  "./",
  "./index.html",
  "./manifest.webmanifest",
  "./css/styles.css",
  "./css/auth.css",
  "./js/utils.js",
  "./js/logo.js",
  "./js/db.js",
  "./js/db-bridge.js",
  "./js/store.js",
  "./js/tutor.js",
  "./js/ui.js",
  "./js/auth.js",
  "./js/pages-core.js",
  "./js/pages-study.js",
  "./js/pages-meta.js",
  "./js/app.js",
  "./icons/icon.svg",
  "./icons/icon-192.png",
  "./icons/icon-512.png",
  "./icons/icon-180.png",
  // SQLite engine + the migration SQL it applies on first run.
  "./vendor/sql-wasm.js",
  "./vendor/sql-wasm.wasm",
  "./db/migrations/001_initial.sql",
  "./db/migrations/002_social_and_sync.sql",
  "./db/migrations/003_search_and_views.sql",
];

self.addEventListener("install", (e) => {
  e.waitUntil(
    caches.open(CACHE)
      // addAll rejects the whole batch if one file 404s, so cache individually.
      .then((c) => Promise.all(SHELL.map((u) => c.add(u).catch(() => {}))))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener("activate", (e) => {
  e.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", (e) => {
  const req = e.request;
  if (req.method !== "GET") return;

  const url = new URL(req.url);
  if (url.origin !== location.origin) return;

  // App is a single page — serve the shell for any navigation.
  if (req.mode === "navigate") {
    e.respondWith(
      caches.match("./index.html").then((hit) => hit || fetch(req).catch(() => caches.match("./")))
    );
    return;
  }

  e.respondWith(
    caches.match(req).then((hit) => {
      if (hit) {
        // Refresh in the background so the next load gets the newer file.
        fetch(req).then((res) => {
          if (res && res.ok) caches.open(CACHE).then((c) => c.put(req, res.clone()));
        }).catch(() => {});
        return hit;
      }
      return fetch(req).then((res) => {
        if (res && res.ok) {
          const copy = res.clone();
          caches.open(CACHE).then((c) => c.put(req, copy));
        }
        return res;
      });
    })
  );
});

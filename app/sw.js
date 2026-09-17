// Offline support for /app/.
//
// Scoped to /app/ by where this file sits, so it controls the app's pages and
// nothing else. It still has to answer for /chart/src/ and /chart/data/, because
// that is where the renderer and the town lists live, shared with /chart/ rather
// than copied. A service worker sees every request its own pages make,
// whatever the URL, so it can cache those without owning /chart/ — and requests
// made by /chart/'s pages go to /chart/'s worker, never this one.
//
// Network first, cache as fallback, for the same reason as /chart/: a stale
// renderer casts a stale chart while looking current, so online is always
// fresh and offline is the last good copy. It never touches /prints/, where a
// cached page could show a price the checkout would refuse.
//
// Bump CACHE when SHELL changes. cache.addAll fails the whole install if any
// entry 404s, so a renamed module has to be renamed here too.

const CACHE = "astrolabe-app-v2";

// Each installable page clears only caches with its own prefix. Caches are
// shared across the site, and deleting everything that isn't ours would wipe
// /chart/'s offline copy every time this one updated.
const OWN = "astrolabe-app-";

const SHELL = [
  "/app/",
  "/app/manifest.webmanifest",
  "/app/src/profiles.js",
  "/chart/src/angles.js",
  "/chart/src/chiron-data.js",
  "/chart/src/ephemeris.js",
  "/chart/src/instrument.js",
  "/chart/src/places.js",
  "/chart/src/points.js",
  "/chart/src/projection.js",
  "/chart/src/vsop87-data.js",
  "/chart/src/vsop87.js",
  "/chart/src/wheel.js",
  // The zone and region tables, but not the town lists: one file per letter,
  // several megabytes together, each cached the first time it is searched.
  "/chart/data/places/meta.json",
  "/chart/icons/apple-touch-icon.png",
  "/chart/icons/icon-192.png",
  "/chart/icons/icon-512.png",
];

// What this worker answers for. Everything else — fonts, /prints/, the
// homepage — goes straight to the network untouched.
const MINE = ["/app/", "/chart/src/", "/chart/data/", "/chart/icons/"];

self.addEventListener("install", (event) => {
  event.waitUntil(caches.open(CACHE).then((cache) => cache.addAll(SHELL)));
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(
        keys.filter((k) => k.startsWith(OWN) && k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  );
});

self.addEventListener("fetch", (event) => {
  const req = event.request;
  if (req.method !== "GET") return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin || !MINE.some((p) => url.pathname.startsWith(p))) return;

  event.respondWith(
    fetch(req)
      .then((res) => {
        if (res.ok) {
          const copy = res.clone();
          caches.open(CACHE).then((cache) => cache.put(req, copy));
        }
        return res;
      })
      .catch(() =>
        caches.match(req).then((hit) =>
          hit || (req.mode === "navigate" ? caches.match("/app/") : Response.error()),
        ),
      ),
  );
});

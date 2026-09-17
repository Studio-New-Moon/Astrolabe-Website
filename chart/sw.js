// Offline support for /chart/.
//
// Scoped to /chart/ by where this file sits, and deliberately so: it must never
// stand between a buyer and /prints/, where checkout needs the network and a
// cached page could show a price the broker would refuse.
//
// Network first, cache as the fallback. The obvious PWA strategy is the
// reverse — serve from cache, update in the background — and its classic
// failure is a visitor stuck on an old version they cannot see is old. This
// renderer changes when the app's astronomy does, and a stale copy casts a
// stale chart while looking perfectly current. So: online, always fresh;
// offline, the last good copy. A chart needs nothing from a server, which is
// what makes offline worth having at all.
//
// Bump CACHE when SHELL changes. A name that stays the same keeps serving the
// old file list to anyone offline until they next load the page online.

const CACHE = "astrolabe-chart-v5";

// Every file the page needs to cast a chart with no signal. cache.addAll fails
// the whole install if any one of these 404s, so a renamed module has to be
// renamed here too, or the service worker silently never installs.
const SHELL = [
  "/chart/",
  "/chart/manifest.webmanifest",
  "/chart/src/angles.js",
  "/chart/src/chiron-data.js",
  "/chart/src/ephemeris.js",
  "/chart/src/instrument.js",
  "/chart/src/instrument-view.js",
  "/chart/src/pass.js",
  "/chart/src/places.js",
  // The place tables, but not the town lists themselves: those are one file
  // per letter, several megabytes together, and each is cached the first time
  // someone searches that letter.
  "/chart/data/places/meta.json",
  "/chart/src/points.js",
  "/chart/src/projection.js",
  "/chart/src/vsop87-data.js",
  "/chart/src/vsop87.js",
  "/chart/src/wheel.js",
  "/chart/icons/apple-touch-icon.png",
  "/chart/icons/icon-192.png",
  "/chart/icons/icon-512.png",
];

self.addEventListener("install", (event) => {
  event.waitUntil(caches.open(CACHE).then((cache) => cache.addAll(SHELL)));
  self.skipWaiting();
});

// Clear out this page's own older caches, and nothing else.
//
// This used to delete every cache that was not CACHE, which was harmless while
// /chart/ was the only installable page. Caches are shared across the whole
// origin, though, so once /app/ installed too, each one's update would have
// wiped the other's offline copy — and whichever updated last would have left
// the other unable to open without a signal. Hence the prefix: each service
// worker owns the caches whose names start with its own.
const OWN = "astrolabe-chart-";

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
  // Same origin and inside /chart/ only. Fonts and everything else go straight
  // to the network untouched; offline they fall back to the serif stack.
  if (url.origin !== self.location.origin || !url.pathname.startsWith("/chart/")) return;

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
          hit || (req.mode === "navigate" ? caches.match("/chart/") : Response.error()),
        ),
      ),
  );
});

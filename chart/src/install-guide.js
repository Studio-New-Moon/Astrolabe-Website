// The Home Screen guide: a sheet that shows, step by step, how to put the page
// on this device's Home Screen, with an arrow pointing at the browser's own
// button. Shared by /chart/ and /app/.
//
// Only Chrome-family browsers offer to install a web app themselves, and only
// once the page asks. Everywhere else the route runs through a menu nobody
// finds unaided, and each browser hides it somewhere different, so the steps
// and the arrow are worked out per browser. The layouts follow philfung's
// add-to-homescreen (MIT), which tracks them as Safari moves things: iOS 26
// put Share behind the ••• button, iOS 27 behind a new bar button.
//
// The sheet opens by itself once, on a phone or tablet, and never again. After
// that the page's own banner (`hint`) reopens it until it is dismissed.

const ua = navigator.userAgent;
const isIPad = /iPad/.test(ua) || (/Macintosh/.test(ua) && navigator.maxTouchPoints > 1);
const isIOS = /iPhone|iPod/.test(ua) || isIPad;
const isAndroid = /Android/.test(ua);

export const installed = () =>
  window.matchMedia("(display-mode: standalone)").matches || navigator.standalone === true;

// ---------- the browser's own buttons, drawn small ----------

const svg = (body, view = "0 0 24 24") =>
  `<svg viewBox="${view}" aria-hidden="true" fill="none" stroke="currentColor" ` +
  `stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round">${body}</svg>`;

const GLYPH = {
  share: svg('<path d="M8.5 9H6.5a1.5 1.5 0 0 0-1.5 1.5v9A1.5 1.5 0 0 0 6.5 21h11a1.5 1.5 0 0 0 1.5-1.5v-9A1.5 1.5 0 0 0 17.5 9h-2"/><path d="M12 14.5V3"/><path d="M8.5 6.5 12 3l3.5 3.5"/>'),
  more: svg('<circle cx="12" cy="12" r="9.5"/><circle cx="7.6" cy="12" r=".9" fill="currentColor"/><circle cx="12" cy="12" r=".9" fill="currentColor"/><circle cx="16.4" cy="12" r=".9" fill="currentColor"/>'),
  bars: svg('<path d="M5 7.5h14M5 12h14M5 16.5h9.5"/>'),
  viewMore: svg('<path d="m7 10 5 5 5-5"/>'),
  addHome: svg('<rect x="4" y="4" width="16" height="16" rx="3"/><path d="M12 8.5v7M8.5 12h7"/>'),
  kebab: svg('<circle cx="12" cy="5.5" r="1.1" fill="currentColor"/><circle cx="12" cy="12" r="1.1" fill="currentColor"/><circle cx="12" cy="18.5" r="1.1" fill="currentColor"/>'),
  menu: svg('<path d="M5 7h14M5 12h14M5 17h14"/>'),
  install: svg('<rect x="3" y="4" width="18" height="12.5" rx="1.5"/><path d="M9 20.5h6"/><path d="M12 7.5v5.5M9.5 10.5 12 13l2.5-2.5"/>'),
  compass: svg('<circle cx="12" cy="12" r="9.5"/><path d="m15.5 8.5-2 5-5 2 2-5z"/>'),
};

// A button as the browser draws it: the glyph, and its label when it has one.
const key = (glyph, label = "") =>
  `<span class="ig-key">${GLYPH[glyph]}${label ? `<span>${label}</span>` : ""}</span>`;
const words = (label) => `<strong>${label}</strong>`;
// (A step that ends on a button drops its full stop when drawn: a lone period
// after the chip reads as a stray mark.)

// ---------- which browser, and so which route ----------
//
// Each route is the steps, and where on the screen the arrow points: "bl",
// "bc", "br" along the bottom toolbar, "tr" at the top right. None when the
// button moves about too much to point at honestly.

function safariMajor() {
  const m = ua.match(/Version\/(\d+)/);
  return m ? parseInt(m[1], 10) : 0;
}

function route() {
  if (isIOS) {
    // In-app browsers cannot add anything to the Home Screen: the first job is
    // getting out into the real one. Instagram and X don't say who they are,
    // only where the visitor came from.
    const ref = document.referrer;
    if (/FBAN|FBAV|LinkedInApp|Instagram/.test(ua) || /\/\/l\.instagram\.com\//.test(ref)) {
      return { steps: [`Tap ${key("more")} at the top right.`,
                       `Choose ${words("Open in browser")}, then follow the steps there.`], arrow: "tr", outside: true };
    }
    if (/\/\/t\.co\//.test(ref)) {
      return { steps: [`Tap ${key("compass")} at the bottom right to open this page in Safari, then follow the steps there.`],
               arrow: "br", outside: true };
    }
    if (/CriOS/.test(ua)) {
      return { steps: [`Tap ${key("share")} at the top right, beside the address.`,
                       `Choose ${key("addHome", "Add to Home Screen")}. You may need to scroll down to find it.`], arrow: "tr" };
    }
    if (/FxiOS|EdgiOS|OPiOS|GSA\//.test(ua)) {
      return { steps: [`Open this page in ${words("Safari")}.`,
                       `Tap ${key("share")}, then choose ${key("addHome", "Add to Home Screen")}.`], arrow: null };
    }
    const v = safariMajor();
    const tail = [`Tap ${key("viewMore", "View More")}.`,
                  `Choose ${key("addHome", "Add to Home Screen")}.`];
    if (isIPad) {
      return v >= 26
        ? { steps: [`Tap ${key("share")} at the top of the screen.`, ...tail], arrow: "tr" }
        : { steps: [`Tap ${key("share")} at the top of the screen.`,
                    `Choose ${key("addHome", "Add to Home Screen")}. You may need to scroll down to find it.`], arrow: "tr" };
    }
    if (v >= 27) return { steps: [`Tap ${key("bars")} in the toolbar.`, `Tap ${key("share", "Share")}.`, ...tail], arrow: "bl" };
    if (v >= 26) return { steps: [`Tap ${key("more")} in the toolbar.`, `Tap ${key("share", "Share")}.`, ...tail], arrow: "br" };
    return { steps: [`Tap ${key("share")} in the toolbar.`,
                     `Choose ${key("addHome", "Add to Home Screen")}. You may need to scroll down to find it.`], arrow: "bc" };
  }
  if (isAndroid) {
    if (/FBAN|FBAV|Instagram/.test(ua)) {
      return { steps: [`Tap ${key("kebab")} at the top right.`,
                       `Choose ${words("Open in browser")}, then follow the steps there.`], arrow: "tr", outside: true };
    }
    if (/SamsungBrowser/.test(ua)) {
      return { steps: [`Tap ${key("menu")} at the bottom right.`,
                       `Choose ${words("Add page to")}, then ${words("Home screen")}.`], arrow: "br" };
    }
    if (/Firefox/.test(ua)) {
      return { steps: [`Tap ${key("kebab")} in the toolbar.`,
                       `Choose ${key("addHome", "Add to Home screen")}.`], arrow: null };
    }
    if (/EdgA/.test(ua)) {
      return { steps: [`Tap ${key("menu")} at the bottom of the screen.`,
                       `Choose ${key("addHome", "Add to phone")}.`], arrow: "br" };
    }
    return { steps: [`Tap ${key("kebab")} at the top right.`,
                     `Choose ${key("install", "Add to Home screen")} or ${words("Install app")}.`], arrow: "tr" };
  }
  return null;
}

// ---------- the sheet ----------

const CSS = `
.ig-scrim{ position: fixed; inset: 0; z-index: 1000; display: grid; place-items: center;
  padding: max(16px, env(safe-area-inset-top)) 16px max(16px, env(safe-area-inset-bottom));
  background: rgba(5,6,16,.72); -webkit-backdrop-filter: blur(3px); backdrop-filter: blur(3px);
  animation: ig-fade .25s ease-out; }
.ig-scrim[hidden]{ display: none !important; }
.ig-sheet{ position: relative; width: min(100%, 25rem); max-height: 100%; overflow-y: auto;
  padding: 26px clamp(18px, 5vw, 26px) 20px; text-align: center; color: var(--ink);
  background: #221a10; border: 1px solid rgba(200,153,63,0.3); border-radius: 12px;
  box-shadow: 0 18px 50px rgba(0,0,0,.55); font-size: 15.5px; line-height: 1.45;
  animation: ig-rise .35s cubic-bezier(.2,.8,.3,1); }
.ig-icon{ width: 68px; height: 68px; border-radius: 16px; display: block; margin: 0 auto 12px;
  box-shadow: 0 0 0 1px rgba(200,153,63,0.3), 0 6px 18px rgba(0,0,0,.45); }
.ig-sheet h2{ margin: 0 0 4px; font-family: var(--font-display); font-weight: 600;
  font-size: 19px; letter-spacing: .04em; color: var(--bright, var(--brass)); }
.ig-why{ margin: 0 0 16px; color: var(--muted); }
.ig-steps{ list-style: none; margin: 0; padding: 0; text-align: left; counter-reset: ig; }
.ig-steps li{ counter-increment: ig; display: flex; gap: 12px; align-items: flex-start;
  padding: 10px 0; border-top: 1px solid rgba(200,153,63,0.18); }
.ig-steps li:first-child{ border-top: 0; }
.ig-steps li::before{ content: counter(ig); flex: none; width: 26px; height: 26px; border-radius: 50%;
  display: grid; place-items: center; font-size: 14px; font-weight: 600;
  color: var(--brass); border: 1px solid var(--brass); margin-top: 1px; }
.ig-key{ display: inline-flex; align-items: center; gap: 6px; vertical-align: middle;
  padding: 3px 9px; margin: 1px 2px; border-radius: 8px; white-space: nowrap;
  background: #17110a; border: 1px solid rgba(200,153,63,0.3); color: var(--ink); font-size: 14.5px; }
.ig-key svg{ width: 19px; height: 19px; flex: none; color: var(--brass); }
.ig-note{ margin: 14px 0 0; padding: 10px 12px; border-radius: 8px; text-align: left;
  background: #17110a; font-size: 14.5px; color: var(--muted); }
.ig-actions{ display: flex; flex-wrap: wrap; justify-content: center; gap: 10px; margin-top: 18px; }
.ig-actions button{ font-family: inherit; font-size: 15px; cursor: pointer; border-radius: 8px;
  padding: 9px 18px; border: 1px solid rgba(200,153,63,0.3); background: transparent; color: var(--muted); }
.ig-actions .ig-go{ border: 1px solid var(--brass); background: var(--brass); color: var(--ground); }
.ig-arrow{ position: fixed; z-index: 1001; width: 34px; height: 56px; color: var(--bright, var(--brass));
  filter: drop-shadow(0 2px 6px rgba(0,0,0,.6)); pointer-events: none; }
.ig-arrow[data-at^="b"]{ bottom: max(6px, env(safe-area-inset-bottom)); animation: ig-down 1.8s infinite; }
.ig-arrow[data-at^="t"]{ top: max(4px, env(safe-area-inset-top)); transform: rotate(180deg); animation: ig-up 1.8s infinite; }
.ig-arrow[data-at="bl"]{ left: calc(20% - 17px); }
.ig-arrow[data-at="bc"]{ left: calc(50% - 17px); }
.ig-arrow[data-at="br"]{ right: calc(7% - 8px); }
.ig-arrow[data-at="tr"]{ right: 14px; }
@keyframes ig-fade{ from{ opacity: 0; } }
@keyframes ig-rise{ from{ opacity: 0; transform: translateY(14px); } }
@keyframes ig-down{ 0%,20%,50%,80%,100%{ translate: 0 0; } 40%{ translate: 0 -22px; } 60%{ translate: 0 -10px; } }
@keyframes ig-up{ 0%,20%,50%,80%,100%{ translate: 0 0; } 40%{ translate: 0 22px; } 60%{ translate: 0 10px; } }
@media (orientation: landscape) and (max-height: 500px){ .ig-arrow{ display: none; } }
@media (prefers-reduced-motion: reduce){ .ig-scrim, .ig-sheet, .ig-arrow{ animation: none; } }
`;

const ARROW = svg('<path d="M12 3v40"/><path d="M4 34l8 10 8-10"/>', "0 0 24 48")
  .replace('stroke-width="1.7"', 'stroke-width="2.6"');

const store = {
  get: (k) => { try { return localStorage.getItem(k); } catch { return null; } },
  set: (k, v) => { try { localStorage.setItem(k, v); } catch {} },
};

// name: what the Home Screen icon is called. hint: the page's own banner, with
// a [data-install-go] button that opens the guide and a [data-dismiss] one
// that retires it. key: the localStorage key that remembers the dismissal.
// note: anything this page needs said before someone installs it.
export function installGuide({ name, hint, key: dismissKey, note = "" }) {
  if (installed() || !hint) return;
  const go = hint.querySelector("[data-install-go]");
  const r = route();
  let deferred = null;

  const dismissed = () => store.get(dismissKey) === "1";
  const showHint = () => {
    hint.hidden = dismissed() || installed() || (!r && !deferred);
    if (go) go.textContent = deferred ? "Install" : "Show Me How";
  };

  let scrim = null;
  let lastFocus = null;

  function close() {
    if (!scrim) return;
    scrim.remove();
    scrim = null;
    document.removeEventListener("keydown", onKey);
    lastFocus?.focus?.();
  }
  function onKey(e) {
    if (e.key === "Escape") close();
    // Keep Tab inside the sheet while it is open.
    if (e.key === "Tab" && scrim) {
      const f = scrim.querySelectorAll("button");
      const first = f[0], last = f[f.length - 1];
      if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
      else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
    }
  }

  async function nativePrompt() {
    if (!deferred) return;
    const p = deferred;
    deferred = null;
    close();
    p.prompt();
    await p.userChoice.catch(() => {});
    showHint();
  }

  function open() {
    // Where the browser will install with one tap, the guide is one button.
    const oneTap = !!deferred;
    if (!oneTap && !r) return;
    close();
    lastFocus = document.activeElement;
    if (!document.getElementById("ig-style")) {
      const s = document.createElement("style");
      s.id = "ig-style";
      s.textContent = CSS;
      document.head.append(s);
    }
    scrim = document.createElement("div");
    scrim.className = "ig-scrim";
    const steps = oneTap ? "" :
      `<ol class="ig-steps">${r.steps.map((s) => `<li><span>${s.replace(/<\/span>\.$/, "</span>")}</span></li>`).join("")}</ol>`;
    scrim.innerHTML = `
      <div class="ig-sheet" role="dialog" aria-modal="true" aria-labelledby="ig-title">
        <img class="ig-icon" src="/chart/icons/icon-192.png" alt="">
        <h2 id="ig-title">Put ${name} on Your Home Screen</h2>
        <p class="ig-why">It opens like an app, and it works with no signal.</p>
        ${steps}
        ${note && !(r && r.outside) ? `<p class="ig-note">${note}</p>` : ""}
        <div class="ig-actions">
          ${oneTap ? `<button class="ig-go" type="button">Install</button>` : ""}
          <button class="ig-close" type="button">${oneTap ? "Not now" : "Close"}</button>
        </div>
      </div>
      ${!oneTap && r.arrow ? `<div class="ig-arrow" data-at="${r.arrow}">${ARROW}</div>` : ""}`;
    scrim.addEventListener("click", (e) => { if (e.target === scrim) close(); });
    scrim.querySelector(".ig-close").addEventListener("click", close);
    scrim.querySelector(".ig-go")?.addEventListener("click", nativePrompt);
    document.body.append(scrim);
    document.addEventListener("keydown", onKey);
    (scrim.querySelector(".ig-go") || scrim.querySelector(".ig-close")).focus();
  }

  go?.addEventListener("click", () => (r ? open() : nativePrompt()));
  hint.querySelectorAll("[data-dismiss]").forEach((b) =>
    b.addEventListener("click", () => { store.set(dismissKey, "1"); hint.hidden = true; }));

  // Chrome holds its own install prompt until the page asks for it.
  window.addEventListener("beforeinstallprompt", (e) => {
    e.preventDefault();
    deferred = e;
    showHint();
  });
  window.addEventListener("appinstalled", () => { close(); hint.hidden = true; });

  showHint();

  // Once, on a phone or tablet, the sheet opens by itself: long enough after
  // the page settles that it reads as an offer rather than a wall. Android
  // waits for Chrome's prompt, if it is coming, so the one-tap sheet wins.
  const SEEN = dismissKey.replace(/dismissed$/, "") + "autoShown";
  if (r && !dismissed() && store.get(SEEN) !== "1") {
    setTimeout(() => {
      if (installed() || dismissed() || scrim) return;
      store.set(SEEN, "1");
      open();
    }, 2200);
  }
}

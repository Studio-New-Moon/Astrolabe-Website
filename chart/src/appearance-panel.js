// The Appearance panel: the app's Settings > Color, Metal and Type, as a
// dialog any instrument page can open.
//
// Every choice applies the moment it is made, the way the app's does, and is
// kept in this browser for the next visit. The cards draw their swatches in
// the colours they stand for rather than the page's current ones, so Rose &
// Parchment still looks like parchment while the page is plum.

import {
  SCHEMES, METALS, FONT_SETS, RANDOM, RANDOM_BLURB, COLOR_BLURB, TYPE_BLURB,
  METAL_BLURB, METAL_BLURB_RANDOM, TARNISHED_ON, TARNISHED_OFF, EVENT,
  load, update, apply,
} from "./appearance.js";

const CSS = `
.ap-open{
  position: absolute; z-index: 30;
  top: calc(env(safe-area-inset-top, 0px) + 16px); right: 16px;
  display: inline-flex; align-items: center; gap: 8px;
  padding: 7px 13px 7px 9px; border-radius: 999px;
  border: 1px solid var(--rule); background: color-mix(in srgb, var(--panel) 82%, transparent);
  color: var(--brass); cursor: pointer;
  font: 600 11.5px/1 var(--font-display); letter-spacing: .14em; text-transform: uppercase;
  -webkit-backdrop-filter: blur(6px); backdrop-filter: blur(6px);
}
.ap-open:hover{ color: var(--bright); border-color: var(--brass); }
.ap-open:focus-visible{ outline: 2px solid var(--bright); outline-offset: 2px; }
.ap-open svg{ width: 18px; height: 18px; flex: none; }

dialog.ap{
  width: min(640px, calc(100vw - 32px)); max-height: min(88vh, 900px);
  padding: 0; border: 1px solid var(--rule); border-radius: 14px;
  background: var(--panel); color: var(--ink);
  box-shadow: 0 30px 80px -30px rgba(0,0,0,.7);
  font-family: var(--font-body);
}
dialog.ap::backdrop{ background: rgba(4,5,12,.55); -webkit-backdrop-filter: blur(3px); backdrop-filter: blur(3px); }
.ap-scroll{ max-height: inherit; overflow-y: auto; padding: 0 22px 26px; }
.ap-head{
  position: sticky; top: 0; z-index: 2; display: flex; align-items: center; justify-content: space-between;
  gap: 12px; padding: 18px 0 14px; background: var(--panel); border-bottom: 1px solid var(--rule);
}
.ap-head h2{ margin: 0; font: 600 23px/1.2 var(--font-display); color: var(--bright); letter-spacing: .02em; }
.ap-close{
  width: 34px; height: 34px; border-radius: 50%; border: 1px solid var(--rule);
  background: transparent; color: var(--ink); font-size: 20px; line-height: 1; cursor: pointer;
}
.ap-close:focus-visible{ outline: 2px solid var(--bright); outline-offset: 2px; }
.ap section{ margin-top: 24px; }
.ap h3{ margin: 0 0 4px; font: 600 17px/1.3 var(--font-display); color: var(--ink); letter-spacing: .03em; }
.ap .ap-blurb{ margin: 0 0 14px; font-size: 14px; line-height: 1.5; color: var(--muted); max-width: 62ch; }
.ap-grid{ display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 10px; }
@media (max-width: 520px){ .ap-grid{ grid-template-columns: 1fr; } }

.ap-card{
  position: relative; display: flex; gap: 12px; align-items: flex-start;
  padding: 11px 12px; border-radius: 10px; cursor: pointer;
  border: 1px solid var(--rule); background: color-mix(in srgb, var(--ground) 45%, transparent);
  transition: border-color .15s ease, background-color .15s ease;
}
.ap-card:hover{ border-color: var(--brass); }
.ap-card input{ position: absolute; opacity: 0; pointer-events: none; }
.ap-card:has(input:checked){ border-color: var(--brass); box-shadow: inset 0 0 0 1px var(--brass);
  background: color-mix(in srgb, var(--brass) 10%, transparent); }
.ap-card:has(input:focus-visible){ outline: 2px solid var(--bright); outline-offset: 2px; }
.ap-card:has(input:disabled){ opacity: .5; cursor: default; }
.ap-card .ap-text{ min-width: 0; }
.ap-wide{ grid-column: 1 / -1; }
.ap-card .ap-name{ display: block; font: 600 14.5px/1.3 var(--font-display); color: var(--ink); letter-spacing: .02em; }
.ap-card .ap-desc{ display: block; margin-top: 3px; font-size: 12.5px; line-height: 1.45; color: var(--muted); }
.ap-tick{
  position: absolute; top: 9px; right: 10px; width: 16px; height: 16px; border-radius: 50%;
  background: var(--brass); color: var(--panel); font-size: 11px; line-height: 16px; text-align: center; display: none;
}
.ap-card:has(input:checked) .ap-tick{ display: block; }

.ap-swatch{ flex: none; width: 50px; height: 50px; border-radius: 9px; position: relative; overflow: hidden;
  box-shadow: inset 0 0 0 1px rgba(0,0,0,.18); }
.ap-swatch .disc{ position: absolute; inset: 11px; border-radius: 50%; box-shadow: 0 1px 3px rgba(0,0,0,.45); }
.ap-swatch .quad{ position: absolute; width: 50%; height: 50%; }
.ap-disc{ flex: none; width: 46px; height: 46px; border-radius: 50%; position: relative;
  box-shadow: 0 1px 3px rgba(0,0,0,.5), inset 0 0 0 1px rgba(255,255,255,.18); }
.ap-disc .oxide{ position: absolute; inset: 0; border-radius: 50%; }
.ap-sample{ flex: none; width: 50px; text-align: center; font-size: 27px; line-height: 50px; color: var(--bright); }
.ap-card .ap-line{ display: block; margin-top: 4px; font-size: 13.5px; color: var(--ink); }

.ap-toggle{
  display: flex; gap: 14px; align-items: flex-start; justify-content: space-between;
  margin-top: 12px; padding: 12px; border-radius: 10px; border: 1px solid var(--rule); cursor: pointer;
}
.ap-toggle .ap-name{ font: 600 14.5px/1.3 var(--font-display); color: var(--ink); }
.ap-toggle .ap-desc{ display: block; margin-top: 3px; font-size: 12.5px; line-height: 1.45; color: var(--muted); max-width: 52ch; }
.ap-switch{ flex: none; appearance: none; -webkit-appearance: none; margin: 2px 0 0; cursor: pointer;
  width: 44px; height: 26px; border-radius: 999px; position: relative;
  background: color-mix(in srgb, var(--muted) 45%, transparent); transition: background-color .15s ease; }
.ap-switch::after{ content: ""; position: absolute; top: 3px; left: 3px; width: 20px; height: 20px; border-radius: 50%;
  background: var(--ink); transition: transform .18s ease; }
.ap-switch:checked{ background: var(--brass); }
.ap-switch:checked::after{ transform: translateX(18px); background: var(--panel); }
.ap-switch:focus-visible{ outline: 2px solid var(--bright); outline-offset: 2px; }
.ap-foot{ margin: 24px 0 0; font-size: 12.5px; color: var(--muted); }
@media (prefers-reduced-motion: reduce){ .ap-card, .ap-switch, .ap-switch::after{ transition: none; } }
`;

const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));

/** Turned metal seen face-on — the app's `Brass.spun`, as a CSS conic gradient. */
function spun(m) {
  return `conic-gradient(from -135deg, ${m.spec}, ${m.base} 11%, ${m.mid} 20%, ${m.dark} 25%, ${m.mid} 31%, ${m.base} 42%, ${m.spec} 50%, ${m.base} 60%, ${m.mid} 70%, ${m.dark} 75%, ${m.mid} 82%, ${m.base} 92%, ${m.spec})`;
}

function oxide(m, on) {
  return on ? `radial-gradient(circle, transparent 36%, ${m.patina}66 72%, ${m.patina}99 100%)` : "none";
}

function schemeCard(s, metal, checked) {
  return `<label class="ap-card"><input type="radio" name="ap-scheme" value="${s.id}" aria-label="${esc(s.name)}"${checked ? " checked" : ""}>
    <span class="ap-swatch" style="background:${s.ground}"><span class="disc" style="background:${spun(metal)}"></span></span>
    <span class="ap-text"><span class="ap-name">${esc(s.name)}</span><span class="ap-desc">${esc(s.blurb)}</span></span>
    <span class="ap-tick" aria-hidden="true">✓</span></label>`;
}

function randomCard(checked) {
  const q = SCHEMES.map((s, i) => `<span class="quad" style="background:${s.ground};left:${(i % 2) * 50}%;top:${Math.floor(i / 2) * 50}%"></span>`).join("");
  return `<label class="ap-card ap-wide"><input type="radio" name="ap-scheme" value="${RANDOM}" aria-label="Random"${checked ? " checked" : ""}>
    <span class="ap-swatch">${q}</span>
    <span class="ap-text"><span class="ap-name">Random</span><span class="ap-desc">${esc(RANDOM_BLURB)}</span></span>
    <span class="ap-tick" aria-hidden="true">✓</span></label>`;
}

function metalCard(m, checked, disabled, tarnished) {
  return `<label class="ap-card"><input type="radio" name="ap-metal" value="${m.id}" aria-label="${esc(m.name)}"${checked ? " checked" : ""}${disabled ? " disabled" : ""}>
    <span class="ap-disc" style="background:${spun(m)}"><span class="oxide" style="background:${oxide(m, tarnished)}"></span></span>
    <span class="ap-text"><span class="ap-name">${esc(m.name)}</span><span class="ap-desc">${esc(m.blurb)}</span></span>
    <span class="ap-tick" aria-hidden="true">✓</span></label>`;
}

function typeCard(f, checked) {
  return `<label class="ap-card"><input type="radio" name="ap-type" value="${f.id}" aria-label="${esc(f.name)}"${checked ? " checked" : ""}>
    <span class="ap-sample" style="font-family:${esc(f.display)}" aria-hidden="true">Aa</span>
    <span class="ap-text"><span class="ap-name" style="font-family:${esc(f.display)}">${esc(f.name)}</span>
    <span class="ap-line" style="font-family:${esc(f.body)}">Leo rising, the Sun in Pisces</span>
    <span class="ap-desc">${esc(f.blurb)}</span></span>
    <span class="ap-tick" aria-hidden="true">✓</span></label>`;
}

const ICON = `<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="9" fill="none" stroke="currentColor" stroke-width="1.6"/><path d="M12 3a9 9 0 0 1 0 18z" fill="currentColor"/><circle cx="12" cy="12" r="2.2" fill="currentColor"/></svg>`;

/**
 * Applies the saved appearance and adds the button that opens the panel.
 * Call once per page, as early as possible so the page never flashes the
 * default colours before the chosen ones.
 */
export function mountAppearance({ into = document.body } = {}) {
  apply();
  if (!document.getElementById("appearance-css")) {
    const style = document.createElement("style");
    style.id = "appearance-css";
    style.textContent = CSS;
    document.head.appendChild(style);
  }

  const open = document.createElement("button");
  open.type = "button";
  open.className = "ap-open";
  open.setAttribute("aria-haspopup", "dialog");
  open.innerHTML = `${ICON}<span>Appearance</span>`;
  into.appendChild(open);

  const dialog = document.createElement("dialog");
  dialog.className = "ap";
  dialog.setAttribute("aria-labelledby", "ap-title");
  document.body.appendChild(dialog);

  function render() {
    const s = load();
    const random = s.scheme === RANDOM;
    const metal = METALS.find((m) => m.id === s.metal) ?? METALS[0];
    const scrollTop = dialog.querySelector(".ap-scroll")?.scrollTop ?? 0;
    const focused = document.activeElement?.closest?.("dialog.ap") ? document.activeElement : null;
    const focusKey = focused ? `${focused.name}|${focused.value}` : null;
    dialog.innerHTML = `<div class="ap-scroll">
      <div class="ap-head"><h2 id="ap-title">Appearance</h2>
        <button class="ap-close" type="button" aria-label="Close">×</button></div>
      <section aria-labelledby="ap-color"><h3 id="ap-color">Color</h3><p class="ap-blurb">${esc(COLOR_BLURB)}</p>
        <div class="ap-grid" role="radiogroup" aria-labelledby="ap-color">
          ${SCHEMES.map((x) => schemeCard(x, metal, s.scheme === x.id)).join("")}${randomCard(random)}
        </div></section>
      <section aria-labelledby="ap-metal"><h3 id="ap-metal">Metal</h3>
        <p class="ap-blurb">${esc(random ? METAL_BLURB_RANDOM : METAL_BLURB)}</p>
        <div class="ap-grid" role="radiogroup" aria-labelledby="ap-metal">
          ${METALS.map((m) => metalCard(m, !random && m.id === s.metal, random, s.tarnished)).join("")}
        </div>
        <label class="ap-toggle"><span><span class="ap-name">Tarnished</span>
          <span class="ap-desc">${esc(s.tarnished ? TARNISHED_ON : TARNISHED_OFF)}</span></span>
          <input class="ap-switch" type="checkbox" role="switch" name="ap-tarnished" aria-label="Tarnished"${s.tarnished ? " checked" : ""}></label>
      </section>
      <section aria-labelledby="ap-type"><h3 id="ap-type">Type</h3><p class="ap-blurb">${esc(TYPE_BLURB)}</p>
        <div class="ap-grid" role="radiogroup" aria-labelledby="ap-type">
          ${FONT_SETS.map((f) => typeCard(f, s.fontSet === f.id)).join("")}
        </div></section>
      <p class="ap-foot">Kept in this browser, and shared by the Chart pages on this site.</p>
    </div>`;
    dialog.querySelector(".ap-scroll").scrollTop = scrollTop;
    if (focusKey) {
      const [name, value] = focusKey.split("|");
      const again = [...dialog.querySelectorAll(`input[name="${name}"]`)].find((i) => i.type === "checkbox" || i.value === value);
      again?.focus({ preventScroll: true });
    }
  }

  dialog.addEventListener("change", (e) => {
    const t = e.target;
    if (t.name === "ap-scheme") update({ scheme: t.value });
    else if (t.name === "ap-metal") update({ metal: t.value });
    else if (t.name === "ap-tarnished") update({ tarnished: t.checked });
    else if (t.name === "ap-type") update({ fontSet: t.value });
    render();
  });
  dialog.addEventListener("click", (e) => {
    if (e.target.closest(".ap-close")) dialog.close();
    else if (e.target === dialog) dialog.close();   // a click on the backdrop
  });
  // Escape is handled here rather than left to the browser: Chrome declines a
  // dialog's own Escape-to-close when it judges the key unprompted, and a panel
  // that won't close on Escape is a trap for a keyboard user.
  dialog.addEventListener("keydown", (e) => {
    if (e.key === "Escape") { e.preventDefault(); dialog.close(); }
  });
  dialog.addEventListener("close", () => open.focus());
  open.addEventListener("click", () => { render(); dialog.showModal(); dialog.querySelector(".ap-close").blur(); });

  return { open: () => open.click() };
}

export { EVENT };

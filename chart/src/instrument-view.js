// The instrument on a page: drawn, kept drawn, and tappable.
//
// Both /chart/ and /app/ show a chart the same way, so this is where that
// lives: the canvas, redrawing when its width changes or its fonts arrive,
// the flat SVG wheel for a browser that can't draw the metal, and the taps.
//
// The app makes each house on the limb and each planet stud a button. Here
// the same places are real <button>s laid over the canvas, so they work by
// touch, mouse and keyboard, and a screen reader can reach them. Tapping one
// lights it on the instrument, says what it is in a line under the wheel,
// and tells the page so it can light the matching table rows. Tapping it
// again lets it go.

import { drawInstrument } from "./instrument.js";
import { wheelSVG } from "./wheel.js";
import { SIGNS, signIndex, normalizedDegrees, wholeSignHouse } from "./angles.js";
import { POINT_NAMES } from "./points.js";

const ROMAN = ["I", "II", "III", "IV", "V", "VI", "VII", "VIII", "IX", "X", "XI", "XII"];
const title = (s) => s.charAt(0).toUpperCase() + s.slice(1);

const dms = (lon) => {
  const d = normalizedDegrees(lon) % 30;
  const deg = Math.floor(d);
  const min = Math.round((d - deg) * 60);
  return min === 60 ? `${deg + 1}°00′` : `${deg}°${String(min).padStart(2, "0")}′`;
};

const canInstrument = (() => {
  try { return typeof document.createElement("canvas").getContext("2d").createConicGradient === "function"; }
  catch { return false; }
})();

const CSS = `
.instrument-stage{ position: relative; }
.instrument-targets{ position: absolute; inset: 0; pointer-events: none; }
.instrument-targets button{
  position: absolute; pointer-events: auto; padding: 0; margin: 0;
  border: 0; border-radius: 50%; background: transparent; cursor: pointer;
  -webkit-tap-highlight-color: transparent;
}
.instrument-targets button:focus-visible{ outline: 2px solid #E8C87A; outline-offset: 1px; }
.instrument-readout{ margin: 10px 2px 0; min-height: 1.6em; font-size: 15.5px; }
.instrument-readout.hint{ opacity: 0.7; }
`;

function injectStyle() {
  if (document.getElementById("instrument-view-css")) return;
  const style = document.createElement("style");
  style.id = "instrument-view-css";
  style.textContent = CSS;
  document.head.appendChild(style);
}

/**
 * Mounts the instrument in `container`.
 *
 * `onSelect({ house, planet })` is called whenever the selection changes, with
 * both null when it's cleared. Returns `{ show(chart, label) }`, where `chart`
 * is `{ ascendantLongitude, latitude?, bodies, points? }`.
 */
export function mountInstrument(container, { onSelect = () => {} } = {}) {
  injectStyle();
  let chart = null;
  let label = "";
  let selected = { house: null, planet: null };
  let drawnWidth = 0;
  let hits = { houses: [], planets: [] };
  let stage = null, canvas = null, targets = null, readout = null;

  const houseSign = (h) => SIGNS[(signIndex(chart.ascendantLongitude) + h - 1) % 12];
  const houseOf = (lon) => wholeSignHouse(lon, chart.ascendantLongitude);

  function describe() {
    if (selected.planet) {
      const b = chart.bodies.find((x) => x.name === selected.planet);
      if (!b) return "";
      return `${title(b.name)} · ${dms(b.longitude)} ${SIGNS[signIndex(b.longitude)]}` +
        `${b.retrograde ? " · retrograde" : ""} · house ${houseOf(b.longitude)}`;
    }
    if (selected.house) {
      const h = selected.house;
      const inside = [
        ...chart.bodies.filter((b) => houseOf(b.longitude) === h).map((b) => title(b.name)),
        ...(chart.points ?? []).filter((p) => houseOf(p.longitude) === h).map((p) => POINT_NAMES[p.name] ?? p.name),
      ];
      return `House ${ROMAN[h - 1]} · ${houseSign(h)} · ${inside.length ? inside.join(", ") : "empty"}`;
    }
    return "Tap a house on the rim, or a planet, to see what's there.";
  }

  function build() {
    container.innerHTML = "";
    stage = document.createElement("div");
    stage.className = "instrument-stage";
    canvas = document.createElement("canvas");
    canvas.setAttribute("role", "img");
    targets = document.createElement("div");
    targets.className = "instrument-targets";
    stage.append(canvas, targets);
    readout = document.createElement("p");
    readout.className = "instrument-readout hint";
    readout.setAttribute("aria-live", "polite");
    container.append(stage, readout);
    // Taps are handled here rather than on each button, so one that lands
    // near a target still counts — see `nearest`.
    stage.addEventListener("click", onStageClick);
    new ResizeObserver(() => {
      const width = Math.round(canvas.getBoundingClientRect().width);
      if (width && width !== drawnWidth) requestAnimationFrame(draw);
    }).observe(canvas);
  }

  function fallback() {
    stage = canvas = targets = readout = null;
    container.innerHTML = wheelSVG(chart, { size: 1000, title: label });
  }

  /**
   * The target a tap at (x, y) means, or null.
   *
   * The buttons are the size of what's drawn: a planet stud is about 24px
   * across and a house numeral about 37px, where a finger wants nearer 48.
   * Ten studs can't each be 48px on a wheel a few hundred across without
   * overlapping, so the buttons stay put and the tolerance lives here: a tap
   * is allowed to miss by a finger's width, and the nearest target within
   * that wins. Planets are tested first, because a stud sits on the rim it
   * shares with a house numeral and the stud is the finer thing to hit.
   *
   * Distances are measured to each target's true centre, the one
   * `drawInstrument` reports, not to anything drawn over it.
   */
  const TOLERANCE = 24;

  function nearest(x, y) {
    let best = null;
    for (const p of hits.planets) {
      const d = Math.hypot(x - p.x, y - p.y);
      if (d <= Math.max(p.r, TOLERANCE) && (!best || d < best.d)) {
        best = { d, pick: { house: null, planet: p.name } };
      }
    }
    if (best) return best.pick;
    for (const h of hits.houses) {
      const d = Math.hypot(x - h.x, y - h.y);
      if (d <= Math.max(h.r, TOLERANCE) && (!best || d < best.d)) {
        best = { d, pick: { house: h.house, planet: null } };
      }
    }
    return best ? best.pick : null;
  }

  function onStageClick(event) {
    // A button's own click carries what it is, so a keyboard or a screen
    // reader activating one is exact rather than going through the tolerance.
    const button = event.target.closest?.("button[data-kind]");
    if (button) {
      const { kind, key } = button.dataset;
      return choose(kind === "planet" ? { house: null, planet: key } : { house: Number(key), planet: null });
    }
    const rect = canvas.getBoundingClientRect();
    if (!rect.width) return;
    const scale = drawnWidth / rect.width;
    const pick = nearest((event.clientX - rect.left) * scale, (event.clientY - rect.top) * scale);
    // A tap on open plate means "never mind", which is how the readout's own
    // invitation reads once something is lit.
    if (pick) return choose(pick);
    if (selected.house || selected.planet) choose(selected);
  }

  function choose(next) {
    const same = next.house === selected.house && next.planet === selected.planet;
    selected = same ? { house: null, planet: null } : next;
    draw();
    onSelect({ ...selected });
  }

  function placeTargets() {
    targets.innerHTML = "";
    const add = (x, y, r, aria, pressed, kind, key) => {
      const b = document.createElement("button");
      b.type = "button";
      b.style.left = `${x - r}px`;
      b.style.top = `${y - r}px`;
      b.style.width = `${r * 2}px`;
      b.style.height = `${r * 2}px`;
      b.setAttribute("aria-label", aria);
      b.setAttribute("aria-pressed", String(pressed));
      b.dataset.kind = kind;
      b.dataset.key = String(key);
      targets.appendChild(b);
    };
    for (const h of hits.houses) {
      add(h.x, h.y, h.r, `House ${ROMAN[h.house - 1]}, ${houseSign(h.house)}`,
        selected.house === h.house, "house", h.house);
    }
    // Studs after houses, so a stud sitting over a numeral is in front of it.
    for (const p of hits.planets) {
      const b = chart.bodies.find((x) => x.name === p.name);
      add(p.x, p.y, p.r, `${title(p.name)}, ${dms(b.longitude)} ${SIGNS[signIndex(b.longitude)]}, house ${houseOf(b.longitude)}`,
        selected.planet === p.name, "planet", p.name);
    }
  }

  function draw() {
    if (!chart || !canvas) return;
    const width = Math.round(canvas.getBoundingClientRect().width);
    if (!width) return;
    drawnWidth = width;
    try {
      hits = drawInstrument(canvas, chart, {
        size: width, dpr: window.devicePixelRatio || 1, keepStyleSize: true,
        selectedHouse: selected.house, selectedPlanet: selected.planet,
      });
      placeTargets();
      readout.textContent = describe();
      readout.classList.toggle("hint", !selected.house && !selected.planet);
    } catch (err) {
      // A failure part way leaves half an instrument, so fall back cleanly.
      console.error(err);
      fallback();
    }
  }

  Promise.all([
    document.fonts.load("700 18px Cinzel"),
    document.fonts.load("400 11px Spectral"),
  ]).then(draw).catch(() => {});

  return {
    show(nextChart, nextLabel) {
      chart = nextChart;
      label = nextLabel;
      selected = { house: null, planet: null };
      if (!canInstrument) return fallback();
      if (!canvas) build();
      canvas.setAttribute("aria-label", label);
      drawnWidth = 0;
      draw();
    },
  };
}

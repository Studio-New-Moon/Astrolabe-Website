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
    new ResizeObserver(() => {
      const width = Math.round(canvas.getBoundingClientRect().width);
      if (width && width !== drawnWidth) requestAnimationFrame(draw);
    }).observe(canvas);
  }

  function fallback() {
    stage = canvas = targets = readout = null;
    container.innerHTML = wheelSVG(chart, { size: 1000, title: label });
  }

  function choose(next) {
    const same = next.house === selected.house && next.planet === selected.planet;
    selected = same ? { house: null, planet: null } : next;
    draw();
    onSelect({ ...selected });
  }

  function placeTargets(hits) {
    targets.innerHTML = "";
    const add = (x, y, r, aria, pressed, onClick) => {
      const b = document.createElement("button");
      b.type = "button";
      b.style.left = `${x - r}px`;
      b.style.top = `${y - r}px`;
      b.style.width = `${r * 2}px`;
      b.style.height = `${r * 2}px`;
      b.setAttribute("aria-label", aria);
      b.setAttribute("aria-pressed", String(pressed));
      b.addEventListener("click", onClick);
      targets.appendChild(b);
    };
    for (const h of hits.houses) {
      add(h.x, h.y, h.r, `House ${ROMAN[h.house - 1]}, ${houseSign(h.house)}`,
        selected.house === h.house, () => choose({ house: h.house, planet: null }));
    }
    // Studs after houses, so a stud sitting over a numeral is the one tapped.
    for (const p of hits.planets) {
      const b = chart.bodies.find((x) => x.name === p.name);
      add(p.x, p.y, p.r, `${title(p.name)}, ${dms(b.longitude)} ${SIGNS[signIndex(b.longitude)]}, house ${houseOf(b.longitude)}`,
        selected.planet === p.name, () => choose({ house: null, planet: p.name }));
    }
  }

  function draw() {
    if (!chart || !canvas) return;
    const width = Math.round(canvas.getBoundingClientRect().width);
    if (!width) return;
    drawnWidth = width;
    try {
      const hits = drawInstrument(canvas, chart, {
        size: width, dpr: window.devicePixelRatio || 1, keepStyleSize: true,
        selectedHouse: selected.house, selectedPlanet: selected.planet,
      });
      placeTargets(hits);
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

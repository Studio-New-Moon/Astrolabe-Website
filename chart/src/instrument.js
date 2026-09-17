// The chart as the app draws it: a brass instrument, struck on a canvas.
//
// A port of `AstrolabeWheel.swift`, draw call for draw call, with the metal
// rules from `Brass.swift` and the stud from `PlanetStud.swift`. The comments
// in those files carry the reasons for almost every number here; they are not
// repeated, only pointed at where a choice would otherwise look arbitrary.
//
// SwiftUI's `Canvas` and the HTML canvas are close cousins: paths, linear,
// radial and conic gradients, clipping, and layers all map straight across.
// What doesn't map is noted where it happens:
//
// - A SwiftUI `.shadow` shadows everything composited so far, including the
//   shadows before it. Canvas `shadowColor` applied while drawing an image of
//   a finished layer does exactly that, so stacked shadows are built one layer
//   at a time.
// - `drawLayer` with an outer opacity becomes an offscreen layer composited at
//   `globalAlpha`. See `strokeWire` for why that difference matters.
// - Text is centred by its measured ink, not its line box, which is what the
//   app has to measure CoreText to get.
//
// Units are points, as in the app. The canvas is scaled by devicePixelRatio
// once, so every fixed hairline (0.5, 0.6, 1.4) means what it means there.
//
// `wheel.js` stays: it is SVG, which is what a print file needs.

import { retePoint, capricornRadius, cancerRadius, almucantar, ecliptic } from "./projection.js";
import { SIGNS, signIndex, degreeWithinSign } from "./angles.js";

const D2R = Math.PI / 180;
const TEXT = "︎";
const SIGN_GLYPHS = ["♈", "♉", "♊", "♋", "♌", "♍", "♎", "♏", "♐", "♑", "♒", "♓"].map((c) => c + TEXT);
const PLANET_GLYPHS = {
  sun: "☉", moon: "☽", mercury: "☿", venus: "♀", mars: "♂",
  jupiter: "♃", saturn: "♄", uranus: "♅", neptune: "♆", pluto: "♇",
};
const ROMAN = ["I", "II", "III", "IV", "V", "VI", "VII", "VIII", "IX", "X", "XI", "XII"];

// The stars a rete reaches for — `Stars.onRete` in AstrolabeCore, unchanged.
const STARS = [
  { name: "Aldebaran", longitude: 69.8, latitude: -5.5, magnitude: 0.87 },
  { name: "Betelgeuse", longitude: 88.8, latitude: -16.0, magnitude: 0.45 },
  { name: "Sirius", longitude: 104.1, latitude: -39.6, magnitude: -1.46 },
  { name: "Regulus", longitude: 149.8, latitude: 0.5, magnitude: 1.36 },
  { name: "Spica", longitude: 203.8, latitude: -2.1, magnitude: 0.98 },
  { name: "Arcturus", longitude: 204.2, latitude: 30.7, magnitude: -0.05 },
  { name: "Pollux", longitude: 113.2, latitude: 6.7, magnitude: 1.14 },
  { name: "Vega", longitude: 285.4, latitude: 61.7, magnitude: 0.03 },
  { name: "Altair", longitude: 301.8, latitude: 29.3, magnitude: 0.76 },
  { name: "Deneb", longitude: 335.3, latitude: 59.9, magnitude: 1.25 },
  { name: "Capella", longitude: 81.9, latitude: 22.9, magnitude: 0.08 },
];

// ---------------------------------------------------------------------------
// Palettes. Brass & Ink with the brass finish is the app's original scheme,
// and the one this site is dressed in. The other metals are the app's
// `MetalFinish` ramps, laid over the same palette.

const METALS = {
  brass:    { deep: "#3D2F14", dark: "#6D5424", mid: "#B08C3F", base: "#C9A24C", lit: "#F0D493", spec: "#FDF1CD", patina: "#4E8C7A", onMetal: "#1A1408" },
  bronze:   { deep: "#2E1D0E", dark: "#5A3A1C", mid: "#8C5C2E", base: "#A9713C", lit: "#D1A268", spec: "#F0D8AE", patina: "#3E7F6B", onMetal: "#160F06" },
  copper:   { deep: "#3A1608", dark: "#6E2C12", mid: "#A9491F", base: "#C4622E", lit: "#E39160", spec: "#F8CDA8", patina: "#2E9C86", onMetal: "#2A1006" },
  sterling: { deep: "#2B2C2E", dark: "#55585C", mid: "#8A8E93", base: "#B4B8BD", lit: "#DCDFE3", spec: "#F9FAFB", patina: "#6B5F55", onMetal: "#141516" },
};

const BRASS_AND_INK = {
  ground: "#14100A", brass: "#B8963F", resist: "#F3E6C4", muted: "#9A8A66",
  plate: "#150F07", engraving: "#6F6A52", horizonLine: "#8FB0A8",
};

/** The app's `wearAmount` at rest: fine swirl marks, no oxide. */
const WEAR = 0.16;

// ---------------------------------------------------------------------------
// Colour and gradient helpers.

function hexParts(hex) {
  const h = hex.replace("#", "");
  return [parseInt(h.slice(0, 2), 16), parseInt(h.slice(2, 4), 16), parseInt(h.slice(4, 6), 16)];
}

function rgba(hex, a = 1) {
  const [r, g, b] = hexParts(hex);
  return `rgba(${r},${g},${b},${Math.max(0, Math.min(1, a))})`;
}

/** `Brass.mix`: a point between two ramp tones, in sRGB. */
function mix(a, b, t) {
  const f = Math.min(Math.max(t, 0), 1);
  const [r1, g1, b1] = hexParts(a);
  const [r2, g2, b2] = hexParts(b);
  const c = (x, y) => Math.round(x + (y - x) * f).toString(16).padStart(2, "0");
  return `#${c(r1, r2)}${c(g1, g2)}${c(b1, b2)}`;
}

function addStops(gradient, stops) {
  for (const [location, color] of stops) gradient.addColorStop(Math.min(Math.max(location, 0), 1), color);
  return gradient;
}

const even = (colors) => colors.map((c, i) => [i / (colors.length - 1), c]);

/**
 * SwiftUI's angular gradient. Its angle is measured clockwise from the
 * trailing edge, which is the canvas's own convention, so it carries over.
 */
const conic = (stops, cx, cy, degrees) => (ctx) =>
  addStops(ctx.createConicGradient(degrees * D2R, cx, cy), stops);

const linear = (stops, x0, y0, x1, y1) => (ctx) =>
  addStops(ctx.createLinearGradient(x0, y0, x1, y1), stops);

const radial = (stops, cx, cy, r0, r1) => (ctx) =>
  addStops(ctx.createRadialGradient(cx, cy, r0, cx, cy, r1), stops);

const solid = (color) => () => color;

/** `Brass.spun`: turned metal seen face-on, two bright lobes and two dark. */
function spunStops(m, polished = true) {
  const hi = polished ? m.spec : m.lit;
  const low = polished ? m.dark : m.mid;
  const mm = polished ? m.mid : m.base;
  return [
    [0.00, hi], [0.11, m.base], [0.20, mm], [0.25, low], [0.31, mm], [0.42, m.base],
    [0.50, hi], [0.60, m.base], [0.70, mm], [0.75, low], [0.82, mm], [0.92, m.base], [1.00, hi],
  ];
}

// ---------------------------------------------------------------------------
// `SeededRandom`: xorshift64, exactly as the app has it, so wear lands in the
// same places given the same seed.

class SeededRandom {
  constructor(seed) {
    this.state = BigInt.asUintN(64, BigInt(seed === 0 ? 0x9E3779B9 : seed));
  }
  next() {
    let s = this.state;
    s = BigInt.asUintN(64, s ^ (s << 13n));
    s = BigInt.asUintN(64, s ^ (s >> 7n));
    s = BigInt.asUintN(64, s ^ (s << 17n));
    this.state = s;
    return Number(s % 100000n) / 100000;
  }
}

// ---------------------------------------------------------------------------
// Layers.

function makeLayer(width, height, dpr) {
  const c = document.createElement("canvas");
  c.width = Math.max(1, Math.ceil(width * dpr));
  c.height = Math.max(1, Math.ceil(height * dpr));
  const x = c.getContext("2d");
  x.setTransform(dpr, 0, 0, dpr, 0, 0);
  return { canvas: c, ctx: x };
}

/** Composite a full-size layer onto `ctx` at an opacity, in device pixels. */
function composite(ctx, layer, opacity = 1) {
  ctx.save();
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.globalAlpha = opacity;
  ctx.drawImage(layer.canvas, 0, 0);
  ctx.restore();
}

// ---------------------------------------------------------------------------
// Geometry.

function geometryFor(size) {
  const mater = size * 0.42;
  const limbInner = mater * 0.84;
  const plate = limbInner * 0.97;
  return {
    size,
    c: { x: size / 2, y: size / 2 },
    mater, limbInner, plate,
    equator: plate / capricornRadius(1),
    hub: size * 0.15,
  };
}

const hypot = Math.hypot;

// ---------------------------------------------------------------------------
// The instrument.

/**
 * Draws the instrument into `canvas`.
 *
 * `chart` is `{ ascendantLongitude, latitude?, bodies: [{ name, longitude,
 * retrograde }] }` — the same data `wheelSVG` takes. Leave `latitude` out for
 * a positions-only chart: the plate then keeps its three reference circles and
 * skips the horizon and almucantars, as the app does.
 *
 * Returns where the houses and the studs are, in the canvas's own CSS pixels,
 * so a page can make them tappable if it wants to.
 */
export function drawInstrument(canvas, chart, options = {}) {
  const size = options.size ?? (canvas.clientWidth || 360);
  const dpr = options.dpr ?? (window.devicePixelRatio || 1);
  const m = METALS[options.metal ?? "brass"] ?? METALS.brass;
  const pal = { ...BRASS_AND_INK, ...(options.palette ?? {}) };
  const font = {
    body: options.bodyFont ?? "Spectral, Georgia, serif",
    display: options.displayFont ?? "Cinzel, Georgia, serif",
    symbol: options.symbolFont ?? "'Apple Symbols', 'Segoe UI Symbol', 'Noto Sans Symbols 2', 'Noto Sans Symbols', 'DejaVu Sans', sans-serif",
  };

  canvas.width = Math.round(size * dpr);
  canvas.height = Math.round(size * dpr);
  if (!options.keepStyleSize) {
    canvas.style.width = `${size}px`;
    canvas.style.height = `${size}px`;
  }
  const ctx = canvas.getContext("2d");
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.clearRect(0, 0, size, size);

  const g = geometryFor(size);
  const asc = chart.ascendantLongitude;
  const ascAngle = retePoint(asc, 0, 1).angle;
  const screenAngle = (a) => a - ascAngle + 180;

  const point = (longitude, latitude = 0) => {
    const p = retePoint(longitude, latitude, g.equator);
    const a = screenAngle(p.angle) * D2R;
    return { x: g.c.x + p.radius * Math.cos(a), y: g.c.y - p.radius * Math.sin(a) };
  };

  // One scratch layer, cleared and reused: every use composites straight
  // back before the next begins, so nothing ever needs two at once.
  const scratch = makeLayer(size, size, dpr);
  const layer = () => {
    scratch.ctx.save();
    scratch.ctx.setTransform(1, 0, 0, 1, 0, 0);
    scratch.ctx.clearRect(0, 0, scratch.canvas.width, scratch.canvas.height);
    scratch.ctx.restore();
    return scratch;
  };

  // ---- stroking and filling in the app's vocabulary ----

  const circlePath = (cx, cy, r) => {
    const p = new Path2D();
    p.arc(cx, cy, Math.max(r, 0), 0, Math.PI * 2);
    return p;
  };

  const fill = (c, path, shading) => {
    c.fillStyle = shading(c);
    c.fill(path);
  };

  const stroke = (c, path, shading, width, { cap = "butt", join = "miter" } = {}) => {
    c.lineWidth = width;
    c.lineCap = cap;
    c.lineJoin = join;
    c.strokeStyle = shading(c);
    c.stroke(path);
  };

  const polyPath = (pts, close = false) => {
    const p = new Path2D();
    pts.forEach((q, i) => (i === 0 ? p.moveTo(q.x, q.y) : p.lineTo(q.x, q.y)));
    if (close) p.closePath();
    return p;
  };

  /**
   * `strokeWire`. A partly transparent wire is banded inside its own layer
   * and faded once as a whole, or each overlapping round cap composites
   * twice and the thread breaks into a row of bright pips.
   */
  const strokeWire = (c, samples, base, shading, opacity = 1) => {
    if (samples.length < 2) return;
    if (opacity >= 1) return bands(c, samples, base, shading);
    const l = layer();
    bands(l.ctx, samples, base, shading);
    composite(c, l, opacity);
  };

  const bands = (c, s, base, shading) => {
    const minLen = Math.max(base * 1.6, 2.0);
    let i = 0;
    while (i < s.length - 1) {
      let hi = i + 1;
      let run = hypot(s[hi].p.x - s[i].p.x, s[hi].p.y - s[i].p.y);
      while (hi < s.length - 1 && run < minLen) {
        hi += 1;
        run += hypot(s[hi].p.x - s[hi - 1].p.x, s[hi].p.y - s[hi - 1].p.y);
      }
      const p = new Path2D();
      p.moveTo(s[i].p.x, s[i].p.y);
      for (let k = i + 1; k <= hi; k++) p.lineTo(s[k].p.x, s[k].p.y);
      const w = (s[i].w + s[hi].w) / 2;
      stroke(c, p, shading, base * w, { cap: "round", join: "round" });
      i = hi;
    }
  };

  /** Draws text with its measured ink centred on a point. */
  const inkText = (c, text, cssFont, color, x, y, { tracking = 0 } = {}) => {
    c.font = cssFont;
    c.fillStyle = color;
    c.textAlign = "left";
    c.textBaseline = "alphabetic";
    if (!tracking) {
      const mt = c.measureText(text);
      const w = mt.actualBoundingBoxRight + mt.actualBoundingBoxLeft;
      const h = mt.actualBoundingBoxAscent + mt.actualBoundingBoxDescent;
      c.fillText(text, x - w / 2 + mt.actualBoundingBoxLeft, y + h / 2 - mt.actualBoundingBoxDescent);
      return { w, h };
    }
    const chars = [...text];
    const widths = chars.map((ch) => c.measureText(ch).width);
    const total = widths.reduce((a, b) => a + b, 0) + tracking * (chars.length - 1);
    const mt = c.measureText(text);
    const h = mt.actualBoundingBoxAscent + mt.actualBoundingBoxDescent;
    let cx = x - total / 2;
    const by = y + h / 2 - mt.actualBoundingBoxDescent;
    chars.forEach((ch, i) => { c.fillText(ch, cx, by); cx += widths[i] + tracking; });
    return { w: total, h };
  };

  /** Draws text centred on its line box, as SwiftUI's `draw(_:at:)` does. */
  const boxText = (c, text, cssFont, color, x, y) => {
    c.font = cssFont;
    c.fillStyle = color;
    c.textAlign = "center";
    c.textBaseline = "middle";
    c.fillText(text, x, y);
  };

  // ================================================================ the mater

  const houseMidAngle = (h) => (180 - (h - 0.5) * 30) * D2R;

  function drawMater(c) {
    const full = circlePath(g.c.x, g.c.y, g.mater);
    fill(c, full, solid(m.mid));
    fill(c, full, conic(even([m.base, m.dark, m.base, m.deep, m.base]), g.c.x, g.c.y, -135));

    const limb = circlePath(g.c.x, g.c.y, (g.mater + g.limbInner) / 2);
    stroke(c, limb, conic(even([m.spec, m.mid, m.dark, m.base, m.spec, m.mid, m.dark, m.base, m.spec]),
      g.c.x, g.c.y, -135), g.mater - g.limbInner);

    // wear on the limb: swirl from polishing
    const rng = new SeededRandom(90210);
    const marks = 14 + Math.floor(WEAR * 90);
    for (let i = 0; i < marks; i++) {
      const a0 = rng.next() * Math.PI * 2;
      const sweep = 0.05 + rng.next() * 0.5;
      const rr = g.limbInner + rng.next() * (g.mater - g.limbInner);
      const arc = new Path2D();
      arc.arc(g.c.x, g.c.y, rr, a0, a0 + sweep, false);
      const alpha = (0.05 + rng.next() * 0.14) * (0.35 + WEAR);
      const tone = rng.next() > 0.5 ? m.deep : m.spec;
      stroke(c, arc, solid(rgba(tone, alpha)), 0.4 + rng.next() * 0.7, { cap: "round" });
    }

    // degree scale, engraved
    for (let d = 0; d < 360; d += 5) {
      const major = d % 30 === 0;
      const a = d * D2R;
      const r1 = major ? g.limbInner + 2 : g.mater - 7;
      const tick = polyPath([
        { x: g.c.x + Math.cos(a) * r1, y: g.c.y + Math.sin(a) * r1 },
        { x: g.c.x + Math.cos(a) * (g.mater - 2), y: g.c.y + Math.sin(a) * (g.mater - 2) },
      ]);
      stroke(c, tick, solid(rgba(m.deep, 0.8)), major ? 1.6 : 0.7);
    }

    // house numerals, cut into the limb
    for (let h = 1; h <= 12; h++) {
      const mid = houseMidAngle(h);
      const r = (g.mater + g.limbInner) / 2;
      // The app asks for semibold, but only Spectral's regular face ships with
      // it, so regular is what it actually draws.
      boxText(c, ROMAN[h - 1], `400 ${g.size * 0.032}px ${font.body}`, m.deep,
        g.c.x + Math.cos(mid) * r, g.c.y + Math.sin(mid) * r);
    }
    stroke(c, circlePath(g.c.x, g.c.y, g.limbInner), solid(m.deep), 1.4);
  }

  // ================================================================ the plate

  function drawPlate(c) {
    const rim = circlePath(g.c.x, g.c.y, g.plate);
    fill(c, rim, solid(pal.plate));
    c.save();
    c.clip(rim);
    for (const r of [g.plate, g.equator, cancerRadius(g.equator)]) {
      stroke(c, circlePath(g.c.x, g.c.y, r), solid(rgba(pal.engraving, 0.45)), 0.9);
    }
    const lat = chart.latitude;
    if (Number.isFinite(lat)) {
      for (let altitude = 15; altitude <= 75; altitude += 15) {
        const a = almucantar(altitude, lat, g.equator);
        if (!a) continue;
        const fade = 0.34 - (altitude / 75) * 0.16;
        // Drawn at the magnitude of the radius: in the southern hemisphere the
        // projection hands back a negative one for the same circle, which
        // CoreGraphics quietly normalises and a canvas arc refuses.
        stroke(c, circlePath(g.c.x, g.c.y - a.offset, Math.abs(a.radius)),
          solid(rgba(pal.horizonLine, fade)), 0.6);
      }
      const h = almucantar(0, lat, g.equator);
      if (h) {
        stroke(c, circlePath(g.c.x, g.c.y - h.offset, Math.abs(h.radius)),
          solid(rgba(pal.horizonLine, 0.85)), 1.8);
      }
    }
    c.restore();
  }

  // ================================================================ the rete

  function ringGeometry() {
    const e = ecliptic(g.equator);
    const turn = (-ascAngle + 180) * D2R;
    return {
      centre: {
        x: g.c.x + e.offset * Math.cos(turn - Math.PI / 2),
        y: g.c.y - e.offset * Math.sin(turn - Math.PI / 2),
      },
      radius: e.radius,
    };
  }

  const bladeShoulder = 0.74;
  const bladeProfile = (t) => {
    const s = bladeShoulder;
    const shank = 1 - 0.52 * Math.pow(Math.min(t / s, 1), 0.8);
    const pt = t <= s ? 1 : Math.pow(1 - (t - s) / (1 - s), 1.7);
    const flare = 1 + 0.20 * Math.exp(-t * 18);
    return shank * pt * flare;
  };

  function starPointers(ringCentre, ringRadius) {
    const out = [];
    for (const star of STARS) {
      const tip = point(star.longitude, star.latitude);
      const dx = tip.x - ringCentre.x, dy = tip.y - ringCentre.y;
      const len = Math.max(Math.sqrt(dx * dx + dy * dy), 0.001);
      const reach = Math.abs(len - ringRadius);
      if (!(reach > g.size * 0.02)) continue;
      const mag = Math.max(-1.5, Math.min(1.5, star.magnitude));
      const halfWidth = g.size * (0.0082 - mag * 0.0018);
      const pin = { x: ringCentre.x + dx / len * ringRadius, y: ringCentre.y + dy / len * ringRadius };
      const run = Math.max(hypot(tip.x - pin.x, tip.y - pin.y), 0.001);
      const ux = (tip.x - pin.x) / run, uy = (tip.y - pin.y) / run;
      const nx = -uy, ny = ux;
      const tuck = g.size * 0.010;
      const heel = { x: pin.x - ux * tuck, y: pin.y - uy * tuck };
      const towardLight = (-nx - ny) >= 0;
      out.push({
        star, pin, heel, tip, halfWidth,
        axis: { dx: ux, dy: uy },
        lit: { dx: towardLight ? nx : -nx, dy: towardLight ? ny : -ny },
        reach: run + tuck,
      });
    }
    return out;
  }

  const bladeStops = () => [
    [0.00, m.base], [0.13, m.spec], [0.27, m.lit], [0.52, m.mid], [0.78, m.dark], [1.00, m.deep],
  ];

  function bladePath(ptr) {
    const steps = 44;
    const pts = [];
    for (let i = 0; i <= steps; i++) {
      const t = i / steps;
      const w = bladeProfile(t) * ptr.halfWidth;
      const s = t * ptr.reach;
      pts.push({ x: ptr.heel.x + ptr.axis.dx * s + ptr.lit.dx * w, y: ptr.heel.y + ptr.axis.dy * s + ptr.lit.dy * w });
    }
    for (let i = steps; i >= 0; i--) {
      const t = i / steps;
      const w = bladeProfile(t) * ptr.halfWidth;
      const s = t * ptr.reach;
      pts.push({ x: ptr.heel.x + ptr.axis.dx * s - ptr.lit.dx * w, y: ptr.heel.y + ptr.axis.dy * s - ptr.lit.dy * w });
    }
    return polyPath(pts, true);
  }

  function drawStarBlade(c, ptr) {
    const blade = bladePath(ptr);
    stroke(c, blade, solid(rgba(m.deep, 0.5)), g.size * 0.0034, { join: "round" });
    const mid = { x: ptr.heel.x + ptr.axis.dx * ptr.reach * 0.3, y: ptr.heel.y + ptr.axis.dy * ptr.reach * 0.3 };
    const w = ptr.halfWidth * 1.15;
    fill(c, blade, linear(bladeStops(),
      mid.x + ptr.lit.dx * w, mid.y + ptr.lit.dy * w, mid.x - ptr.lit.dx * w, mid.y - ptr.lit.dy * w));
    stroke(c, blade, solid(rgba(m.deep, 0.45)), 0.5);
    const spine = [];
    for (let i = 0; i <= 26; i++) {
      const t = 0.03 + (0.87 - 0.03) * i / 26;
      const f = bladeProfile(t);
      const s = t * ptr.reach;
      const off = f * ptr.halfWidth * 0.30;
      spine.push({
        p: { x: ptr.heel.x + ptr.axis.dx * s + ptr.lit.dx * off, y: ptr.heel.y + ptr.axis.dy * s + ptr.lit.dy * off },
        w: Math.max(f, 0.06),
      });
    }
    strokeWire(c, spine, ptr.halfWidth * 0.52, solid(m.spec), 0.55);
  }

  function drawStarJoint(c, ptr, ringCentre, ringRadius, ringWidth) {
    const u = ptr.axis, n = ptr.lit;
    const sPin = (ptr.pin.x - ptr.heel.x) * u.dx + (ptr.pin.y - ptr.heel.y) * u.dy;
    const half = ringWidth / 2;
    const sEdge = sPin + half;
    const sFoot = sPin + half * 0.92;
    const free = ptr.reach - sEdge;
    if (!(free > g.size * 0.002)) return;

    let lift = Math.min(ptr.halfWidth * 1.35, free * 0.5);
    lift = Math.max(lift, g.size * 0.0015);
    const sTop = sEdge + lift;
    const wTop = bladeProfile(sTop / ptr.reach) * ptr.halfWidth;
    const wFoot = wTop + lift * 0.95;

    const p = (s, w) => ({ x: ptr.heel.x + u.dx * s + n.dx * w, y: ptr.heel.y + u.dy * s + n.dy * w });

    const base = p(sFoot, 0);
    const rFoot = hypot(base.x - ringCentre.x, base.y - ringCentre.y);
    const aFoot = Math.atan2(base.y - ringCentre.y, base.x - ringCentre.x);
    const dPhi = wFoot / Math.max(rFoot, 0.001);
    const onRing = (d) => ({ x: ringCentre.x + rFoot * Math.cos(aFoot + d), y: ringCentre.y + rFoot * Math.sin(aFoot + d) });
    const probe = onRing(dPhi);
    const side = ((probe.x - base.x) * n.dx + (probe.y - base.y) * n.dy) >= 0 ? 1 : -1;
    const alongRing = (d) => {
      const a = aFoot + d;
      const s = d >= 0 ? -1 : 1;
      return { dx: -Math.sin(a) * s, dy: Math.cos(a) * s };
    };

    const flank = (sign, inset) => {
      const start = p(sTop, sign * wTop * inset);
      const d = side * sign * dPhi * inset;
      const end = onRing(d);
      const c1 = { x: start.x - u.dx * lift * 0.6, y: start.y - u.dy * lift * 0.6 };
      const back = alongRing(d);
      const c2 = { x: end.x + back.dx * wFoot * 0.55, y: end.y + back.dy * wFoot * 0.55 };
      const pts = [];
      for (let i = 0; i <= 16; i++) {
        const t = i / 16, mm = 1 - t;
        const b0 = mm * mm * mm, b1 = 3 * mm * mm * t, b2 = 3 * mm * t * t, b3 = t * t * t;
        pts.push({
          x: b0 * start.x + b1 * c1.x + b2 * c2.x + b3 * end.x,
          y: b0 * start.y + b1 * c1.y + b2 * c2.y + b3 * end.y,
        });
      }
      return pts;
    };

    const litFlank = flank(1, 1), farFlank = flank(-1, 1);
    const cove = [...litFlank];
    const arcSteps = 12;
    for (let i = 1; i <= arcSteps; i++) cove.push(onRing(side * dPhi * (1 - 2 * i / arcSteps)));
    for (const q of [...farFlank].reverse()) cove.push(q);
    const covePath = polyPath(cove, true);

    const fading = (pts) => pts.map((q, i) => ({ p: q, w: Math.max(0.05, Math.pow(1 - i / (pts.length - 1), 0.85)) }));

    for (const f of [litFlank, farFlank]) {
      strokeWire(c, fading(f), g.size * 0.0034, solid(rgba(m.deep, 0.5)));
    }

    const mid = p(sEdge, 0);
    const w = wFoot * 1.05;
    fill(c, covePath, linear(bladeStops(), mid.x + n.dx * w, mid.y + n.dy * w, mid.x - n.dx * w, mid.y - n.dy * w));

    strokeWire(c, fading(flank(1, 0.86)), Math.max(g.size * 0.0016, 0.7), solid(m.spec), 0.5);
    strokeWire(c, fading(flank(-1, 0.96)), Math.max(g.size * 0.0017, 0.7), solid(m.deep), 0.55);

    const spine = [];
    for (let i = 0; i <= 8; i++) {
      const s = sFoot + (sTop - sFoot) * i / 8;
      const f = bladeProfile(s / ptr.reach);
      const ease = 1 + 0.9 * Math.pow(1 - i / 8, 1.6);
      spine.push({ p: p(s, f * ease * ptr.halfWidth * 0.30), w: f * ease });
    }
    strokeWire(c, spine, ptr.halfWidth * 0.42, solid(m.spec), 0.42);

    const sBand = Math.min(sTop + lift * 0.55, sEdge + free * 0.40);
    if (!(sBand < ptr.reach * 0.92)) return;
    const wBand = bladeProfile(sBand / ptr.reach) * ptr.halfWidth * 0.80;
    stroke(c, polyPath([p(sBand, wBand), p(sBand, -wBand)]), solid(rgba(m.deep, 0.7)),
      Math.max(g.size * 0.0013, 0.6), { cap: "round" });

    const toLight = { dx: -0.7071, dy: -0.7071 };
    const lipSign = (u.dx * toLight.dx + u.dy * toLight.dy) >= 0 ? 1 : -1;
    const sLip = sBand + lipSign * Math.max(g.size * 0.0012, 0.55);
    const wLip = bladeProfile(sLip / ptr.reach) * ptr.halfWidth * 0.76;
    stroke(c, polyPath([p(sLip, wLip), p(sLip, -wLip)]), solid(rgba(m.spec, 0.35)),
      Math.max(g.size * 0.0009, 0.5), { cap: "round" });
  }

  function drawBead(c, at, r) {
    const path = circlePath(at.x, at.y, r);
    fill(c, path, (cc) => addStops(
      cc.createRadialGradient(at.x - r * 0.34, at.y - r * 0.34, 0, at.x - r * 0.34, at.y - r * 0.34, r * 1.6),
      even([m.spec, m.lit, m.base, m.dark, m.deep])));
    stroke(c, path, solid(rgba(m.deep, 0.55)), 0.6);
  }

  function drawStarHead(c, ptr) {
    const mag = Math.max(-1.5, Math.min(1.5, ptr.star.magnitude));
    const r = g.size * (0.0050 - mag * 0.0006);
    const sr = r * 1.08;
    fill(c, circlePath(ptr.tip.x + r * 0.34, ptr.tip.y + r * 0.34, sr), solid(rgba(m.deep, 0.5)));

    const l = layer();
    for (const [deg, reach] of [[0, 3.0], [180, 3.0], [90, 2.2], [270, 2.2]]) {
      const a = deg * D2R;
      const dx = Math.cos(a), dy = Math.sin(a);
      const len = r * reach, halfW = r * 0.20;
      fill(l.ctx, polyPath([
        { x: ptr.tip.x - dy * halfW, y: ptr.tip.y + dx * halfW },
        { x: ptr.tip.x + dx * len, y: ptr.tip.y + dy * len },
        { x: ptr.tip.x + dy * halfW, y: ptr.tip.y - dx * halfW },
      ], true), solid(m.spec));
    }
    composite(c, l, 0.45);
    drawBead(c, ptr.tip, r);
  }

  const glyphInk = new Map();
  function inkOf(c, i) {
    if (glyphInk.has(i)) return glyphInk.get(i);
    c.font = `100px ${font.symbol}`;
    const mt = c.measureText(SIGN_GLYPHS[i]);
    const w = (mt.actualBoundingBoxLeft + mt.actualBoundingBoxRight) / 100;
    const h = (mt.actualBoundingBoxAscent + mt.actualBoundingBoxDescent) / 100;
    const ink = { w: w > 0 ? w : 0.75, h: h > 0 ? h : 0.75 };
    glyphInk.set(i, ink);
    return ink;
  }

  function drawRete(c, ring, pointers) {
    const { centre, radius: r } = ring;
    for (const ptr of pointers) drawStarBlade(c, ptr);

    const ringWidth = g.size * 0.026;
    stroke(c, circlePath(centre.x, centre.y, r),
      linear(even([m.spec, m.deep, m.lit, m.dark, "#E8C87A"]), centre.x - r, centre.y - r, centre.x + r, centre.y + r),
      ringWidth);

    for (const ptr of pointers) drawStarJoint(c, ptr, centre, r, ringWidth);

    const half = ringWidth / 2;
    const engravingFit = 0.80;
    let glyphSize = g.size * 0.038;
    for (let i = 0; i < 12; i++) {
      const mm = point(i * 30 + 15);
      const dx = mm.x - centre.x, dy = mm.y - centre.y;
      const d = Math.max(hypot(dx, dy), 0.001);
      const ink = inkOf(c, i);
      const extent = ink.w * Math.abs(dx / d) + ink.h * Math.abs(dy / d);
      if (!(extent > 0.0001)) continue;
      glyphSize = Math.min(glyphSize, ringWidth * engravingFit / extent);
    }

    for (let i = 0; i < 12; i++) {
      const lambda = i * 30;
      const p = point(lambda);
      const px = p.x - centre.x, py = p.y - centre.y;
      const pd = Math.max(hypot(px, py), 0.001);
      const reach = half * engravingFit;
      stroke(c, polyPath([
        { x: p.x - px / pd * reach, y: p.y - py / pd * reach },
        { x: p.x + px / pd * reach, y: p.y + py / pd * reach },
      ]), solid(rgba(m.deep, 0.8)), 1);

      const mid = point(lambda + 15);
      inkText(c, SIGN_GLYPHS[i], `${glyphSize}px ${font.symbol}`, m.deep, mid.x, mid.y);
    }

    for (const ptr of pointers) drawStarHead(c, ptr);
  }

  function drawRule(c) {
    const a = 20 * D2R;
    stroke(c, polyPath([
      { x: g.c.x - Math.cos(a) * g.limbInner, y: g.c.y - Math.sin(a) * g.limbInner },
      { x: g.c.x + Math.cos(a) * g.limbInner, y: g.c.y + Math.sin(a) * g.limbInner },
    ]), linear(even([m.dark, m.spec, m.mid, m.deep]), g.c.x, g.c.y - 4, g.c.x, g.c.y + 4), g.size * 0.014);
  }

  // ================================================================ armature

  function clusters(bodies) {
    const sorted = [...bodies].sort((a, b) => a.longitude - b.longitude);
    const out = [];
    let i = 0;
    const maxRadius = g.mater;
    while (i < sorted.length) {
      let j = i + 1;
      while (j < sorted.length && sorted[j].longitude - sorted[j - 1].longitude < 9) j += 1;
      const group = [];
      sorted.slice(i, j).forEach((body, k) => {
        const base = point(body.longitude);
        const dx = base.x - g.c.x, dy = base.y - g.c.y;
        const len = Math.max(Math.sqrt(dx * dx + dy * dy), 0.001);
        const reach = Math.min(len + k * g.size * 0.052, maxRadius);
        group.push({ body, pos: { x: g.c.x + dx / len * reach, y: g.c.y + dy / len * reach } });
      });
      out.push(group);
      i = j;
    }
    return out;
  }

  const leadSteps = 20;
  const taper = (i, total) => 1 - 0.56 * Math.pow(i / Math.max(total, 1), 1.5);

  function voluteSamples(origin, heading, hand, lead, leadRadius, turns, outerRadius, eyeRatio) {
    const out = [];
    let p = { ...origin };
    let h = heading;
    const na = lead > 0.001 ? leadSteps : 0;
    const nb = 72;
    const total = na + nb;
    if (na > 0) {
      let w = Array.from({ length: na }, (_, k) => Math.sin(Math.PI * (k + 0.5) / na));
      const sum = Math.max(w.reduce((a, b) => a + b, 0), 0.0001);
      w = w.map((x) => x / sum);
      const ds = lead * leadRadius / na;
      for (let i = 0; i < na; i++) {
        p = { x: p.x + Math.cos(h) * ds, y: p.y + Math.sin(h) * ds };
        h += -hand * lead * w[i];
        out.push({ p, w: taper(out.length + 1, total) });
      }
    }
    let e = Array.from({ length: nb }, (_, k) => Math.min(1, ((k + 0.5) / nb) / 0.18));
    const esum = Math.max(e.reduce((a, b) => a + b, 0), 0.0001);
    e = e.map((x) => x / esum);
    const sweep = hand * turns * 2 * Math.PI;
    for (let i = 0; i < nb; i++) {
      const t = i / nb;
      const r = outerRadius * Math.pow(eyeRatio, t);
      const dTheta = sweep * e[i];
      const ds = r * Math.abs(dTheta);
      p = { x: p.x + Math.cos(h) * ds, y: p.y + Math.sin(h) * ds };
      h += dTheta;
      out.push({ p, w: taper(out.length + 1, total) });
    }
    return out;
  }

  function cascadeSamples(orn, hand, scale) {
    if (orn.length <= 12) return [];
    const eye = orn[orn.length - 1].p;
    const bulk = orn[Math.floor(orn.length / 3)].p;
    const h = Math.atan2(eye.y - bulk.y, eye.x - bulk.x);
    const s = g.size * scale;
    return voluteSamples(eye, h, -hand, 0.62, s * 0.030, 1.15, s * 0.019, 0.30);
  }

  const scrollSamples = (s) => s.filter((_, i) => i % 3 === 0).map((x) => x.p);

  function clashes(root, tip, halfWidth, scroll) {
    const vx = tip.x - root.x, vy = tip.y - root.y;
    const vv = Math.max(vx * vx + vy * vy, 0.0001);
    const arm = g.size * 0.015, gap = g.size * 0.007;
    for (const q of scroll) {
      const t = Math.min(Math.max(((q.x - root.x) * vx + (q.y - root.y) * vy) / vv, 0), 1);
      const d = hypot(q.x - (root.x + vx * t), q.y - (root.y + vy * t));
      if (d < bladeProfile(t) * halfWidth + arm + gap) return true;
    }
    return false;
  }

  const seatSettings = (() => {
    const leads = [1.45, 1.15, 1.75, 0.95];
    const swings = [0.0, 0.35, -0.35, 0.62, -0.62, 0.90, -0.90];
    const out = [];
    for (const size of [1.0, 0.86, 0.74]) {
      for (const flip of [false, true]) {
        for (const swing of swings) {
          for (const lead of leads) out.push({ lead, swing, size, flip });
        }
      }
    }
    return out;
  })();

  function armature(cluster, blades, ring) {
    if (!cluster.length) return null;
    const seat = point(cluster[0].body.longitude);
    const nodes = [seat];
    for (const { pos } of cluster) {
      const last = nodes[nodes.length - 1];
      if (hypot(pos.x - last.x, pos.y - last.y) > 1) nodes.push(pos);
    }
    if (nodes.length <= 1) return null;

    const outward = { x: seat.x - g.c.x, y: seat.y - g.c.y };
    const oLen = Math.max(hypot(outward.x, outward.y), 0.001);
    const bx = -outward.y / oLen, by = outward.x / oLen;

    const body = [{ p: nodes[0], w: 1 }];
    const bow = g.size * 0.030;
    for (let k = 1; k < nodes.length; k++) {
      const a = nodes[k - 1], b = nodes[k];
      const ctrl = { x: (a.x + b.x) / 2 + bx * bow, y: (a.y + b.y) / 2 + by * bow };
      const steps = 22;
      for (let i = 1; i <= steps; i++) {
        const t = i / steps, u = 1 - t;
        body.push({
          p: { x: u * u * a.x + 2 * u * t * ctrl.x + t * t * b.x, y: u * u * a.y + 2 * u * t * ctrl.y + t * t * b.y },
          w: 1,
        });
      }
    }
    body.forEach((s, i) => { s.w = 1 + 0.10 * Math.sin(Math.PI * (i / Math.max(body.length - 1, 1))); });

    const headOut = Math.atan2(body[1].p.y - body[0].p.y, body[1].p.x - body[0].p.x);
    const n = body.length;
    const headEnd = Math.atan2(body[n - 1].p.y - body[n - 2].p.y, body[n - 1].p.x - body[n - 2].p.x);
    const bowSign = (Math.cos(headOut) * by - Math.sin(headOut) * bx) >= 0 ? 1 : -1;

    const seatTerminal = (s) => {
      const hand = s.flip ? -bowSign : bowSign;
      const orn = voluteSamples(seat, headOut + Math.PI + s.swing * bowSign, hand,
        s.lead, g.size * 0.044 * s.size, 1.35, g.size * 0.032 * s.size, 0.26);
      return { orn, curl: cascadeSamples(orn, hand, s.size) };
    };

    const covered = g.size * 0.026;
    const inside = ring.radius - g.size * 0.008;
    const placeable = (end) => {
      const pts = scrollSamples([...end.orn, ...end.curl]).filter((q) => hypot(q.x - seat.x, q.y - seat.y) > covered);
      if (pts.some((q) => hypot(q.x - ring.centre.x, q.y - ring.centre.y) > inside)) return false;
      return !blades.some((b) => clashes(b.heel, b.tip, b.halfWidth, pts));
    };

    let setting = seatSettings[0];
    let seatEnd = seatTerminal(setting);
    for (const next of seatSettings.slice(1)) {
      if (placeable(seatEnd)) break;
      setting = next;
      seatEnd = seatTerminal(next);
    }
    const tailOrn = voluteSamples(body[n - 1].p, headEnd, -bowSign, 1.55, g.size * 0.026, 1.45, g.size * 0.020, 0.26);

    return {
      seat, body, seatOrn: seatEnd.orn, seatCurl: seatEnd.curl, tailOrn,
      seatScale: setting.size, studs: cluster.map((x) => x.pos),
    };
  }

  function flankOf(s, shift, sign) {
    if (s.length <= 1) return s;
    const lx = -0.7071, ly = -0.7071;
    return s.map((sample, i) => {
      const a = s[Math.max(i - 1, 0)].p, b = s[Math.min(i + 1, s.length - 1)].p;
      const dx = b.x - a.x, dy = b.y - a.y;
      const len = Math.max(Math.sqrt(dx * dx + dy * dy), 0.0001);
      const nx = -dy / len, ny = dx / len;
      const d = shift * (lx * nx + ly * ny) * sample.w * sign;
      return { p: { x: sample.p.x + nx * d, y: sample.p.y + ny * d }, w: sample.w };
    });
  }

  function strikeWire(c, s, width, shading) {
    const w = g.size * width;
    strokeWire(c, s, w * 1.42, solid(m.deep), 0.5);
    strokeWire(c, s, w, shading);
    strokeWire(c, flankOf(s, w * 0.30, -1), w * 0.30, solid(m.deep), 0.34);
    strokeWire(c, flankOf(s, w * 0.30, 1), w * 0.26, solid(m.spec), 0.6);
  }

  function voluteEye(s) {
    if (s.length < 3) return null;
    const a = s[s.length - 3].p, b = s[s.length - 2].p, c = s[s.length - 1].p;
    const d = 2 * (a.x * (b.y - c.y) + b.x * (c.y - a.y) + c.x * (a.y - b.y));
    if (!(Math.abs(d) > 1e-9)) return null;
    const a2 = a.x * a.x + a.y * a.y, b2 = b.x * b.x + b.y * b.y, c2 = c.x * c.x + c.y * c.y;
    const ux = (a2 * (b.y - c.y) + b2 * (c.y - a.y) + c2 * (a.y - b.y)) / d;
    const uy = (a2 * (c.x - b.x) + b2 * (a.x - c.x) + c2 * (b.x - a.x)) / d;
    return { centre: { x: ux, y: uy }, radius: hypot(c.x - ux, c.y - uy) };
  }

  const wireHalf = (width, s) => g.size * width * (s.length ? s[s.length - 1].w : 1) / 2;

  function drawEyeBoss(c, at, r) {
    const path = circlePath(at.x, at.y, r);
    fill(c, path, (cc) => addStops(
      cc.createRadialGradient(at.x - r * 0.30, at.y - r * 0.30, 0, at.x - r * 0.30, at.y - r * 0.30, r * 1.85),
      even([m.spec, m.lit, m.base, m.mid, m.dark])));
    stroke(c, path, solid(rgba(m.deep, 0.45)), 0.6);
  }

  function drawCascade(c, curl, from, scale) {
    if (curl.length <= 1) return;
    const width = 0.0085 * (0.6 + 0.4 * scale);
    const end = curl[curl.length - 1].p;
    strikeWire(c, curl, width, linear(even([m.base, m.lit, m.mid, m.dark]), from.x, from.y, end.x, end.y));
    const tip = voluteEye(curl);
    if (tip) drawEyeBoss(c, tip.centre, tip.radius + wireHalf(width, curl) * 0.85);
  }

  function drawBezel(c, head) {
    const r = g.size * 0.026;
    const path = circlePath(head.x, head.y, r);
    fill(c, path, conic(even([m.lit, m.dark, m.base, m.deep, m.lit]), head.x, head.y, -135));
    stroke(c, path, solid(rgba(m.deep, 0.7)), 0.8);
  }

  function drawArmature(c, cluster, blades, ring) {
    const arm = armature(cluster, blades, ring);
    if (!arm) return;
    const wire = [...arm.seatOrn].reverse().concat(arm.body, arm.tailOrn);
    const tail = arm.body[arm.body.length - 1].p;
    strikeWire(c, wire, 0.014, linear(even([m.dark, m.base, m.lit, m.mid, m.dark]), arm.seat.x, arm.seat.y, tail.x, tail.y));
    if (arm.seatOrn.length) drawCascade(c, arm.seatCurl, arm.seatOrn[arm.seatOrn.length - 1].p, arm.seatScale);
    const seatEye = voluteEye(arm.seatOrn);
    if (seatEye) drawEyeBoss(c, seatEye.centre, seatEye.radius + wireHalf(0.014, arm.seatOrn) * 0.85);
    const tailEye = voluteEye(arm.tailOrn);
    if (tailEye) drawEyeBoss(c, tailEye.centre, tailEye.radius + wireHalf(0.014, arm.tailOrn) * 0.85);
    for (const stud of arm.studs) drawBezel(c, stud);
  }

  // ================================================================ the hub

  function drawHub(c) {
    const sun = chart.bodies.find((b) => b.name === "sun");
    const r = g.hub;
    fill(c, circlePath(g.c.x, g.c.y, r), solid(rgba(pal.ground, 0.96)));
    // strokeBorder: the 2pt line sits inside the circle's edge
    const l = layer();
    stroke(l.ctx, circlePath(g.c.x, g.c.y, r - 1), conic(spunStops(m, false), g.c.x, g.c.y, -135), 2);
    composite(c, l, 0.7);

    const signName = SIGNS[signIndex(asc)];
    const lines = [
      { text: "RISING", font: `400 11px ${font.body}`, color: pal.brass, tracking: 1.6, size: 11, leading: 1.54 },
      { text: `${SIGN_GLYPHS[signIndex(asc)]} ${signName}`, font: `700 ${g.size * 0.052}px ${font.display}`, color: pal.resist, size: g.size * 0.052, leading: 1.36 },
      {
        text: `${Math.round(degreeWithinSign(asc))}° · Sun in ${sun ? SIGNS[signIndex(sun.longitude)] : ""}`,
        font: `400 ${g.size * 0.026}px ${font.body}`, color: pal.muted, size: g.size * 0.026, leading: 1.54,
      },
    ];
    // Line boxes at each font's own line height (Spectral's is tall), stacked
    // with 1pt between them and centred as a block, as the app's VStack does.
    const heights = lines.map((ln) => ln.size * ln.leading);
    const total = heights.reduce((a, b) => a + b, 0) + (lines.length - 1);
    let y = g.c.y - total / 2;
    const maxWidth = (r - g.size * 0.012) * 2;
    lines.forEach((ln, i) => {
      const cy = y + heights[i] / 2;
      c.font = ln.font;
      let fontCss = ln.font;
      const width = c.measureText(ln.text).width + (ln.tracking ?? 0) * ([...ln.text].length - 1);
      if (width > maxWidth) {
        const scale = Math.max(0.6, maxWidth / width);
        fontCss = ln.font.replace(/([\d.]+)px/, (_, px) => `${Number(px) * scale}px`);
      }
      c.font = fontCss;
      c.fillStyle = ln.color;
      c.textAlign = ln.tracking ? "left" : "center";
      c.textBaseline = "middle";
      if (ln.tracking) {
        const chars = [...ln.text];
        const widths = chars.map((ch) => c.measureText(ch).width);
        let x = g.c.x - width / 2;
        chars.forEach((ch, k) => { c.fillText(ch, x, cy); x += widths[k] + ln.tracking; });
      } else {
        c.fillText(ln.text, g.c.x, cy);
      }
      y += heights[i] + 1;
    });
  }

  // ================================================================ studs

  /** A layer built up by SwiftUI-style stacked shadows. */
  function withShadow(src, w, h, color, alpha, dx, dy, radius) {
    const out = makeLayer(w, h, dpr);
    const oc = out.ctx;
    oc.save();
    oc.setTransform(1, 0, 0, 1, 0, 0);
    oc.shadowColor = rgba(color, alpha);
    oc.shadowOffsetX = dx * dpr;
    oc.shadowOffsetY = dy * dpr;
    oc.shadowBlur = radius * dpr;
    oc.drawImage(src.canvas, 0, 0);
    oc.restore();
    return out;
  }

  function drawStud(c, body, at) {
    const d = g.size * 0.072;
    const pad = 8;
    const box = d + pad * 2;
    const o = pad + d / 2;
    const s = makeLayer(box, box, dpr);
    const sc = s.ctx;
    const disc = circlePath(o, o, d / 2);

    fill(sc, disc, conic(spunStops(m, true), o, o, -135));
    stroke(sc, circlePath(o, o, d / 2 - 0.5), linear([[0, "rgba(255,255,255,0.6)"], [1, "rgba(0,0,0,0.45)"]], o, o - d / 2, o, o + d / 2), 1);

    // wear under the glyph
    sc.save();
    sc.clip(disc);
    const heavy = WEAR * (body.retrograde ? 1.25 : 1);
    let seed = 7;
    for (const ch of body.name) seed = (seed * 31 + ch.charCodeAt(0)) % 100000;
    const rng = new SeededRandom(seed + 7);
    const x0 = o - d / 2, y0 = o - d / 2;
    const strokes = 6 + Math.floor(heavy * 26);
    const grain = rng.next() * Math.PI;
    for (let i = 0; i < strokes; i++) {
      const angle = grain + (rng.next() - 0.5) * 0.7;
      const len = d * (0.15 + rng.next() * 0.55);
      const sx = x0 + rng.next() * d, sy = y0 + rng.next() * d;
      const dx = Math.cos(angle) * len, dy = Math.sin(angle) * len;
      const a = (0.06 + rng.next() * 0.16) * (0.4 + heavy);
      stroke(sc, polyPath([{ x: sx, y: sy }, { x: sx + dx, y: sy + dy }]), solid(rgba(m.deep, a)), 0.5 + rng.next() * 0.6, { cap: "round" });
      stroke(sc, polyPath([{ x: sx + 0.5, y: sy - 0.5 }, { x: sx + dx + 0.5, y: sy + dy - 0.5 }]), solid(rgba(m.spec, a * 0.7)), 0.4, { cap: "round" });
    }
    const nicks = Math.floor(heavy * 7);
    for (let i = 0; i < nicks; i++) {
      const cx = x0 + rng.next() * d, cy = y0 + rng.next() * d;
      const r = d * (0.012 + rng.next() * 0.030);
      const a0 = rng.next() * Math.PI * 2;
      const chip = new Path2D();
      chip.moveTo(cx, cy);
      chip.arc(cx, cy, r, a0, a0 + 1.6 + rng.next(), false);
      chip.closePath();
      fill(sc, chip, solid(rgba(m.deep, 0.42 + rng.next() * 0.28)));
      stroke(sc, chip, solid(rgba(m.spec, 0.5)), 0.5);
    }
    const pits = Math.floor(heavy * 40);
    for (let i = 0; i < pits; i++) {
      const cx = x0 + rng.next() * d, cy = y0 + rng.next() * d;
      const r = d * (0.004 + rng.next() * 0.008);
      fill(sc, circlePath(cx, cy, r), solid(rgba(m.deep, 0.25 + rng.next() * 0.35)));
    }
    sc.restore();

    // The glyph, engraved: dark above-left, light below-right, stacked the
    // way SwiftUI stacks shadows, then laid onto the metal.
    let t = makeLayer(box, box, dpr);
    inkText(t.ctx, (PLANET_GLYPHS[body.name] ?? "?") + TEXT, `${d * 0.52}px ${font.symbol}`, m.onMetal, o, o);
    t = withShadow(t, box, box, m.deep, 0.95, -1.0, -1.0, 0);
    t = withShadow(t, box, box, m.deep, 0.55, -0.5, -0.5, 0);
    t = withShadow(t, box, box, m.spec, 0.95, 1.0, 1.0, 0);
    t = withShadow(t, box, box, m.spec, 0.55 * 0.95, 0.5, 0.5, 0);
    t = withShadow(t, box, box, m.deep, 0.5, -0.4, -0.4, 2.2);
    sc.save();
    sc.setTransform(1, 0, 0, 1, 0, 0);
    sc.drawImage(t.canvas, 0, 0);
    sc.restore();

    const shadowed = withShadow(s, box, box, "#000000", 0.5, 0, 1, 2);
    c.save();
    c.setTransform(1, 0, 0, 1, 0, 0);
    c.drawImage(shadowed.canvas, Math.round((at.x - o) * dpr), Math.round((at.y - o) * dpr));
    c.restore();
  }

  // ================================================================ compose

  const ring = ringGeometry();
  const pointers = starPointers(ring.centre, ring.radius);
  const planets = chart.bodies.filter((b) => PLANET_GLYPHS[b.name]);
  const groups = clusters(planets);

  drawMater(ctx);
  drawPlate(ctx);
  drawRete(ctx, ring, pointers);
  drawRule(ctx);
  for (const cluster of groups) drawArmature(ctx, cluster, pointers, ring);
  drawHub(ctx);

  // Pointers whose tips reach inside the hub are redrawn over it, clipped to
  // the hub, exactly as the app's third canvas does.
  ctx.save();
  ctx.clip(circlePath(g.c.x, g.c.y, g.hub));
  const ringWidth = g.size * 0.026;
  for (const ptr of pointers) drawStarBlade(ctx, ptr);
  for (const ptr of pointers) drawStarJoint(ctx, ptr, ring.centre, ring.radius, ringWidth);
  for (const ptr of pointers) drawStarHead(ctx, ptr);
  ctx.restore();

  const studs = groups.flat();
  for (const { body, pos } of studs) drawStud(ctx, body, pos);

  const limbR = (g.mater + g.limbInner) / 2;
  return {
    houses: Array.from({ length: 12 }, (_, i) => {
      const a = houseMidAngle(i + 1);
      return { house: i + 1, x: g.c.x + Math.cos(a) * limbR, y: g.c.y + Math.sin(a) * limbR, r: g.size * 0.055 };
    }),
    planets: studs.map(({ body, pos }) => ({ name: body.name, x: pos.x, y: pos.y, r: g.size * 0.036 })),
  };
}

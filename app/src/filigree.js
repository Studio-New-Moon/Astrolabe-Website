// FiligreeFrame, ported from the app's FiligreeFrame.swift — the same
// generator, not an approximation of it.
//
// The ornament is generated for the size of the thing it frames: the corner
// clusters scale off the shorter side, and pieces are culled where an arm has
// no room for them, so it has to be rebuilt whenever its container resizes.
// Everything is authored in ornament units (a notional 1000-unit square whose
// origin is the corner) and scaled on the way out, exactly as in Swift.
//
// The Swift file carries the reasoning behind every constant and every motif
// (why stems meet coils along their tangent, why the terminus is pulled back
// to 452, why the culls are where they are). Read it before changing any
// number here, and change both together: this is a port, and the two are
// meant to draw the same metal.

import { resolve, EVENT, METALS } from "../../chart/src/appearance.js";

/** Room past the framed element's own edge for the rail and the cast shadow. */
const BLEED = 6;
const RAIL_Y = 48;
const RAIL_GAUGE = 26;
/**
 * How far the cast shadow reaches past the metal's own silhouette, in CSS
 * pixels: the 1.1px drop plus about two standard deviations of the 1.2px
 * blur. `contentClearance` measures only the metal, so on its own it lets
 * the shadow land on whatever sits just inside it. Every margin below adds
 * this, so nothing in a framed element is touched by the frame or its shadow.
 */
const SHADOW = 3.5;
/** Measured off the built silhouette; see `deepestReachUnits` in Swift. */
const DEEPEST_REACH_UNITS = 565;

/** Points per ornament unit for a container of this size. */
const unitsPerPoint = (w, h, scale) => Math.min(w, h) * 0.29 * scale / 560;

/** How far a corner cluster reaches in from each edge, in CSS pixels. */
export const contentClearance = (w, h, scale = 1) => DEEPEST_REACH_UNITS * unitsPerPoint(w, h, scale);

// ---------------------------------------------------------------- Primitives

function bezier(p0, p1, p2, p3, n = 70) {
  const out = [];
  for (let i = 0; i <= n; i++) {
    const t = i / n, u = 1 - t;
    const w0 = u * u * u, w1 = 3 * u * u * t, w2 = 3 * u * t * t, w3 = t * t * t;
    out.push({ x: w0 * p0.x + w1 * p1.x + w2 * p2.x + w3 * p3.x,
               y: w0 * p0.y + w1 * p1.y + w2 * p2.y + w3 * p3.y });
  }
  return out;
}

function asymRibbon(pts, wl, wr) {
  if (pts.length < 2) return [];
  const left = [], right = [];
  for (let i = 0; i < pts.length; i++) {
    const a = pts[Math.max(i - 1, 0)], b = pts[Math.min(i + 1, pts.length - 1)];
    const dx = b.x - a.x, dy = b.y - a.y;
    const l = Math.max(Math.hypot(dx, dy), 0.001);
    const nx = -dy / l, ny = dx / l;
    left.push({ x: pts[i].x + nx * wl[i], y: pts[i].y + ny * wl[i] });
    right.push({ x: pts[i].x - nx * wr[i], y: pts[i].y - ny * wr[i] });
  }
  return left.concat(right.reverse());
}

const ribbon = (pts, widths) => asymRibbon(pts, widths.map((w) => w / 2), widths.map((w) => w / 2));

function circlePoly(c, r, n = 32) {
  const out = [];
  for (let i = 0; i < n; i++) {
    const a = 2 * Math.PI * i / n;
    out.push({ x: c.x + r * Math.cos(a), y: c.y + r * Math.sin(a) });
  }
  return out;
}

const outermostDiagonal = (cl) =>
  cl.reduce((m, s) => (s.p.x + s.p.y > m.x + m.y ? s.p : m), cl[0]?.p ?? { x: 0, y: 0 });

const nearestStation = (cl, p) =>
  cl.reduce((m, s) => (Math.hypot(s.p.x - p.x, s.p.y - p.y) < Math.hypot(m.x - p.x, m.y - p.y) ? s.p : m), cl[0]?.p ?? p);

// ---------------------------------------------------------------- Ornament

class Ornament {
  constructor(rect, cornerRadius, scale) {
    this.rect = rect;
    this.cornerRadius = cornerRadius;
    this.s = unitsPerPoint(rect.w, rect.h, scale);
  }

  get diagonalRoom() { return (Math.min(this.rect.w, this.rect.h) / 2) / this.s; }
  get railRadiusUnits() {
    const inset = RAIL_Y * this.s;
    const r = Math.min(this.cornerRadius, Math.min(this.rect.w, this.rect.h) / 2 - inset);
    return Math.max(r, 0) / this.s;
  }
  get arcCentre() { return RAIL_Y + this.railRadiusUnits; }
  get arcLength() { return this.railRadiusUnits * Math.PI / 4; }
  get railThin() { return Math.max(0.9, RAIL_GAUGE * this.s * 0.36); }

  railPoint(horizontal, d) {
    const rU = this.railRadiusUnits, ac = this.arcCentre;
    if (d < this.arcLength && rU > 0.001) {
      const sweep = d / rU;
      const th = 5 * Math.PI / 4 + (horizontal ? sweep : -sweep);
      const p = { x: ac + rU * Math.cos(th), y: ac + rU * Math.sin(th) };
      let t = { x: -Math.sin(th), y: Math.cos(th) };
      if (!horizontal) t = { x: -t.x, y: -t.y };
      return { p, t, n: { x: -Math.cos(th), y: -Math.sin(th) } };
    }
    const e = d - this.arcLength;
    return horizontal
      ? { p: { x: ac + e, y: RAIL_Y }, t: { x: 1, y: 0 }, n: { x: 0, y: 1 } }
      : { p: { x: RAIL_Y, y: ac + e }, t: { x: 0, y: 1 }, n: { x: 1, y: 0 } };
  }

  offRail(base, a, b) {
    return { x: base.p.x + base.t.x * a + base.n.x * b, y: base.p.y + base.t.y * a + base.n.y * b };
  }

  // ---- Motifs

  startAngle(heading, turns, chir, tight) {
    return heading - Math.atan2(chir * turns * 2 * Math.PI, Math.log(tight));
  }

  spiral(cx, cy, R, rIn, a0, turns, chir, n = 150) {
    const out = [];
    for (let i = 0; i <= n; i++) {
      const t = i / n;
      const a = a0 + chir * turns * 2 * Math.PI * t;
      const r = R * Math.pow(rIn / R, t);
      out.push({ x: cx + r * Math.cos(a), y: cy + r * Math.sin(a) });
    }
    return out;
  }

  scroll(polys, { cx, cy, R, a0, turns, chir, wRoot, root = null, bow = 0.18, flare = 1.0, tight = 0.30 }) {
    const cl = this.spiral(cx, cy, R, R * tight, a0, turns, chir);
    const n = cl.length;
    const stations = cl.map((p, i) => ({ p, w: wRoot * (1 - 0.55 * Math.pow(i / (n - 1), 1.2)) }));
    polys.push(ribbon(cl, stations.map((s) => s.w)));
    polys.push(circlePoly(cl[n - 1], stations[n - 1].w * 0.5));

    if (root) {
      const start = cl[0];
      const d = { x: start.x - root.x, y: start.y - root.y };
      const dist = Math.max(Math.hypot(d.x, d.y), 0.001);
      const perp = { x: -d.y * bow, y: d.x * bow };
      const m1 = { x: root.x + d.x * 0.40 + perp.x, y: root.y + d.y * 0.40 + perp.y };
      const back = { x: start.x - cl[1].x, y: start.y - cl[1].y };
      const bl = Math.max(Math.hypot(back.x, back.y), 0.001);
      const m2 = { x: start.x + back.x / bl * dist * 0.34, y: start.y + back.y / bl * dist * 0.34 };
      const stem = bezier(root, m1, m2, start);
      const ns = stem.length;
      const swell = flare * 1.1 - 0.95;
      polys.push(ribbon(stem, stem.map((_, i) => wRoot * (0.95 + swell * Math.pow(1 - i / (ns - 1), 2.2)))));
    }
    return stations;
  }

  tangentLobe(polys, cl, idx, length, hand, wMax, notches = 2) {
    if (!(cl.length > idx + 2 && idx > 1)) return;
    const p0 = cl[idx].p, a = cl[idx - 2].p, b = cl[idx + 2].p;
    let h = { x: b.x - a.x, y: b.y - a.y };
    const hl = Math.max(Math.hypot(h.x, h.y), 0.001);
    h = { x: h.x / hl, y: h.y / hl };
    const turned = (ang, k) => {
      const c = Math.cos(hand * ang), sn = Math.sin(hand * ang);
      return { x: p0.x + (h.x * c - h.y * sn) * length * k, y: p0.y + (h.x * sn + h.y * c) * length * k };
    };
    this.lobe(polys, p0, turned(0.25, 0.35), turned(0.90, 0.70), turned(1.60, 1.0), wMax, notches, hand > 0 ? 1 : -1);
  }

  lobe(polys, p0, c1, c2, tip, wMax, notches, notchSide) {
    const spine = bezier(p0, c1, c2, tip, 90);
    const n = spine.length;
    const wl = [], wr = [];
    for (let i = 0; i < n; i++) {
      const t = i / (n - 1);
      let w = wMax * 4 * Math.pow(t, 0.45) * Math.pow(1 - t, 1.25);
      w = Math.max(w, wMax * 0.10 * (1 - t));
      const notch = 1 - 0.5 * Math.pow(Math.max(0, Math.sin(notches * 2 * Math.PI * t + 0.6)), 2);
      if (notchSide > 0) { wl.push(w * 0.5); wr.push(w * 0.75 * notch); }
      else { wl.push(w * 0.75 * notch); wr.push(w * 0.5); }
    }
    polys.push(asymRibbon(spine, wl, wr));
  }

  sprig(polys, cl, end, w0, trefoilSize) {
    const start = outermostDiagonal(cl);
    const d = { x: end.x - start.x, y: end.y - start.y };
    const dist = Math.max(Math.hypot(d.x, d.y), 0.001);
    const u = { x: d.x / dist, y: d.y / dist };
    const perp = { x: -u.y * dist * 0.10, y: u.x * dist * 0.10 };
    const c1 = { x: start.x + u.x * dist * 0.35 + perp.x, y: start.y + u.y * dist * 0.35 + perp.y };
    const c2 = { x: start.x + u.x * dist * 0.72 + perp.x * 0.5, y: start.y + u.y * dist * 0.72 + perp.y * 0.5 };
    const stem = bezier(start, c1, c2, end, 90);
    const n = stem.length;
    polys.push(ribbon(stem, stem.map((_, i) => {
      const t = i / (n - 1);
      return w0 * (0.55 + 0.45 * Math.min(t / 0.16, 1)) * (1 - 0.62 * Math.pow(t, 0.9));
    })));
    this.trefoil(polys, end, trefoilSize);
  }

  tendril(polys, p0, c1, c2, tip, w0) {
    if (!(w0 * this.s > 0.22)) return;
    const spine = bezier(p0, c1, c2, tip, 80);
    const n = spine.length;
    polys.push(ribbon(spine, spine.map((_, i) => {
      const t = i / (n - 1);
      const ramp = 0.36 + 0.64 * Math.min(t / 0.20, 1);
      const taper = 1 - 0.90 * Math.pow(t, 1.9);
      return Math.max(w0 * ramp * taper, 0.4);
    })));
  }

  band(polys, cl, end, w0, sag) {
    if (!cl.length) return;
    const start = nearestStation(cl, end);
    const d = { x: end.x - start.x, y: end.y - start.y };
    const perp = { x: -d.y * sag, y: d.x * sag };
    const m1 = { x: start.x + d.x * 0.33 + perp.x, y: start.y + d.y * 0.33 + perp.y };
    const m2 = { x: start.x + d.x * 0.66 + perp.x, y: start.y + d.y * 0.66 + perp.y };
    const curve = bezier(start, m1, m2, end, 80);
    const n = curve.length;
    polys.push(ribbon(curve, curve.map((_, i) => w0 * (0.5 + 0.5 * Math.pow(Math.sin(Math.PI * i / (n - 1)), 0.7)))));
  }

  trefoil(polys, c, size) {
    for (let k = 0; k < 3; k++) {
      const a = (20 + k * 120) * Math.PI / 180;
      const tip = { x: c.x + size * Math.cos(a), y: c.y + size * Math.sin(a) };
      const c1 = { x: c.x + size * 0.35 * Math.cos(a - 0.5), y: c.y + size * 0.35 * Math.sin(a - 0.5) };
      const c2 = { x: c.x + size * 0.75 * Math.cos(a + 0.25), y: c.y + size * 0.75 * Math.sin(a + 0.25) };
      const spine = bezier(c, c1, c2, tip, 40);
      const n = spine.length;
      polys.push(ribbon(spine, spine.map((_, i) => {
        const t = i / (n - 1);
        return size * 0.55 * 4 * Math.pow(t, 0.6) * Math.pow(1 - t, 1.1);
      })));
    }
    polys.push(circlePoly(c, size * 0.16));
  }

  // ---- Composition

  polygons(armX, armY) {
    const polys = [];
    const s = this.s, arcCentre = this.arcCentre, arcLength = this.arcLength;

    const thinUnits = this.railThin / s;
    for (const horizontal of [true, false]) {
      const arm = horizontal ? armX : armY;
      const reach = Math.min(arm, 880) - arcCentre + arcLength;
      if (!(reach > 0)) continue;
      const line = [], widths = [];
      const steps = 56;
      for (let i = 0; i <= steps; i++) {
        const t = i / steps;
        line.push(this.railPoint(horizontal, reach * t).p);
        widths.push(RAIL_GAUGE + (thinUnits - RAIL_GAUGE) * Math.pow(t, 0.85));
      }
      polys.push(ribbon(line, widths));
    }

    const deg = Math.PI / 180;
    const apex = this.scroll(polys, { cx: 235, cy: 235, R: 115, a0: -135 * deg, turns: 1.3, chir: 1, wRoot: 30,
      root: this.railPoint(true, 0).p, bow: 0.10, flare: 1.85, tight: 0.30 });

    let flankH = [], flankV = [];
    if (armX > 480 && arcCentre < 340) {
      flankH = this.scroll(polys, { cx: 435, cy: 160, R: 50, a0: -80 * deg, turns: 1.35, chir: -1, wRoot: 13,
        root: { x: 350, y: RAIL_Y }, bow: 0.25 });
    }
    if (armY > 480 && arcCentre < 340) {
      flankV = this.scroll(polys, { cx: 160, cy: 435, R: 50, a0: -190 * deg, turns: 1.35, chir: 1, wRoot: 13,
        root: { x: RAIL_Y, y: 350 }, bow: -0.25 });
    }

    const sTurns = 1.45, sTight = 0.48;
    const sScroll = this.scroll(polys, { cx: 392, cy: 392, R: 62,
      a0: this.startAngle(Math.PI / 4, sTurns, -1, sTight),
      turns: sTurns, chir: -1, wRoot: 16, root: outermostDiagonal(apex), bow: 0.05, tight: sTight });

    this.tangentLobe(polys, sScroll, 34, 100, 1, 17);
    this.tangentLobe(polys, sScroll, 78, 68, 1, 13);
    if (flankH.length) this.tangentLobe(polys, flankH, 16, 78, 1, 13, 1);
    if (flankV.length) this.tangentLobe(polys, flankV, 16, 78, -1, 13, 1);

    const chain = [[560, 104, 38], [668, 90, 27], [756, 78, 19], [828, 68, 13]];
    let firstChainH = [], firstChainV = [];
    chain.forEach(([cx, cy, R], k) => {
      if (!(R * s > 1.1)) return;
      const chir = k % 2 === 0 ? 1 : -1;
      if (!(cx - R * 0.4 > arcCentre)) return;
      if (cx + R * 1.4 < armX) {
        const cl = this.scroll(polys, { cx, cy, R, a0: -Math.PI / 2, turns: 1.25, chir, wRoot: 5 + R * 0.20,
          root: { x: cx - R * 0.4, y: RAIL_Y }, bow: 0.10 });
        if (k === 0) firstChainH = cl;
        if (k < 3 && R * s > 1.6) {
          const mx = cx + R * 1.35;
          this.lobe(polys, { x: mx, y: RAIL_Y }, { x: mx + R * 0.2, y: RAIL_Y + R * 0.7 },
            { x: mx - R * 0.1, y: RAIL_Y + R * 1.2 }, { x: mx - R * 0.5, y: RAIL_Y + R * 1.7 }, R * 0.30, 1, 1);
        }
      }
      if (cx + R * 1.4 < armY) {
        const cl = this.scroll(polys, { cx: cy, cy: cx, R, a0: Math.PI, turns: 1.25, chir, wRoot: 5 + R * 0.20,
          root: { x: RAIL_Y, y: cx - R * 0.4 }, bow: 0.10 });
        if (k === 0) firstChainV = cl;
        if (k < 3 && R * s > 1.6) {
          const my = cx + R * 1.35;
          this.lobe(polys, { x: RAIL_Y, y: my }, { x: RAIL_Y + R * 0.7, y: my + R * 0.2 },
            { x: RAIL_Y + R * 1.2, y: my - R * 0.1 }, { x: RAIL_Y + R * 1.7, y: my - R * 0.5 }, R * 0.30, 1, -1);
        }
      }
    });

    const tw = 15;
    for (const horizontal of [true, false]) {
      const base = this.railPoint(horizontal, 47);
      this.tendril(polys, base.p, this.offRail(base, 55, -11), this.offRail(base, 117, 0),
        this.offRail(base, 169, 23), tw);
    }
    if (flankH.length) {
      this.tendril(polys, nearestStation(flankH, { x: 410, y: 120 }),
        { x: 378, y: 192 }, { x: 384, y: 300 }, { x: 438, y: 372 }, tw * 0.95);
    }
    if (flankV.length) {
      this.tendril(polys, nearestStation(flankV, { x: 150, y: 378 }),
        { x: 228, y: 400 }, { x: 306, y: 476 }, { x: 392, y: 460 }, tw * 0.95);
    }

    if (this.diagonalRoom > 620) {
      const tip = { x: 452, y: 452 };
      this.sprig(polys, sScroll, tip, 13, 40);
      if (firstChainH.length) this.band(polys, firstChainH, tip, 10, -0.16);
      if (firstChainV.length) this.band(polys, firstChainV, tip, 10, 0.16);
    }
    return polys;
  }
}

// ---------------------------------------------------------------- SVG

const f = (n) => (Math.round(n * 100) / 100).toString();

function roundedRectPath(x, y, w, h, r) {
  r = Math.max(0, Math.min(r, w / 2, h / 2));
  return `M${f(x + r)} ${f(y)}H${f(x + w - r)}A${f(r)} ${f(r)} 0 0 1 ${f(x + w)} ${f(y + r)}` +
    `V${f(y + h - r)}A${f(r)} ${f(r)} 0 0 1 ${f(x + w - r)} ${f(y + h)}` +
    `H${f(x + r)}A${f(r)} ${f(r)} 0 0 1 ${f(x)} ${f(y + h - r)}V${f(y + r)}A${f(r)} ${f(r)} 0 0 1 ${f(x + r)} ${f(y)}Z`;
}

let uid = 0;

/** The frame's SVG markup for a framed element of `w` × `h` CSS pixels. */
function frameMarkup(w, h, cornerRadius, scale, tones) {
  const rect = { x: BLEED, y: BLEED, w, h };
  if (!(w > 90 && h > 44)) return "";
  const o = new Ornament(rect, cornerRadius, scale);
  const s = o.s;
  const id = `fil${++uid}`;

  const inset = RAIL_Y * s;
  const bw = w - 2 * inset, bh = h - 2 * inset;
  const r = Math.min(cornerRadius, Math.min(bw, bh) / 2);
  const rail = roundedRectPath(rect.x + inset, rect.y + inset, bw, bh, r);
  const trim = (RAIL_Y - RAIL_GAUGE / 2) * s;
  const clip = roundedRectPath(rect.x + trim, rect.y + trim, w - 2 * trim, h - 2 * trim, Math.max(0, r - trim));
  const thin = o.railThin;

  const polys = o.polygons(w / (2 * s), h / (2 * s));
  let defs = `<clipPath id="${id}c"><path d="${clip}"/></clipPath>` +
    `<filter id="${id}r" x="-5%" y="-5%" width="110%" height="110%"><feGaussianBlur stdDeviation="1.1"/></filter>` +
    `<filter id="${id}b" x="-10%" y="-10%" width="120%" height="120%"><feGaussianBlur stdDeviation="1.2"/></filter>`;
  let body = `<path d="${rail}" fill="none" stroke="${tones.deep}" stroke-opacity=".42" stroke-width="${f(thin * 1.5)}" transform="translate(0.7 1)" filter="url(#${id}r)"/>` +
    `<path d="${rail}" fill="none" stroke="${tones.base}" stroke-width="${f(thin)}"/>`;

  let corners = "";
  [[1, 1], [-1, 1], [1, -1], [-1, -1]].forEach(([sx, sy], k) => {
    let d = "", minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    for (const poly of polys) {
      if (poly.length < 3) continue;
      poly.forEach((p, i) => {
        const x = sx > 0 ? rect.x + p.x * s : rect.x + w - p.x * s;
        const y = sy > 0 ? rect.y + p.y * s : rect.y + h - p.y * s;
        if (x < minX) minX = x; if (x > maxX) maxX = x;
        if (y < minY) minY = y; if (y > maxY) maxY = y;
        d += (i ? "L" : "M") + f(x) + " " + f(y);
      });
      d += "Z";
    }
    if (!d) return;
    // Lit from up-left in screen space whichever way the corner is mirrored,
    // so all four read as one plate under one light.
    defs += `<linearGradient id="${id}g${k}" gradientUnits="userSpaceOnUse" x1="${f(minX)}" y1="${f(minY)}" x2="${f(maxX)}" y2="${f(maxY)}">` +
      [tones.spec, tones.lit, tones.base, tones.mid, tones.dark].map((c, i) => `<stop offset="${i / 4}" stop-color="${c}"/>`).join("") +
      `</linearGradient>`;
    // One path, non-zero fill, so the overlapping pieces composite into a
    // single sheet; no outline stroke, for the reason the Swift file gives.
    corners += `<path d="${d}" fill="${tones.deep}" fill-opacity=".4" transform="translate(0.8 1.1)" filter="url(#${id}b)"/>` +
      `<path d="${d}" fill="url(#${id}g${k})"/>`;
  });

  return `<defs>${defs}</defs>${body}<g clip-path="url(#${id}c)">${corners}</g>`;
}

/**
 * The least leading padding that keeps a disc of radius `r`, centred `cy`
 * down a `w` × `h` card, clear of the two left-hand clusters and their
 * shadow — tested against the ornament's own outline points rather than a
 * bounding box, since the disc sits in the hollow between the clusters.
 */
function discClearance(w, h, radius, cy, r, min) {
  if (!(w > 90 && h > 44)) return min;
  const o = new Ornament({ x: 0, y: 0, w, h }, radius, 1);
  const s = o.s, reach = r + 2 + SHADOW;
  let pad = min;
  for (const poly of o.polygons(w / (2 * s), h / (2 * s))) {
    for (const p of poly) {
      const x = p.x * s;
      for (const y of [p.y * s, h - p.y * s]) {
        const dy = y - cy;
        if (Math.abs(dy) >= reach) continue;
        pad = Math.max(pad, x + Math.sqrt(reach * reach - dy * dy) - r);
      }
    }
  }
  return Math.ceil(pad * 2) / 2;
}

/**
 * How far in from the side edges the metal reaches anywhere between the top
 * and bottom bands, in CSS pixels — the depth the side padding has to clear.
 */
function sideReach(w, h, radius, scale, band) {
  if (!(w > 90 && h > 44)) return 0;
  const o = new Ornament({ x: 0, y: 0, w, h }, radius, scale);
  const s = o.s;
  let reach = 0;
  for (const poly of o.polygons(w / (2 * s), h / (2 * s))) {
    for (const p of poly) if (p.y * s > band && p.y * s < h - band) reach = Math.max(reach, p.x * s);
  }
  return reach;
}

// ---------------------------------------------------------------- Mounting

/**
 * Placeholder markup for a framed element. `mode` is "card" (the Purpose card:
 * full-size cluster, trailing room reserved for it as LifeAreasView does) or
 * "panel" (the horoscope: the cluster's reach pinned to a share of the width,
 * with a band of that depth above and below, as AreaHoroscopeSection does).
 */
export function filigree({ radius = 11, mode = "card" } = {}) {
  return `<svg class="filigree" aria-hidden="true" style="position:absolute;inset:-6px;width:calc(100% + 12px);height:calc(100% + 12px);pointer-events:none;overflow:visible" data-radius="${radius}" data-mode="${mode}"></svg>`;
}

const tracked = new Set();
const lastSize = new WeakMap();

function draw(svg) {
  const host = svg.parentElement;
  if (!host || !svg.isConnected) { tracked.delete(svg); return; }
  // The frame is laid over its host, so it needs the host positioned and
  // itself absolute. The markup says so inline; this holds even where a page
  // arrives with an older stylesheet (GitHub Pages lets one be cached for ten
  // minutes), which would otherwise stretch the frame across the whole page.
  if (getComputedStyle(host).position === "static") host.style.position = "relative";
  if (getComputedStyle(svg).position !== "absolute") {
    Object.assign(svg.style, { position: "absolute", inset: `-${BLEED}px`, width: `calc(100% + ${2 * BLEED}px)`,
      height: `calc(100% + ${2 * BLEED}px)`, pointerEvents: "none", overflow: "visible" });
  }
  let w = host.offsetWidth, h = host.offsetHeight;
  const mode = svg.dataset.mode, radius = +svg.dataset.radius;
  let scale = 1;

  if (mode === "panel") {
    // 44pt on the iPhone 16 Plus's 371pt panel, as a share of the width; read
    // off the width alone so the band it sets cannot feed back into it.
    const reach = w * (44 / 371);
    const atFull = contentClearance(w, h, 1);
    if (atFull > 0) scale = Math.min(1, reach / atFull);
    const band = Math.max(16, reach + 2 + SHADOW);
    if (host.style.paddingBlock !== `${band}px`) host.style.paddingBlock = `${band}px`;
    // The sides carry the cascade of small scrolls running down each edge,
    // which reaches further in than the panel's ordinary 16px once the panel
    // is wider than a phone. Measured off the ornament itself, beside the
    // content only — the corner clusters above and below are the band's job.
    const side = `${Math.max(16, Math.ceil(sideReach(w, h, radius, scale, band - 2 - SHADOW) + 2 + SHADOW))}px`;
    if (host.style.paddingInline !== side) host.style.paddingInline = side;
  } else if (mode === "button") {
    // A button given emphasis (the install buttons, the homepage's first Cast
    // Your Chart), or a small plate framed whole (the instrument section's): the frame sits around it in a band of its own, the corner
    // clusters held to a 20px reach that suits a button's height rather than
    // a card's, with the button centred in the band.
    const reach = 20;
    const atFull = contentClearance(w, h, 1);
    if (atFull > 0) scale = Math.min(1, reach / atFull);
    const band = `${Math.ceil(reach + 2 + SHADOW)}px`;
    if (host.style.padding !== band) {
      host.style.padding = band;
      // Measured again now the band is in, so the frame is drawn to the box
      // it actually sits on rather than the one it was before the band
      // (which left it short of the edges, floating inside its box).
      w = host.offsetWidth; h = host.offsetHeight;
      // The holder just grew; /assets/fit-buttons.js re-measures the label.
      window.dispatchEvent(new Event("astrolabe:framed"));
    }
  } else {
    // The card's own 13px, plus whatever more the cluster needs, plus 2px of
    // air between glyph and metal and the shadow's reach. Settles in a step or
    // two: the text below it is capped at two lines.
    const reserve = `${13 + Math.max(0, contentClearance(w, h) + 2 + SHADOW - 13)}px`;
    if (host.style.paddingRight !== reserve) host.style.paddingRight = reserve;
    // The leading edge holds the sign's medallion, which sits between the two
    // left-hand clusters. Moved right only as far as it has to go to clear
    // the actual metal, so the card keeps the app's layout wherever it can.
    const disc = host.querySelector(":scope > .medallion");
    if (disc) {
      const hr = host.getBoundingClientRect(), dr = disc.getBoundingClientRect();
      const lead = `${discClearance(w, h, radius, dr.top + dr.height / 2 - hr.top, dr.width / 2, 13)}px`;
      if (host.style.paddingLeft !== lead) host.style.paddingLeft = lead;
    }
  }

  // A frame can name its metal (data-metal) where what it frames is struck in
  // a fixed one, as the homepage's buttons are always polished brass.
  const own = svg.dataset.metal && METALS.find((m) => m.id === svg.dataset.metal);
  const metal = own || tones;
  // data-edge="flush" lays the rail along the host's own edge (a framed
  // plate, whose border the rail replaces) instead of inside it: the frame is
  // drawn that much larger and set out by the same amount.
  // The frame is positioned from inside the host's border, so the rail is
  // set out by half the border too, to run along the border's middle.
  const out = svg.dataset.edge === "flush" ? RAIL_Y * unitsPerPoint(w, h, scale) + host.clientTop / 2 : 0;
  const fw = w + 2 * out, fh = h + 2 * out;
  const key = `${fw}x${fh}x${scale}x${metal.id}`;
  if (lastSize.get(svg) === key) return;
  lastSize.set(svg, key);
  if (out) {
    const pad = BLEED + out;
    Object.assign(svg.style, { inset: `-${pad}px`, width: `calc(100% + ${2 * pad}px)`, height: `calc(100% + ${2 * pad}px)` });
  }
  svg.setAttribute("viewBox", `0 0 ${fw + 2 * BLEED} ${fh + 2 * BLEED}`);
  svg.innerHTML = frameMarkup(fw, fh, radius, scale, metal);
}

let tones = resolve().metal;
let tonesKey = tones.id;

const observer = typeof ResizeObserver === "function"
  ? new ResizeObserver((entries) => entries.forEach((e) => {
      const svg = e.target.querySelector(":scope > svg.filigree");
      if (svg) draw(svg);
    }))
  : null;

// Once the fonts are in and the page has loaded, every frame is drawn again
// from scratch: either can resize a box after its frame first went in.
const redrawAll = () => { for (const svg of tracked) { lastSize.delete(svg); draw(svg); } };
document.fonts?.ready.then(redrawAll);
if (document.readyState !== "complete") window.addEventListener("load", redrawAll, { once: true });

/** Draws every filigree placeholder under `root` and keeps it sized. */
export function mountFiligrees(root = document) {
  root.querySelectorAll("svg.filigree").forEach((svg) => {
    if (tracked.has(svg)) return;
    tracked.add(svg);
    draw(svg);
    // Border box, not content box: the horoscope's band is padding, so a
    // change to it moves the border box and leaves the content box alone.
    observer?.observe(svg.parentElement, { box: "border-box" });
  });
  for (const svg of tracked) {
    if (svg.isConnected) continue;
    tracked.delete(svg);
    // A frame taken out with its host has no parent left to stop watching.
    if (svg.parentElement) observer?.unobserve(svg.parentElement);
  }
}

window.addEventListener(EVENT, () => {
  tones = resolve().metal;
  tonesKey = tones.id;
  for (const svg of tracked) draw(svg);
});

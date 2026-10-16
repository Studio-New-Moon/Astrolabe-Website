// The homepage's first screen: the iPhone app's welcome screen, on the web.
//
// A port of `WelcomeView.swift` and `AstrolabeScene.swift`, draw call for
// draw call where a draw call exists. The Swift carries the reasons for almost
// every number here; they are pointed at rather than repeated.
//
// - `Starfield`, `drawPlanet`, `strokeRing`: the seeded sky (xorshift64 from
//   `SeededRandom.swift`, seed 88, so the stars and planets fall where the
//   app's do). Drawn once, not every second: the app turns the whole field
//   once every 45 minutes, which no visit here would ever see, so only its
//   random starting turn is kept.
// - `ShootingStar`, `MoonGlow`, `RLegStarPointer`: as written.
// - The astrolabe. The app hangs baked `GenericAstrolabeFront` /
//   `AstrolabeBack` textures on a SceneKit cylinder under an orthographic
//   camera tipped 20 degrees. Here the same faces are drawn on canvases, and
//   the same camera is done by hand: an orthographic projection of a plane is
//   an affine map, so each baked layer lands with one `setTransform`. The
//   cylinder's wall, the turned throne, the ring and the shackle are real
//   meshes, depth-sorted and shaded against the same banded "room" the app
//   reflects in its metal. What SceneKit does that this does not: per-pixel
//   physically-based shading and multisampled edges. The faces were never
//   lit by those (they are `.lambert`, drawn with their own light), so they
//   come through unchanged; the metal parts are an approximation.

import { retePoint, cancerRadius, ecliptic } from "../../chart/src/projection.js";

const D2R = Math.PI / 180;
const reduceMotion = matchMedia("(prefers-reduced-motion: reduce)");

// ---------------------------------------------------------------------------
// Colour. `Palette.brassAndInk` with the brass `MetalFinish`.

const B = {
  deep: "#3D2F14", dark: "#6D5424", mid: "#B08C3F",
  base: "#C9A24C", lit: "#F0D493", spec: "#FDF1CD",
};
const ENGRAVING = "#6F6A52";
// fire, earth, air, water
const ELEMENTS = ["#DD6440", "#6D9F38", "#2F52A0", "#12797F"];

function rgb(hex) {
  const h = hex.replace("#", "");
  return [parseInt(h.slice(0, 2), 16), parseInt(h.slice(2, 4), 16), parseInt(h.slice(4, 6), 16)];
}
function rgba(hex, a = 1) {
  const [r, g, b] = rgb(hex);
  return `rgba(${r},${g},${b},${Math.max(0, Math.min(1, a))})`;
}
const clamp01 = (x) => Math.max(0, Math.min(1, x));

function linear(ctx, x0, y0, x1, y1, stops) {
  const g = ctx.createLinearGradient(x0, y0, x1, y1);
  for (const [o, c] of stops) g.addColorStop(clamp01(o), c);
  return g;
}
function radial(ctx, cx, cy, r0, r1, stops) {
  const g = ctx.createRadialGradient(cx, cy, Math.max(0, r0), cx, cy, Math.max(r1, 0.0001));
  for (const [o, c] of stops) g.addColorStop(clamp01(o), c);
  return g;
}
/** SwiftUI's `.conicGradient(…, angle:)`: starts at `angle`, runs clockwise. */
function conic(ctx, deg, cx, cy, stops) {
  if (!ctx.createConicGradient) return null;
  const g = ctx.createConicGradient(deg * D2R, cx, cy);
  for (const [o, c] of stops) g.addColorStop(clamp01(o), c);
  return g;
}
const evenly = (colors) => colors.map((c, i) => [i / (colors.length - 1), c]);

function circle(ctx, x, y, r) {
  ctx.beginPath();
  ctx.arc(x, y, Math.max(r, 0), 0, Math.PI * 2);
}

// ---------------------------------------------------------------------------
// `SeededRandom`: xorshift64, exactly as the app has it.

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
// Blur. SwiftUI's `.blur(radius:)` is a Gaussian; so is the canvas `filter`
// where it exists. Safari before 18 has no canvas filter, so there the shape
// is drawn small, blurred by hand and scaled back up, which for a blur loses
// nothing worth having.

let filterOK = null;
function canvasFilterWorks() {
  if (filterOK !== null) return filterOK;
  try {
    const c = document.createElement("canvas");
    c.width = c.height = 9;
    const x = c.getContext("2d");
    x.filter = "blur(2px)";
    x.fillRect(4, 4, 1, 1);
    filterOK = x.getImageData(1, 4, 1, 1).data[3] > 0;
  } catch (e) { filterOK = false; }
  return filterOK;
}

function boxBlur(data, w, h, r) {
  // three box passes each way approximate a Gaussian; premultiplied, so a
  // blurred edge fades to clear rather than to grey
  const n = w * h;
  const a = new Float32Array(n * 4), t = new Float32Array(n * 4);
  for (let i = 0; i < n; i++) {
    const al = data[i * 4 + 3] / 255;
    a[i * 4] = data[i * 4] * al; a[i * 4 + 1] = data[i * 4 + 1] * al;
    a[i * 4 + 2] = data[i * 4 + 2] * al; a[i * 4 + 3] = al * 255;
  }
  const pass = (src, dst, horizontal) => {
    const len = horizontal ? w : h, lines = horizontal ? h : w;
    const step = horizontal ? 4 : w * 4;
    const k = 1 / (2 * r + 1);
    for (let l = 0; l < lines; l++) {
      const base = horizontal ? l * w * 4 : l * 4;
      for (let ch = 0; ch < 4; ch++) {
        let acc = 0;
        for (let i = -r; i <= r; i++) acc += src[base + Math.min(len - 1, Math.max(0, i)) * step + ch];
        for (let i = 0; i < len; i++) {
          dst[base + i * step + ch] = acc * k;
          const out = Math.max(0, i - r), inn = Math.min(len - 1, i + r + 1);
          acc += src[base + inn * step + ch] - src[base + out * step + ch];
        }
      }
    }
  };
  for (let p = 0; p < 3; p++) { pass(a, t, true); pass(t, a, false); }
  for (let i = 0; i < n; i++) {
    const al = a[i * 4 + 3];
    const f = al > 0 ? 255 / al : 0;
    data[i * 4] = a[i * 4] * f; data[i * 4 + 1] = a[i * 4 + 1] * f;
    data[i * 4 + 2] = a[i * 4 + 2] * f; data[i * 4 + 3] = al;
  }
}

/**
 * Runs `draw` with a Gaussian blur of `radius` points on whatever it paints.
 * `k` is device pixels per point in `ctx`'s current transform.
 */
function withBlur(ctx, radius, k, draw) {
  const px = radius * k;
  ctx.save();
  if (px < 0.35) { draw(ctx); ctx.restore(); return; }
  if (canvasFilterWorks()) {
    ctx.filter = `blur(${px}px)`;
    draw(ctx);
    ctx.restore();
    return;
  }
  const W = ctx.canvas.width, H = ctx.canvas.height;
  const f = Math.max(1, Math.min(4, Math.round(px / 2)));
  const tmp = document.createElement("canvas");
  tmp.width = Math.ceil(W / f); tmp.height = Math.ceil(H / f);
  const t = tmp.getContext("2d");
  const m = ctx.getTransform();
  t.setTransform(m.a / f, m.b / f, m.c / f, m.d / f, m.e / f, m.f / f);
  t.globalAlpha = ctx.globalAlpha;
  draw(t);
  const img = t.getImageData(0, 0, tmp.width, tmp.height);
  boxBlur(img.data, tmp.width, tmp.height, Math.max(1, Math.round((px / f) * 0.87)));
  t.putImageData(img, 0, 0);
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.globalAlpha = 1;
  ctx.imageSmoothingEnabled = true;
  ctx.drawImage(tmp, 0, 0, W, H);
  ctx.restore();
}

function makeCanvas(wPts, hPts, k) {
  const c = document.createElement("canvas");
  c.width = Math.max(1, Math.ceil(wPts * k));
  c.height = Math.max(1, Math.ceil(hPts * k));
  const x = c.getContext("2d");
  x.setTransform(k, 0, 0, k, 0, 0);
  return [c, x];
}

// ===========================================================================
// The sky — `Starfield`.

const PLANET_SPECS = [
  [0.095, true], [0.042, true],
  [0.075, false], [0.06, false], [0.05, false], [0.048, false], [0.065, false], [0.055, false],
];

function drawFlare(ctx, fx, fy, tx, ty, color) {
  const dx = tx - fx, dy = ty - fy;
  for (const step of [0.35, 0.6, 0.82]) {
    const r = 5.0 * (1 - step * 0.6);
    circle(ctx, fx + dx * step, fy + dy * step, r);
    ctx.fillStyle = rgba(color, 0.12 * (1 - step * 0.5));
    ctx.fill();
  }
}

function strokeRing(ctx, r, color, strength) {
  // in a frame already turned to the ring's tilt, centred on the planet
  for (const [inset, width, opacity] of [[0, 0.34, 0.5], [0.16, 0.16, 0.32], [0.30, 0.1, 0.6]]) {
    ctx.beginPath();
    ctx.ellipse(0, 0, r * (1.75 - inset), r * (0.5 - inset * 0.29), 0, 0, Math.PI * 2);
    ctx.strokeStyle = rgba(color, opacity * strength);
    ctx.lineWidth = r * width;
    ctx.stroke();
  }
}

function drawPlanet(ctx, cx, cy, r, color, ringed, tilt, rng) {
  const t = tilt * D2R;
  if (ringed) {
    ctx.save();
    ctx.translate(cx, cy); ctx.rotate(t);
    ctx.beginPath(); ctx.rect(-r * 3, -r * 3, r * 6, r * 3); ctx.clip();
    strokeRing(ctx, r, color, 0.32);
    ctx.restore();
  }

  circle(ctx, cx, cy, r);
  ctx.fillStyle = radial(ctx, cx - r * 0.32, cy - r * 0.32, 0, r * 1.35,
    [[0, rgba(color, 0.95)], [0.5, rgba(color, 0.55)], [1, "rgba(0,0,0,0.82)"]]);
  ctx.fill();

  if (!ringed) {
    ctx.save();
    circle(ctx, cx, cy, r); ctx.clip();
    const tone = (dark, a) => (dark ? `rgba(0,0,0,${a})` : `rgba(255,255,255,${a})`);
    const hasBands = rng.next() > 0.32;
    if (hasBands) {
      const bandCount = 3 + Math.floor(rng.next() * 3);
      for (let i = 0; i < bandCount; i++) {
        const tt = (i + 0.5) / bandCount - 0.5;
        const thickness = r * (0.12 + rng.next() * 0.16);
        const dark = rng.next() > 0.5;
        const a = 0.08 + rng.next() * 0.12;
        ctx.save();
        ctx.translate(cx, cy); ctx.rotate(t);
        ctx.beginPath();
        ctx.ellipse(0, r * tt * 1.7, r * 1.15, thickness / 2, 0, 0, Math.PI * 2);
        ctx.fillStyle = tone(dark, a);
        ctx.fill();
        ctx.restore();
      }
    }
    const blotchCount = 5 + Math.floor(rng.next() * 5);
    for (let i = 0; i < blotchCount; i++) {
      const bx = (rng.next() - 0.5) * r * 1.7;
      const by = (rng.next() - 0.5) * r * 1.7;
      const br = r * (0.1 + rng.next() * 0.24);
      const stretch = 0.6 + rng.next() * 1.1;
      const dark = rng.next() > 0.45;
      const a = 0.05 + rng.next() * 0.09;
      ctx.save();
      ctx.translate(cx, cy); ctx.rotate(t);
      ctx.beginPath();
      ctx.ellipse(bx, by, br * stretch, br, 0, 0, Math.PI * 2);
      ctx.fillStyle = tone(dark, a);
      ctx.fill();
      ctx.restore();
    }
    if (rng.next() > 0.5) {
      const bx = cx + (rng.next() - 0.5) * r * 0.9;
      const by = cy + (rng.next() - 0.5) * r * 0.9;
      const br = r * (0.32 + rng.next() * 0.22);
      const dark = rng.next() > 0.5;
      const a = 0.07 + rng.next() * 0.06;
      circle(ctx, bx, by, br);
      ctx.fillStyle = tone(dark, a);
      ctx.fill();
    }
    const g = conic(ctx, 60, cx, cy, [
      [0, rgba(color, 0)], [0.070, rgba(color, 0.34)], [0.139, rgba(color, 0.52)],
      [0.208, rgba(color, 0.34)], [0.278, rgba(color, 0)], [1, rgba(color, 0)],
    ]);
    if (g) {
      ctx.beginPath();
      ctx.arc(cx, cy, r * 0.96, 60 * D2R, 160 * D2R, false);
      ctx.strokeStyle = g;
      ctx.lineWidth = r * 0.06;
      ctx.lineCap = "round";
      ctx.stroke();
    }
    ctx.restore();
  }

  circle(ctx, cx, cy, r);
  ctx.strokeStyle = rgba(color, 0.4);
  ctx.lineWidth = 0.6;
  ctx.stroke();

  if (ringed) {
    ctx.save();
    ctx.translate(cx, cy); ctx.rotate(t);
    ctx.beginPath(); ctx.rect(-r * 3, 0, r * 6, r * 3); ctx.clip();
    strokeRing(ctx, r, color, 1);
    ctx.restore();
  }
}

/**
 * The welcome screen's sky, at `w` x `h` points, into a context already
 * scaled to device pixels by `k`. `planets: false` gives the stars and
 * constellations alone, for the night the rest of the page sits on.
 */
export function drawStarfield(ctx, w, h, k, { planets = true, rotation = 0 } = {}) {
  ctx.save();
  ctx.translate(w / 2, h / 2);
  ctx.rotate(rotation * D2R);
  ctx.translate(-w / 2, -h / 2);
  const rng = new SeededRandom(88);

  for (let c = 0; c < 4; c++) {
    const color = ELEMENTS[c % 4];
    const depth = rng.next();
    const pointCount = 4 + Math.floor(rng.next() * 3);
    const originX = rng.next() * w;
    const originY = rng.next() * h * 0.85;
    const spread = w * (0.2 + depth * 0.3);
    const pts = [];
    for (let i = 0; i < pointCount; i++) {
      const x = originX + (rng.next() - 0.5) * spread;
      const y = originY + (rng.next() - 0.5) * spread * 0.75;
      pts.push([x, y]);
    }
    ctx.beginPath();
    ctx.moveTo(pts[0][0], pts[0][1]);
    for (const p of pts.slice(1)) ctx.lineTo(p[0], p[1]);
    ctx.strokeStyle = rgba(color, 0.14 + depth * 0.24);
    ctx.lineWidth = 0.5 + depth * 0.7;
    ctx.stroke();
    const dotR = 1.3 + depth * 1.8;
    ctx.fillStyle = rgba(color, 0.3 + depth * 0.4);
    for (const p of pts) { circle(ctx, p[0], p[1], dotR); ctx.fill(); }
  }

  let brightSeen = 0;
  for (let i = 0; i < 110; i++) {
    const color = ELEMENTS[i % 4];
    const x = rng.next() * w;
    const y = rng.next() * h;
    const bright = rng.next() > 0.88;
    const r = bright ? 1.6 : 0.5 + rng.next() * 0.7;
    const alpha = bright ? 0.95 : 0.35 + rng.next() * 0.4;
    if (bright) {
      const reach = r * 6;
      ctx.beginPath();
      ctx.moveTo(x - reach, y); ctx.lineTo(x + reach, y);
      ctx.moveTo(x, y - reach); ctx.lineTo(x, y + reach);
      ctx.strokeStyle = rgba(color, 0.45);
      ctx.lineWidth = 0.6;
      ctx.stroke();
      brightSeen += 1;
      if (brightSeen <= 2) drawFlare(ctx, x, y, w / 2, h * 0.55, color);
    }
    circle(ctx, x, y, r);
    ctx.fillStyle = `rgba(255,255,255,${alpha * 0.9})`;
    ctx.fill();
    circle(ctx, x, y, r * 1.8);
    ctx.fillStyle = rgba(color, alpha * 0.3);
    ctx.fill();
  }

  if (planets) {
    const sectorWidth = 360 / PLANET_SPECS.length;
    const diag = Math.sqrt(w * w + h * h) / 2;
    const sizes = PLANET_SPECS.map((p) => p[0]);
    const minS = Math.min(...sizes), maxS = Math.max(...sizes);
    const list = [];
    let prev = -1, first = -1;
    PLANET_SPECS.forEach(([size, ringed], i) => {
      let color = Math.floor(rng.next() * 4);
      const isLast = i === PLANET_SPECS.length - 1;
      let attempt = 0;
      while ((color === prev || (isLast && color === first)) && attempt < 6) {
        color = Math.floor(rng.next() * 4);
        attempt += 1;
      }
      prev = color;
      if (i === 0) first = color;
      const r = w * size;
      const sector = i * sectorWidth + (rng.next() - 0.5) * sectorWidth * 0.7;
      const a = sector * D2R;
      const radius = diag * (0.28 + rng.next() * 0.62);
      let cx = w / 2 + Math.cos(a) * radius;
      let cy = h / 2 + Math.sin(a) * radius;
      cx = Math.min(Math.max(cx, r * 0.4), w - r * 0.4);
      cy = Math.min(Math.max(cy, r * 0.4), h - r * 0.4);
      if (cy < h * 0.40) {
        cx = rng.next() < 0.5 ? w * (0.02 + rng.next() * 0.10) : w * (0.88 + rng.next() * 0.10);
      }
      const tilt = rng.next() * 150 - 75;
      const farness = 1 - (size - minS) / (maxS - minS);
      const blur = Math.pow(farness, 2) * w * 0.006;
      const seed = Math.floor(rng.next() * 1000000) + 1;
      list.push({ cx, cy, r, color: ELEMENTS[color], ringed, tilt, blur, seed });
    });
    list.sort((p, q) => q.blur - p.blur);
    for (const p of list) {
      const prng = new SeededRandom(p.seed);
      const paint = (c) => drawPlanet(c, p.cx, p.cy, p.r, p.color, p.ringed, p.tilt, prng);
      if (p.blur > 0.3) withBlur(ctx, p.blur, k, paint);
      else paint(ctx);
    }
  }
  ctx.restore();
}

// ===========================================================================
// `MoonGlow`.

function drawMoonGlow(ctx, w, h) {
  const cx = w / 2, cy = h / 2, r = 32;
  circle(ctx, cx, cy, r);
  ctx.fillStyle = radial(ctx, cx, cy, 0, r, [
    [0, "rgba(237,227,204,0.85)"], [0.42, "rgba(201,162,76,0.45)"], [1, "rgba(201,162,76,0)"],
  ]);
  ctx.fill();
  for (const [fx, fy, rad] of [[0.26, 0.31, 2.1], [0.755, 0.62, 1.7], [0.705, 0.20, 1.3], [0.315, 0.69, 1.2]]) {
    const px = w * fx, py = h * fy;
    circle(ctx, px, py, rad); ctx.fillStyle = "#E8C87A"; ctx.fill();
    circle(ctx, px, py, rad * 0.35); ctx.fillStyle = "#FFF8E6"; ctx.fill();
  }
}

// ===========================================================================
// `RLegStarPointer` — drawn into its own 120 x 120 frame, centred on the tip
// of the R's leg.

const LEG_TIP = { x: 126.2, y: 6.1 };

function drawLegStar(ctx) {
  const a = 48.2 * D2R;
  const dir = { x: Math.cos(a), y: Math.sin(a) };
  const tip = { x: 60, y: 60 };
  const bead = { x: 60 + dir.x * 8, y: 60 + dir.y * 8 };
  const flare = "#FFF8E6", halo = "#E8C87A";

  // the burst, unshadowed
  const bloom = 14;
  circle(ctx, bead.x, bead.y, bloom);
  ctx.fillStyle = radial(ctx, bead.x, bead.y, 0, bloom,
    [[0, rgba(flare, 0.5)], [0.26, rgba(halo, 0.42)], [1, rgba(halo, 0)]]);
  ctx.fill();
  for (let i = 0; i < 8; i++) {
    const ang = i * Math.PI / 4;
    const long = i % 2 === 0;
    const reach = long ? 17 : 8;
    const ex = bead.x + Math.cos(ang) * reach, ey = bead.y + Math.sin(ang) * reach;
    ctx.beginPath(); ctx.moveTo(bead.x, bead.y); ctx.lineTo(ex, ey);
    ctx.strokeStyle = linear(ctx, bead.x, bead.y, ex, ey,
      [[0, flare], [0.22, rgba(halo, 0.65)], [1, rgba(halo, 0)]]);
    ctx.lineWidth = long ? 1.2 : 0.7;
    ctx.lineCap = "round";
    ctx.stroke();
  }

  // the shank and bead, with the letters' own hard shadow and a tight soft one
  const k = ctx.getTransform().a;
  const [lc, lx] = makeCanvas(120, 120, k);
  const start = { x: tip.x - dir.x * 1.5, y: tip.y - dir.y * 1.5 };
  lx.beginPath(); lx.moveTo(start.x, start.y); lx.lineTo(bead.x, bead.y);
  lx.strokeStyle = linear(lx, start.x, start.y, bead.x, bead.y,
    [[0, "#C6A14E"], [0.5, "#C19A4D"], [1, "#9D7C33"]]);
  lx.lineWidth = 1.84; lx.lineCap = "butt"; lx.stroke();
  const r = 3;
  circle(lx, bead.x, bead.y, r);
  lx.fillStyle = radial(lx, bead.x - r * 0.3, bead.y - r * 0.3, 0, r * 1.6,
    evenly(["#FDF1CD", "#F2DDA0", "#E6C47F", "#9D7C33", "#7A5F28"]));
  lx.fill();
  lx.strokeStyle = "rgba(122,95,40,0.55)"; lx.lineWidth = 0.5; lx.stroke();
  const hot = r * 0.26;
  circle(lx, bead.x - r * 0.36, bead.y - r * 0.36, hot);
  lx.fillStyle = "rgba(255,255,255,0.9)"; lx.fill();

  ctx.save();
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.shadowColor = "rgba(0,0,0,0.45)"; ctx.shadowBlur = 6 * k; ctx.shadowOffsetY = 2 * k;
  ctx.drawImage(lc, 0, 0);
  ctx.shadowColor = "rgba(0,0,0,0.85)"; ctx.shadowBlur = 0; ctx.shadowOffsetY = 1 * k;
  ctx.drawImage(lc, 0, 0);
  ctx.shadowColor = "transparent";
  ctx.drawImage(lc, 0, 0);
  ctx.restore();
}

// ===========================================================================
// The faces — `GenericAstrolabeFront` and `AstrolabeBack`, one canvas per
// layer, at `parallax: 0`, exactly as `AstrolabeScene.engravingNodes` bakes
// them. `s` is the face's side in points; every fixed line width below is in
// points, as in the app.

const ELEVATION = 0.55;           // FlipGeometry.elevation
const RETE_STOCK = 0.022;
const RETE_REACH = 0.988;
const LIP_DEPTH = 0.0096;
const ROMAN = ["I", "II", "III", "IV", "V", "VI", "VII", "VIII", "IX", "X", "XI", "XII"];
const SIGN_GLYPHS = ["♈", "♉", "♊", "♋", "♌", "♍", "♎", "♏", "♐", "♑", "♒", "♓"].map((g) => g + "︎");
const SERIF = '"New York", ui-serif, "Iowan Old Style", "Palatino Linotype", Georgia, serif';
const SYMBOLS = '"Apple Symbols", "Segoe UI Symbol", "Noto Sans Symbols 2", "Noto Sans Symbols", system-ui, sans-serif';
const STARS = [
  ["Aldebaran", 69.8, -5.5, 0.87], ["Betelgeuse", 88.8, -16.0, 0.45], ["Sirius", 104.1, -39.6, -1.46],
  ["Regulus", 149.8, 0.5, 1.36], ["Spica", 203.8, -2.1, 0.98], ["Arcturus", 204.2, 30.7, -0.05],
  ["Pollux", 113.2, 6.7, 1.14], ["Vega", 285.4, 61.7, 0.03], ["Altair", 301.8, 29.3, 0.76],
  ["Deneb", 335.3, 59.9, 1.25], ["Capella", 81.9, 22.9, 0.08],
];

function arcPath(ctx, cx, cy, r, from, to) {
  ctx.beginPath();
  ctx.arc(cx, cy, r, from, to, false);
}

function drawWear(ctx, c, mater, limbInner, s, seed) {
  const rng = new SeededRandom(seed);
  const amount = 0.16;
  ctx.save();
  circle(ctx, c, c, mater); ctx.clip();
  for (let i = 0; i < 14 + Math.floor(amount * 90); i++) {
    const a0 = rng.next() * Math.PI * 2;
    const sweep = 0.05 + rng.next() * 0.5;
    const rr = limbInner + rng.next() * (mater - limbInner);
    const alpha = (0.05 + rng.next() * 0.14) * (0.35 + amount);
    const color = rng.next() > 0.5 ? rgba(B.deep, alpha) : rgba(B.spec, alpha);
    const lw = 0.4 + rng.next() * 0.7;
    arcPath(ctx, c, c, rr, a0, a0 + sweep);
    ctx.strokeStyle = color; ctx.lineWidth = lw; ctx.lineCap = "round";
    ctx.stroke();
  }
  ctx.restore();
}

function materFill(ctx, c, mater) {
  circle(ctx, c, c, mater);
  ctx.fillStyle = B.mid; ctx.fill();
  const g = conic(ctx, -135, c, c, evenly([B.base, B.dark, B.base, B.deep, B.base]));
  if (g) { circle(ctx, c, c, mater); ctx.fillStyle = g; ctx.fill(); }
}

const LIP_BREAK = 11 * D2R;
function drawLip(ctx, c, mater, s) {
  const from = -Math.PI / 2 + LIP_BREAK;
  const to = from + 2 * Math.PI - 2 * LIP_BREAK;
  ctx.save();
  circle(ctx, c, c, mater); ctx.clip();
  arcPath(ctx, c, c, mater, from, to);
  ctx.strokeStyle = linear(ctx, c - mater * 0.7, c - mater * 0.7, c + mater * 0.7, c + mater * 0.7,
    evenly([B.spec, B.lit, B.base, B.mid, B.dark, B.deep]));
  ctx.lineWidth = s * 0.013; ctx.lineCap = "butt";
  ctx.stroke();
  ctx.restore();
  arcPath(ctx, c, c, mater, from, to);
  ctx.strokeStyle = rgba(B.deep, 0.9); ctx.lineWidth = 1; ctx.stroke();
}

function limbTicks(ctx, c, mater, limbInner) {
  for (let d = 0; d < 360; d += 5) {
    const major = d % 30 === 0;
    const a = d * D2R;
    const r1 = major ? limbInner + 2 : mater - 7;
    ctx.beginPath();
    ctx.moveTo(c + Math.cos(a) * r1, c + Math.sin(a) * r1);
    ctx.lineTo(c + Math.cos(a) * (mater - 2), c + Math.sin(a) * (mater - 2));
    ctx.strokeStyle = rgba(B.deep, 0.8); ctx.lineWidth = major ? 1.6 : 0.7; ctx.lineCap = "butt";
    ctx.stroke();
  }
}

function drawRecess(ctx, c, limbInner, plateShiftY, s, k) {
  ctx.save();
  circle(ctx, c, c, limbInner); ctx.clip();
  withBlur(ctx, s * 0.013, k, (x) => {
    x.translate(s * 0.005, plateShiftY + s * 0.007);
    circle(x, c, c, limbInner);
    x.strokeStyle = "rgba(0,0,0,0.5)"; x.lineWidth = s * 0.036; x.stroke();
  });
  withBlur(ctx, s * 0.006, k, (x) => {
    x.translate(-s * 0.004, plateShiftY - s * 0.005);
    circle(x, c, c, limbInner);
    x.strokeStyle = rgba(B.spec, 0.20); x.lineWidth = s * 0.012; x.stroke();
  });
  ctx.restore();
}

function drawPlateRefs(ctx, c, limbInner, equator) {
  const plate = limbInner * 0.97;
  ctx.save();
  circle(ctx, c, c, plate); ctx.clip();
  ctx.lineCap = "butt";
  for (let i = 1; i <= 4; i++) {
    const f = i / 5;
    const r = plate * (0.44 + f * 0.95);
    for (const sign of [-1, 1]) {
      const cx = c + sign * plate * (0.32 + f * 1.05);
      circle(ctx, cx, c - plate * 0.30, r);
      ctx.strokeStyle = rgba(ENGRAVING, 0.14); ctx.lineWidth = 0.45; ctx.stroke();
    }
  }
  for (let i = 1; i <= 7; i++) {
    const f = i / 8;
    const r = plate * (1 - f * 0.60);
    circle(ctx, c, c - plate * f * 0.38, r);
    ctx.strokeStyle = rgba(ENGRAVING, 0.17 + f * 0.12); ctx.lineWidth = 0.5; ctx.stroke();
  }
  for (let i = 0; i < 24; i++) {
    const a = i * 15 * D2R;
    const long = i % 6 === 0;
    const r0 = plate * 0.30, r1 = plate * (long ? 0.99 : 0.90);
    ctx.beginPath();
    ctx.moveTo(c + Math.cos(a) * r0, c + Math.sin(a) * r0);
    ctx.lineTo(c + Math.cos(a) * r1, c + Math.sin(a) * r1);
    ctx.strokeStyle = rgba(ENGRAVING, long ? 0.34 : 0.19); ctx.lineWidth = long ? 0.6 : 0.4; ctx.stroke();
  }
  for (let i = 0; i < 72; i++) {
    const a = i * 5 * D2R;
    const deep = i % 6 === 0;
    const r0 = plate * (deep ? 0.945 : 0.965);
    ctx.beginPath();
    ctx.moveTo(c + Math.cos(a) * r0, c + Math.sin(a) * r0);
    ctx.lineTo(c + Math.cos(a) * plate, c + Math.sin(a) * plate);
    ctx.strokeStyle = rgba(ENGRAVING, deep ? 0.40 : 0.23); ctx.lineWidth = deep ? 0.6 : 0.35; ctx.stroke();
  }
  ctx.restore();
  for (const r of [plate, equator, cancerRadius(equator)]) {
    circle(ctx, c, c, r);
    ctx.strokeStyle = rgba(ENGRAVING, 0.35); ctx.lineWidth = 0.8; ctx.stroke();
  }
}

function drawMater(ctx, c, mater, limbInner, s) {
  materFill(ctx, c, mater);
  drawWear(ctx, c, mater, limbInner, s, 90210);
  limbTicks(ctx, c, mater, limbInner);
  ctx.fillStyle = B.deep;
  ctx.font = `600 ${s * 0.032}px ${SERIF}`;
  ctx.textAlign = "center"; ctx.textBaseline = "middle";
  for (let h = 1; h <= 12; h++) {
    const mid = (180 - (h - 0.5) * 30) * D2R;
    const r = (mater + limbInner) / 2;
    ctx.fillText(ROMAN[h - 1], c + Math.cos(mid) * r, c + Math.sin(mid) * r);
  }
  circle(ctx, c, c, limbInner);
  ctx.strokeStyle = B.deep; ctx.lineWidth = 1.4; ctx.stroke();
  drawLip(ctx, c, mater, s);
}

function drawMaterLip(ctx, c, mater, limbInner, s, k) {
  const depth = s * LIP_DEPTH;
  const inner = limbInner - depth;
  if (inner <= 0) return;
  ctx.save();
  circle(ctx, c, c, inner); ctx.clip();
  withBlur(ctx, s * 0.003, k, (x) => {
    circle(x, c, c, inner);
    x.strokeStyle = "rgba(0,0,0,0.28)"; x.lineWidth = depth * 0.9; x.stroke();
  });
  withBlur(ctx, s * 0.007, k, (x) => {
    x.translate(s * 0.004, s * 0.006);
    circle(x, c, c, inner);
    x.strokeStyle = "rgba(0,0,0,0.45)"; x.lineWidth = depth * 1.9; x.stroke();
  });
  ctx.restore();

  ctx.save();
  ctx.beginPath();
  ctx.arc(c, c, limbInner, 0, Math.PI * 2);
  ctx.arc(c, c, inner, 0, Math.PI * 2, true);
  ctx.clip("evenodd");
  materFill(ctx, c, mater);
  ctx.restore();

  circle(ctx, c, c, inner);
  ctx.strokeStyle = rgba(B.deep, 0.55); ctx.lineWidth = 0.8; ctx.stroke();
  circle(ctx, c, c, inner);
  ctx.strokeStyle = linear(ctx, c - inner * 0.75, c - inner * 0.75, c + inner * 0.55, c + inner * 0.55,
    evenly([rgba(B.spec, 0.85), rgba(B.lit, 0.35), rgba(B.deep, 0)]));
  ctx.lineWidth = 1.1; ctx.stroke();
}

// One zodiac glyph's ink, so it can be centred by what it actually cuts.
const glyphInkCache = new Map();
function glyphInk(i) {
  if (glyphInkCache.has(i)) return glyphInkCache.get(i);
  const c = document.createElement("canvas").getContext("2d");
  c.font = `100px ${SYMBOLS}`;
  const m = c.measureText(SIGN_GLYPHS[i]);
  let ink = { w: 0.75, h: 0.75, mx: 0, my: 0 };
  if (m.actualBoundingBoxRight !== undefined) {
    const w = m.actualBoundingBoxLeft + m.actualBoundingBoxRight;
    const h = m.actualBoundingBoxAscent + m.actualBoundingBoxDescent;
    if (w > 0 && h > 0) {
      ink = {
        w: w / 100, h: h / 100,
        // ink centre relative to the left-aligned alphabetic origin
        mx: (m.actualBoundingBoxRight - m.actualBoundingBoxLeft) / 2 / 100,
        my: (m.actualBoundingBoxDescent - m.actualBoundingBoxAscent) / 2 / 100,
      };
    }
  }
  glyphInkCache.set(i, ink);
  return ink;
}

function drawRete(ctx, c, ring, reteRim, s, shadow) {
  const { cx, cy, r } = ring;
  if (shadow) {
    circle(ctx, c, c, reteRim);
    ctx.strokeStyle = "rgba(0,0,0,0.5)"; ctx.lineWidth = s * RETE_STOCK * 1.09; ctx.stroke();
    circle(ctx, cx, cy, r);
    ctx.lineWidth = s * 0.024; ctx.stroke();
    return;
  }
  const half = s * RETE_STOCK / 2;
  const band = () => {
    ctx.beginPath();
    ctx.arc(c, c, reteRim + half, 0, Math.PI * 2);
    ctx.arc(c, c, reteRim - half, 0, Math.PI * 2, true);
  };
  band();
  ctx.fillStyle = radial(ctx, c, c, reteRim - half, reteRim + half, [
    [0, B.deep], [0.20, B.base], [0.42, B.spec], [0.62, B.lit], [0.86, B.dark], [1, B.deep]]);
  ctx.fill("evenodd");
  ctx.save();
  ctx.globalAlpha = 0.42;
  band();
  ctx.fillStyle = linear(ctx, c - reteRim, c - reteRim, c + reteRim, c + reteRim,
    evenly([B.spec, B.lit, B.mid, B.dark, B.deep]));
  ctx.fill("evenodd");
  ctx.restore();
  for (const edge of [reteRim - half, reteRim + half]) {
    circle(ctx, c, c, edge);
    ctx.strokeStyle = rgba(B.deep, 0.7); ctx.lineWidth = 1; ctx.stroke();
  }

  const ringWidth = s * RETE_STOCK;
  circle(ctx, cx, cy, r);
  ctx.strokeStyle = linear(ctx, cx - r, cy - r, cx + r, cy + r,
    evenly([B.spec, B.deep, B.lit, B.dark, "#E8C87A"]));
  ctx.lineWidth = ringWidth; ctx.stroke();

  let glyphSize = s * 0.032;
  for (let i = 0; i < 12; i++) {
    const ink = glyphInk(i);
    const extent = Math.max(ink.w, ink.h);
    if (extent > 0.0001) glyphSize = Math.min(glyphSize, ringWidth * 0.80 / extent);
  }
  ctx.font = `${glyphSize}px ${SYMBOLS}`;
  ctx.textAlign = "left"; ctx.textBaseline = "alphabetic";
  for (let i = 0; i < 12; i++) {
    const a = i * 30 * D2R;
    ctx.beginPath();
    ctx.moveTo(cx + Math.cos(a) * r * 0.93, cy + Math.sin(a) * r * 0.93);
    ctx.lineTo(cx + Math.cos(a) * r * 1.07, cy + Math.sin(a) * r * 1.07);
    ctx.strokeStyle = rgba(B.deep, 0.8); ctx.lineWidth = 1; ctx.stroke();
    const mid = (i * 30 + 15) * D2R;
    const ink = glyphInk(i);
    const ax = cx + Math.cos(mid) * r, ay = cy + Math.sin(mid) * r;
    ctx.fillStyle = B.deep;
    ctx.fillText(SIGN_GLYPHS[i], ax - ink.mx * glyphSize, ay - ink.my * glyphSize);
  }
}

function bladeProfile(t) {
  const shoulder = 0.74;
  const shank = 1 - 0.52 * Math.pow(Math.min(t / shoulder, 1), 0.8);
  const point = t <= shoulder ? 1 : Math.pow(1 - (t - shoulder) / (1 - shoulder), 1.7);
  const flare = 1 + 0.20 * Math.exp(-t * 18);
  return shank * point * flare;
}

function bladePath(ctx, heel, ux, uy, nx, ny, reach, halfWidth) {
  const steps = 36;
  ctx.beginPath();
  for (let i = 0; i <= steps; i++) {
    const t = i / steps, w = bladeProfile(t) * halfWidth, d = t * reach;
    const x = heel.x + ux * d + nx * w, y = heel.y + uy * d + ny * w;
    if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
  }
  for (let i = steps; i >= 0; i--) {
    const t = i / steps, w = bladeProfile(t) * halfWidth, d = t * reach;
    ctx.lineTo(heel.x + ux * d - nx * w, heel.y + uy * d - ny * w);
  }
  ctx.closePath();
}

function drawStarJoint(ctx, heel, ux, uy, nx, ny, reach, halfWidth, ring, ringWidth, s) {
  const sEdge = ringWidth;
  const free = reach - sEdge;
  if (free <= s * 0.004) return;
  const lift = Math.max(Math.min(halfWidth * 1.35, free * 0.5), s * 0.0015);
  const sTop = sEdge + lift;
  const wTop = bladeProfile(sTop / reach) * halfWidth;
  const wFoot = wTop + lift * 0.95;
  const p = (d, w) => ({ x: heel.x + ux * d + nx * w, y: heel.y + uy * d + ny * w });
  const base = p(sEdge * 0.55, 0);
  const rFoot = Math.hypot(base.x - ring.cx, base.y - ring.cy);
  const aFoot = Math.atan2(base.y - ring.cy, base.x - ring.cx);
  const dPhi = wFoot / Math.max(rFoot, 0.001);
  const onRing = (d) => ({ x: ring.cx + rFoot * Math.cos(aFoot + d), y: ring.cy + rFoot * Math.sin(aFoot + d) });
  const a = p(sTop, wTop), ctl1 = p(sEdge, wTop + lift * 0.3), e1 = onRing(dPhi);
  ctx.beginPath();
  ctx.moveTo(a.x, a.y);
  ctx.quadraticCurveTo(ctl1.x, ctl1.y, e1.x, e1.y);
  for (let i = 1; i <= 12; i++) { const q = onRing(dPhi - 2 * dPhi * (i / 12)); ctx.lineTo(q.x, q.y); }
  const ctl2 = p(sEdge, -wTop - lift * 0.3), e2 = p(sTop, -wTop);
  ctx.quadraticCurveTo(ctl2.x, ctl2.y, e2.x, e2.y);
  ctx.closePath();
  ctx.fillStyle = linear(ctx, a.x, a.y, e2.x, e2.y, evenly([B.lit, B.base, B.mid, B.dark]));
  ctx.fill();
}

function drawStarHead(ctx, tip, r) {
  const sr = r * 1.08;
  circle(ctx, tip.x + r * 0.34, tip.y + r * 0.34, sr);
  ctx.fillStyle = rgba(B.deep, 0.5); ctx.fill();
  ctx.save();
  ctx.globalAlpha = 0.45;
  for (const [deg, reach] of [[0, 3.0], [180, 3.0], [90, 2.2], [270, 2.2]]) {
    const a = deg * D2R, len = r * reach;
    const ex = tip.x + Math.cos(a) * len, ey = tip.y + Math.sin(a) * len;
    ctx.beginPath(); ctx.moveTo(tip.x, tip.y); ctx.lineTo(ex, ey);
    ctx.strokeStyle = linear(ctx, tip.x, tip.y, ex, ey, [[0, B.spec], [1, rgba(B.spec, 0)]]);
    ctx.lineWidth = r * 0.5; ctx.lineCap = "round"; ctx.stroke();
  }
  ctx.restore();
  circle(ctx, tip.x, tip.y, r);
  ctx.fillStyle = radial(ctx, tip.x - r * 0.3, tip.y - r * 0.3, 0, r * 1.6,
    evenly([B.spec, B.lit, B.base, B.dark, B.deep]));
  ctx.fill();
}

function drawStarPointers(ctx, c, ring, equator, s, shadow) {
  for (const [, lon, lat, mag] of STARS) {
    const p = retePoint(lon, lat, equator);
    const a = p.angle * D2R;
    const tip = { x: c + p.radius * Math.cos(a), y: c - p.radius * Math.sin(a) };
    const dx = tip.x - ring.cx, dy = tip.y - ring.cy;
    const len = Math.max(Math.sqrt(dx * dx + dy * dy), 0.001);
    if (!(Math.abs(len - ring.r) > s * 0.018)) continue;
    const pin = { x: ring.cx + dx / len * ring.r, y: ring.cy + dy / len * ring.r };
    const m = Math.max(-1.5, Math.min(1.5, mag));
    const halfWidth = s * (0.0042 - m * 0.0007);
    const ringWidth = s * RETE_STOCK;
    const L = Math.max(Math.hypot(tip.x - pin.x, tip.y - pin.y), 0.001);
    const ux = (tip.x - pin.x) / L, uy = (tip.y - pin.y) / L;
    const heel = { x: pin.x - ux * ringWidth * 0.5, y: pin.y - uy * ringWidth * 0.5 };
    const reach = Math.hypot(tip.x - heel.x, tip.y - heel.y);
    const nx = -uy, ny = ux;
    bladePath(ctx, heel, ux, uy, nx, ny, reach, halfWidth);
    if (shadow) { ctx.fillStyle = "rgba(0,0,0,0.45)"; ctx.fill(); continue; }
    ctx.strokeStyle = rgba(B.deep, 0.5); ctx.lineWidth = s * 0.0026; ctx.lineJoin = "round"; ctx.stroke();
    const mid = { x: heel.x + ux * reach * 0.3, y: heel.y + uy * reach * 0.3 };
    const w = halfWidth * 1.15;
    ctx.fillStyle = linear(ctx, mid.x + nx * w, mid.y + ny * w, mid.x - nx * w, mid.y - ny * w, [
      [0, B.base], [0.13, B.spec], [0.27, B.lit], [0.52, B.mid], [0.78, B.dark], [1, B.deep]]);
    ctx.fill();
    ctx.strokeStyle = rgba(B.deep, 0.45); ctx.lineWidth = 0.5; ctx.lineJoin = "miter"; ctx.stroke();
    drawStarJoint(ctx, heel, ux, uy, nx, ny, reach, halfWidth, ring, ringWidth, s);
    drawStarHead(ctx, tip, s * (0.0050 - m * 0.0006));
  }
}

function ruleProfile(u) {
  const hub = 0.14, shoulder = 0.24;
  if (u <= hub) return 1.0;
  if (u <= shoulder) return 1 - 0.26 * Math.pow((u - hub) / (shoulder - hub), 0.55);
  return 0.74 - 0.30 * Math.pow((u - shoulder) / (1 - shoulder), 1.3);
}

function ruleBarPath(ctx, cx, cy, dx, dy, half, halfWidth, ox = 0, oy = 0) {
  const nx = -dy, ny = dx, steps = 56;
  const pt = (i, side) => {
    const t = -1 + 2 * i / steps;
    const w = ruleProfile(Math.abs(t)) * halfWidth * side;
    const d = t * half;
    return [cx + dx * d + nx * w + ox, cy + dy * d + ny * w + oy];
  };
  ctx.beginPath();
  ctx.moveTo(...pt(0, 1));
  for (let i = 1; i <= steps; i++) ctx.lineTo(...pt(i, 1));
  for (let i = steps; i >= 0; i--) ctx.lineTo(...pt(i, -1));
  ctx.closePath();
}

function fillRuleBody(ctx, cx, cy, nx, ny, hw) {
  ctx.fillStyle = linear(ctx, cx - nx * hw, cy - ny * hw, cx + nx * hw, cy + ny * hw, [
    [0, B.deep], [0.07, B.spec], [0.17, B.dark], [0.30, B.base], [0.43, B.lit],
    [0.58, B.base], [0.71, B.mid], [0.85, B.dark], [0.93, B.spec], [1, B.deep]]);
  ctx.fill();
}

function drawRuleGraduations(ctx, cx, cy, dx, dy, nx, ny, half, hw) {
  const divisions = 30;
  for (let i = 1; i < divisions; i++) {
    if (i === divisions / 2) continue;
    const t = i / divisions * 2 - 1;
    const major = i % 5 === 0;
    const w = ruleProfile(Math.abs(t)) * hw;
    const d = t * half;
    const bx = cx + dx * d, by = cy + dy * d;
    const from = w * (major ? 0.30 : 0.52);
    ctx.beginPath();
    ctx.moveTo(bx + nx * from, by + ny * from);
    ctx.lineTo(bx + nx * w * 0.92, by + ny * w * 0.92);
    ctx.strokeStyle = rgba(B.deep, major ? 0.7 : 0.42); ctx.lineWidth = major ? 0.6 : 0.35; ctx.stroke();
  }
}

function drawRule(ctx, c, limbInner, s, k) {
  const a = 20 * D2R;
  const dx = Math.cos(a), dy = Math.sin(a), nx = -dy, ny = dx;
  const hw = s * 0.0115;
  withBlur(ctx, s * 0.006, k, (x) => {
    ruleBarPath(x, c, c, dx, dy, limbInner, hw, s * 0.007, s * 0.009);
    x.fillStyle = "rgba(0,0,0,0.42)"; x.fill();
  });
  ruleBarPath(ctx, c, c, dx, dy, limbInner, hw);
  ctx.fillStyle = rgba(B.deep, 0.55); ctx.fill();
  fillRuleBody(ctx, c, c, nx, ny, hw);
  ctx.strokeStyle = rgba(B.deep, 0.75); ctx.lineWidth = 0.7; ctx.stroke();
  drawRuleGraduations(ctx, c, c, dx, dy, nx, ny, limbInner, hw);
  ctx.beginPath();
  ctx.moveTo(c - dx * limbInner * 0.97, c - dy * limbInner * 0.97);
  ctx.lineTo(c + dx * limbInner * 0.97, c + dy * limbInner * 0.97);
  ctx.strokeStyle = rgba(B.deep, 0.35); ctx.lineWidth = 0.5; ctx.stroke();
}

function drawHorse(ctx, c, s, k) {
  const seat = c + s * 0.005;
  withBlur(ctx, s * 0.006, k, (x) => {
    circle(x, c + s * 0.006, c + s * 0.008, s * 0.017);
    x.fillStyle = "rgba(0,0,0,0.45)"; x.fill();
  });
  const wr = s * 0.0132;
  circle(ctx, c, c, wr);
  ctx.fillStyle = radial(ctx, c - wr * 0.35, c - wr * 0.35, 0, wr * 1.7, evenly([B.lit, B.base, B.mid, B.dark, B.deep]));
  ctx.fill();
  ctx.strokeStyle = rgba(B.deep, 0.7); ctx.lineWidth = 0.6; ctx.stroke();

  const hl = s * 0.032, ht = s * 0.0072, cant = Math.PI * 0.05;
  const rot = (x, y) => [c + x * Math.cos(cant) - y * Math.sin(cant), seat + x * Math.sin(cant) + y * Math.cos(cant)];
  const wedge = () => {
    ctx.beginPath();
    ctx.moveTo(...rot(-hl, 0));
    ctx.quadraticCurveTo(...rot(-hl * 0.4, -ht), ...rot(0, -ht));
    ctx.quadraticCurveTo(...rot(hl * 0.4, -ht), ...rot(hl, 0));
    ctx.quadraticCurveTo(...rot(hl * 0.4, ht), ...rot(0, ht));
    ctx.quadraticCurveTo(...rot(-hl * 0.4, ht), ...rot(-hl, 0));
    ctx.closePath();
  };
  wedge();
  ctx.fillStyle = rgba(B.deep, 0.6); ctx.fill();
  const [x0, y0] = rot(0, -ht), [x1, y1] = rot(0, ht);
  ctx.fillStyle = linear(ctx, x0, y0, x1, y1, [
    [0, B.deep], [0.15, B.dark], [0.32, B.base], [0.45, B.spec], [0.55, B.lit], [0.70, B.mid], [0.86, B.dark], [1, B.deep]]);
  ctx.fill();
  ctx.strokeStyle = rgba(B.deep, 0.85); ctx.lineWidth = 0.6; ctx.stroke();

  const pr = s * 0.0068;
  circle(ctx, c, seat, pr);
  ctx.fillStyle = radial(ctx, c - pr * 0.35, seat - pr * 1.35, 0, pr * 1.7, evenly([B.spec, B.lit, B.base, B.dark, B.deep]));
  ctx.fill();
  ctx.strokeStyle = rgba(B.deep, 0.7); ctx.lineWidth = 0.4; ctx.stroke();
}

function frontGeometry(s) {
  const c = s / 2, mater = s * 0.42, limbInner = mater * 0.84, equator = limbInner * 0.60;
  const reteRim = limbInner * RETE_REACH - s * RETE_STOCK / 2;
  const e = ecliptic(equator);
  return { c, mater, limbInner, equator, reteRim, ring: { cx: c, cy: c - e.offset, r: e.radius } };
}

/** One layer of the front, into a canvas `s` points square at `k` px per point. */
function bakeFront(layer, s, k) {
  const [cv, ctx] = makeCanvas(s, s, k);
  const g = frontGeometry(s);
  const { c, mater, limbInner, equator, reteRim, ring } = g;
  const plateShiftY = s * 0.020 * ELEVATION;
  ctx.lineCap = "butt";
  if (layer === "mater") {
    drawMater(ctx, c, mater, limbInner, s);
    ctx.save(); ctx.translate(0, plateShiftY);
    drawPlateRefs(ctx, c, limbInner, equator);
    ctx.restore();
    drawRecess(ctx, c, limbInner, plateShiftY, s, k);
  } else if (layer === "reteShadow") {
    withBlur(ctx, s * 0.008, k, (x) => {
      drawStarPointers(x, c, ring, equator, s, true);
      drawRete(x, c, ring, reteRim, s, true);
    });
  } else if (layer === "rete") {
    ctx.translate(0, -s * 0.003 * ELEVATION);
    drawStarPointers(ctx, c, ring, equator, s, false);
    drawRete(ctx, c, ring, reteRim, s, false);
  } else if (layer === "materLip") {
    ctx.translate(0, -s * 0.006 * ELEVATION);
    drawMaterLip(ctx, c, mater, limbInner, s, k);
  } else if (layer === "rule") {
    ctx.translate(0, -s * 0.011 * ELEVATION);
    drawRule(ctx, c, limbInner, s, k);
  } else if (layer === "horse") {
    ctx.translate(0, -s * 0.017 * ELEVATION);
    drawHorse(ctx, c, s, k);
  }
  return cv;
}

// --- the back

function drawRose(ctx, c, r) {
  ctx.beginPath();
  for (let i = 0; i < 16; i++) {
    const a = i * Math.PI / 8 - Math.PI / 2;
    const rad = i % 2 === 0 ? r : r * 0.42;
    const x = c + Math.cos(a) * rad, y = c + Math.sin(a) * rad;
    if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
  }
  ctx.closePath();
  ctx.fillStyle = rgba(B.deep, 0.16); ctx.fill();
  ctx.strokeStyle = rgba(B.deep, 0.55); ctx.lineWidth = 0.7; ctx.stroke();
  circle(ctx, c, c, r * 0.42);
  ctx.strokeStyle = rgba(B.deep, 0.5); ctx.lineWidth = 0.6; ctx.stroke();
}

const VANE_SEAT = 0.60, VANE_REACH = 1.82, VANE_TIP = 0.32;
function vaneOutline(px, py, dx, dy, barWidth, top) {
  const ux = dx, uy = dy, vx = -dy, vy = dx;
  const bu = barWidth * VANE_SEAT, bv = barWidth * VANE_REACH;
  const lift = top ? { x: -barWidth * 0.26, y: -barWidth * 0.38 } : { x: 0, y: 0 };
  const ku = top ? 0.46 : 1, kv = top ? 0.88 : 1;
  const samples = 9, pts = [];
  const add = (i, side) => {
    const f = i / (samples - 1);
    const b = -1 + 2 * f;
    const a = (1 - (1 - VANE_TIP) * Math.pow(Math.abs(b), 1.7)) * side;
    pts.push({
      x: px + ux * a * bu * ku + vx * b * bv * kv + lift.x,
      y: py + uy * a * bu * ku + vy * b * bv * kv + lift.y,
    });
  };
  for (let i = 0; i < samples; i++) add(i, 1);
  for (let i = samples - 1; i >= 0; i--) add(i, -1);
  return pts;
}
function polyPath(ctx, pts, ox = 0, oy = 0) {
  ctx.beginPath();
  pts.forEach((p, i) => (i === 0 ? ctx.moveTo(p.x + ox, p.y + oy) : ctx.lineTo(p.x + ox, p.y + oy)));
  ctx.closePath();
}

function drawBore(ctx, cx, cy, r) {
  ctx.save();
  circle(ctx, cx, cy, r); ctx.clip();
  circle(ctx, cx, cy, r); ctx.fillStyle = rgba(B.base, 0.95); ctx.fill();
  circle(ctx, cx - r * 0.34, cy - r * 0.30, r); ctx.fillStyle = B.deep; ctx.fill();
  ctx.restore();
  arcPath(ctx, cx, cy, r, Math.PI * 0.92, Math.PI * 1.98);
  ctx.strokeStyle = rgba(B.deep, 0.9); ctx.lineWidth = 0.8; ctx.stroke();
  arcPath(ctx, cx, cy, r, -Math.PI * 0.08, Math.PI * 0.92);
  ctx.strokeStyle = rgba(B.spec, 0.45); ctx.lineWidth = 0.6; ctx.stroke();
}

function drawVane(ctx, px, py, dx, dy, barWidth, k) {
  const lx = -0.55, ly = -0.835;
  const base = vaneOutline(px, py, dx, dy, barWidth, false);
  const cap = vaneOutline(px, py, dx, dy, barWidth, true);
  const apex = { x: px - barWidth * 0.26, y: py - barWidth * 0.38 };
  withBlur(ctx, barWidth * 0.20, k, (x) => {
    polyPath(x, base, barWidth * 0.26, barWidth * 0.36);
    x.fillStyle = "rgba(0,0,0,0.55)"; x.fill();
  });
  polyPath(ctx, base);
  ctx.fillStyle = B.dark; ctx.fill();
  const facing = (a, b) => {
    let nx = -(b.y - a.y), ny = b.x - a.x;
    const len = Math.max(Math.hypot(nx, ny), 0.001);
    nx /= len; ny /= len;
    const mx = (a.x + b.x) / 2 - px, my = (a.y + b.y) / 2 - py;
    if (nx * mx + ny * my < 0) { nx = -nx; ny = -ny; }
    return nx * lx + ny * ly;
  };
  for (let i = 0; i < base.length; i++) {
    const j = (i + 1) % base.length;
    const quad = [base[i], base[j], cap[j], cap[i]];
    const lit = facing(base[i], base[j]);
    const foot = { x: (base[i].x + base[j].x) / 2, y: (base[i].y + base[j].y) / 2 };
    const crest = { x: (cap[i].x + cap[j].x) / 2, y: (cap[i].y + cap[j].y) / 2 };
    polyPath(ctx, quad);
    ctx.fillStyle = linear(ctx, crest.x, crest.y, foot.x, foot.y, [[0, B.mid], [1, B.dark]]);
    ctx.fill();
    const t = Math.max(-1, Math.min(1, lit));
    ctx.fillStyle = t > 0 ? rgba(B.spec, t * 0.78) : rgba(B.deep, -t * 0.85);
    ctx.fill();
  }
  polyPath(ctx, cap);
  ctx.fillStyle = linear(ctx, apex.x + lx * barWidth, apex.y + ly * barWidth, apex.x - lx * barWidth, apex.y - ly * barWidth,
    evenly([B.spec, B.lit, B.base, B.mid]));
  ctx.fill();
  ctx.strokeStyle = linear(ctx, apex.x + lx * barWidth * 2, apex.y + ly * barWidth * 2,
    apex.x - lx * barWidth * 2, apex.y - ly * barWidth * 2, evenly([B.spec, B.lit, B.mid, B.deep]));
  ctx.lineWidth = 0.7; ctx.stroke();
  for (const i of [0, base.length / 2]) {
    ctx.beginPath(); ctx.moveTo(cap[i].x, cap[i].y); ctx.lineTo(base[i].x, base[i].y);
    ctx.strokeStyle = rgba(B.deep, 0.45); ctx.lineWidth = 0.5; ctx.stroke();
  }
  polyPath(ctx, base);
  ctx.strokeStyle = rgba(B.deep, 0.85); ctx.lineWidth = 0.6; ctx.stroke();
  drawBore(ctx, apex.x, apex.y, barWidth * 0.19);
}

function drawAlidade(ctx, c, length, angleDeg, shadow, k) {
  const a = angleDeg * D2R;
  const dx = Math.cos(a), dy = Math.sin(a), nx = -dy, ny = dx;
  const half = length / 2, barWidth = length * 0.045, hw = barWidth * 0.60;
  const p1 = { x: c - dx * half, y: c - dy * half }, p2 = { x: c + dx * half, y: c + dy * half };
  if (shadow) {
    ruleBarPath(ctx, c, c, dx, dy, half, hw);
    ctx.fillStyle = "rgba(0,0,0,0.5)"; ctx.fill();
    for (const e of [p1, p2]) { polyPath(ctx, vaneOutline(e.x, e.y, dx, dy, barWidth, false)); ctx.fill(); }
    return;
  }
  ruleBarPath(ctx, c, c, dx, dy, half, hw);
  ctx.fillStyle = rgba(B.deep, 0.5); ctx.fill();
  fillRuleBody(ctx, c, c, nx, ny, hw);
  ctx.strokeStyle = rgba(B.deep, 0.7); ctx.lineWidth = 0.7; ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(p1.x - nx * hw * 0.34, p1.y - ny * hw * 0.34);
  ctx.lineTo(p2.x - nx * hw * 0.34, p2.y - ny * hw * 0.34);
  ctx.strokeStyle = rgba(B.spec, 0.45); ctx.lineWidth = hw * 0.22; ctx.lineCap = "round"; ctx.stroke();
  ctx.lineCap = "butt";
  drawRuleGraduations(ctx, c, c, dx, dy, nx, ny, half, hw);
  for (const e of [p1, p2]) drawVane(ctx, e.x, e.y, dx, dy, barWidth, k);
  const pivotR = barWidth * 1.35;
  circle(ctx, c, c, pivotR);
  ctx.fillStyle = radial(ctx, c - pivotR * 0.3, c - pivotR * 0.3, 0, pivotR * 1.6, evenly([B.spec, B.lit, B.base, B.dark, B.deep]));
  ctx.fill();
  ctx.strokeStyle = rgba(B.deep, 0.55); ctx.lineWidth = 0.6; ctx.stroke();
}

function bakeBack(layer, s, k) {
  const [cv, ctx] = makeCanvas(s, s, k);
  const c = s / 2, mater = s * 0.42, limbInner = mater * 0.84, plate = limbInner * 0.97;
  const plateShiftY = s * 0.020 * ELEVATION;
  ctx.lineCap = "butt";
  if (layer === "plate") {
    materFill(ctx, c, mater);
    drawWear(ctx, c, mater, limbInner, s, 90211);
    limbTicks(ctx, c, mater, limbInner);
    circle(ctx, c, c, limbInner);
    ctx.strokeStyle = B.deep; ctx.lineWidth = 1.4; ctx.stroke();
    drawLip(ctx, c, mater, s);

    ctx.save();
    ctx.translate(0, plateShiftY);
    const calR = limbInner - (mater - limbInner) * 0.3;
    for (let day = 0; day < 365; day++) {
      const deep = day % 10 === 0;
      const a = day / 365 * 2 * Math.PI;
      const r1 = calR - (deep ? 3.5 : 1.8);
      ctx.beginPath();
      ctx.moveTo(c + Math.cos(a) * r1, c + Math.sin(a) * r1);
      ctx.lineTo(c + Math.cos(a) * calR, c + Math.sin(a) * calR);
      ctx.strokeStyle = rgba(B.deep, deep ? 0.7 : 0.4); ctx.lineWidth = deep ? 0.9 : 0.4; ctx.stroke();
    }
    circle(ctx, c, c, plate); ctx.strokeStyle = rgba(B.deep, 0.5); ctx.lineWidth = 0.9; ctx.stroke();
    circle(ctx, c, c, plate * 0.7); ctx.strokeStyle = rgba(B.deep, 0.35); ctx.lineWidth = 0.6; ctx.stroke();
    for (let i = 0; i < 72; i++) {
      const a = i * 5 * D2R;
      const deep = i % 6 === 0;
      const r0 = plate * (deep ? 0.925 : 0.950);
      ctx.beginPath();
      ctx.moveTo(c + Math.cos(a) * r0, c + Math.sin(a) * r0);
      ctx.lineTo(c + Math.cos(a) * plate * 0.98, c + Math.sin(a) * plate * 0.98);
      ctx.strokeStyle = rgba(B.deep, deep ? 0.5 : 0.28); ctx.lineWidth = deep ? 0.6 : 0.35; ctx.stroke();
    }
    for (const f of [0.42, 0.68]) {
      circle(ctx, c, c, plate * f); ctx.strokeStyle = rgba(B.deep, 0.3); ctx.lineWidth = 0.5; ctx.stroke();
    }
    for (let i = 0; i < 48; i++) {
      const a = i / 48 * 2 * Math.PI;
      const long = i % 4 === 0;
      const r0 = plate * 0.42, r1 = plate * (long ? 0.68 : 0.6);
      ctx.beginPath();
      ctx.moveTo(c + Math.cos(a) * r0, c + Math.sin(a) * r0);
      ctx.lineTo(c + Math.cos(a) * r1, c + Math.sin(a) * r1);
      ctx.strokeStyle = rgba(B.deep, long ? 0.5 : 0.3); ctx.lineWidth = long ? 0.6 : 0.35; ctx.stroke();
    }
    ctx.font = `${s * 0.032}px ${SYMBOLS}`;
    ctx.textAlign = "center"; ctx.textBaseline = "middle";
    ctx.fillStyle = rgba(B.deep, 0.75);
    for (let i = 0; i < 12; i++) {
      const mid = (i * 30 + 15) * D2R, r = plate * 0.84;
      ctx.fillText(SIGN_GLYPHS[i], c + Math.cos(mid) * r, c + Math.sin(mid) * r);
    }
    drawRose(ctx, c, plate * 0.3);
    ctx.restore();
    drawRecess(ctx, c, limbInner, plateShiftY, s, k);
  } else if (layer === "alidadeShadow") {
    withBlur(ctx, s * 0.007, k, (x) => drawAlidade(x, c, mater * 1.66, 24, true, k));
  } else if (layer === "alidade") {
    ctx.translate(0, -s * 0.014 * ELEVATION);
    drawAlidade(ctx, c, mater * 1.66, 24, false, k);
  }
  return cv;
}

// ===========================================================================
// The scene — `AstrolabeScene`, by hand.

const FRAME = 272, OVERHANG = 44;
const VIEW_H = 1 + OVERHANG / FRAME;              // view height, in disc frames
const COS = Math.cos(20 * D2R), SIN = Math.sin(20 * D2R);
const TARGET_Y = OVERHANG / FRAME / 2;
const VIEW_TOP = COS * TARGET_Y + VIEW_H / 2;     // screen-up of the view's top edge
const DISC_R = 0.42, THICK = 0.11, FACE_Z = THICK / 2, SKIN = 0.0006;
const VIEW_DIR = [0, SIN, -COS];                  // camera's forward
const TO_CAM = [0, -SIN, COS];
const KEY = norm([-0.407, 0.400, 0.821]);         // toward the key light
const FILL = norm([0.559, -0.511, 0.653]);        // toward the fill

function norm(v) { const l = Math.hypot(v[0], v[1], v[2]) || 1; return [v[0] / l, v[1] / l, v[2] / l]; }
const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];

// `AstrolabeScene.Room`: the banded room the metal reflects, as a small
// equirectangular table, softened once for the finish's roughness.
const ROOM_W = 128, ROOM_H = 64;
const room = (() => {
  const t = new Float32Array(ROOM_W * ROOM_H);
  const bands = [[0, 0.28, 0.95], [0.28, 0.34, 0.72], [0.34, 0.46, 0.55], [0.46, 0.50, 0.30],
    [0.50, 0.62, 0.20], [0.62, 0.78, 0.11], [0.78, 1.0, 0.05]];
  for (let y = 0; y < ROOM_H; y++) {
    const v = (y + 0.5) / ROOM_H;
    for (let x = 0; x < ROOM_W; x++) {
      const u = (x + 0.5) / ROOM_W;
      let tone = 0.05;
      for (const [a, b, tn] of bands) if (v >= a && v < b) tone = tn;
      for (const cx of [0.18, 0.68]) {
        if (Math.abs(u - cx) <= 0.045 && v >= 0.10 && v <= 0.40) tone = 1.0;
        else if (Math.abs(u - cx) <= 0.09 && v > 0.40 && v <= 0.48) tone = 0.62;
      }
      t[y * ROOM_W + x] = tone;
    }
  }
  // roughness: a Gaussian over a few texels, wrapping round the room
  const blur = (src, horizontal, sigma) => {
    const out = new Float32Array(src.length);
    const rad = Math.ceil(sigma * 2.5);
    const ker = [];
    let sum = 0;
    for (let i = -rad; i <= rad; i++) { const w = Math.exp(-(i * i) / (2 * sigma * sigma)); ker.push(w); sum += w; }
    for (let y = 0; y < ROOM_H; y++) for (let x = 0; x < ROOM_W; x++) {
      let acc = 0;
      for (let i = -rad; i <= rad; i++) {
        const xx = horizontal ? (x + i + ROOM_W) % ROOM_W : x;
        const yy = horizontal ? y : Math.min(ROOM_H - 1, Math.max(0, y + i));
        acc += src[yy * ROOM_W + xx] * ker[i + rad];
      }
      out[y * ROOM_W + x] = acc / sum;
    }
    return out;
  };
  return blur(blur(t, true, 3.2), false, 2.2);
})();

function roomTone(d) {
  // SceneKit's environment maps its image with the top row overhead.
  const v = Math.acos(Math.max(-1, Math.min(1, d[1]))) / Math.PI;
  const u = (Math.atan2(d[0], -d[2]) / (2 * Math.PI) + 0.5 + 1) % 1;
  const fx = u * ROOM_W - 0.5, fy = Math.min(ROOM_H - 1, Math.max(0, v * ROOM_H - 0.5));
  const x0 = Math.floor(fx), y0 = Math.floor(fy), tx = fx - x0, ty = fy - y0;
  const at = (x, y) => room[Math.min(ROOM_H - 1, y) * ROOM_W + ((x % ROOM_W) + ROOM_W) % ROOM_W];
  return (at(x0, y0) * (1 - tx) + at(x0 + 1, y0) * tx) * (1 - ty) +
    (at(x0, y0 + 1) * (1 - tx) + at(x0 + 1, y0 + 1) * tx) * ty;
}

const BASE_RGB = rgb(B.base), SPEC_RGB = rgb(B.spec);
/** The polished edge material: metal at 0.92, roughness 0.24, base albedo. */
function shadeMetal(n) {
  const vn = dot(VIEW_DIR, n);
  const r = [VIEW_DIR[0] - 2 * vn * n[0], VIEW_DIR[1] - 2 * vn * n[1], VIEW_DIR[2] - 2 * vn * n[2]];
  const env = roomTone(r) * 1.55;
  const key = Math.pow(Math.max(0, dot(r, KEY)), 48) * 0.9;
  const diffuse = 0.08 * (0.32 + 0.64 * Math.max(0, dot(n, KEY)) + 0.13 * Math.max(0, dot(n, FILL)));
  const out = [0, 0, 0];
  for (let i = 0; i < 3; i++) {
    const v = BASE_RGB[i] * (env * 0.92 + diffuse) + SPEC_RGB[i] * key;
    out[i] = Math.max(0, Math.min(255, Math.round(v)));
  }
  return `rgb(${out[0]},${out[1]},${out[2]})`;
}

// --- the throne, turned (`AstrolabeScene.Bracket`, `Profile`, `throneNode`)

function throneProfile() {
  const b = {
    spigotBottom: 0.384, footTop: 0.410, plinthBottom: 0.430, footWaist: 0.0520,
    plinthFloor: 0.438, plinthWaist: 0.0470, plinthR: 0.0510, plinthTop: 0.4525,
    shoulderR: 0.0440, shoulderTop: 0.468, shoulderTopR: 0.0395, cymaFootR: 0.0350,
    neckBottom: 0.503, neckR: 0.0140, beadBottom: 0.510, beadTop: 0.519, headY: 0.536, headR: 0.027,
  };
  const stock = THICK / 2;
  const pts = [{ y: b.spigotBottom, r: 0 }];
  const hard = new Set();
  const top = () => pts[pts.length - 1].y, radius = () => pts[pts.length - 1].r;
  const fillet = (r) => { hard.add(pts.length - 1); pts.push({ y: top(), r }); hard.add(pts.length - 1); };
  const band = (y) => { hard.add(pts.length - 1); pts.push({ y, r: radius() }); hard.add(pts.length - 1); };
  const taper = (y, r) => { hard.add(pts.length - 1); pts.push({ y, r }); hard.add(pts.length - 1); };
  const sweep = (y, r, bulge, steps = 14) => {
    const y0 = top(), r0 = radius();
    const dy = y - y0, dr = r - r0, len = Math.max(Math.hypot(dy, dr), 1e-6);
    const cx = (r0 + r) / 2 + bulge * (dy / len), cy = (y0 + y) / 2 - bulge * (dr / len);
    for (let i = 1; i <= steps; i++) {
      const t = i / steps, u = 1 - t;
      pts.push({ y: u * u * y0 + 2 * u * t * cy + t * t * y, r: u * u * r0 + 2 * u * t * cx + t * t * r });
    }
  };
  const bead = (y, proud, steps = 16) => {
    const y0 = top(), r0 = radius(), mid = (y0 + y) / 2, half = (y - y0) / 2;
    hard.add(pts.length - 1);
    for (let i = 1; i <= steps; i++) {
      const a = -Math.PI / 2 + Math.PI * i / steps;
      pts.push({ y: mid + half * Math.sin(a), r: r0 + proud * Math.cos(a) });
    }
    hard.add(pts.length - 1);
  };
  const groove = (y, h, d) => { const r0 = radius(); band(y - h); taper(y, r0 - d); taper(y + h, r0); };
  const ball = (centre, rad, steps = 22) => {
    const a0 = Math.asin(Math.max(-1, Math.min(1, (top() - centre) / rad)));
    hard.add(pts.length - 1);
    for (let i = 1; i <= steps; i++) {
      const a = a0 + (Math.PI / 2 - a0) * i / steps;
      pts.push({ y: centre + rad * Math.sin(a), r: rad * Math.cos(a) });
    }
  };
  fillet(stock);
  band(b.footTop);
  sweep(b.plinthBottom, b.footWaist, 0.0035);
  sweep(b.plinthFloor, b.plinthWaist, -0.0022);
  fillet(b.plinthR);
  groove(b.plinthFloor + 0.0042, 0.0022, 0.0040);
  groove(b.plinthFloor + 0.0104, 0.0022, 0.0040);
  band(b.plinthTop);
  fillet(b.shoulderR);
  sweep(b.shoulderTop, b.shoulderTopR, 0.0018);
  fillet(b.cymaFootR);
  sweep(b.neckBottom, b.neckR, -0.0125, 22);
  band(b.beadBottom);
  bead(b.beadTop, 0.0052);
  fillet(Math.sqrt(Math.max(b.headR * b.headR - Math.pow(b.headY - top(), 2), 0)));
  ball(b.headY, b.headR);
  return { pts, hard };
}

/** A lathe's quads, in the disc's own frame, each with its own normal. */
function latheQuads(profile, segments, keep) {
  const { pts, hard } = profile;
  const segN = (i) => {
    const dy = pts[i + 1].y - pts[i].y, dr = pts[i + 1].r - pts[i].r;
    const len = Math.max(Math.hypot(dy, dr), 1e-9);
    return { r: dy / len, y: -dr / len };
  };
  const merge = (a, b) => { const r = a.r + b.r, y = a.y + b.y, l = Math.max(Math.hypot(r, y), 1e-9); return { r: r / l, y: y / l }; };
  const quads = [];
  for (let i = 0; i < pts.length - 1; i++) {
    if (!keep(pts[i], pts[i + 1])) continue;
    if (pts[i].y === pts[i + 1].y && pts[i].r === pts[i + 1].r) continue;
    const own = segN(i);
    const below = i > 0 && !hard.has(i) ? merge(own, segN(i - 1)) : own;
    const above = i + 2 < pts.length && !hard.has(i + 1) ? merge(own, segN(i + 1)) : own;
    const nn = merge(below, above);
    for (let j = 0; j < segments; j++) {
      const a0 = 2 * Math.PI * j / segments, a1 = 2 * Math.PI * (j + 1) / segments, am = (a0 + a1) / 2;
      const P = (p, a) => [p.r * Math.cos(a), p.y, p.r * Math.sin(a)];
      quads.push({
        p: [P(pts[i], a0), P(pts[i], a1), P(pts[i + 1], a1), P(pts[i + 1], a0)],
        n: [nn.r * Math.cos(am), nn.y, nn.r * Math.sin(am)],
      });
    }
  }
  return quads;
}

/** A torus's quads. `plane` "xy" lies in the disc (the ring); "yz" across it (the shackle). */
function torusQuads(cy, major, minor, ringSeg, pipeSeg, plane) {
  const at = (phi, psi) => {
    const rr = major + minor * Math.cos(psi);
    if (plane === "xy") {
      return {
        p: [Math.cos(phi) * rr, cy + Math.sin(phi) * rr, minor * Math.sin(psi)],
        n: [Math.cos(phi) * Math.cos(psi), Math.sin(phi) * Math.cos(psi), Math.sin(psi)],
      };
    }
    return {
      p: [minor * Math.sin(psi), cy + Math.sin(phi) * rr, Math.cos(phi) * rr],
      n: [Math.sin(psi), Math.sin(phi) * Math.cos(psi), Math.cos(phi) * Math.cos(psi)],
    };
  };
  const quads = [];
  for (let i = 0; i < ringSeg; i++) for (let j = 0; j < pipeSeg; j++) {
    const f0 = 2 * Math.PI * i / ringSeg, f1 = 2 * Math.PI * (i + 1) / ringSeg;
    const s0 = 2 * Math.PI * j / pipeSeg, s1 = 2 * Math.PI * (j + 1) / pipeSeg;
    quads.push({
      p: [at(f0, s0).p, at(f1, s0).p, at(f1, s1).p, at(f0, s1).p],
      n: at((f0 + f1) / 2, (s0 + s1) / 2).n,
    });
  }
  return quads;
}

const spinV = (v, cA, sA) => [v[0] * cA + v[2] * sA, v[1], -v[0] * sA + v[2] * cA];

/** Easing: SwiftUI's `.easeOut` and SceneKit's `.easeInEaseOut`, as cubic Béziers. */
function bezier(x1, y1, x2, y2) {
  const cx = 3 * x1, bx = 3 * (x2 - x1) - cx, ax = 1 - cx - bx;
  const cy = 3 * y1, by = 3 * (y2 - y1) - cy, ay = 1 - cy - by;
  const X = (t) => ((ax * t + bx) * t + cx) * t, Y = (t) => ((ay * t + by) * t + cy) * t;
  const dX = (t) => (3 * ax * t + 2 * bx) * t + cx;
  return (x) => {
    if (x <= 0) return 0;
    if (x >= 1) return 1;
    let t = x;
    for (let i = 0; i < 8; i++) { const d = dX(t); if (Math.abs(d) < 1e-6) break; t -= (X(t) - x) / d; }
    t = Math.max(0, Math.min(1, t));
    return Y(t);
  };
}
const easeOut = bezier(0, 0, 0.58, 1);
const easeInOut = bezier(0.42, 0, 0.58, 1);

/** `AstrolabeScene.Idle`: four degrees a second on the rete, the alidade's slow sighting sweep. */
function alidadeSweep(t) {
  const over = 7, hold = 1.4, travel = 30;
  let x = t % (2 * (over + hold));
  if (x < over) return -15 + travel * easeInOut(x / over);
  x -= over;
  if (x < hold) return 15;
  x -= hold;
  if (x < over) return 15 - travel * easeInOut(x / over);
  return -15;
}

class Instrument {
  constructor(host) {
    this.host = host;
    this.canvas = host.querySelector("canvas");
    this.shadow = host.querySelector(".instrument-shadow");
    this.ctx = this.canvas.getContext("2d");
    this.angle = 0;
    this.idleT = 0;
    this.idlePaused = false;
    this.resumeTimer = null;
    this.tween = null;
    this.drag = null;
    this.visible = true;
    this.raf = 0;
    this.last = 0;
    this.side = 0;
    this.fitAngle = null;

    this.bindInput();
  }

  setSide(side) {
    const dpr = Math.min(window.devicePixelRatio || 1, 3);
    if (side === this.side && dpr === this.dpr) return;
    this.side = side; this.dpr = dpr;
    const W = Math.round(side * dpr), H = Math.round(side * VIEW_H * dpr);
    this.canvas.width = W; this.canvas.height = H;
    this.unit = side * dpr;
    const k = Math.max(2, Math.min(3, dpr));
    this.layers = {
      mater: bakeFront("mater", side, k), reteShadow: bakeFront("reteShadow", side, k),
      rete: bakeFront("rete", side, k), materLip: bakeFront("materLip", side, k),
      rule: bakeFront("rule", side, k), horse: bakeFront("horse", side, k),
      plate: bakeBack("plate", side, k), alidadeShadow: bakeBack("alidadeShadow", side, k),
      alidade: bakeBack("alidade", side, k),
    };
    this.faceBuf = document.createElement("canvas");
    this.faceBuf.width = W; this.faceBuf.height = H;
    this.fitBuf = document.createElement("canvas");
    this.fitBuf.width = W; this.fitBuf.height = H;
    this.fitAngle = null;

    // The throne below its bead never meets the ring or the shackle, and a
    // body of revolution turned about its own axis under a fixed light looks
    // the same at every angle — so it is struck once.
    const profile = throneProfile();
    const inDisc = (p) => p.y < DISC_R - 0.006;
    const lower = latheQuads(profile, 64, (a, b) => Math.max(a.y, b.y) <= 0.510 && !(inDisc(a) && inDisc(b)));
    this.throneTop = latheQuads(profile, 40, (a, b) => Math.max(a.y, b.y) > 0.510);
    this.ringQuads = torusQuads(0.590, 0.037 - 0.0102 / 2, 0.0102 / 2, 64, 12, "xy");
    this.shackleQuads = torusQuads(0.549, 0.026 - 0.0078 / 2, 0.0078 / 2, 48, 10, "yz");
    this.throneBuf = document.createElement("canvas");
    this.throneBuf.width = W; this.throneBuf.height = H;
    this.paintQuads(this.throneBuf.getContext("2d"), lower, 1, 0, true);
    this.draw();
  }

  // world point -> device pixels
  px(p) {
    return [this.canvas.width / 2 + p[0] * this.unit, (VIEW_TOP - (COS * p[1] + SIN * p[2])) * this.unit];
  }

  paintQuads(ctx, quads, cA, sA, clear) {
    if (clear) ctx.clearRect(0, 0, ctx.canvas.width, ctx.canvas.height);
    const vis = [];
    for (const q of quads) {
      const n = spinV(q.n, cA, sA);
      if (dot(n, TO_CAM) <= 0) continue;
      const w = q.p.map((p) => spinV(p, cA, sA));
      const depth = w.reduce((d, p) => d + dot(p, TO_CAM), 0);
      vis.push({ w, n, depth });
    }
    vis.sort((a, b) => a.depth - b.depth);
    ctx.lineJoin = "round";
    ctx.lineWidth = 0.6;
    for (const q of vis) {
      const s = q.w.map((p) => this.px(p));
      ctx.beginPath();
      ctx.moveTo(s[0][0], s[0][1]);
      for (let i = 1; i < 4; i++) ctx.lineTo(s[i][0], s[i][1]);
      ctx.closePath();
      const col = shadeMetal(q.n);
      ctx.fillStyle = col; ctx.strokeStyle = col;
      ctx.fill(); ctx.stroke();
    }
  }

  drawSide(ctx, cA, sA) {
    const N = 128;
    ctx.lineJoin = "round";
    ctx.lineWidth = 0.6;
    for (let i = 0; i < N; i++) {
      const f0 = 2 * Math.PI * i / N, f1 = 2 * Math.PI * (i + 1) / N, fm = (f0 + f1) / 2;
      const n = spinV([Math.cos(fm), Math.sin(fm), 0], cA, sA);
      if (dot(n, TO_CAM) <= 0) continue;
      const corner = (f, z) => this.px(spinV([DISC_R * Math.cos(f), DISC_R * Math.sin(f), z], cA, sA));
      const q = [corner(f0, FACE_Z), corner(f1, FACE_Z), corner(f1, -FACE_Z), corner(f0, -FACE_Z)];
      ctx.beginPath();
      ctx.moveTo(q[0][0], q[0][1]);
      for (let j = 1; j < 4; j++) ctx.lineTo(q[j][0], q[j][1]);
      ctx.closePath();
      const col = shadeMetal(n);
      ctx.fillStyle = col; ctx.strokeStyle = col;
      ctx.fill(); ctx.stroke();
    }
  }

  /** The affine that lands a face layer at height `z` (signed) on screen. */
  faceTransform(front, z, cA, sA) {
    const d = this.dpr, s = this.side, sg = front ? 1 : -1, W = this.canvas.width, u = this.unit;
    return [
      sg * d * cA, SIN * sg * d * sA, 0, COS * d,
      W / 2 - sg * d * cA * s / 2 + u * z * sA,
      u * VIEW_TOP - COS * d * s / 2 - SIN * sg * d * sA * s / 2 - u * SIN * z * cA,
    ];
  }

  drawLayer(ctx, img, front, z, cA, sA, turn = 0, thrown = null) {
    const m = this.faceTransform(front, z, cA, sA);
    const s = this.side;
    ctx.setTransform(m[0], m[1], m[2], m[3], m[4], m[5]);
    if (thrown) ctx.translate(thrown[0] * s, thrown[1] * s);
    if (turn) { ctx.translate(s / 2, s / 2); ctx.rotate(turn * D2R); ctx.translate(-s / 2, -s / 2); }
    ctx.drawImage(img, 0, 0, s, s);
  }

  draw() {
    if (!this.side) return;
    const ctx = this.ctx, W = this.canvas.width, H = this.canvas.height;
    const A = this.angle * D2R, cA = Math.cos(A), sA = Math.sin(A);
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, W, H);

    ctx.drawImage(this.throneBuf, 0, 0);
    if (this.fitAngle !== this.angle) {
      const f = this.fitBuf.getContext("2d");
      this.paintQuads(f, [...this.throneTop, ...this.ringQuads, ...this.shackleQuads], cA, sA, true);
      this.fitAngle = this.angle;
    }
    ctx.drawImage(this.fitBuf, 0, 0);
    this.drawSide(ctx, cA, sA);

    const front = cA > 0;
    const n = front ? [sA, 0, cA] : [-sA, 0, -cA];
    // `.lambert` under the scene's three lamps
    const light = Math.min(1, 0.32 + 0.64 * Math.max(0, dot(n, KEY)) + 0.13 * 0.86 * Math.max(0, dot(n, FILL)));
    const f = this.faceBuf.getContext("2d");
    f.setTransform(1, 0, 0, 1, 0, 0);
    f.clearRect(0, 0, W, H);
    const reteTurn = (this.idleT * 4) % 360;
    const L = this.layers;
    if (front) {
      this.drawLayer(f, L.mater, true, FACE_Z + SKIN, cA, sA);
      this.drawLayer(f, L.reteShadow, true, FACE_Z + SKIN + 0.0006, cA, sA, reteTurn, [0.011, 0.020 * ELEVATION + 0.015]);
      this.drawLayer(f, L.rete, true, FACE_Z + 0.003, cA, sA, reteTurn);
      this.drawLayer(f, L.materLip, true, FACE_Z + 0.006, cA, sA);
      this.drawLayer(f, L.rule, true, FACE_Z + 0.011, cA, sA);
      this.drawLayer(f, L.horse, true, FACE_Z + 0.017, cA, sA);
    } else {
      const sweep = alidadeSweep(this.idleT);
      this.drawLayer(f, L.plate, false, -FACE_Z - SKIN, cA, sA);
      this.drawLayer(f, L.alidadeShadow, false, -FACE_Z - SKIN - 0.0006, cA, sA, sweep, [0.010, 0.020 * ELEVATION + 0.014]);
      this.drawLayer(f, L.alidade, false, -FACE_Z - 0.014, cA, sA, sweep);
    }
    f.setTransform(1, 0, 0, 1, 0, 0);
    if (light < 0.999) {
      f.globalCompositeOperation = "source-atop";
      f.fillStyle = `rgba(0,0,0,${1 - light})`;
      f.fillRect(0, 0, W, H);
      f.globalCompositeOperation = "source-over";
    }
    ctx.drawImage(this.faceBuf, 0, 0);

    // the drop shadow follows the silhouette's width
    if (this.shadow) {
      const wide = Math.max(0.06, (Math.abs(cA) * DISC_R * 2 + Math.abs(sA) * THICK) / (DISC_R * 2));
      this.shadow.style.transform = `scaleX(${wide.toFixed(4)})`;
    }
  }

  // ---- motion

  get moving() {
    return !!this.tween || (!this.idlePaused && !reduceMotion.matches);
  }

  kick() {
    if (this.raf || !this.visible) return;
    this.last = performance.now();
    const step = (now) => {
      this.raf = 0;
      const dt = Math.min(0.1, (now - this.last) / 1000);
      this.last = now;
      if (!this.idlePaused && !reduceMotion.matches) this.idleT += dt;
      if (this.tween) {
        const t = (now - this.tween.t0) / this.tween.dur;
        if (t >= 1) { this.angle = this.tween.to; this.tween = null; }
        else this.angle = this.tween.from + (this.tween.to - this.tween.from) * easeOut(t);
      }
      this.draw();
      if (this.moving && this.visible) this.raf = requestAnimationFrame(step);
    };
    this.raf = requestAnimationFrame(step);
  }

  setVisible(v) {
    this.visible = v;
    if (v) this.kick();
    else if (this.raf) { cancelAnimationFrame(this.raf); this.raf = 0; }
  }

  animateTo(to, ms) {
    if (reduceMotion.matches) { this.tween = null; this.angle = to; this.draw(); return; }
    this.tween = { from: this.angle, to, t0: performance.now(), dur: ms };
    this.kick();
  }

  holdIdle() {
    clearTimeout(this.resumeTimer);
    this.resumeTimer = null;
    this.idlePaused = true;
  }

  releaseIdle() {
    clearTimeout(this.resumeTimer);
    this.resumeTimer = setTimeout(() => { this.idlePaused = false; this.kick(); }, 1100);
  }

  bindInput() {
    const host = this.host;
    const inCircle = (e) => {
      const r = host.getBoundingClientRect();
      const cx = r.left + r.width / 2, cy = r.top + r.height / 2;
      return Math.hypot(e.clientX - cx, e.clientY - cy) <= Math.min(r.width, r.height) / 2;
    };
    host.addEventListener("pointerdown", (e) => {
      if (e.button !== 0 || !inCircle(e)) return;
      this.drag = { id: e.pointerId, x0: e.clientX, y0: e.clientY, start: this.angle, dx: 0, dy: 0 };
      try { host.setPointerCapture(e.pointerId); } catch (_) { /* fine */ }
      this.tween = null;
      this.holdIdle();
    });
    host.addEventListener("pointermove", (e) => {
      const d = this.drag;
      if (!d || d.id !== e.pointerId) return;
      d.dx = e.clientX - d.x0; d.dy = e.clientY - d.y0;
      this.angle = d.start + d.dx * 0.62;
      this.draw();
    });
    const end = (e, cancelled) => {
      const d = this.drag;
      if (!d || d.id !== e.pointerId) return;
      this.drag = null;
      if (!cancelled && Math.abs(d.dx) < 6 && Math.abs(d.dy) < 6) {
        this.animateTo(this.angle + 180, 400);
      } else {
        this.animateTo(Math.round(this.angle / 180) * 180, 300);
      }
      this.releaseIdle();
    };
    host.addEventListener("pointerup", (e) => end(e, false));
    host.addEventListener("pointercancel", (e) => end(e, true));

    // Keyboard: the arrows turn it, a step at a time, and it settles onto the
    // nearer face once they stop; Enter or Space turns it over, as a tap does.
    let settle = null;
    host.addEventListener("keydown", (e) => {
      if (e.key === "ArrowLeft" || e.key === "ArrowRight") {
        e.preventDefault();
        this.holdIdle();
        clearTimeout(settle);
        const base = this.tween ? this.tween.to : this.angle;
        this.animateTo(base + (e.key === "ArrowRight" ? 20 : -20), 150);
        settle = setTimeout(() => {
          this.animateTo(Math.round(this.angle / 180) * 180, 300);
          this.releaseIdle();
        }, 650);
      } else if (e.key === "Enter" || e.key === " ") {
        e.preventDefault();
        clearTimeout(settle);
        this.holdIdle();
        const base = this.tween ? this.tween.to : this.angle;
        this.animateTo(Math.round(base / 180) * 180 + 180, 400);
        this.releaseIdle();
      }
    });
  }
}

// ===========================================================================
// `ShootingStar`.

function startShootingStars(canvas) {
  const ctx = canvas.getContext("2d");
  const DURATION = 650;
  let next = performance.now() + (0.6 + Math.random() * 0.8) * 1000;
  let origin = [0.1, 0.1], vector = [0.3, 0.2], raf = 0, timer = 0, running = true;

  const frame = (now) => {
    raf = 0;
    const w = canvas.clientWidth, h = canvas.clientHeight, dpr = canvas.width / Math.max(1, w);
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    const elapsed = now - next;
    if (elapsed >= DURATION) {
      next = performance.now() + (1.6 + Math.random() * 2.4) * 1000;
      schedule();
      return;
    }
    if (elapsed >= 0) {
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      const t = elapsed / DURATION;
      const hx = (origin[0] + vector[0] * t) * w, hy = (origin[1] + vector[1] * t) * h;
      const tt = Math.max(t - 0.3, 0);
      const tx = (origin[0] + vector[0] * tt) * w, ty = (origin[1] + vector[1] * tt) * h;
      const fade = t < 0.75 ? 1 : 1 - (t - 0.75) / 0.25;
      ctx.beginPath(); ctx.moveTo(tx, ty); ctx.lineTo(hx, hy);
      ctx.strokeStyle = linear(ctx, tx, ty, hx, hy, [[0, "rgba(255,255,255,0)"], [1, `rgba(255,255,255,${0.9 * fade})`]]);
      ctx.lineWidth = 1.8; ctx.lineCap = "round"; ctx.stroke();
      circle(ctx, hx, hy, 1.6);
      ctx.fillStyle = `rgba(255,255,255,${fade})`; ctx.fill();
    }
    raf = requestAnimationFrame(frame);
  };
  const schedule = () => {
    clearTimeout(timer);
    if (!running || reduceMotion.matches) return;
    const wait = Math.max(0, next - performance.now());
    timer = setTimeout(() => {
      origin = [Math.random(), Math.random()];
      const a = Math.random() * 2 * Math.PI, len = 0.22 + Math.random() * 0.28;
      vector = [Math.cos(a) * len, Math.sin(a) * len];
      next = performance.now();
      if (!raf) raf = requestAnimationFrame(frame);
    }, wait);
  };
  schedule();
  return {
    setRunning(v) {
      running = v;
      if (!v) { clearTimeout(timer); if (raf) cancelAnimationFrame(raf); raf = 0; ctx.clearRect(0, 0, canvas.width, canvas.height); }
      else { next = performance.now() + 600; schedule(); }
    },
  };
}

// ===========================================================================
// The enter button's wear — `WearMarks(seed: 4021, intensity: 0.16)` baked
// into the metal under the label, as `wornBrassButton` does.

function wearImage(w, h, seed) {
  const k = Math.min(window.devicePixelRatio || 1, 3);
  const [cv, ctx] = makeCanvas(w, h, k);
  const rng = new SeededRandom(seed);
  const heavy = 0.16, dim = Math.min(w, h);
  const strokes = 6 + Math.floor(heavy * 26);
  const grain = rng.next() * Math.PI;
  ctx.lineCap = "round";
  for (let i = 0; i < strokes; i++) {
    const angle = grain + (rng.next() - 0.5) * 0.7;
    const len = dim * (0.15 + rng.next() * 0.55);
    const x0 = rng.next() * w, y0 = rng.next() * h;
    const dx = Math.cos(angle) * len, dy = Math.sin(angle) * len;
    const a = (0.06 + rng.next() * 0.16) * (0.4 + heavy);
    ctx.beginPath(); ctx.moveTo(x0, y0); ctx.lineTo(x0 + dx, y0 + dy);
    ctx.strokeStyle = rgba(B.deep, a); ctx.lineWidth = 0.5 + rng.next() * 0.6; ctx.stroke();
    ctx.beginPath(); ctx.moveTo(x0 + 0.5, y0 - 0.5); ctx.lineTo(x0 + dx + 0.5, y0 + dy - 0.5);
    ctx.strokeStyle = rgba(B.spec, a * 0.7); ctx.lineWidth = 0.4; ctx.stroke();
  }
  for (let i = 0; i < Math.floor(heavy * 7); i++) {
    const cx = rng.next() * w, cy = rng.next() * h;
    const r = dim * (0.012 + rng.next() * 0.030);
    const a0 = rng.next() * Math.PI * 2;
    ctx.beginPath(); ctx.moveTo(cx, cy);
    ctx.arc(cx, cy, r, a0, a0 + 1.6 + rng.next(), false);
    ctx.closePath();
    ctx.fillStyle = rgba(B.deep, 0.42 + rng.next() * 0.28); ctx.fill();
    ctx.strokeStyle = rgba(B.spec, 0.5); ctx.lineWidth = 0.5; ctx.stroke();
  }
  for (let i = 0; i < Math.floor(heavy * 40); i++) {
    const cx = rng.next() * w, cy = rng.next() * h;
    const r = dim * (0.004 + rng.next() * 0.008);
    circle(ctx, cx, cy, r);
    ctx.fillStyle = rgba(B.deep, 0.25 + rng.next() * 0.35); ctx.fill();
  }
  return cv.toDataURL("image/png");
}

// ===========================================================================
// Layout: the app's VStack, with `scale` = side / 272.

const REGULAR = matchMedia("(min-width: 768px)");

export function initWelcome(root) {
  const sky = root.querySelector(".sky");
  const shooting = root.querySelector(".shooting");
  const glow = root.querySelector(".moon-glow");
  const star = root.querySelector(".r-star");
  const enter = root.querySelector(".enter");
  const stack = root.querySelector(".welcome-stack");
  const host = root.querySelector(".instrument");
  const instrument = new Instrument(host);
  // `?angle=<degrees>` holds the instrument at a stated turn with its idle
  // stopped, the way the app's `-ReteAngle` launch argument does, so one
  // frame can be compared like for like.
  const held = parseFloat(new URLSearchParams(location.search).get("angle"));
  if (Number.isFinite(held)) { instrument.angle = held; instrument.idlePaused = true; }
  const skyTurn = Number.isFinite(held) ? 0 : Math.random() * 360;
  let skySize = "";

  const paintCanvas = (canvas, w, h, draw) => {
    const dpr = Math.min(window.devicePixelRatio || 1, 3);
    canvas.width = Math.round(w * dpr); canvas.height = Math.round(h * dpr);
    const ctx = canvas.getContext("2d");
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    draw(ctx, dpr);
  };

  const layout = () => {
    // regular width uses the 400pt instrument; a window too short to hold the
    // whole composition at that size gets the largest that fits
    let scale = 1;
    root.style.setProperty("--k", "1");
    if (REGULAR.matches) {
      scale = 400 / FRAME;
      root.style.setProperty("--k", String(scale));
      // twice, since the tagline may rewrap at the smaller size
      for (let pass = 0; pass < 2; pass++) {
        const avail = window.innerHeight;
        const need = stack.scrollHeight;
        if (need <= avail) break;
        scale = Math.max(1, scale * (avail - 1) / need);
        root.style.setProperty("--k", String(scale));
      }
    }
    const side = Math.round(FRAME * scale);
    root.style.setProperty("--side", side + "px");
    instrument.setSide(side);

    const k = scale;
    paintCanvas(glow, 200 * k, 84 * k, (ctx) => drawMoonGlow(ctx, 200 * k, 84 * k));
    paintCanvas(star, 120 * k, 120 * k, (ctx, dpr) => {
      ctx.setTransform(dpr * k, 0, 0, dpr * k, 0, 0);
      drawLegStar(ctx);
    });
    placeStar(k);

    const w = root.clientWidth, h = root.clientHeight;
    const size = `${w}x${h}`;
    if (size !== skySize) {
      skySize = size;
      paintCanvas(sky, w, h, (ctx, dpr) => drawStarfield(ctx, w, h, dpr, { rotation: skyTurn }));
      const dpr = Math.min(window.devicePixelRatio || 1, 3);
      shooting.width = Math.round(w * dpr); shooting.height = Math.round(h * dpr);
    }

    const bw = enter.offsetWidth, bh = enter.offsetHeight;
    if (bw && bh) enter.style.setProperty("--wear", `url(${wearImage(bw, bh, 4021)})`);
  };

  const placeStar = (k) => {
    const text = root.querySelector(".wm-astro");
    const mark = root.querySelector(".wm-baseline");
    if (!text || !mark) return;
    const box = text.getBoundingClientRect();
    const wrap = star.offsetParent.getBoundingClientRect();
    const base = mark.getBoundingClientRect().top;
    star.style.left = `${box.left - wrap.left + LEG_TIP.x * k - 60 * k}px`;
    star.style.top = `${base - wrap.top + LEG_TIP.y * k - 60 * k}px`;
  };

  let lastW = 0, lastH = 0;
  const onResize = () => {
    const w = window.innerWidth, h = window.innerHeight;
    // a mobile browser's toolbar coming and going changes only the height,
    // by a little; that is not a reason to redraw the sky
    if (w === lastW && Math.abs(h - lastH) < 120) return;
    lastW = w; lastH = h;
    layout();
  };

  const go = () => {
    lastW = window.innerWidth; lastH = window.innerHeight;
    layout();
    const stars = startShootingStars(shooting);
    new IntersectionObserver(([e]) => {
      instrument.setVisible(e.isIntersecting);
      stars.setRunning(e.isIntersecting && !reduceMotion.matches);
    }).observe(root);
    document.addEventListener("visibilitychange", () => {
      // The installed web app takes the welcome screen away once ENTER is
      // pressed; coming back to the app then must not wake it up unseen.
      const on = document.visibilityState === "visible" && root.isConnected;
      instrument.setVisible(on);
      stars.setRunning(on && !reduceMotion.matches);
    });
    reduceMotion.addEventListener?.("change", () => { stars.setRunning(!reduceMotion.matches); instrument.kick(); instrument.draw(); });
    window.addEventListener("resize", () => { clearTimeout(go.t); go.t = setTimeout(onResize, 120); });
    REGULAR.addEventListener?.("change", layout);
    // `.scaleEffect(0.85 → 1)` and `.opacity(0 → 1)`, easeOut 0.9s after 0.15s
    root.getBoundingClientRect();
    setTimeout(() => root.classList.add("appeared"), 30);
    instrument.kick();
  };

  go();
  // The R's star is measured against Metamorphous, and the fit against the
  // tagline's real face, so both are taken again once the fonts are in.
  if (document.fonts && document.fonts.ready) document.fonts.ready.then(() => layout());

  return instrument;
}

// ===========================================================================
// The night the rest of the page sits on: the same sky's stars and faint
// constellations, without the planets, held still behind the scroll.

export function initBackdrop(canvas) {
  let size = "";
  const paint = () => {
    const w = window.innerWidth, h = Math.max(window.innerHeight, screen.height || 0);
    const key = `${w}x${Math.round(h / 200)}`;
    if (key === size) return;
    size = key;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    canvas.width = Math.round(w * dpr); canvas.height = Math.round(h * dpr);
    const ctx = canvas.getContext("2d");
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    drawStarfield(ctx, w, h, dpr, { planets: false });
  };
  paint();
  window.addEventListener("resize", () => { clearTimeout(paint.t); paint.t = setTimeout(paint, 200); });
}

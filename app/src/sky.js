// Sky Navigator: the app's Sky tab, in a browser.
//
// Point the device at the sky and the instrument shows two things at once,
// because they aren't the same thing: the zodiac sign that stretch of the
// ecliptic is named for, and the real constellation actually up there. The
// gap between them is the feature, not an embarrassment to be smoothed over.
//
// Ported from the app, value for value:
// - SkyPointing.swift (AstrolabeCore): horizontal to equatorial to ecliptic,
//   the thirteen constellations at their real IAU widths, and the gap.
// - Astronomy.swift: sidereal time and the obliquity.
// - SkyPointingView.swift: the dial, the legend, the readout, the sliders.
// - ConstellationChart.swift + ConstellationFigures.swift: the stars actually
//   there, mounted in the instrument's round bezel.
// - SkySensors.swift: sensors when the device has them and says yes, the
//   sliders when it doesn't. The fallback drives the identical code path, so
//   the tab works seated, indoors, on a computer, or with permission declined.
//
// Where the browser differs from the phone:
// - iOS only lets a page ask for motion after a tap, so the sensors start from
//   the button. Elsewhere they start by themselves once they've been allowed.
// - Browsers report a magnetic bearing. The app corrects to true north, so a
//   reading here can sit a few degrees off the app's.
// - The app fuses the gyroscope into the compass so a fast sweep doesn't lag.
//   Browsers already fuse their orientation events; this smooths them.
// - The app's seven-town list is the site's own place search here, starting
//   from Portland, the app's own default.

import { FIGURES } from "./sky-figures.js";
import { SIGNS } from "./lore.js";
import { resolve, EVENT } from "../../chart/src/appearance.js";
import { loadPlaces, searchPlaces } from "../../chart/src/places.js";

const RAD = Math.PI / 180;
const norm = (d) => ((d % 360) + 360) % 360;
const esc = (s) => String(s ?? "").replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
const store = {
  get(k) { try { return localStorage.getItem(k); } catch { return null; } },
  set(k, v) { try { localStorage.setItem(k, v); } catch { /* private window */ } },
};
const reduceMotion = () => window.matchMedia("(prefers-reduced-motion: reduce)").matches;

// ---------------------------------------------------------------- the maths

// Astronomy.swift
const OBLIQUITY = 23.4392911;
const julianDay = (date) => date.getTime() / 86400000 + 2440587.5;
const localSidereal = (jd, longitude) => norm(280.46061837 + 360.98564736629 * (jd - 2451545.0) + longitude);

// SkyPointing.eclipticConstellations
export const CONSTELLATIONS = [
  ["Pisces", 351.6, 28.7], ["Aries", 28.7, 53.5], ["Taurus", 53.5, 90.4],
  ["Gemini", 90.4, 118.3], ["Cancer", 118.3, 138.2], ["Leo", 138.2, 174.0],
  ["Virgo", 174.0, 217.8], ["Libra", 217.8, 241.1], ["Scorpius", 241.1, 247.7],
  ["Ophiuchus", 247.7, 266.6], ["Sagittarius", 266.6, 299.7],
  ["Capricornus", 299.7, 327.6], ["Aquarius", 327.6, 351.6],
].map(([name, start, end]) => ({ name, start, end, width: end - start < 0 ? end - start + 360 : end - start }));

const contains = (c, lon) => {
  const l = norm(lon);
  return c.start <= c.end ? l >= c.start && l < c.end : l >= c.start || l < c.end;
};

/** Ecliptic longitude of whatever the device is aimed at. Azimuth from north through east. */
export function eclipticLongitude(azimuth, altitude, latitude, lst) {
  const e = OBLIQUITY * RAD, lat = latitude * RAD, a = azimuth * RAD, h = altitude * RAD;
  const sinDec = Math.sin(h) * Math.sin(lat) + Math.cos(h) * Math.cos(lat) * Math.cos(a);
  const dec = Math.asin(Math.max(-1, Math.min(1, sinDec)));
  const hourAngle = Math.atan2(-Math.sin(a) * Math.cos(h),
    Math.cos(lat) * Math.sin(h) - Math.sin(lat) * Math.cos(h) * Math.cos(a));
  const ra = norm(lst - hourAngle / RAD) * RAD;
  return norm(Math.atan2(Math.sin(ra) * Math.cos(e) + Math.tan(dec) * Math.sin(e), Math.cos(ra)) / RAD);
}

const namesMatch = (sign, con) => sign === con || (sign === "Scorpio" && con === "Scorpius") || (sign === "Capricorn" && con === "Capricornus");

/** SkyPointing.reading: the aim in both frames at once. */
export function reading(azimuth, altitude, latitude, lst) {
  const lon = eclipticLongitude(azimuth, altitude, latitude, lst);
  const sign = SIGNS[Math.floor(lon / 30) % 12];
  const constellation = CONSTELLATIONS.find((c) => contains(c, lon)) ?? CONSTELLATIONS[0];
  // Midpoint to midpoint: the visible residue of precession.
  const signMid = Math.floor(lon / 30) * 30 + 15;
  const conMid = norm(constellation.start + constellation.width / 2);
  let gap = norm(signMid - conMid);
  if (gap > 180) gap -= 360;
  const gapDegrees = Math.abs(gap);
  const agree = namesMatch(sign.name, constellation.name);
  const summary = agree
    ? `Both say ${sign.name} here, though the sector and the stars still sit ${Math.round(gapDegrees)}° apart`
    : `${Math.round(gapDegrees)}° apart — the sign says ${sign.name}, the sky says ${constellation.name}`;
  return { lon, sign, constellation, gapDegrees, summary };
}

const POINTS = ["N", "NNE", "NE", "ENE", "E", "ESE", "SE", "SSE", "S", "SSW", "SW", "WSW", "W", "WNW", "NW", "NNW"];
const compass = (deg) => POINTS[Math.round(deg / 22.5) % 16];

// ---------------------------------------------------------------- colour

function palette() {
  const r = resolve();
  const css = getComputedStyle(document.documentElement);
  const m = r.metal;
  return {
    ground: r.page["--ground"], brass: r.page["--brass"], bright: r.page["--bright"],
    resist: r.scheme.resist, muted: r.scheme.muted, fire: r.scheme.fire,
    air: css.getPropertyValue("--el-air").trim() || "#2F52A0",
    plate: r.scheme.plate, isDark: r.isDark,
    spec: m.spec, lit: m.lit, base: m.base, mid: m.mid, dark: m.dark, deep: m.deep,
  };
}
const alpha = (hex, a) => {
  const h = hex.replace("#", "");
  return `rgba(${parseInt(h.slice(0, 2), 16)},${parseInt(h.slice(2, 4), 16)},${parseInt(h.slice(4, 6), 16)},${a})`;
};

/** Brass.spun: the turned-metal sheen, as a conic gradient. */
function spun(ctx, cx, cy, p, polished = true) {
  const hi = polished ? p.spec : p.lit, low = polished ? p.dark : p.mid, m = polished ? p.mid : p.base;
  if (!ctx.createConicGradient) return p.base;
  const g = ctx.createConicGradient(0, cx, cy);
  [[0, hi], [0.11, p.base], [0.20, m], [0.25, low], [0.31, m], [0.42, p.base], [0.50, hi],
   [0.60, p.base], [0.70, m], [0.75, low], [0.82, m], [0.92, p.base], [1, hi]].forEach(([t, c]) => g.addColorStop(t, c));
  return g;
}

function sizeCanvas(canvas, w, h) {
  const k = Math.min(window.devicePixelRatio || 1, 3);
  if (canvas.width !== Math.round(w * k) || canvas.height !== Math.round(h * k)) {
    canvas.width = Math.round(w * k); canvas.height = Math.round(h * k);
  }
  canvas.style.width = w + "px"; canvas.style.height = h + "px";
  const ctx = canvas.getContext("2d");
  ctx.setTransform(k, 0, 0, k, 0, 0);
  ctx.clearRect(0, 0, w, h);
  return ctx;
}

// ---------------------------------------------------------------- the dial

/** An annular wedge, 0° at the top and running clockwise, as SkyDial's `Arc`. */
function wedge(ctx, c, r0, r1, from, to) {
  const a0 = (from - 90) * RAD, a1 = (to - 90) * RAD;
  ctx.beginPath();
  ctx.arc(c, c, r1, a0, a1, false);
  ctx.arc(c, c, r0, a1, a0, true);
  ctx.closePath();
}

function drawDial(canvas, size, r, p) {
  const ctx = sizeCanvas(canvas, size, size);
  const c = size / 2, outer = size / 2, mid = outer * 0.78, inner = outer * 0.54;
  const band = outer - mid;

  ctx.save();
  // The rings turn like a compass card: what you're aimed at always sits
  // under the fixed pointer at the top.
  ctx.translate(c, c); ctx.rotate(-r.lon * RAD); ctx.translate(-c, -c);

  // The satin ring. The app strokes it inside a frame half a band smaller
  // than the dial, so it sits half a band in from the sign wedges and over
  // the outer half of the constellations; kept, because that's the app.
  ctx.globalAlpha = 0.5;
  ctx.lineWidth = band;
  ctx.strokeStyle = spun(ctx, c, c, p, false);
  ctx.beginPath(); ctx.arc(c, c, outer - band, 0, Math.PI * 2); ctx.stroke();
  ctx.globalAlpha = 1;

  // Twelve equal sectors; the one aimed at is struck in polished brass.
  for (let i = 0; i < 12; i++) {
    wedge(ctx, c, mid, outer, i * 30, i * 30 + 30);
    if (SIGNS[i].name === r.sign.name) {
      ctx.globalAlpha = 0.85; ctx.fillStyle = spun(ctx, c, c, p, true); ctx.fill(); ctx.globalAlpha = 1;
    }
    ctx.lineWidth = 0.7; ctx.strokeStyle = alpha(p.brass, 0.5); ctx.stroke();
  }

  // Thirteen real constellations at their true widths. Ophiuchus, the one
  // the signs leave out, is picked out in bright brass.
  for (const con of CONSTELLATIONS) {
    wedge(ctx, c, inner, mid, con.start, con.start + con.width);
    const tint = con.name === "Ophiuchus" ? p.bright : p.air;
    ctx.fillStyle = alpha(tint, con.name === r.constellation.name ? 0.75 : 0.34); ctx.fill();
    ctx.lineWidth = 0.6; ctx.strokeStyle = alpha(p.brass, 0.35); ctx.stroke();
  }
  ctx.restore();

  // The lubber line, fixed at the top, from the hub's edge to the rim.
  const fromY = c - inner * 1.02, tipY = c - outer, headW = 7, headL = 10, baseY = tipY + headL;
  ctx.strokeStyle = p.fire; ctx.fillStyle = p.fire; ctx.lineWidth = 2.5; ctx.lineCap = "round";
  ctx.beginPath(); ctx.moveTo(c, fromY); ctx.lineTo(c, baseY); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(c - headW, baseY); ctx.lineTo(c, tipY); ctx.lineTo(c + headW, baseY); ctx.closePath(); ctx.fill();
}

// ---------------------------------------------------------------- the stars

/** ConstellationFigures.plot: a unit square, north up and east to the left. */
function plot(figure) {
  const first = figure.stars[0];
  const ras = figure.stars.map((s) => {
    let ra = s.ra;
    while (ra - first.ra > 180) ra -= 360;
    while (ra - first.ra < -180) ra += 360;
    return ra;
  });
  const decs = figure.stars.map((s) => s.dec);
  const meanDec = (Math.min(...decs) + Math.max(...decs)) / 2;
  const squeeze = Math.cos(meanDec * RAD);
  const xs = ras.map((ra) => -ra * squeeze), ys = decs.map((d) => -d);
  const minX = Math.min(...xs), minY = Math.min(...ys);
  const spanX = Math.max(...xs) - minX, spanY = Math.max(...ys) - minY;
  const scale = 1 / Math.max(Math.max(spanX, spanY), 0.001);
  const padX = (1 - spanX * scale) / 2, padY = (1 - spanY * scale) / 2;
  return figure.stars.map((s, i) => ({ name: s.name, mag: s.mag, x: (xs[i] - minX) * scale + padX, y: (ys[i] - minY) * scale + padY }));
}

/** SeededRandom: xorshift64, exactly as the app has it. */
function seeded(seed) {
  let s = BigInt.asUintN(64, seed === 0n ? 0x9E3779B9n : seed);
  return () => {
    s = BigInt.asUintN(64, s ^ (s << 13n));
    s = BigInt.asUintN(64, s ^ (s >> 7n));
    s = BigInt.asUintN(64, s ^ (s << 17n));
    return Number(s % 100000n) / 100000;
  };
}

const APERTURE_FIT = 0.79, INSET_X = 0.14, INSET_Y = 0.13, NAMED = 3;

function drawStars(canvas, w, h, figure, p) {
  const ctx = sizeCanvas(canvas, w, h);
  const starlight = p.spec;
  const unit = Math.min(w, h) / 95;

  // The faint field behind the figure, seeded by the name as the app seeds it.
  let seed = 17n;
  for (const ch of figure.constellation) seed = BigInt.asUintN(64, seed * 131n + BigInt(ch.codePointAt(0)));
  const rng = seeded(seed);
  for (let i = 0; i < 70; i++) {
    const x = rng() * w, y = rng() * h, r = unit * (0.22 + rng() * 0.4);
    ctx.fillStyle = alpha(starlight, 0.14 + rng() * 0.2);
    ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.fill();
  }

  const box = { x: w * INSET_X, y: h * INSET_Y, w: w * (1 - INSET_X * 2), h: h * (1 - INSET_Y * 2) };
  const plotted = plot(figure).map((s) => ({ ...s, px: box.x + s.x * box.w, py: box.y + s.y * box.h }));

  ctx.strokeStyle = alpha(p.bright, 0.55);
  ctx.lineWidth = Math.max(0.8, unit * 0.5); ctx.lineCap = "round"; ctx.lineJoin = "round";
  ctx.beginPath();
  for (const [a, b] of figure.lines) { ctx.moveTo(plotted[a].px, plotted[a].py); ctx.lineTo(plotted[b].px, plotted[b].py); }
  ctx.stroke();

  const named = new Set([...plotted].sort((a, b) => a.mag - b.mag).slice(0, NAMED).map((s) => s.name));
  ctx.font = `${Math.max(8, unit * 5.2)}px ui-serif, "New York", Georgia, serif`;
  ctx.textBaseline = "top";
  for (const s of plotted) {
    const r = Math.min(Math.max((5.4 - s.mag) * unit * 0.62, unit * 0.75), unit * 3.4);
    const glow = ctx.createRadialGradient(s.px, s.py, 0, s.px, s.py, r * 2.6);
    glow.addColorStop(0, alpha(starlight, 0.34)); glow.addColorStop(1, alpha(starlight, 0));
    ctx.fillStyle = glow; ctx.beginPath(); ctx.arc(s.px, s.py, r * 2.6, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = starlight; ctx.beginPath(); ctx.arc(s.px, s.py, r, 0, Math.PI * 2); ctx.fill();
    if (!named.has(s.name)) continue;
    const toLeft = s.px > w * 0.62;
    ctx.textAlign = toLeft ? "right" : "left";
    ctx.fillStyle = alpha(p.lit, 0.85);
    ctx.fillText(s.name, s.px + (toLeft ? -(r + unit * 1.6) : r + unit * 1.6), s.py - r - unit * 1.2);
  }
}

const ringGradient = (ctx, cy, r, stops) => {
  const g = ctx.createLinearGradient(0, cy - r, 0, cy + r);
  stops.forEach(([t, c]) => g.addColorStop(t, c));
  return g;
};
/** strokeBorder: a ring of `width` drawn just inside a circle of diameter `d`. */
function ringInside(ctx, c, d, width, style) {
  ctx.lineWidth = width; ctx.strokeStyle = style;
  ctx.beginPath(); ctx.arc(c, c, d / 2 - width / 2, 0, Math.PI * 2); ctx.stroke();
}

/** The bezel beneath the stars: spun disc, outer chamfer, crown, and the night ground. */
function drawBezelBack(canvas, s, p) {
  const ctx = sizeCanvas(canvas, s, s);
  const c = s / 2, rim = s * 0.055, d = s - rim * 2;
  ctx.fillStyle = spun(ctx, c, c, p, true);
  ctx.beginPath(); ctx.arc(c, c, s / 2, 0, Math.PI * 2); ctx.fill();
  ringInside(ctx, c, s, rim * 0.32, ringGradient(ctx, c, s / 2,
    [[0, alpha(p.spec, 0.14)], [0.45, "rgba(0,0,0,0)"], [0.70, "rgba(0,0,0,0.08)"], [1, "rgba(0,0,0,0.24)"]]));
  ringInside(ctx, c, s, 1.5, ringGradient(ctx, c, s / 2, [[0, alpha(p.spec, 0.95)], [1, alpha(p.deep, 0.55)]]));
  // The crown, turned the other way from the disc so the two faces part.
  ctx.save(); ctx.translate(c, c); ctx.rotate(-118 * RAD); ctx.translate(-c, -c);
  ctx.lineWidth = rim * 0.36; ctx.strokeStyle = spun(ctx, c, c, p, false);
  ctx.beginPath(); ctx.arc(c, c, (s - rim) / 2, 0, Math.PI * 2); ctx.stroke();
  ctx.restore();
  const d2 = s - rim * 0.64;
  ringInside(ctx, c, d2, 1.25, ringGradient(ctx, c, d2 / 2, [[0, alpha(p.deep, 0.65)], [1, alpha(p.spec, 0.45)]]));
  // A picture of night in every palette, as a star atlas prints white on black.
  ctx.fillStyle = p.isDark ? p.plate : p.deep;
  ctx.beginPath(); ctx.arc(c, c, d / 2, 0, Math.PI * 2); ctx.fill();
}

/** The bezel over the stars: the vignette, the bore, its lip, and four screws. */
function drawBezelFront(canvas, s, p) {
  const ctx = sizeCanvas(canvas, s, s);
  const c = s / 2, rim = s * 0.055, d = s - rim * 2;
  const v = ctx.createRadialGradient(c, c, 0, c, c, d / 2);
  v.addColorStop(0.72, "rgba(0,0,0,0)"); v.addColorStop(0.88, "rgba(0,0,0,0.22)"); v.addColorStop(1, "rgba(0,0,0,0.55)");
  ctx.fillStyle = v; ctx.beginPath(); ctx.arc(c, c, d / 2, 0, Math.PI * 2); ctx.fill();
  const bore = d + rim * 0.68;
  ringInside(ctx, c, bore, rim * 0.34, ringGradient(ctx, c, bore / 2,
    [[0, "rgba(0,0,0,0.30)"], [0.5, "rgba(0,0,0,0.08)"], [1, alpha(p.spec, 0.18)]]));
  ringInside(ctx, c, d, 1.5, ringGradient(ctx, c, d / 2, [[0, alpha(p.deep, 0.75)], [1, alpha(p.spec, 0.30)]]));

  // Fasteners at the four diagonals, slots turned by the app's own seed.
  const rng = seeded(5107n);
  const bands = [0, 1, 2, 3];
  for (let i = 3; i >= 1; i--) { const j = Math.floor(rng() * (i + 1)) % (i + 1); [bands[i], bands[j]] = [bands[j], bands[i]]; }
  const ring = (s - rim) / 2, head = rim * 0.34;
  [45, 135, 225, 315].forEach((deg, i) => {
    const x = c + Math.cos(deg * RAD) * ring, y = c + Math.sin(deg * RAD) * ring;
    const g = ctx.createRadialGradient(x - head * 0.34, y - head * 0.34, 0, x - head * 0.34, y - head * 0.34, head * 1.6);
    [p.spec, p.lit, p.base, p.dark, p.deep].forEach((col, k) => g.addColorStop(k / 4, col));
    ctx.fillStyle = g; ctx.beginPath(); ctx.arc(x, y, head, 0, Math.PI * 2); ctx.fill();
    ctx.lineWidth = 0.6; ctx.strokeStyle = alpha(p.deep, 0.6); ctx.stroke();
    const slot = (bands[i] + 0.25 + rng() * 0.5) * Math.PI / 4;
    const dx = Math.cos(slot) * head * 0.62, dy = Math.sin(slot) * head * 0.62;
    ctx.lineWidth = 0.9; ctx.strokeStyle = alpha(p.deep, 0.75);
    ctx.beginPath(); ctx.moveTo(x - dx, y - dy); ctx.lineTo(x + dx, y + dy); ctx.stroke();
    ctx.lineWidth = 0.5; ctx.strokeStyle = alpha(p.spec, 0.4);
    ctx.beginPath(); ctx.moveTo(x - dx + 0.4, y - dy + 0.4); ctx.lineTo(x + dx + 0.4, y + dy + 0.4); ctx.stroke();
  });
}

// ---------------------------------------------------------------- sensors

/**
 * Where the top edge of the device points, from a W3C orientation event:
 * the device's y axis in east-north-up, so altitude is how far the top edge
 * is raised and the bearing is where it faces. Holding it up to the sky puts
 * the altitude near 0 at the horizon and near 90 overhead, as in the app.
 */
function topEdge(e) {
  const a = e.alpha * RAD, b = e.beta * RAD;
  const east = -Math.sin(a) * Math.cos(b), north = Math.cos(a) * Math.cos(b), up = Math.sin(b);
  return { azimuth: norm(Math.atan2(east, north) / RAD), altitude: Math.asin(Math.max(-1, Math.min(1, up))) / RAD };
}

class Sensors {
  constructor(onChange) {
    this.onChange = onChange;
    this.on = false;
    this.offset = null;   // iOS: compass heading minus the relative bearing
    this.got = false;
    this.handler = (e) => this.orient(e);
    this.watch = null;
  }

  static available() { return typeof window.DeviceOrientationEvent !== "undefined"; }
  static needsTap() { return typeof window.DeviceOrientationEvent?.requestPermission === "function"; }

  async start({ fromTap = false } = {}) {
    if (!Sensors.available()) return "This device has no compass, so the sliders stay in charge.";
    if (Sensors.needsTap()) {
      if (!fromTap && !this.granted) return null;
      try {
        const answer = await DeviceOrientationEvent.requestPermission();
        if (answer !== "granted") return "Motion access was declined, so the sliders stay in charge. Reload the page to be asked again.";
        this.granted = true;
      } catch { return "Motion access was declined, so the sliders stay in charge. Reload the page to be asked again."; }
    }
    this.absolute = "ondeviceorientationabsolute" in window;
    window.addEventListener(this.absolute ? "deviceorientationabsolute" : "deviceorientation", this.handler);
    this.on = true; this.got = false;
    if (navigator.geolocation) {
      this.watch = navigator.geolocation.watchPosition(
        (pos) => this.onChange({ latitude: pos.coords.latitude, longitude: pos.coords.longitude, located: true }),
        () => this.onChange({ located: false }),
        { enableHighAccuracy: false, maximumAge: 600000, timeout: 20000 });
    }
    // Done at the first reading. Some computers report orientation support
    // and never send one, so after a moment's silence the sliders take over.
    return new Promise((done) => {
      this.firstReading = () => { clearTimeout(this.silence); done(null); };
      this.silence = setTimeout(() => {
        this.firstReading = null;
        if (this.on && !this.got) { this.stop(); done("This device has no compass, so the sliders stay in charge."); }
        else done(null);
      }, 1600);
    });
  }

  stop() {
    clearTimeout(this.silence);
    window.removeEventListener("deviceorientationabsolute", this.handler);
    window.removeEventListener("deviceorientation", this.handler);
    if (this.watch !== null) navigator.geolocation.clearWatch(this.watch);
    this.watch = null; this.on = false;
  }

  orient(e) {
    if (e.alpha === null || e.beta === null) return;
    const aim = topEdge(e);
    let azimuth;
    if (typeof e.webkitCompassHeading === "number" && e.webkitCompassHeading >= 0) {
      // iOS gives a relative alpha and a separate compass heading. The two
      // agree best with the device near flat, so the offset between them is
      // learned there and carried when the device is raised to the sky.
      const sample = norm(e.webkitCompassHeading - aim.azimuth);
      if (this.offset === null) this.offset = sample;
      else if (Math.abs(e.beta) < 50) {
        let d = sample - this.offset; if (d > 180) d -= 360; if (d < -180) d += 360;
        this.offset = norm(this.offset + d * 0.1);
      }
      azimuth = norm(aim.azimuth + this.offset);
    } else if (this.absolute || e.absolute) {
      azimuth = aim.azimuth;
    } else return;
    this.got = true;
    if (this.firstReading) { const f = this.firstReading; this.firstReading = null; f(); }
    this.onChange({ azimuth, altitude: Math.max(0, Math.min(90, aim.altitude)) });
  }
}

// ---------------------------------------------------------------- the screen

const CSS = `
.sky{ display: flex; flex-direction: column; gap: 20px; }
.sky-lede{ font-size: 14px; color: var(--muted); text-align: center; margin: 0; }
.sky-dial{ position: relative; width: 100%; max-width: 420px; margin-inline: auto; padding-inline: 8px; box-sizing: border-box; aspect-ratio: 1; }
.sky-dial canvas{ display: block; }
.sky-hub{ position: absolute; inset: 0; display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 2px; pointer-events: none; text-align: center; }
.sky-hub .sign{ font: 500 20px var(--font-display); color: var(--resist); }
.sky-hub .con{ font: 600 12px var(--font-body); letter-spacing: 1.4px; text-transform: uppercase; color: var(--el-air); filter: brightness(1.25); }
.sky-legend{ display: flex; flex-wrap: wrap; justify-content: center; gap: 8px 22px; font-size: 11px; color: var(--muted); }
.sky-legend span{ display: inline-flex; align-items: center; gap: 6px; }
.sky-legend i{ width: 12px; height: 12px; border-radius: 50%; flex: none; }
.sky-legend .sw-sign{ background: conic-gradient(var(--bright), var(--brass), var(--bright), var(--brass), var(--bright)); }
.sky-legend .sw-con{ background: var(--el-air); }
.sky-card{ background: var(--panel); border: 1px solid var(--rule); border-radius: 12px; padding: 16px; display: flex; flex-direction: column; gap: 10px; max-width: 420px; width: 100%; margin-inline: auto; box-sizing: border-box; }
.sky-eyepiece{ position: relative; width: 100%; aspect-ratio: 1; filter: drop-shadow(0 1.5px 3px rgba(0,0,0,.5)); }
.sky-eyepiece canvas{ position: absolute; display: block; }
.sky-eyepiece .stars-layer{ transition: opacity .45s ease-in-out; }
.sky-hint{ font: 13px/1.45 ui-serif, "New York", Georgia, serif; color: var(--muted); margin: 0; }
.sky-panel{ background: var(--panel); border: 1px solid var(--rule); border-radius: 12px; padding: 16px; display: flex; flex-direction: column; gap: 12px; }
.sky-row{ display: flex; align-items: baseline; gap: 8px; }
.sky-row .plate-label{ flex: none; width: 124px; white-space: nowrap; overflow: hidden; text-overflow: clip; }
.sky-row .v{ font-size: 15px; color: var(--ink); font-variant-numeric: tabular-nums; }
.sky-gap{ padding: 10px; border-radius: 8px; border: 1px solid color-mix(in srgb, var(--el-fire) 50%, transparent); background: color-mix(in srgb, var(--el-fire) 12%, transparent); }
.sky-gap .v{ font-size: 14px; color: var(--el-fire); }
.sky-manual{ display: flex; flex-direction: column; gap: 6px; }
.sky-manual input[type=range]{ width: 100%; accent-color: var(--bright); }
.sky-place{ position: relative; margin-top: 6px; }
.sky-place label{ font-size: 13px; color: var(--muted); display: block; margin-bottom: 4px; }
.sky-place input{ width: 100%; box-sizing: border-box; font: 15px var(--font-body); color: var(--ink); background: var(--ground); border: 1px solid var(--rule); border-radius: 8px; padding: 9px 11px; }
.sky-place ul{ list-style: none; margin: 4px 0 0; padding: 0; border: 1px solid var(--rule); border-radius: 8px; background: var(--ground); overflow: hidden; }
.sky-place ul[hidden]{ display: none; }
.sky-place li button{ display: block; width: 100%; text-align: left; font: 14.5px var(--font-body); color: var(--ink); background: none; border: 0; border-top: 1px solid var(--rule); padding: 8px 11px; cursor: pointer; }
.sky-place li:first-child button{ border-top: 0; }
.sky-place li button:hover, .sky-place li button:focus-visible{ background: var(--panel); }
.sky-note{ font-size: 12px; color: var(--muted); margin: 0; }
.sky-panel .metal-button{ width: 100%; font-size: 11px; letter-spacing: 1.6px; padding-block: 12px; }
.sky-sr{ position: absolute; width: 1px; height: 1px; overflow: hidden; clip-path: inset(50%); white-space: nowrap; }
`;

const PORTLAND = { label: "Portland, Oregon, United States", latitude: 45.5152, longitude: -122.6784 };
const PLACE_KEY = "astrolabe.sky.place";
const SENSORS_KEY = "astrolabe.sky.sensors";

export function mountSky(root) {
  if (!document.getElementById("sky-style")) {
    const s = document.createElement("style"); s.id = "sky-style"; s.textContent = CSS; document.head.append(s);
  }
  let place = PORTLAND;
  try { const saved = JSON.parse(store.get(PLACE_KEY) || "null"); if (saved && Number.isFinite(saved.latitude)) place = saved; } catch {}

  const state = { azimuth: 120, altitude: 35, latitude: place.latitude, longitude: place.longitude, now: new Date(), located: null };
  let usingSensors = false, note = "", lastCon = null, lastSummary = "", visible = false, frame = 0, tick = 0;
  // The displayed aim, eased toward the sensors' so a hand's tremor doesn't shake the dial.
  const shown = { azimuth: state.azimuth, altitude: state.altitude };

  const sensors = new Sensors((change) => {
    if ("located" in change) {
      state.located = change.located;
      if (change.located) { state.latitude = change.latitude; state.longitude = change.longitude; }
      renderPanel();
    }
    if ("azimuth" in change) { state.azimuth = change.azimuth; state.altitude = change.altitude; }
    schedule();
  });

  root.innerHTML = `
    <div class="sky">
      <p class="sky-lede">Hold your device up and the instrument follows the sky. It shows two things at once, because they aren't the same thing.</p>
      <div class="sky-dial" id="skyDial" role="img" aria-label="Sky dial">
        <canvas></canvas>
        <div class="sky-hub" aria-hidden="true">
          <span class="plate-label">Pointed At</span>
          <span class="sign" id="skySign"></span>
          <span class="con" id="skyCon"></span>
        </div>
      </div>
      <div class="sky-legend" aria-hidden="true">
        <span><i class="sw-sign"></i>Outer Ring — Your Zodiac Sign</span>
        <span><i class="sw-con"></i>Inner Ring — the Real Constellation</span>
      </div>
      <div class="sky-card" id="skyChart" role="img">
        <p class="plate-label">The Stars Actually There</p>
        <div class="sky-eyepiece" id="skyEyepiece">
          <canvas class="bezel-back"></canvas>
          <canvas class="stars-layer"></canvas>
          <canvas class="stars-layer" style="opacity:0"></canvas>
          <canvas class="bezel-front"></canvas>
        </div>
        <p class="sky-hint" id="skyHint"></p>
      </div>
      <div class="sky-panel" id="skyPanel"></div>
      <p class="sky-sr" aria-live="polite" id="skyAnnounce"></p>
    </div>`;

  const dial = root.querySelector("#skyDial"), dialCanvas = dial.querySelector("canvas");
  const eyepiece = root.querySelector("#skyEyepiece");
  const [back, starsA, starsB, front] = eyepiece.querySelectorAll("canvas");
  let starsFront = starsA;

  function current() {
    const lst = localSidereal(julianDay(state.now), state.longitude);
    return reading(shown.azimuth, shown.altitude, state.latitude, lst);
  }

  function layoutEyepiece(p, figure, crossfade) {
    const s = eyepiece.clientWidth;
    if (!s) return;
    const rim = s * 0.055, d = s - rim * 2;
    for (const cv of [back, front]) { cv.style.left = "0"; cv.style.top = "0"; }
    drawBezelBack(back, s, p);
    drawBezelFront(front, s, p);
    const w = d * APERTURE_FIT, h = w / 1.35;
    const target = crossfade ? (starsFront === starsA ? starsB : starsA) : starsFront;
    target.style.left = (s - w) / 2 + "px"; target.style.top = (s - h) / 2 + "px";
    drawStars(target, w, h, figure, p);
    if (crossfade && target !== starsFront) {
      target.style.opacity = "1"; starsFront.style.opacity = "0"; starsFront = target;
    }
  }

  function draw({ redrawChart = false } = {}) {
    frame = 0;
    if (!visible) return;
    // Ease toward the aim. Sliders set it directly; sensors arrive noisy.
    if (usingSensors && !reduceMotion()) {
      let d = state.azimuth - shown.azimuth; if (d > 180) d -= 360; if (d < -180) d += 360;
      shown.azimuth = norm(shown.azimuth + d * 0.3);
      shown.altitude += (state.altitude - shown.altitude) * 0.3;
      if (Math.abs(d) > 0.05 || Math.abs(state.altitude - shown.altitude) > 0.05) schedule();
    } else { shown.azimuth = state.azimuth; shown.altitude = state.altitude; }

    const p = palette();
    const r = current();
    const size = Math.max(0, dial.clientWidth - 16);
    if (size) drawDial(dialCanvas, size, r, p);
    root.querySelector("#skySign").textContent = `${r.sign.glyph} ${r.sign.name}`;
    root.querySelector("#skyCon").textContent = r.constellation.name;

    const changed = r.constellation.name !== lastCon;
    if (changed || redrawChart) {
      const figure = FIGURES.find((f) => f.constellation === r.constellation.name);
      if (figure) {
        layoutEyepiece(p, figure, changed && lastCon !== null && !reduceMotion());
        root.querySelector("#skyHint").textContent = figure.hint;
        root.querySelector("#skyChart").setAttribute("aria-label", `Star chart for ${figure.constellation}. ${figure.hint}`);
      }
      if (changed && lastCon !== null) root.querySelector("#skyAnnounce").textContent = `Now over ${r.constellation.name}. ${r.summary}`;
      lastCon = r.constellation.name;
    }
    if (r.summary !== lastSummary) { dial.setAttribute("aria-label", `Sky dial. ${r.summary}`); lastSummary = r.summary; }
    updateReadout(r);
  }

  function schedule() { if (!frame && visible) frame = requestAnimationFrame(() => draw()); }

  function updateReadout(r) {
    const set = (id, text) => { const el = root.querySelector(id); if (el && el.textContent !== text) el.textContent = text; };
    set("#rowBearing", `${Math.round(shown.azimuth) % 360}° ${compass(shown.azimuth)}`);
    set("#rowAltitude", `${Math.round(shown.altitude)}° above the horizon`);
    set("#rowSign", `${r.sign.glyph} ${r.sign.name}`);
    set("#rowCon", r.constellation.name);
    set("#rowGap", r.summary);
    const az = root.querySelector("#skyAz");
    if (az && document.activeElement !== az) az.value = String(Math.round(state.azimuth) % 360);
  }

  function renderPanel() {
    const where = usingSensors && state.located === false
      ? `<p class="sky-note">Location is off, so the sky is worked out for ${esc(place.label)}.</p>` : "";
    const manual = usingSensors ? "" : `
      <div class="sky-manual">
        <label class="plate-label" for="skyAz">Bearing — Drag to Sweep</label>
        <input type="range" id="skyAz" min="0" max="359" step="1" value="${Math.round(state.azimuth)}">
        <label class="plate-label" for="skyAlt">Altitude</label>
        <input type="range" id="skyAlt" min="0" max="89" step="1" value="${Math.round(state.altitude)}">
      </div>`;
    const placeField = usingSensors && state.located !== false ? "" : `
      <div class="sky-place">
        <label for="skyPlace">Observing from</label>
        <input id="skyPlace" type="text" autocomplete="off" spellcheck="false" value="${esc(place.label)}"
          role="combobox" aria-autocomplete="list" aria-expanded="false" aria-controls="skyPlaces">
        <ul id="skyPlaces" role="listbox" hidden></ul>
      </div>`;
    root.querySelector("#skyPanel").innerHTML = `
      <div class="sky-row"><span class="plate-label">Bearing</span><span class="v" id="rowBearing"></span></div>
      <div class="sky-row"><span class="plate-label">Altitude</span><span class="v" id="rowAltitude"></span></div>
      <div class="sky-row"><span class="plate-label">Sign</span><span class="v" id="rowSign"></span></div>
      <div class="sky-row"><span class="plate-label">Constellation</span><span class="v" id="rowCon"></span></div>
      <div class="sky-row sky-gap"><span class="plate-label">The Gap</span><span class="v" id="rowGap"></span></div>
      ${manual}${placeField}${where}
      ${note ? `<p class="sky-note">${esc(note)}</p>` : ""}
      <button type="button" class="metal-button" id="skyToggle">${usingSensors ? "Back to the Sliders" : "Use My Device's Sensors"}</button>`;

    const az = root.querySelector("#skyAz"), alt = root.querySelector("#skyAlt");
    const label = () => az?.setAttribute("aria-valuetext", `${az.value} degrees, ${compass(+az.value)}`);
    az?.addEventListener("input", () => { state.azimuth = +az.value; label(); schedule(); });
    alt?.addEventListener("input", () => { state.altitude = +alt.value; alt.setAttribute("aria-valuetext", `${alt.value} degrees above the horizon`); schedule(); });
    label();
    root.querySelector("#skyToggle").addEventListener("click", toggle);
    wirePlace();
    updateReadout(current());
  }

  async function toggle() {
    if (usingSensors) {
      sensors.stop(); usingSensors = false; note = ""; store.set(SENSORS_KEY, "0");
      state.latitude = place.latitude; state.longitude = place.longitude;
      renderPanel(); schedule();
      return;
    }
    await startSensors(true);
  }

  async function startSensors(fromTap) {
    const button = root.querySelector("#skyToggle");
    if (button) button.disabled = true;
    const problem = await sensors.start({ fromTap });
    if (button) button.disabled = false;
    if (problem === null && sensors.on) {
      usingSensors = true; note = ""; store.set(SENSORS_KEY, "1");
    } else if (problem) {
      // A quiet resume that fails says nothing: the visitor didn't ask.
      usingSensors = false; if (fromTap) note = problem;
    }
    renderPanel(); schedule();
  }

  function wirePlace() {
    const input = root.querySelector("#skyPlace"), list = root.querySelector("#skyPlaces");
    if (!input) return;
    let seq = 0, timer = 0;
    input.addEventListener("input", () => {
      clearTimeout(timer);
      timer = setTimeout(async () => {
        const mine = ++seq;
        if ((await loadPlaces()) === null) return;
        const hits = await searchPlaces(input.value, 6);
        if (mine !== seq) return;
        list.innerHTML = "";
        for (const h of hits ?? []) {
          const li = document.createElement("li");
          const b = document.createElement("button");
          b.type = "button"; b.setAttribute("role", "option"); b.textContent = h.label;
          b.addEventListener("click", () => {
            place = { label: h.label, latitude: h.latitude, longitude: h.longitude };
            store.set(PLACE_KEY, JSON.stringify(place));
            state.latitude = place.latitude; state.longitude = place.longitude;
            input.value = h.label; list.hidden = true; input.setAttribute("aria-expanded", "false");
            schedule();
          });
          li.append(b); list.append(li);
        }
        list.hidden = !list.children.length;
        input.setAttribute("aria-expanded", String(!list.hidden));
      }, 150);
    });
    input.addEventListener("keydown", (e) => {
      if (e.key === "Escape") { list.hidden = true; input.setAttribute("aria-expanded", "false"); }
      if (e.key === "ArrowDown") { list.querySelector("button")?.focus(); e.preventDefault(); }
    });
  }

  renderPanel();
  new ResizeObserver(() => { if (visible) draw({ redrawChart: true }); }).observe(dial);
  window.addEventListener(EVENT, () => { if (visible) draw({ redrawChart: true }); });

  return {
    /** The tab came into view. */
    show() {
      visible = true;
      state.now = new Date();
      draw({ redrawChart: true });
      // The sky turns whether or not you move.
      clearInterval(tick);
      tick = setInterval(() => { state.now = new Date(); schedule(); }, 30000);
      // Sensors resume by themselves where no tap is needed to ask.
      if (!usingSensors && store.get(SENSORS_KEY) === "1" && (!Sensors.needsTap() || sensors.granted)) startSensors(false);
    },
    /** The tab went out of view: stop listening, so nothing runs unseen. */
    hide() {
      visible = false;
      clearInterval(tick);
      cancelAnimationFrame(frame); frame = 0;
      if (usingSensors) { sensors.stop(); usingSensors = false; renderPanel(); }
    },
  };
}

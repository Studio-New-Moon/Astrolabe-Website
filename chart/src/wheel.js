// The chart as an instrument, drawn as SVG.
//
// Follows the same four layers `AstrolabeWheel.swift` draws, in the same
// order, because the stack is what explains the astrology: houses are cut into
// the fixed limb because they belong to where you were born and never move;
// the plate below carries the sky as it falls over one particular latitude;
// and the rete above turns, carrying the zodiac. Which sign meets which house
// is a consequence of the geometry rather than a convention — and it comes out
// different for everyone.
//
// SVG rather than a bitmap because the same drawing has to serve a preview on
// screen and a print at 300 DPI, and vectors have no resolution. Gelato's
// Order v4 API accepts SVG directly.
//
// NOTE FOR PRINT: glyphs here are `<text>` in a font stack. That is right for
// the web and wrong for a print file — a printer's RIP has no opinion about
// which serif we meant. Anything sent to Gelato must have its text converted
// to paths first.

import {
  capricornRadius, cancerRadius, almucantar, retePoint, ecliptic,
} from "./projection.js";
import { SIGNS, normalizedDegrees, signIndex } from "./angles.js";

const D2R = Math.PI / 180;

// The site's own palette, so a chart on the page belongs to the page.
export const BRASS = {
  ground: "#14100A",
  plate: "#090B1C",
  limb: "#1B1206",
  line: "#3A2C12",
  brass: "#B8963F",
  bright: "#E8C87A",
  resist: "#F3E6C4",
  muted: "#9A8A66",
};

// U+FE0E, the text presentation selector.
//
// Without it several of these are emoji by default — Scorpio, Sagittarius and
// the rest arrive as coloured squares on most systems, because the same code
// points serve as zodiac emoji. An engraved brass instrument with emoji cut
// into the limb is not the look, and a printer's RIP would embed whatever it
// found. Appending FE0E asks explicitly for the text glyph.
const TEXT = "\uFE0E";
const SIGN_GLYPHS = ["♈","♉","♊","♋","♌","♍","♎","♏","♐","♑","♒","♓"].map((c) => c + TEXT);
const PLANET_GLYPHS = Object.fromEntries(Object.entries({
  sun: "☉", moon: "☽", mercury: "☿", venus: "♀", mars: "♂",
  jupiter: "♃", saturn: "♄", uranus: "♅", neptune: "♆", pluto: "♇",
}).map(([k, v]) => [k, v + TEXT]));
const ROMAN = ["I","II","III","IV","V","VI","VII","VIII","IX","X","XI","XII"];

/** The radii the whole drawing is scaled from, as in `AstrolabeWheel.Geometry`. */
export function geometry(size) {
  const mater = size * 0.42;
  const limbInner = mater * 0.84;
  const plate = limbInner * 0.97;
  return {
    size,
    c: size / 2,
    mater,
    limbInner,
    plate,
    // The equator radius every projected circle is scaled against.
    equator: plate / capricornRadius(1),
    hub: size * 0.15,
  };
}

const n = (v) => Number(v.toFixed(3));
const pt = (g, r, aDeg) => {
  const a = aDeg * D2R;
  return [n(g.c + r * Math.cos(a)), n(g.c - r * Math.sin(a))];
};
const circle = (cx, cy, r, attrs) =>
  `<circle cx="${n(cx)}" cy="${n(cy)}" r="${n(r)}" ${attrs}/>`;

/**
 * House I begins at the left horizon and runs *downward* from it, so houses
 * I–VI are below the horizon and VII–XII above: the IC at the bottom of the
 * wheel, the midheaven at the top.
 *
 * The negation is the whole subtlety, and `AstrolabeWheel.swift` carries the
 * same warning. Swift draws the limb in screen coordinates, where y grows
 * downward, and adds the house offset; `pt()` here works in the ordinary
 * mathematical frame with y up, because that is what the rete points want.
 * The two conventions are opposite, so the house angles have to be negated to
 * mean the same thing. Without it the wheel renders mirrored: IV at the top
 * and X at the bottom, which is the chart upside down — and it still looks
 * entirely plausible, which is why this is a comment rather than a one-liner.
 */
const houseStartAngle = (h) => -(180 - (h - 1) * 30);
const houseMidAngle = (h) => -(180 - (h - 0.5) * 30);

/**
 * Draw the chart.
 *
 * `chart` is { ascendantLongitude, midheavenLongitude, latitude, bodies },
 * where each body is { name, longitude, retrograde }.
 */
export function wheelSVG(chart, { size = 1000, title = "" } = {}) {
  const g = geometry(size);
  const lat = chart.latitude;

  // The whole rete turns so the ascendant sits on the left horizon, where
  // convention puts it.
  const ascAngle = retePoint(chart.ascendantLongitude, 0, 1).angle;
  const screenAngle = (reteAngle) => reteAngle - ascAngle + 180;
  const atLongitude = (lon, scale = 1) => {
    const p = retePoint(lon, 0, g.equator * scale);
    return pt(g, p.radius, screenAngle(p.angle));
  };

  const out = [];
  out.push(
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${size} ${size}" ` +
    `width="${size}" height="${size}" role="img" aria-label="${esc(title || "Birth chart")}">`,
  );
  out.push(`<defs>
    <radialGradient id="materFace" cx="38%" cy="32%" r="78%">
      <stop offset="0%" stop-color="#4A3A18"/><stop offset="55%" stop-color="#2B2110"/>
      <stop offset="100%" stop-color="#150F07"/>
    </radialGradient>
    <radialGradient id="plateFace" cx="42%" cy="34%" r="80%">
      <stop offset="0%" stop-color="#141A33"/><stop offset="100%" stop-color="#06080F"/>
    </radialGradient>
  </defs>`);
  out.push(`<rect width="${size}" height="${size}" fill="${BRASS.ground}"/>`);

  // ---- the mater: the fixed body, and the limb the houses are cut into ----
  out.push(circle(g.c, g.c, g.mater, `fill="url(#materFace)" stroke="${BRASS.brass}" stroke-width="${n(size*0.0035)}"`));
  out.push(circle(g.c, g.c, g.limbInner, `fill="none" stroke="${BRASS.line}" stroke-width="${n(size*0.0016)}"`));

  const limbMid = (g.mater + g.limbInner) / 2;
  for (let h = 1; h <= 12; h++) {
    const a = houseStartAngle(h);
    const [x1, y1] = pt(g, g.limbInner, a);
    const [x2, y2] = pt(g, g.mater, a);
    // The four angles are cut deeper than the ordinary house divisions,
    // because they are the chart's own axes rather than just its twelfths.
    const cardinal = h === 1 || h === 4 || h === 7 || h === 10;
    out.push(
      `<line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" ` +
      `stroke="${cardinal ? BRASS.bright : BRASS.brass}" ` +
      `stroke-width="${n(size * (cardinal ? 0.0034 : 0.0016))}"/>`,
    );
    const [tx, ty] = pt(g, limbMid, houseMidAngle(h));
    out.push(
      `<text x="${tx}" y="${ty}" fill="${BRASS.bright}" font-size="${n(size*0.026)}" ` +
      `font-family="Cinzel, Georgia, serif" text-anchor="middle" dominant-baseline="central" ` +
      `opacity="0.85">${ROMAN[h-1]}</text>`,
    );
  }

  // ---- the plate: the sky over one latitude, and nobody else's ----
  out.push(`<g>`);
  out.push(circle(g.c, g.c, g.plate, `fill="url(#plateFace)"`));
  out.push(`<clipPath id="plateClip"><circle cx="${n(g.c)}" cy="${n(g.c)}" r="${n(g.plate)}"/></clipPath>`);
  out.push(`<g clip-path="url(#plateClip)">`);

  // the three reference circles every plate carries
  for (const r of [g.plate, g.equator, cancerRadius(g.equator)]) {
    out.push(circle(g.c, g.c, r, `fill="none" stroke="${BRASS.brass}" stroke-opacity="0.45" stroke-width="${n(size*0.0009)}"`));
  }

  // Almucantars — circles of equal altitude, thinning as they climb. `offset`
  // runs toward the zenith and screen y grows downward, so it is subtracted.
  for (let alt = 15; alt <= 75; alt += 15) {
    const a = almucantar(alt, lat, g.equator);
    if (!a) continue;
    const fade = 0.34 - (alt / 75) * 0.16;
    out.push(circle(g.c, g.c - a.offset, a.radius,
      `fill="none" stroke="${BRASS.muted}" stroke-opacity="${n(fade)}" stroke-width="${n(size*0.0006)}"`));
  }
  // The horizon itself, heavier, because it is the line a plate exists to carry.
  const hz = almucantar(0, lat, g.equator);
  if (hz) {
    out.push(circle(g.c, g.c - hz.offset, hz.radius,
      `fill="none" stroke="${BRASS.resist}" stroke-opacity="0.85" stroke-width="${n(size*0.0018)}"`));
  }
  out.push(`</g></g>`);

  // ---- the rete: the part that turns, carrying the zodiac ----
  const e = ecliptic(g.equator);
  const turn = (-ascAngle + 180) * D2R;
  const ringCx = g.c + e.offset * Math.cos(turn - Math.PI / 2);
  const ringCy = g.c - e.offset * Math.sin(turn - Math.PI / 2);
  out.push(circle(ringCx, ringCy, e.radius,
    `fill="none" stroke="${BRASS.brass}" stroke-width="${n(size*0.009)}" stroke-opacity="0.92"`));
  out.push(circle(ringCx, ringCy, e.radius,
    `fill="none" stroke="${BRASS.bright}" stroke-width="${n(size*0.0012)}" stroke-opacity="0.5"`));

  // Sign divisions, struck across the ring's width at each 30°, and the glyph
  // set just inside it.
  for (let s = 0; s < 12; s++) {
    const lon = s * 30;
    const [ix, iy] = atLongitude(lon, 0.965);
    const [ox, oy] = atLongitude(lon, 1.035);
    out.push(`<line x1="${ix}" y1="${iy}" x2="${ox}" y2="${oy}" stroke="${BRASS.resist}" stroke-width="${n(size*0.0014)}" stroke-opacity="0.7"/>`);
    const [gx, gy] = atLongitude(lon + 15, 0.90);
    out.push(
      `<text x="${gx}" y="${gy}" fill="${BRASS.bright}" font-size="${n(size*0.030)}" ` +
      `font-family="Georgia, 'Times New Roman', serif" font-variant-emoji="text" text-anchor="middle" dominant-baseline="central">${SIGN_GLYPHS[s]}</text>`,
    );
  }

  // ---- the bodies, as studs on the rete ----
  //
  // Labels sit radially *inside* the ecliptic band, measured from the ring's
  // own centre rather than the plate's — the ring is off-centre, so a label
  // pushed from the plate's middle drifts off the band it belongs to.
  //
  // Inward, because outward is where the limb is. The ring runs close to the
  // limb on the ascendant side, so labels pushed out collide with the Roman
  // numerals cut into it — and a stellium, which needs the most room, is
  // exactly what pushes furthest. Inside the ring is plate: dark, and carrying
  // nothing but almucantars a glyph can sit over.
  //
  // Then they are spread. A stellium is not a drawing problem to be avoided:
  // three planets inside a few degrees is a real and meaningful thing for the
  // chart to say, and the drawing has to say it legibly. Bodies are walked in
  // ring order and any label closer than the minimum separation to the one
  // before is pushed further out, cascading, with a leader line back to its
  // own stud so no glyph is ever orphaned from the mark it names.
  // Points ride the rete alongside the planets, and are labelled the same way,
  // but struck smaller: a node is not a body, and the drawing should not imply
  // it is one.
  const bodies = [...(chart.bodies ?? []), ...(chart.points ?? [])];
  if (bodies.length) {
    const placed = bodies.map((b) => {
      const [x, y] = atLongitude(b.longitude);
      const vx = x - ringCx, vy = y - ringCy;
      const len = Math.hypot(vx, vy) || 1;
      return {
        body: b, x, y,
        nx: -vx / len, ny: -vy / len,
        // Angle around the ring, for ordering and for separation.
        theta: Math.atan2(-vy, vx),
      };
    });
    placed.sort((a, b) => a.theta - b.theta);

    const base = size * 0.036;         // clear of the band
    const step = size * 0.030;         // one label's height
    const minGap = size * 0.042;       // how close two labels may sit
    for (let i = 0; i < placed.length; i++) {
      placed[i].out = base;
      // Compare against every label already placed, not just the previous
      // one: the ring wraps, and three bodies within a few degrees each need
      // clearing the two before them rather than only the last.
      let bumped = true, guard = 0;
      while (bumped && guard++ < 24) {
        bumped = false;
        const px = placed[i].x + placed[i].nx * placed[i].out;
        const py = placed[i].y + placed[i].ny * placed[i].out;
        for (let j = 0; j < i; j++) {
          const qx = placed[j].x + placed[j].nx * placed[j].out;
          const qy = placed[j].y + placed[j].ny * placed[j].out;
          if (Math.hypot(px - qx, py - qy) < minGap) {
            placed[i].out += step;
            bumped = true;
            break;
          }
        }
      }
    }

    for (const p of placed) {
      const lx = p.x + p.nx * p.out;
      const ly = p.y + p.ny * p.out;
      // Leader from the stud to a displaced label.
      out.push(
        `<line x1="${n(p.x + p.nx * size * 0.012)}" y1="${n(p.y + p.ny * size * 0.012)}" ` +
        `x2="${n(lx - p.nx * size * 0.016)}" y2="${n(ly - p.ny * size * 0.016)}" ` +
        `stroke="${BRASS.brass}" stroke-width="${n(size * 0.0012)}" stroke-opacity="0.55"/>`,
      );
      const minor = p.body.isPoint === true;
      out.push(circle(p.x, p.y, size * (minor ? 0.0068 : 0.010),
        `fill="${minor ? BRASS.brass : BRASS.bright}" stroke="${BRASS.ground}" ` +
        `stroke-width="${n(size * 0.0016)}"`));
      out.push(
        `<text x="${n(lx)}" y="${n(ly)}" fill="${BRASS.resist}" font-size="${n(size * 0.026)}" ` +
        `font-family="Georgia, 'Times New Roman', serif" font-variant-emoji="text" ` +
        `text-anchor="middle" dominant-baseline="central">` +
        `${p.body.glyph ?? PLANET_GLYPHS[p.body.name] ?? "?"}` +
        `${p.body.retrograde ? `<tspan font-size="${n(size * 0.015)}" dy="${n(-size * 0.006)}">℞</tspan>` : ""}` +
        `</text>`,
      );
    }
  }

  // ---- the rule: the ascendant–descendant axis, and the meridian ----
  const axis = (lon, color, width) => {
    const [x1, y1] = atLongitude(lon, 1.04);
    const [x2, y2] = atLongitude(normalizedDegrees(lon + 180), 1.04);
    out.push(`<line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" stroke="${color}" stroke-width="${n(width)}" stroke-opacity="0.75"/>`);
  };
  axis(chart.ascendantLongitude, BRASS.resist, size * 0.0022);
  axis(chart.midheavenLongitude, BRASS.brass, size * 0.0016);

  // the hub the rule turns on
  out.push(circle(g.c, g.c, size * 0.016, `fill="${BRASS.brass}" stroke="${BRASS.bright}" stroke-width="${n(size*0.0018)}"`));
  out.push(circle(g.c, g.c, size * 0.006, `fill="${BRASS.ground}"`));

  out.push(`</svg>`);
  return out.join("\n");
}

function esc(s) {
  return String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

/** Convenience: the label form the app uses, "7° Capricorn". */
export function placementLabel(longitude) {
  return `${Math.floor(normalizedDegrees(longitude) % 30)}° ${SIGNS[signIndex(longitude)]}`;
}

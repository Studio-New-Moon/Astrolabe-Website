// The app's Wheel style (ChartWheel.swift), as SVG.
//
// The instrument is the truthful object; this is the readable one. Twelve
// whole-sign houses tinted by element, the ascendant's sign on the left
// horizon, brass studs for the planets and points (spread outward where they
// crowd, as the app spreads them), aspect lines between the planets, the four
// angles ticked on the rim, and the rising sign in the hub.
//
// Every proportion below is the app's, as a share of the wheel's size `s`,
// drawn on a 1000-unit square so it scales with its container.

import { SIGNS, ROMAN, PLANET_NAMES, PLANET_GLYPHS, POINT_INFO, ANGLE_INFO, matchAspect, signAt } from "./lore.js";
import { moonApsideGlyph } from "./icons.js";

const S = 1000;
const C = S / 2;
const norm = (d) => ((d % 360) + 360) % 360;
const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));

/**
 * `chart`: { asc, bodies: [{name, longitude, retrograde}], points: [...], angles: [{kind, longitude}] }
 * `opts`: { selectedHouse, selectedPlanet, selectedPoint, showAspects, sunSign }
 */
export function chartWheelSVG(chart, opts = {}) {
  const s = S;
  const outer = s / 2 - 2;
  const inner = outer * 0.44;
  const ascSign = signAt(chart.asc);
  const angleFor = (lon) => 180 + norm(lon - ascSign.index * 30);
  const at = (lon, r) => {
    const a = angleFor(lon) * Math.PI / 180;
    return { x: C + r * Math.cos(a), y: C - r * Math.sin(a) };
  };
  const polar = (deg, r) => {
    const a = deg * Math.PI / 180;
    return { x: C + r * Math.cos(a), y: C - r * Math.sin(a) };
  };

  const out = [];
  out.push(`<svg class="chart-wheel" viewBox="0 0 ${s} ${s}" xmlns="http://www.w3.org/2000/svg" role="group" aria-label="Chart wheel">`);
  out.push(`<defs>
    <linearGradient id="cwSpun" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0" stop-color="var(--metal-spec, #FDF1CD)"/><stop offset=".22" stop-color="var(--bright)"/>
      <stop offset=".5" stop-color="var(--brass)"/><stop offset=".78" stop-color="var(--metal-deep, #6D5424)"/>
      <stop offset="1" stop-color="var(--bright)"/>
    </linearGradient>
    <radialGradient id="cwStud" cx=".36" cy=".32" r=".75">
      <stop offset="0" stop-color="#FDF1CD"/><stop offset=".35" stop-color="var(--bright)"/>
      <stop offset=".75" stop-color="var(--brass)"/><stop offset="1" stop-color="#5A4520"/>
    </radialGradient>
  </defs>`);

  // Houses.
  for (let h = 1; h <= 12; h++) {
    const sign = SIGNS[(ascSign.index + h - 1) % 12];
    const a0 = 180 + (h - 1) * 30, a1 = a0 + 30;
    const lit = opts.selectedHouse === h;
    const p0 = polar(a0, outer), p1 = polar(a1, outer), q1 = polar(a1, inner), q0 = polar(a0, inner);
    // Angles grow anticlockwise on screen, which is SVG's sweep-flag 0.
    const d = `M${p0.x},${p0.y} A${outer},${outer} 0 0 0 ${p1.x},${p1.y} L${q1.x},${q1.y} A${inner},${inner} 0 0 1 ${q0.x},${q0.y} Z`;
    const mid = (a0 + a1) / 2;
    const label = polar(mid, (outer + inner) / 2 * 0.74);
    out.push(`<g class="cw-house" role="button" tabindex="0" data-house="${h}" aria-label="House ${ROMAN[h - 1]}, ${sign.name}"${lit ? ' aria-pressed="true"' : ""}>` +
      `<path d="${d}" fill="var(--el-${sign.element})" fill-opacity="${lit ? 0.5 : 0.24}" stroke="var(--brass)" stroke-opacity="${lit ? 0.9 : 0.35}" stroke-width="${lit ? 4.7 : 2.1}"/>` +
      `<text x="${label.x}" y="${label.y - s * 0.004}" text-anchor="middle" font-size="${s * 0.048}" fill="var(--resist)" class="cw-glyph">${sign.glyph}</text>` +
      `<text x="${label.x}" y="${label.y + s * 0.034}" text-anchor="middle" font-size="${s * 0.026}" font-weight="600" fill="var(--brass)" class="cw-body">${ROMAN[h - 1]}</text>` +
      `</g>`);
  }

  // Studs, spread outward where they crowd (ChartWheel.spread).
  const studR = (outer + inner) / 2 * 1.06;
  const subjects = [
    ...chart.bodies.map((b) => ({ ...b, kind: "planet" })),
    ...chart.points.map((p) => ({ ...p, kind: "point" })),
  ].sort((a, b) => norm(a.longitude) - norm(b.longitude));
  const maxR = s / 2 - s * 0.072 / 2;
  const studs = [];
  for (let i = 0; i < subjects.length;) {
    let j = i + 1;
    while (j < subjects.length && norm(subjects[j].longitude) - norm(subjects[j - 1].longitude) < 9) j++;
    subjects.slice(i, j).forEach((p, k) => {
      studs.push({ p, pos: at(p.longitude, Math.min(studR + k * s * 0.055, maxR)) });
    });
    i = j;
  }

  // Aspect lines, under the ring and the studs.
  if (opts.showAspects) {
    const ps = chart.bodies;
    for (let i = 0; i < ps.length; i++) {
      for (let j = i + 1; j < ps.length; j++) {
        const m = matchAspect(ps[i].longitude, ps[j].longitude);
        if (!m) continue;
        const a = at(ps[i].longitude, studR), b = at(ps[j].longitude, studR);
        const tight = 1 - Math.min(m.orb / m.kind.orb, 1);
        const hard = m.kind.id === "square" || m.kind.id === "opposition";
        const easy = m.kind.id === "sextile" || m.kind.id === "trine";
        const w = (hard ? 1.2 : 0.85) * 2.6;
        const dash = easy ? ` stroke-dasharray="${4 * 2.6} ${3 * 2.6}"` : "";
        out.push(`<line x1="${a.x}" y1="${a.y}" x2="${b.x}" y2="${b.y}" stroke="#000" stroke-opacity="${0.3 + tight * 0.3}" stroke-width="${w + 2.9}"${dash}/>`);
        out.push(`<line x1="${a.x}" y1="${a.y}" x2="${b.x}" y2="${b.y}" stroke="var(--brass)" stroke-opacity="${0.35 + tight * 0.55}" stroke-width="${w}"${dash}/>`);
      }
    }
  }

  // The rim.
  out.push(`<circle cx="${C}" cy="${C}" r="${outer - 6.5}" fill="none" stroke="url(#cwSpun)" stroke-width="13"/>`);

  const d = s * 0.072;
  for (const { p, pos } of studs) {
    const isPlanet = p.kind === "planet";
    const lit = isPlanet ? opts.selectedPlanet === p.name : opts.selectedPoint === p.name;
    const name = isPlanet ? PLANET_NAMES[p.name] : POINT_INFO[p.name].name;
    const sign = signAt(p.longitude);
    const deg = Math.round(norm(p.longitude) % 30);
    const house = ((signAt(p.longitude).index - ascSign.index + 12) % 12) + 1;
    const glyph = isPlanet ? PLANET_GLYPHS[p.name] : POINT_INFO[p.name].glyph;
    const apside = p.name === "blackMoonLilith" || p.name === "whiteMoonSelena";
    const glyphMark = apside
      ? `<g transform="translate(${pos.x - d * 0.3},${pos.y - d * 0.3})" color="#1A1408"><g transform="scale(${(d * 0.6) / 24})">${moonApsideGlyph(p.name === "blackMoonLilith", 24).replace(/^<svg[^>]*>|<\/svg>$/g, "")}</g></g>`
      : `<text x="${pos.x}" y="${pos.y + d * 0.19}" text-anchor="middle" font-size="${d * 0.52}" fill="var(--on-metal)" class="cw-glyph">${glyph}</text>`;
    out.push(`<g class="cw-stud" role="button" tabindex="0" data-${p.kind}="${p.name}"` +
      ` aria-label="${esc(name)} at ${deg}° ${sign.name}${p.retrograde ? " ℞" : ""}, House ${ROMAN[house - 1]}"${lit ? ' aria-pressed="true"' : ""}>` +
      `<circle cx="${pos.x}" cy="${pos.y + 3}" r="${d / 2}" fill="#000" opacity=".35"/>` +
      `<circle cx="${pos.x}" cy="${pos.y}" r="${d / 2}" fill="url(#cwStud)" stroke="${lit ? "var(--bright)" : "#3D2F14"}" stroke-width="${lit ? 5 : 1.6}"/>` +
      `<circle cx="${pos.x}" cy="${pos.y}" r="${d / 2 - 5}" fill="none" stroke="#3D2F14" stroke-opacity=".35" stroke-width="1.4"/>` +
      glyphMark + `</g>`);
  }

  // The four angles: a tick on the rim and a capsule label, nudged clear of studs.
  const clearance = s * 0.075;
  for (const a of chart.angles) {
    const rad = angleFor(a.longitude);
    const from = polar(rad, outer * 0.95), to = polar(rad, outer);
    let cand = rad, lp = polar(cand, outer * 0.885), step = 1;
    while (studs.some(({ pos }) => Math.hypot(pos.x - lp.x, pos.y - lp.y) < clearance) && step <= 8) {
      const deg = 6 * Math.floor((step + 1) / 2) * (step % 2 === 0 ? -1 : 1);
      cand = rad + deg;
      lp = polar(cand, outer * 0.885);
      step++;
    }
    const abbr = ANGLE_INFO[a.kind].abbreviation;
    const fs = s * 0.024, w = abbr.length * fs * 0.72 + 21;
    out.push(`<g aria-hidden="true"><line x1="${from.x}" y1="${from.y}" x2="${to.x}" y2="${to.y}" stroke="var(--bright)" stroke-width="5.3"/>` +
      `<rect x="${lp.x - w / 2}" y="${lp.y - fs * 0.85}" width="${w}" height="${fs * 1.7}" rx="${fs * 0.85}" fill="var(--ground)" fill-opacity=".85"/>` +
      `<text x="${lp.x}" y="${lp.y + fs * 0.36}" text-anchor="middle" font-size="${fs}" font-weight="600" fill="var(--bright)" class="cw-body">${abbr}</text></g>`);
  }

  // The hub.
  const sunSign = opts.sunSign ?? "";
  out.push(`<g aria-hidden="true"><circle cx="${C}" cy="${C}" r="${inner}" fill="var(--ground)"/>` +
    `<circle cx="${C}" cy="${C}" r="${inner - 2.6}" fill="none" stroke="url(#cwSpun)" stroke-width="5.3" opacity=".7"/>` +
    `<text x="${C}" y="${C - s * 0.05}" text-anchor="middle" font-size="${s * 0.029}" font-weight="600" letter-spacing="${s * 0.0042}" fill="var(--brass)" class="cw-body">RISING</text>` +
    `<text x="${C}" y="${C + s * 0.02}" text-anchor="middle" font-size="${s * 0.055}" font-weight="500" fill="var(--resist)" class="cw-display">${ascSign.glyph} ${ascSign.name}</text>` +
    `<text x="${C}" y="${C + s * 0.07}" text-anchor="middle" font-size="${s * 0.027}" fill="var(--muted)" class="cw-body">${Math.round(norm(chart.asc) % 30)}° · Sun in ${esc(sunSign)}</text></g>`);

  out.push(`</svg>`);
  return out.join("");
}

// Chart in Motion's own instrument, drawn for animation.
//
// Deliberately separate from the chart wheel (`chart/src/wheel.js`): that one
// is a still drawing made once, at print resolution, and sizes everything as a
// fraction of the wheel. Played at 60 frames a second on a phone, fractions of
// a 340-pixel wheel come out at nine pixels and pile on top of each other. So
// this one is built the other way round:
//
// - Glyphs are sized in screen pixels and the instrument is fitted around
//   them, not the reverse. A phone gets a smaller plate, never smaller type.
// - The rim, the plate and the band are drawn once per size; a frame only
//   moves what moved, by setting attributes on elements that already exist.
// - The rete carries a band with the zodiac in it. Your birth chart sits
//   inside the band and the moving sky outside it, so the two sets never
//   compete for one track.
// - Labels are spread along their track by a small relaxation each frame, and
//   joined to their true position by a leader when pushed off it.
//
// It shares the astronomy (projection.js) with the chart wheel, and nothing
// else, so a planet lands on the same degree in both.

import { capricornRadius, cancerRadius, almucantar, retePoint, ecliptic } from "../../chart/src/projection.js";

const D2R = Math.PI / 180;
const TAU = Math.PI * 2;
const NS = "http://www.w3.org/2000/svg";
const VIEW = 1000;
const C = VIEW / 2;
const TEXT = "︎";
const MIN_STAGE_PX = 300;

const INK = {
  ground: "#14100A", limb: "#1B1206", line: "#3A2C12", brass: "#B8963F",
  bright: "#E8C87A", resist: "#F3E6C4", muted: "#9A8A66", band: "#2A200F",
};
const SIGN_GLYPHS = ["♈","♉","♊","♋","♌","♍","♎","♏","♐","♑","♒","♓"].map((c) => c + TEXT);
const ROMAN = ["I","II","III","IV","V","VI","VII","VIII","IX","X","XI","XII"];
const SERIF = "Georgia, 'Times New Roman', serif";

function el(tag, attrs, parent) {
  const e = document.createElementNS(NS, tag);
  set(e, attrs);
  if (parent) parent.appendChild(e);
  return e;
}
function set(e, attrs) {
  for (const k in attrs) e.setAttribute(k, typeof attrs[k] === "number" ? +attrs[k].toFixed(2) : attrs[k]);
}
/** A point in the plate's frame: angle in radians, counter-clockwise, y up. */
const polar = (cx, cy, r, aRad) => [cx + r * Math.cos(aRad), cy - r * Math.sin(aRad)];
const wrap = (a) => ((a % TAU) + TAU) % TAU;

// House I begins at the left horizon and runs downward, as in the app's
// wheel: I–VI below the horizon, VII–XII above.
const houseStart = (h) => -(180 - (h - 1) * 30) * D2R;
const houseMid = (h) => -(180 - (h - 0.5) * 30) * D2R;

/**
 * Spread labels round a circle so no two sit closer than `gap` radians.
 * Starts from the true angles every frame, so the result is a function of
 * where the planets are rather than of where the labels were last frame.
 */
export function spread(angles, gap) {
  const n = angles.length;
  if (n < 2) return angles.slice();
  gap = Math.min(gap, (TAU / n) * 0.98);
  const order = angles.map((a, i) => [wrap(a), i]).sort((x, y) => x[0] - y[0]);
  const pos = order.map((o) => o[0]);
  for (let it = 0; it < 60; it++) {
    let moved = false;
    for (let i = 0; i < n; i++) {
      const j = (i + 1) % n;
      const d = pos[j] - pos[i] + (j === 0 ? TAU : 0);
      if (d < gap - 1e-9) {
        const push = (gap - d) / 2;
        pos[i] -= push;
        pos[j] += push;
        moved = true;
      }
    }
    if (!moved) break;
  }
  const out = new Array(n);
  order.forEach((o, k) => { out[o[1]] = pos[k]; });
  return out;
}

export function createMotionWheel(svg) {
  set(svg, { viewBox: `0 0 ${VIEW} ${VIEW}` });
  svg.replaceChildren();
  const defs = el("defs", {}, svg);
  defs.innerHTML = `
    <radialGradient id="mwMater" cx="38%" cy="32%" r="78%">
      <stop offset="0%" stop-color="#4A3A18"/><stop offset="55%" stop-color="#2B2110"/><stop offset="100%" stop-color="#150F07"/>
    </radialGradient>
    <radialGradient id="mwPlate" cx="42%" cy="34%" r="80%">
      <stop offset="0%" stop-color="#141A33"/><stop offset="100%" stop-color="#06080F"/>
    </radialGradient>`;
  const clip = el("clipPath", { id: "mwClip" }, defs);
  const clipCircle = el("circle", { cx: C, cy: C, r: 1 }, clip);

  const layer = (name, attrs = {}) => el("g", { "data-layer": name, ...attrs }, svg);
  const rim = layer("rim");
  const plate = layer("plate");
  const clipped = layer("clipped", { "clip-path": "url(#mwClip)" });
  const lines = el("g", {}, clipped);
  const axes = el("g", {}, clipped);
  const band = layer("band");
  const leaders = layer("leaders");
  const natalLayer = layer("natal");
  const skyLayer = layer("sky");
  const hub = layer("hub");

  let g = null;           // the sizes, in viewBox units, for the current stage
  let latitude = 0;
  const pools = { natal: new Map(), sky: new Map(), lines: [] };

  // ---- sizes, fitted around legible type ----
  function measure(stagePx) {
    // Pixel minimums only hold on a stage with room for them. Below about
    // 200px, 15px glyphs leave no plate at all and every radius goes negative,
    // so a narrower stage is sized as if it were 300px and simply drawn
    // smaller: small type rather than a broken instrument.
    const k = VIEW / Math.max(stagePx, MIN_STAGE_PX);  // viewBox units per CSS pixel
    const u = (px, floor) => Math.max(px * k, floor);  // at least `px` on screen
    // Floors in viewBox units let type grow with a large wheel (about 21px on
    // a 660px stage) while the pixel minimums hold it legible on a phone.
    const glyph = u(15, 32);
    const signGlyph = u(12, 26);
    const bandW = signGlyph * 1.55;
    const medalR = glyph * 0.72;
    const stud = u(2.5, 5);
    const gapU = u(3, 5);
    const mater = 482;
    const limbInner = mater - u(24, 56);
    const plateR = limbInner - u(1.5, 3);
    // The outermost thing on the rete is a medallion, on the band's outside,
    // at the ring's furthest reach (Capricorn). Solve for the plate scale that
    // just clears the rim there.
    const outer = bandW / 2 + gapU + medalR * 2 + gapU;
    const equator = (plateR - outer) / capricornRadius(1);
    const ring = ecliptic(equator);
    return {
      k, glyph, signGlyph, bandW, medalR, stud, gapU, mater, limbInner, plateR, equator, ring,
      numeral: u(11, 24),
      natalR: ring.radius - bandW / 2 - gapU - glyph * 0.62,
      skyR: ring.radius + bandW / 2 + gapU + medalR,
      line: u(1, 1.5),
    };
  }

  // ---- the parts that never move for a given size and place ----
  function buildStatic() {
    rim.replaceChildren(); plate.replaceChildren(); band.replaceChildren(); hub.replaceChildren();
    lines.replaceChildren(); axes.replaceChildren();
    pools.lines = [];

    el("rect", { width: VIEW, height: VIEW, fill: INK.ground }, rim);
    el("circle", { cx: C, cy: C, r: g.mater, fill: "url(#mwMater)", stroke: INK.brass, "stroke-width": g.line * 2.4 }, rim);
    el("circle", { cx: C, cy: C, r: g.limbInner, fill: "none", stroke: INK.line, "stroke-width": g.line }, rim);
    const numeralR = (g.mater + g.limbInner) / 2;
    for (let h = 1; h <= 12; h++) {
      const cardinal = h % 3 === 1;
      const [x1, y1] = polar(C, C, g.limbInner, houseStart(h));
      const [x2, y2] = polar(C, C, g.mater, houseStart(h));
      el("line", { x1, y1, x2, y2, stroke: cardinal ? INK.bright : INK.brass, "stroke-width": g.line * (cardinal ? 2.4 : 1.1) }, rim);
      const [tx, ty] = polar(C, C, numeralR, houseMid(h));
      const t = el("text", { x: tx, y: ty, fill: INK.bright, "font-size": g.numeral, "font-family": "Cinzel, Georgia, serif",
        "text-anchor": "middle", "dominant-baseline": "central", opacity: 0.85 }, rim);
      t.textContent = ROMAN[h - 1];
    }

    set(clipCircle, { r: g.plateR });
    el("circle", { cx: C, cy: C, r: g.plateR, fill: "url(#mwPlate)" }, plate);
    const plateLines = el("g", { "clip-path": "url(#mwClip)" }, plate);
    for (const r of [g.plateR, g.equator, cancerRadius(g.equator)]) {
      el("circle", { cx: C, cy: C, r, fill: "none", stroke: INK.brass, "stroke-opacity": 0.4, "stroke-width": g.line * 0.7 }, plateLines);
    }
    for (let alt = 15; alt <= 75; alt += 15) {
      const a = almucantar(alt, latitude, g.equator);
      if (!a) continue;
      el("circle", { cx: C, cy: C - a.offset, r: Math.abs(a.radius), fill: "none", stroke: INK.muted,
        "stroke-opacity": 0.3 - (alt / 75) * 0.14, "stroke-width": g.line * 0.6 }, plateLines);
    }
    const hz = almucantar(0, latitude, g.equator);
    if (hz) {
      el("circle", { cx: C, cy: C - hz.offset, r: Math.abs(hz.radius), fill: "none", stroke: INK.resist,
        "stroke-opacity": 0.7, "stroke-width": g.line * 1.4 }, plateLines);
    }

    // The two axes, redrawn each frame because they turn with the rete.
    g.ascAxis = el("line", { stroke: INK.resist, "stroke-opacity": 0.6, "stroke-width": g.line * 1.5 }, axes);
    g.mcAxis = el("line", { stroke: INK.brass, "stroke-opacity": 0.6, "stroke-width": g.line * 1.2 }, axes);

    // The band: a ring with the zodiac cut into it.
    g.bandFill = el("circle", { fill: "none", stroke: INK.band, "stroke-width": g.bandW }, band);
    g.bandIn = el("circle", { fill: "none", stroke: INK.brass, "stroke-width": g.line * 1.3 }, band);
    g.bandOut = el("circle", { fill: "none", stroke: INK.brass, "stroke-width": g.line * 1.3 }, band);
    g.ticks = [];
    g.signs = [];
    for (let s = 0; s < 12; s++) {
      g.ticks.push(el("line", { stroke: INK.brass, "stroke-opacity": 0.8, "stroke-width": g.line }, band));
      const t = el("text", { fill: INK.bright, "font-size": g.signGlyph, "font-family": SERIF,
        "text-anchor": "middle", "dominant-baseline": "central" }, band);
      t.textContent = SIGN_GLYPHS[s];
      g.signs.push(t);
    }

    el("circle", { cx: C, cy: C, r: g.glyph * 0.32, fill: INK.brass, stroke: INK.bright, "stroke-width": g.line }, hub);
    el("circle", { cx: C, cy: C, r: g.glyph * 0.12, fill: INK.ground }, hub);

    // Size every pooled label to the new stage.
    for (const m of pools.natal.values()) sizeNatal(m);
    for (const m of pools.sky.values()) sizeSky(m);
  }

  // ---- pooled marks ----
  function natalMark(key, glyph) {
    let m = pools.natal.get(key);
    if (m) return m;
    m = {
      stud: el("circle", { fill: INK.resist }, natalLayer),
      leader: el("line", { stroke: INK.brass, "stroke-opacity": 0.6 }, leaders),
      text: el("text", { fill: INK.resist, "font-family": SERIF, "text-anchor": "middle", "dominant-baseline": "central" }, natalLayer),
    };
    m.text.textContent = glyph + TEXT;
    pools.natal.set(key, m);
    sizeNatal(m);
    return m;
  }
  function sizeNatal(m) {
    if (!g) return;
    set(m.stud, { r: g.stud });
    set(m.leader, { "stroke-width": g.line });
    set(m.text, { "font-size": g.glyph });
  }

  function skyMark(key, glyph, minor) {
    let m = pools.sky.get(key);
    if (m) return m;
    m = {
      minor,
      stud: el("circle", { fill: INK.bright }, skyLayer),
      leader: el("line", { stroke: INK.bright, "stroke-opacity": 0.55 }, leaders),
      group: el("g", {}, skyLayer),
    };
    m.disc = el("circle", { fill: "#241A10", stroke: minor ? INK.brass : INK.bright }, m.group);
    m.text = el("text", { fill: INK.resist, "font-family": SERIF, "text-anchor": "middle", "dominant-baseline": "central" }, m.group);
    m.text.textContent = glyph + TEXT;
    m.rx = el("text", { fill: "#D4775F", "font-family": SERIF, "text-anchor": "middle", "dominant-baseline": "central" }, m.group);
    m.rx.textContent = "℞";
    pools.sky.set(key, m);
    sizeSky(m);
    return m;
  }
  function sizeSky(m) {
    if (!g) return;
    const r = g.medalR * (m.minor ? 0.8 : 1);
    set(m.stud, { r: g.stud });
    set(m.leader, { "stroke-width": g.line });
    set(m.disc, { r, "stroke-width": g.line * 1.6 });
    set(m.text, { "font-size": g.glyph * (m.minor ? 0.78 : 0.95) });
    // Tucked onto the rim of the disc, so the spacing allowance above covers it.
    set(m.rx, { "font-size": g.glyph * 0.5, x: r * 0.82, y: -r * 0.82 });
  }

  function linePool(i) {
    while (pools.lines.length <= i) {
      pools.lines.push({
        line: el("line", { "stroke-linecap": "round" }, lines),
        halo: el("circle", { fill: "none" }, lines),
      });
    }
    return pools.lines[i];
  }

  /** Place one set of labels round its track, with leaders when pushed off. */
  function placeTrack(items, radius, gapUnits, ring, draw) {
    const angles = spread(items.map((it) => it.theta), gapUnits / radius);
    items.forEach((it, i) => {
      const [x, y] = polar(ring.cx, ring.cy, radius, angles[i]);
      const off = Math.abs(wrap(angles[i] - it.theta + Math.PI) - Math.PI);
      draw(it, x, y, off > 1.5 * D2R);
    });
  }

  return {
    /** Fit the instrument to the stage's width in CSS pixels, for a latitude. */
    layout(stagePx, lat) {
      latitude = lat;
      g = measure(stagePx);
      buildStatic();
    },

    /**
     * Draw one moment.
     *
     * `frame` is { ascendant, midheaven, sky, natal, aspects }, where `sky` and
     * `natal` are lists of { key, glyph, longitude, retrograde, minor } and
     * `aspects` is a list of { sky, natal, color, closeness, conjunction }.
     * `natal` may be null, for a sky with no birth chart under it.
     */
    draw({ ascendant, midheaven, sky, natal, aspects = [] }) {
      if (!g) return;
      const ascAngle = retePoint(ascendant, 0, 1).angle;
      // The rete is turned so the ascendant sits on the left horizon.
      const turn = (-ascAngle + 180) * D2R;
      const ring = {
        cx: C + g.ring.offset * Math.cos(turn - Math.PI / 2),
        cy: C - g.ring.offset * Math.sin(turn - Math.PI / 2),
      };
      // The angle round the ring's own centre at which a longitude sits.
      const thetaOf = (lon) => {
        const p = retePoint(lon, 0, g.equator);
        const [x, y] = polar(C, C, p.radius, (p.angle - ascAngle + 180) * D2R);
        return Math.atan2(-(y - ring.cy), x - ring.cx);
      };
      const R = g.ring.radius;
      const inner = R - g.bandW / 2;
      const outer = R + g.bandW / 2;

      for (const c of [g.bandFill, g.bandIn, g.bandOut]) set(c, { cx: ring.cx, cy: ring.cy });
      set(g.bandFill, { r: R });
      set(g.bandIn, { r: inner });
      set(g.bandOut, { r: outer });
      for (let s = 0; s < 12; s++) {
        const th = thetaOf(s * 30);
        const [x1, y1] = polar(ring.cx, ring.cy, inner, th);
        const [x2, y2] = polar(ring.cx, ring.cy, outer, th);
        set(g.ticks[s], { x1, y1, x2, y2 });
        const [gx, gy] = polar(ring.cx, ring.cy, R, thetaOf(s * 30 + 15));
        set(g.signs[s], { x: gx, y: gy });
      }

      const axis = (line, lon) => {
        const [x1, y1] = polar(ring.cx, ring.cy, outer, thetaOf(lon));
        const [x2, y2] = polar(ring.cx, ring.cy, outer, thetaOf(lon + 180));
        set(line, { x1, y1, x2, y2 });
      };
      axis(g.ascAxis, ascendant);
      axis(g.mcAxis, midheaven);

      // ---- your chart, inside the band ----
      const natalAt = new Map();
      const seenNatal = new Set();
      if (natal) {
        const items = natal.map((b) => ({ ...b, theta: thetaOf(b.longitude) }));
        placeTrack(items, g.natalR, g.glyph * 1.08, ring, (it, x, y, pushed) => {
          const m = natalMark(it.key, it.glyph);
          seenNatal.add(it.key);
          const [sx, sy] = polar(ring.cx, ring.cy, inner, it.theta);
          natalAt.set(it.key, [sx, sy, it.theta]);
          set(m.stud, { cx: sx, cy: sy, visibility: "visible" });
          set(m.text, { x, y, visibility: "visible" });
          if (pushed) {
            const [lx, ly] = polar(ring.cx, ring.cy, inner - g.stud * 1.5, it.theta);
            const dx = x - lx, dy = y - ly, len = Math.hypot(dx, dy) || 1;
            const stop = len - g.glyph * 0.5;
            set(m.leader, { x1: lx, y1: ly, x2: lx + dx * stop / len, y2: ly + dy * stop / len, visibility: stop > 0 ? "visible" : "hidden" });
          } else {
            set(m.leader, { visibility: "hidden" });
          }
        });
      }
      for (const [key, m] of pools.natal) {
        if (!seenNatal.has(key)) for (const e of [m.stud, m.text, m.leader]) set(e, { visibility: "hidden" });
      }

      // ---- the moving sky, outside the band ----
      const skyAt = new Map();
      const seenSky = new Set();
      const skyItems = sky.map((b) => ({ ...b, theta: thetaOf(b.longitude) }));
      // Room for a disc, its neighbour, and a retrograde tag between them on
      // the diagonal: 1.16r + tag + r, with a little over for the track's
      // curve, since spacing is measured round the arc and discs meet on the chord.
      placeTrack(skyItems, g.skyR, g.medalR * 2.6, ring, (it, x, y, pushed) => {
        const m = skyMark(it.key, it.glyph, it.minor === true);
        seenSky.add(it.key);
        const [sx, sy] = polar(ring.cx, ring.cy, outer, it.theta);
        skyAt.set(it.key, [sx, sy, it.theta]);
        set(m.stud, { cx: sx, cy: sy, visibility: "visible" });
        set(m.group, { transform: `translate(${x.toFixed(1)} ${y.toFixed(1)})`, visibility: "visible" });
        set(m.rx, { visibility: it.retrograde ? "visible" : "hidden" });
        if (pushed) {
          const dx = x - sx, dy = y - sy, len = Math.hypot(dx, dy) || 1;
          const stop = len - g.medalR;
          set(m.leader, { x1: sx, y1: sy, x2: sx + dx * stop / len, y2: sy + dy * stop / len, visibility: stop > 0 ? "visible" : "hidden" });
        } else {
          set(m.leader, { visibility: "hidden" });
        }
      });
      for (const [key, m] of pools.sky) {
        // The retrograde tag is hidden in its own right: in SVG a child that
        // says visibility="visible" shows through a hidden parent, so a point
        // left over from the other mode would leave its ℞ floating on the plate.
        if (!seenSky.has(key)) for (const e of [m.stud, m.group, m.leader, m.rx]) set(e, { visibility: "hidden" });
      }

      // ---- aspects: from the sky's stud to yours, under the band ----
      let used = 0;
      for (const a of aspects) {
        const s = skyAt.get(a.sky), n = natalAt.get(a.natal);
        if (!s || !n) continue;
        const { line, halo } = linePool(used++);
        const alpha = 0.12 + 0.88 * a.closeness * a.closeness;
        if (a.conjunction) {
          const [hx, hy] = polar(ring.cx, ring.cy, R, n[2]);
          set(line, { visibility: "hidden" });
          set(halo, { cx: hx, cy: hy, r: g.bandW * (0.7 + 0.35 * a.closeness), stroke: a.color,
            "stroke-opacity": alpha, "stroke-width": g.line * (1 + 2.5 * a.closeness), visibility: "visible" });
        } else {
          set(halo, { visibility: "hidden" });
          set(line, { x1: s[0], y1: s[1], x2: n[0], y2: n[1], stroke: a.color,
            "stroke-opacity": alpha, "stroke-width": g.line * (0.8 + 2.6 * a.closeness), visibility: "visible" });
        }
      }
      for (let i = used; i < pools.lines.length; i++) {
        set(pools.lines[i].line, { visibility: "hidden" });
        set(pools.lines[i].halo, { visibility: "hidden" });
      }

      return { ring, thetaOf };
    },

    /** For tests: the sizes in use. */
    get geometry() { return g; },
  };
}

// How the instrument looks: its colour scheme, its metal, whether it has been
// left to tarnish, and which faces the words are struck in.
//
// These are the iPhone app's own Appearance settings — `Palette.swift`,
// `MetalFinish.swift`, `FontSet.swift` and the Tarnished toggle in
// `SettingsView.swift` — carried over value for value, so a colour or a
// sentence here should always be traceable to its counterpart there. The
// choice lives in this browser only, and it is shared by every page that
// shows the instrument: /chart/, /app/ and /app/motion/.
//
// Two deliberate differences from the app, both so that a visitor who never
// opens the panel sees exactly the site they saw before it existed:
//
// - Brass & Ink with the brass metal keeps the site's own dress: the night
//   sky behind the page, and the slightly lifted brass the site's labels were
//   already set in. Every other combination is the app's, unaltered.
// - The default type is Engraved (Cinzel, Spectral, JetBrains Mono), which is
//   what the site has always been set in. The app defaults to Native Sky.

const STORE = "astrolabe.appearance.v1";
export const EVENT = "astrolabe:appearance";

// ---------------------------------------------------------------- schemes

export const SCHEMES = [
  {
    id: "brass", name: "Brass & Ink", isDark: true,
    blurb: "Aged brass on an ink-dark plate. The instrument as a made object.",
    ground: "#14100A", panel: "#1B1206", resist: "#F3E6C4", ink: "#EDE0C0", muted: "#9A8A66",
    plate: "#150F07", engraving: "#6F6A52", horizonLine: "#8FB0A8", fire: "#DD6440",
  },
  {
    id: "rose", name: "Rose & Parchment", isDark: false,
    blurb: "Sun-bleached adobe, oxidised silver, and stones set in it — turquoise, coral, and a real dark in the shade.",
    ground: "#F2E4CC", panel: "#E4D0AE", resist: "#2E1A14", ink: "#241310", muted: "#7A5E4C",
    plate: "#C9AE85", engraving: "#7A5A3C", horizonLine: "#1E7A72", fire: "#C4452A",
  },
  {
    id: "plum", name: "Plum & Turquoise", isDark: true,
    blurb: "Jewelled dark — plum, turquoise, and rose, straight off the batik cloth.",
    ground: "#1A1026", panel: "#261634", resist: "#F7E7F5", ink: "#EEDCEC", muted: "#A187B0",
    plate: "#120A1C", engraving: "#7A5F92", horizonLine: "#2FA8AD", fire: "#E0714B",
  },
  {
    id: "verdigris", name: "Verdigris & Linen", isDark: false,
    blurb: "The green copper grows, set against undyed linen, with indigo in the shadows.",
    ground: "#EDEAE0", panel: "#DCDCCE", resist: "#14202A", ink: "#101C26", muted: "#5E6E70",
    plate: "#C6C6B4", engraving: "#5A6A66", horizonLine: "#2F52A0", fire: "#C4542A",
  },
];

export const RANDOM = "random";
export const RANDOM_BLURB = "A different scheme and metal each day — quietly, on its own, rather than picking one and stopping.";

// ---------------------------------------------------------------- metals

export const METALS = [
  {
    id: "brass", name: "Brass",
    blurb: "Copper and zinc. Warm yellow, and what most surviving instruments were struck from.",
    deep: "#3D2F14", dark: "#6D5424", mid: "#B08C3F", base: "#C9A24C", lit: "#F0D493", spec: "#FDF1CD", patina: "#4E8C7A", onMetal: "#1A1408",
  },
  {
    id: "bronze", name: "Bronze",
    blurb: "Copper and tin. Darker and browner, with a blue-green verdigris in the recesses.",
    deep: "#2E1D0E", dark: "#5A3A1C", mid: "#8C5C2E", base: "#A9713C", lit: "#D1A268", spec: "#F0D8AE", patina: "#3E7F6B", onMetal: "#160F06",
  },
  {
    id: "copper", name: "Copper",
    blurb: "Soft, red, and the finest to engrave. Grows the strongest verdigris of the four.",
    deep: "#3A1608", dark: "#6E2C12", mid: "#A9491F", base: "#C4622E", lit: "#E39160", spec: "#F8CDA8", patina: "#2E9C86", onMetal: "#2A1006",
  },
  {
    id: "sterling", name: "Sterling Silver",
    blurb: "Reserved for presentation pieces. Tarnishes warm brown-black, never green.",
    deep: "#2B2C2E", dark: "#55585C", mid: "#8A8E93", base: "#B4B8BD", lit: "#DCDFE3", spec: "#F9FAFB", patina: "#6B5F55", onMetal: "#141516",
  },
];

export const METAL_BLURB = "What the instrument is made of. All four are alloys a maker of the period could actually have worked — no modern ones, which would put the object in the wrong century. Independent of the color scheme, so any metal pairs with any palette.";
export const METAL_BLURB_RANDOM = "What the instrument is made of — though Random is choosing that too, a different alloy each day. Pick a scheme above to set the metal yourself.";
export const TARNISHED_ON = "Aged, with oxide worked into every recess and a heavier bloom on retrograde planets.";
export const TARNISHED_OFF = "Kept polished. A trace of oxide remains in the recesses regardless — it's what separates a bezel from the ring it sits on.";

/**
 * `Brass.polished`: flat stock lit from above. Dark where it turns away at the
 * top edge, a hard specular line just below it, a shaded core, and a weaker
 * bounce off the lower edge. Ten stops and not two, because the app's rule is
 * that metal never sits at one value across an area the eye can resolve —
 * a smooth two-stop ramp reads as plastic whatever the hue.
 */
function polished(m) {
  return `linear-gradient(180deg, ${m.dark} 0%, ${m.base} 7%, ${m.spec} 16%, ${m.lit} 24%, ${m.mid} 37%, ` +
    `${m.dark} 52%, ${m.mid} 64%, ${m.lit} 77%, ${m.mid} 88%, ${m.deep} 100%)`;
}

/**
 * `EngravedText`: lettering cut into the metal, not raised from it. With the
 * light at the upper left, a groove's upper-left wall faces away and goes
 * dark while its lower-right wall catches the light — dark above-left, light
 * below-right, always. The app notes it had this backwards twice.
 */
function engrave(m) {
  const d = (a) => alpha(m.deep, a), s = (a) => alpha(m.spec, a);
  return `-1px -1px 0 ${d(0.95)}, -0.5px -0.5px 0 ${d(0.55)}, 1px 1px 0 ${s(0.95)}, ` +
    `0.5px 0.5px 0 ${s(0.52)}, -0.4px -0.4px 2.2px ${d(0.5)}`;
}

/** `BrassBevel`: a light top edge, a dark bottom one, and a small drop shadow. */
const BEVEL = "inset 0 1px 0 rgba(255,255,255,.55), inset 0 -1px 0 rgba(0,0,0,.35), " +
  "inset 1px 0 0 rgba(255,255,255,.14), inset -1px 0 0 rgba(0,0,0,.14), 0 1px 2px rgba(0,0,0,.45)";

/** `MetalFinish.accent(isDark:)`: the label colour, which has to hold on either ground. */
function accent(metal, isDark) {
  return isDark ? { brass: metal.mid, bright: metal.lit } : { brass: metal.dark, bright: metal.mid };
}

// ---------------------------------------------------------------- type

// The app names iOS faces. A browser has its own, so each set asks for the
// app's face first and then the nearest thing a Windows or Android device
// already carries. Nothing is downloaded for any set but Engraved, whose three
// faces the site already loads.
export const FONT_SETS = [
  {
    id: "nativeSky", name: "Native Sky",
    blurb: "Your device's own serif, sans, and mono — nothing to load, and it reads the way the rest of your screen does.",
    display: 'ui-serif, "New York", "Iowan Old Style", Georgia, serif',
    body: 'system-ui, -apple-system, "Segoe UI", Roboto, "Helvetica Neue", sans-serif',
    mono: 'ui-monospace, Menlo, Consolas, monospace',
  },
  {
    id: "celestialEditorial", name: "Celestial Editorial",
    blurb: "Didot over Optima. Closer to a star chart than a horoscope column — Didot's hairlines want size, so it suits the large type best.",
    display: 'Didot, "Bodoni 72", "Bodoni MT", "Libre Bodoni", serif',
    body: 'Optima, Candara, "Segoe UI", "Noto Sans", sans-serif',
    mono: 'Menlo, ui-monospace, Consolas, monospace',
  },
  {
    id: "ancientInstrument", name: "Ancient Instrument",
    blurb: "Copperplate over Palatino. Capitals struck like the plate itself, over a scholar's serif for the reading beneath it.",
    display: 'Copperplate, "Copperplate Gothic Light", "Copperplate Gothic", Georgia, serif',
    body: 'Palatino, "Palatino Linotype", "Book Antiqua", "URW Palladio L", Georgia, serif',
    mono: '"Courier New", Courier, monospace',
  },
  {
    id: "engraved", name: "Engraved",
    blurb: "Cinzel over Spectral over JetBrains Mono. The direction this whole instrument was originally sketched in — lapidary capitals over a warm literary serif.",
    display: '"Cinzel", Georgia, serif',
    body: '"Spectral", Georgia, "Times New Roman", serif',
    mono: '"JetBrains Mono", ui-monospace, monospace',
  },
];

export const TYPE_BLURB = "A display face for headings and names, a body face for readings, a mono face for degrees and coordinates — the same three roles, differently struck.";
export const COLOR_BLURB = "Every color below already appears somewhere in the app — the batik dyes, the parchment, the metal. Changing the scheme re-tints the whole instrument, not just the background.";

const DEFAULTS = { scheme: "brass", metal: "brass", tarnished: false, fontSet: "engraved" };

// ---------------------------------------------------------------- Random

// `Palette.resolved` for the "random" id: one scheme and one metal a day,
// drawn exactly as the app draws them, so a phone and a browser on the same
// day agree. The day number goes through the SplitMix64 finalizer before
// xorshift64 sees it — the app's own fix for adjacent days picking alike.

const U64 = (x) => BigInt.asUintN(64, x);

function mixSeed(x) {
  let z = U64(x + 0x9E3779B97F4A7C15n);
  z = U64((z ^ (z >> 30n)) * 0xBF58476D1CE4E5B9n);
  z = U64((z ^ (z >> 27n)) * 0x94D049BB133111EBn);
  return z ^ (z >> 31n);
}

function xorshift(seed) {
  let s = seed === 0n ? 0x9E3779B9n : seed;
  return () => {
    s = U64(s ^ (s << 13n));
    s = U64(s ^ (s >> 7n));
    s = U64(s ^ (s << 17n));
    return Number(s % 100000n) / 100000;
  };
}

/** `LocalDay.index()`: whole local days since 1 January 1970. */
export function localDayIndex(date = new Date()) {
  const start = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  return Math.round((start - new Date(1970, 0, 1)) / 86400000);
}

export function dailyPick(date = new Date()) {
  const next = xorshift(mixSeed(BigInt(localDayIndex(date))));
  const scheme = SCHEMES[Math.floor(next() * SCHEMES.length) % SCHEMES.length];
  const metal = METALS[Math.floor(next() * METALS.length) % METALS.length];
  return { scheme: scheme.id, metal: metal.id };
}

// ---------------------------------------------------------------- state

export function load() {
  let saved = {};
  try { saved = JSON.parse(localStorage.getItem(STORE) || "{}") || {}; } catch { saved = {}; }
  const pick = (value, list, fallback) => (list.some((x) => x.id === value) ? value : fallback);
  return {
    scheme: saved.scheme === RANDOM ? RANDOM : pick(saved.scheme, SCHEMES, DEFAULTS.scheme),
    metal: pick(saved.metal, METALS, DEFAULTS.metal),
    tarnished: saved.tarnished === true,
    fontSet: pick(saved.fontSet, FONT_SETS, DEFAULTS.fontSet),
  };
}

function save(state) {
  try { localStorage.setItem(STORE, JSON.stringify(state)); } catch { /* private window: this visit only */ }
}

const alpha = (hex, a) => {
  const h = hex.replace("#", "");
  return `rgba(${parseInt(h.slice(0, 2), 16)},${parseInt(h.slice(2, 4), 16)},${parseInt(h.slice(4, 6), 16)},${a})`;
};

/**
 * Everything a page and the renderer need, worked out from a choice.
 *
 * `page` is CSS custom properties. `instrument` is what `drawInstrument`
 * takes. `motion` is what the Chart in Motion wheel takes.
 */
export function resolve(state = load()) {
  const daily = state.scheme === RANDOM ? dailyPick() : null;
  const scheme = SCHEMES.find((s) => s.id === (daily ? daily.scheme : state.scheme)) ?? SCHEMES[0];
  const metal = METALS.find((m) => m.id === (daily ? daily.metal : state.metal)) ?? METALS[0];
  const fonts = FONT_SETS.find((f) => f.id === state.fontSet) ?? FONT_SETS[3];
  // The site's own dress, kept exactly for the one combination it was made in.
  const siteDress = scheme.id === "brass" && metal.id === "brass";
  const a = siteDress ? { brass: "#C8993F", bright: "#E8C87A" } : accent(metal, scheme.isDark);

  const page = siteDress ? {
    "--night": "#090B1C", "--ground": "#17110a", "--panel": "#221a10",
    "--ink": "#ede0c4", "--muted": "#a6926c", "--brass": "#c8993f", "--bright": "#E8C87A",
    "--resist": "#F3E6C4", "--rule": "rgba(200,153,63,0.3)", "--danger": "#d4775f",
    "--glow": "rgba(184,150,63,.14)", "--stars": "1", "--instrument": "#14100A",
    "--fused": "#e8c87a", "--flow": "#f3e6c4", "--friction": "#d4775f",
  } : {
    "--night": scheme.ground, "--ground": scheme.isDark ? scheme.ground : scheme.panel, "--panel": scheme.panel,
    "--ink": scheme.ink, "--muted": scheme.muted, "--brass": a.brass, "--bright": a.bright,
    "--resist": scheme.resist, "--rule": alpha(a.brass, scheme.isDark ? 0.3 : 0.35),
    "--danger": scheme.isDark ? "#d4775f" : scheme.fire,
    "--glow": alpha(a.brass, scheme.isDark ? 0.14 : 0.1), "--stars": scheme.isDark ? "1" : "0",
    "--instrument": scheme.ground,
    "--fused": a.bright, "--flow": scheme.resist, "--friction": scheme.isDark ? "#d4775f" : scheme.fire,
  };
  Object.assign(page, {
    "--font-display": fonts.display, "--font-body": fonts.body, "--font-mono": fonts.mono,
    // Buttons are struck from the chosen metal, as the app's are.
    "--metal": polished(metal), "--on-metal": metal.onMetal, "--engrave": engrave(metal), "--metal-lift": BEVEL,
  });

  return {
    state, scheme, metal, fonts, tarnished: state.tarnished, isDark: scheme.isDark,
    page,
    instrument: {
      metal: metal.id,
      tarnished: state.tarnished,
      // Left empty for the site's own dress, so the renderer's defaults — the
      // colours the instrument has always been drawn in — stay exactly as they were.
      palette: siteDress ? {} : {
        ground: scheme.ground, brass: a.brass, resist: scheme.resist, muted: scheme.muted,
        fire: scheme.fire, plate: scheme.plate, engraving: scheme.engraving, horizonLine: scheme.horizonLine,
      },
      displayFont: fonts.display,
      bodyFont: fonts.body,
    },
    // Chart in Motion draws its own SVG instrument. Its glyphs stay in the
    // faces its plate was measured around, as the app's wheel keeps its hand-
    // measured glyphs; the metal and the scheme re-tint it like everything else.
    motion: siteDress ? {} : {
      ground: scheme.ground, limb: scheme.panel, line: metal.deep, brass: a.brass, bright: a.bright,
      resist: scheme.resist, muted: scheme.muted, band: scheme.isDark ? metal.deep : scheme.panel,
      mater: [metal.dark, metal.deep, scheme.plate],
      plate: [scheme.panel, scheme.plate],
      disc: scheme.panel,
      rx: scheme.isDark ? "#D4775F" : scheme.fire,
      numeral: metal.lit,
    },
    // The aspect lines on the instrument, by tone.
    aspects: siteDress
      ? { fused: "#E8C87A", flow: "#F3E6C4", friction: "#D4775F" }
      : { fused: a.bright, flow: scheme.resist, friction: scheme.isDark ? "#D4775F" : scheme.fire },
  };
}

// ---------------------------------------------------------------- wear

/**
 * `WearMarks`, drawn once into a small image that every button then wears.
 *
 * Scratches mostly one way, as if wiped with a cloth; nicks with a bright torn
 * lip; pitting; and, only once the metal is really tarnished, colonies of
 * oxide spreading in the low places. Polished is not zero wear — a handled
 * instrument carries fine marks, and a surface with none reads as plastic —
 * but it grows no oxide at all, as the app insists. Seeded, so a button's
 * wear is the same on every visit. 4021 is the seed the app's own buttons use.
 */
const wearCache = new Map();

function wearTexture(m, heavy, seed = 4021) {
  const key = `${m.id}|${heavy}|${seed}`;
  if (wearCache.has(key)) return wearCache.get(key);
  const w = 360, h = 72, scale = 2;
  const canvas = document.createElement("canvas");
  canvas.width = w * scale; canvas.height = h * scale;
  const c = canvas.getContext("2d");
  if (!c) return "none";
  c.scale(scale, scale);
  const next = xorshift(BigInt(seed));
  const dim = Math.min(w, h);

  const colony = (cx0, cy0, spread) => {
    const lobes = 2 + Math.floor(next() * 4);
    for (let lobe = 0; lobe < lobes; lobe++) {
      const drift = spread * 0.55 * lobe / Math.max(lobes - 1, 1);
      const dir = next() * Math.PI * 2;
      const cx = cx0 + Math.cos(dir) * drift, cy = cy0 + Math.sin(dir) * drift;
      const base = spread * (0.85 - 0.5 * lobe / lobes) * (0.5 + next() * 0.9);
      if (!(base > 0.6)) continue;
      const slow = 0.22 + next() * 0.30, fast = 0.06 + next() * 0.14;
      const p1 = next() * Math.PI * 2, p2 = next() * Math.PI * 2, f = 5 + Math.round(next() * 5);
      const blob = (ox, oy) => {
        const path = new Path2D();
        for (let i = 0; i <= 44; i++) {
          const t = i / 44 * Math.PI * 2;
          const r = base * (1 + slow * Math.sin(t * 2 + p1) + fast * Math.sin(t * f + p2));
          const x = cx + ox + Math.cos(t) * r, y = cy + oy + Math.sin(t) * r;
          if (i === 0) path.moveTo(x, y); else path.lineTo(x, y);
        }
        path.closePath();
        return path;
      };
      const a = (0.05 + next() * 0.11) * (0.35 + heavy);
      const shape = blob(0, 0);
      c.fillStyle = alpha(m.patina, a); c.fill(shape);
      c.fillStyle = alpha(m.patina, a * 0.75); c.fill(blob(base * 0.12, base * 0.10));
      if (next() > 0.55) { c.strokeStyle = alpha(m.deep, a * 1.2); c.lineWidth = 0.5; c.stroke(shape); }
    }
  };

  const colonies = heavy > 0.4 ? 2 + Math.floor(heavy * 5) : 0;
  for (let i = 0; i < colonies; i++) {
    const x = next() * w, y = next() * h;
    colony(x, y, dim * (0.10 + next() * 0.34) * (0.5 + heavy));
  }
  const strokes = 6 + Math.floor(heavy * 26);
  const grain = next() * Math.PI;
  c.lineCap = "round";
  for (let i = 0; i < strokes; i++) {
    const angle = grain + (next() - 0.5) * 0.7;
    const len = dim * (0.15 + next() * 0.55);
    const x0 = next() * w, y0 = next() * h;
    const dx = Math.cos(angle) * len, dy = Math.sin(angle) * len;
    const a = (0.06 + next() * 0.16) * (0.4 + heavy);
    c.strokeStyle = alpha(m.deep, a); c.lineWidth = 0.5 + next() * 0.6;
    c.beginPath(); c.moveTo(x0, y0); c.lineTo(x0 + dx, y0 + dy); c.stroke();
    c.strokeStyle = alpha(m.spec, a * 0.7); c.lineWidth = 0.4;
    c.beginPath(); c.moveTo(x0 + 0.5, y0 - 0.5); c.lineTo(x0 + dx + 0.5, y0 + dy - 0.5); c.stroke();
  }
  const nicks = Math.floor(heavy * 7);
  for (let i = 0; i < nicks; i++) {
    const cx = next() * w, cy = next() * h, r = dim * (0.012 + next() * 0.030);
    const a0 = next() * Math.PI * 2;
    c.beginPath(); c.moveTo(cx, cy); c.arc(cx, cy, r, a0, a0 + 1.6 + next()); c.closePath();
    c.fillStyle = alpha(m.deep, 0.42 + next() * 0.28); c.fill();
    c.strokeStyle = alpha(m.spec, 0.5); c.lineWidth = 0.5; c.stroke();
  }
  const pits = Math.floor(heavy * 40);
  for (let i = 0; i < pits; i++) {
    const cx = next() * w, cy = next() * h, r = dim * (0.004 + next() * 0.008);
    c.beginPath(); c.arc(cx, cy, r, 0, Math.PI * 2);
    c.fillStyle = alpha(m.deep, 0.25 + next() * 0.35); c.fill();
  }
  const url = `url("${canvas.toDataURL("image/png")}")`;
  wearCache.set(key, url);
  return url;
}

// ---------------------------------------------------------------- applying

export function apply(state = load()) {
  const r = resolve(state);
  const root = document.documentElement;
  for (const [k, v] of Object.entries(r.page)) root.style.setProperty(k, v);
  try { root.style.setProperty("--metal-wear", wearTexture(r.metal, r.tarnished ? 1.0 : 0.16)); } catch { /* no canvas: plain metal */ }
  root.dataset.scheme = r.scheme.id;
  root.style.colorScheme = r.isDark ? "dark" : "light";
  const meta = document.querySelector('meta[name="theme-color"]');
  if (meta) meta.setAttribute("content", r.page["--night"]);
  window.dispatchEvent(new CustomEvent(EVENT, { detail: r }));
  return r;
}

export function update(change) {
  const next = { ...load(), ...change };
  save(next);
  return apply(next);
}

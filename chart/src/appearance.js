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
    deep: "#3D2F14", dark: "#6D5424", mid: "#B08C3F", base: "#C9A24C", lit: "#F0D493", spec: "#FDF1CD", patina: "#4E8C7A",
  },
  {
    id: "bronze", name: "Bronze",
    blurb: "Copper and tin. Darker and browner, with a blue-green verdigris in the recesses.",
    deep: "#2E1D0E", dark: "#5A3A1C", mid: "#8C5C2E", base: "#A9713C", lit: "#D1A268", spec: "#F0D8AE", patina: "#3E7F6B",
  },
  {
    id: "copper", name: "Copper",
    blurb: "Soft, red, and the finest to engrave. Grows the strongest verdigris of the four.",
    deep: "#3A1608", dark: "#6E2C12", mid: "#A9491F", base: "#C4622E", lit: "#E39160", spec: "#F8CDA8", patina: "#2E9C86",
  },
  {
    id: "sterling", name: "Sterling Silver",
    blurb: "Reserved for presentation pieces. Tarnishes warm brown-black, never green.",
    deep: "#2B2C2E", dark: "#55585C", mid: "#8A8E93", base: "#B4B8BD", lit: "#DCDFE3", spec: "#F9FAFB", patina: "#6B5F55",
  },
];

export const METAL_BLURB = "What the instrument is made of. All four are alloys a maker of the period could actually have worked — no modern ones, which would put the object in the wrong century. Independent of the color scheme, so any metal pairs with any palette.";
export const METAL_BLURB_RANDOM = "What the instrument is made of — though Random is choosing that too, a different alloy each day. Pick a scheme above to set the metal yourself.";
export const TARNISHED_ON = "Aged, with oxide worked into every recess and a heavier bloom on retrograde planets.";
export const TARNISHED_OFF = "Kept polished. A trace of oxide remains in the recesses regardless — it's what separates a bezel from the ring it sits on.";

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

// ---------------------------------------------------------------- applying

export function apply(state = load()) {
  const r = resolve(state);
  const root = document.documentElement;
  for (const [k, v] of Object.entries(r.page)) root.style.setProperty(k, v);
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

// The web app: the iPhone app's five tabs in one page.
//
// Chart, Areas, Signs, Tarot, and Sky, in the app's order, each under its own
// inline title, routed by the hash (#chart, #areas, #areas/love, #chart/whole,
// #signs, #tarot, #sky) so the page stays one file to cache offline and one
// origin for localStorage. Detail pages rise as sheets with the app's close
// glyph, as they do on a phone.
//
// What a reading says is never written here. Horoscopes, nameplates, and the
// whole-chart summary come from the reading server, which runs the app's own
// Swift (readings.js); this file only lays them out. Everything here is free:
// subscriptions were dropped on 2026-10-16, and prints are the only thing the
// site sells.

import { mountAppearance } from "../../chart/src/appearance-panel.js";
import { resolve, EVENT } from "../../chart/src/appearance.js";
import { installGuide } from "../../chart/src/install-guide.js";
import { julianDayFromLocal, anglesFor } from "../../chart/src/angles.js";
import { longitudeOf, isRetrograde, PLANETS } from "../../chart/src/ephemeris.js";
import { pointLongitude, pointIsRetrograde, POINTS } from "../../chart/src/points.js";
import { mountInstrument } from "../../chart/src/instrument-view.js";
import { studImage } from "../../chart/src/instrument.js";
import { loadPlaces, searchPlaces } from "../../chart/src/places.js";
import { listProfiles, getProfile, saveProfile, deleteProfile, selectedProfileId, selectProfile, requestPersistentStorage } from "./profiles.js";
import { fetchReadings, readerDay } from "./readings.js";
import { ICONS, moonApsideGlyph } from "./icons.js";
import { chartWheelSVG } from "./chart-wheel.js";
import { filigree, mountFiligrees } from "./filigree.js";
import { mountSky } from "./sky.js";
import {
  SIGNS, signAt, ROMAN, ORDINAL, rulerOf, rulerSubject, subject, PLANET_NAMES, PLANET_GLYPHS, POINT_INFO, ANGLE_INFO,
  HOUSE_TITLES, HOUSE_COVERS, HOUSE_ESSENCES, AREAS, ASPECT_KINDS, matchAspect, TAROT, SIGN_READINGS,
  retrogradeNote, CHIRON_RETROGRADE_NOTE,
} from "./lore.js";

const $ = (id) => document.getElementById(id);
const esc = (s) => String(s ?? "").replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
/** The app's `Text(markdown:)`: its copy marks emphasis with _underscores_. */
const md = (s) => esc(s).replace(/(^|[\s(“"'—])_([^_]+)_/g, "$1<em>$2</em>").replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>").replace(/\*([^*]+)\*/g, "<em>$1</em>");
const icon = (name) => ICONS[name] ?? "";
const norm = (d) => ((d % 360) + 360) % 360;
const reduceMotion = () => window.matchMedia("(prefers-reduced-motion: reduce)").matches;
const store = {
  get(k) { try { return localStorage.getItem(k); } catch { return null; } },
  set(k, v) { try { localStorage.setItem(k, v); } catch { /* private window: forget it */ } },
};

// Fill every data-icon placeholder already in the page.
const fillIcons = (root = document) => root.querySelectorAll("[data-icon]").forEach((el) => { el.innerHTML = icon(el.dataset.icon); });

// ---------------------------------------------------------------- appearance

// The app's element dyes per scheme (Palette.swift), which appearance.js
// doesn't carry. Set on the root so the wheel, medallions and sign labels
// re-dye with the scheme the way the app's do.
const ELEMENT_DYES = {
  brass: ["#DD6440", "#6D9F38", "#2F52A0", "#12797F"],
  rose: ["#C4452A", "#5E7C2E", "#2F5E8C", "#1E8C8C"],
  plum: ["#E0714B", "#6D9F38", "#5A7BC4", "#2FA8AD"],
  verdigris: ["#C4542A", "#5E8C34", "#2F52A0", "#12797F"],
};
function dyeElements() {
  const r = resolve();
  const [fire, earth, air, water] = ELEMENT_DYES[r.scheme.id] ?? ELEMENT_DYES.brass;
  const root = document.documentElement.style;
  root.setProperty("--el-fire", fire); root.setProperty("--el-earth", earth);
  root.setProperty("--el-air", air); root.setProperty("--el-water", water);
  root.setProperty("--metal-deep", r.metal.deep ?? "#6D5424");
}
const appearance = mountAppearance({ into: $("appearanceHome") });
dyeElements();
window.addEventListener(EVENT, () => { dyeElements(); if (current) drawWheel(); });
// The panel hands focus back to its own (hidden) opener; bring it to Settings instead.
document.querySelector("dialog.ap")?.addEventListener("close", () => {
  if ($("sheet").open) $("sheetBody").querySelector("[data-open-appearance]")?.focus();
});

// ---------------------------------------------------------------- the five tabs

// In a browser the website adds a sixth, Home, first: it leaves the app for the
// homepage, the welcome screen with the rest of the site below it. The
// installed app leaves it out, since it opens on its own welcome screen and the
// homepage is outside it.
const INSTALLED = window.matchMedia("(display-mode: standalone)").matches || navigator.standalone === true;
const TABS = [
  ...(INSTALLED ? [] : [{ id: "home", title: "Home", icon: "home", fill: "homeFill", href: "/" }]),
  { id: "chart", title: "Chart", icon: "chart", fill: "chartFill" },
  { id: "areas", title: "Areas", icon: "areas", fill: "areasFill" },
  { id: "signs", title: "Signs", icon: "signs", fill: "signsFill" },
  { id: "tarot", title: "Tarot", icon: "tarot", fill: "tarot", badge: "Soon" },
  { id: "sky", title: "Sky", icon: "sky", fill: "sky" },
];

function buildTabs() {
  // Phone: the system tab bar along the bottom.
  $("tabBar").innerHTML = TABS.map((t) =>
    `<a href="${t.href || "#" + t.id}" data-tab="${t.id}"><span class="ic"><span class="line">${icon(t.icon)}</span><span class="fill">${icon(t.fill)}</span>` +
    `${t.badge ? `<span class="badge" aria-hidden="true">${t.badge}</span>` : ""}</span>` +
    `<span>${t.title}</span>${t.badge ? `<span class="sr-only">, coming soon</span>` : ""}</a>`).join("");
  // iPad and wider: the floating pill, with the sidebar button first.
  $("topTabs").innerHTML =
    `<button type="button" id="sidebarOpen" aria-label="Show Sidebar" aria-controls="sidebar" aria-expanded="false">${icon("sidebar")}</button>` +
    TABS.map((t) => `<a href="${t.href || "#" + t.id}" data-tab="${t.id}">${t.title}${t.badge ? `<span class="badge" aria-hidden="true">${t.badge}</span><span class="sr-only">, coming soon</span>` : ""}</a>`).join("");
  $("sideTabs").innerHTML = TABS.map((t) =>
    `<a href="${t.href || "#" + t.id}" data-tab="${t.id}">${icon(t.icon)}<span>${t.title}</span>${t.badge ? `<span class="badge" aria-hidden="true">${t.badge}</span><span class="sr-only">, coming soon</span>` : ""}</a>`).join("");
  $("sidebarClose").innerHTML = icon("sidebar");
  const setSidebar = (open) => {
    document.body.classList.toggle("sidebar-open", open);
    $("sidebarOpen").setAttribute("aria-expanded", String(open));
    store.set("astrolabe.app.sidebar", open ? "1" : "0");
  };
  $("sidebarOpen").addEventListener("click", () => { setSidebar(true); $("sidebarClose").focus(); });
  $("sidebarClose").addEventListener("click", () => { setSidebar(false); $("sidebarOpen").focus(); });
  if (store.get("astrolabe.app.sidebar") === "1") setSidebar(true);
}

// ---------------------------------------------------------------- routing

const scrollMemory = {};
let route = { tab: "chart", page: null };

function parseRoute() {
  const [tab, page] = location.hash.replace(/^#/, "").split("/");
  if (!TABS.some((t) => t.id === tab && !t.href)) return { tab: "chart", page: null };
  return { tab, page: page || null };
}

function routeKey(r) { return r.page ? `${r.tab}/${r.page}` : r.tab; }

function navBar(r) {
  const lead = [], trail = [];
  let title = "";
  const feedback = `<a class="icon" href="/support/" aria-label="Send Feedback">${icon("feedback")}</a>`;
  if (r.tab === "chart" && r.page === "whole") {
    lead.push(`<a class="back" href="#chart">${icon("chevronLeft")}<span>Your Chart</span></a>`);
    title = "Your Whole Chart";
  } else if (r.tab === "chart") {
    lead.push(`<button type="button" id="openSettings" aria-label="Settings" aria-haspopup="dialog">${icon("settings")}</button>`, feedback);
    title = "Your Chart";
  } else if (r.tab === "areas" && r.page) {
    lead.push(`<a class="back" href="#areas">${icon("chevronLeft")}<span>Life Areas</span></a>`);
    title = AREAS.find((a) => a.id === r.page)?.title ?? "Life Areas";
  } else if (r.tab === "areas") {
    lead.push(feedback);
    title = "Life Areas";
  } else if (r.tab === "signs") {
    lead.push(feedback);
    title = "The Twelve";
    trail.push(`<a class="metal-button prints" href="/prints/">Prints</a>`);
  } else if (r.tab === "tarot") {
    title = "Tarot";
  } else if (r.tab === "sky") {
    lead.push(feedback);
    title = "Sky Navigator";
  }
  $("navLeading").innerHTML = lead.join("");
  $("navTrailing").innerHTML = trail.join("");
  $("navTitle").textContent = title;
  document.title = `${title} — Follow My Astrolabe`;
  $("openSettings")?.addEventListener("click", openSettings);
}

function show(r) {
  scrollMemory[routeKey(route)] = window.scrollY;
  route = r;
  navBar(r);
  const screen = r.tab === "chart" ? (r.page === "whole" ? "whole" : "chart")
    : r.tab === "areas" ? (r.page ? "area" : "areas") : r.tab;
  document.querySelectorAll("[data-screen]").forEach((s) => { s.hidden = s.dataset.screen !== screen; });
  document.querySelectorAll("[data-tab]").forEach((a) => {
    if (a.dataset.tab === r.tab) a.setAttribute("aria-current", "page"); else a.removeAttribute("aria-current");
  });
  if (screen === "chart" && current) drawWheel();
  if (screen === "whole") renderWhole();
  if (screen === "areas") renderAreas();
  if (screen === "area") renderArea(r.page);
  if (screen === "tarot") startDeck(); else stopDeck();
  if (screen === "sky") sky?.show(); else sky?.hide();
  window.scrollTo(0, r.page ? 0 : (scrollMemory[routeKey(r)] ?? 0));
}

window.addEventListener("hashchange", () => {
  if ($("sheet").open) closeAllSheets();
  show(parseRoute());
  $("main").focus({ preventScroll: true });
});

// ---------------------------------------------------------------- casting

// An invented person, never saved. The page must not open empty, and it must
// never open on anyone real — see the note on /chart/'s defaults.
const EXAMPLE = {
  id: null, name: "Alex Rivera", relationship: "Example — an invented person",
  date: "1990-03-16", time: "14:15", timeMode: "exact",
  place: { name: "New York, New York, United States", latitude: 40.7128, longitude: -74.0060, timeZoneID: "America/New_York" },
};

function cast(profile) {
  const [y, m, d] = profile.date.split("-").map(Number);
  const [hh, mm] = profile.time.split(":").map(Number);
  const { latitude: lat, longitude: lon, timeZoneID } = profile.place;
  const jd = julianDayFromLocal(y, m, d, hh, mm, timeZoneID);
  const angles = anglesFor(jd, lat, lon);
  const asc = angles[0].longitude;
  const bodies = PLANETS.map((name) => ({ name, longitude: longitudeOf(name, jd), retrograde: isRetrograde(name, jd) }));
  const points = POINTS.map((name) => ({ name, longitude: pointLongitude(name, jd), retrograde: pointIsRetrograde(name, jd) }));
  const ascSign = signAt(asc);
  const houseOf = (lonX) => ((signAt(lonX).index - ascSign.index + 12) % 12) + 1;
  const houseSign = (h) => SIGNS[(ascSign.index + h - 1) % 12];
  // Every aspect between planets, tightest first (BirthChart.aspects).
  const aspects = [];
  for (let i = 0; i < bodies.length; i++) {
    for (let j = i + 1; j < bodies.length; j++) {
      const hit = matchAspect(bodies[i].longitude, bodies[j].longitude);
      if (hit) aspects.push({ a: bodies[i].name, b: bodies[j].name, kind: hit.kind, orb: hit.orb, separation: hit.separation });
    }
  }
  aspects.sort((x, y2) => x.orb - y2.orb);
  return { jd, angles, asc, mc: angles[1].longitude, bodies, points, lat, ascSign, houseOf, houseSign, aspects };
}

// Labels, as the app formats them.
const degIn = (lon) => norm(lon) % 30;
const label = (lon, retro = false) => `${Math.round(degIn(lon))}° ${signAt(lon).name}${retro ? " ℞" : ""}`;
const degMin = (lon) => {
  let d = Math.floor(degIn(lon)), m = Math.round((degIn(lon) - d) * 60);
  if (m === 60) { m = 0; d += 1; }
  return `${d}° ${m}' ${signAt(lon).name}`;
};
const shortDate = (iso) => {
  const [y, m, d] = iso.split("-").map(Number);
  return new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", year: "numeric", timeZone: "UTC" }).format(Date.UTC(y, m - 1, d));
};
const clock = (hhmm) => {
  const [h, m] = hhmm.split(":").map(Number);
  return `${((h + 11) % 12) + 1}:${String(m).padStart(2, "0")} ${h < 12 ? "AM" : "PM"}`;
};
const planetName = (n) => PLANET_NAMES[n];
const body = (c, n) => c.bodies.find((b) => b.name === n);
/** The planet ruling a house's sign, and where it landed (BirthChart.dispositor). */
const dispositor = (c, house) => {
  const name = rulerOf(c.houseSign(house)).toLowerCase();
  return body(c, name) ?? null;
};

// ---------------------------------------------------------------- readings

let readings = null;
let readingsFor = null;
let readingsError = null;
let readingsLoading = false;
let inFlight = null;

async function loadReadings(profile) {
  const key = profile.id ?? "example";
  if (readingsFor === key && (readings || readingsLoading)) return;
  readings = null; readingsError = null; readingsFor = key; readingsLoading = true;
  inFlight?.abort();
  const controller = new AbortController();
  inFlight = controller;
  rerenderReadingViews();
  try {
    const answer = await fetchReadings(profile, { signal: controller.signal });
    if (controller !== inFlight) return;
    readings = answer;
    if (!answer) readingsError = "Readings need an exact birth time.";
  } catch (e) {
    if (controller !== inFlight) return;
    readingsError = e.message;
  }
  readingsLoading = false;
  rerenderReadingViews();
}

function rerenderReadingViews() {
  if (route.tab === "areas") route.page ? renderArea(route.page) : renderAreas();
  if (route.tab === "chart" && route.page === "whole") renderWhole();
  if (current) renderReadout();
  // A sheet open over the change is refreshed in place, never re-focused,
  // and the profile form is left alone so nothing typed into it is lost.
  if ($("sheet").open && sheetStack.length && sheetStack.at(-1).kind !== "editor") renderTopSheet({ refresh: true });
}

// ---------------------------------------------------------------- the chart tab

let current = null;   // the profile on screen
let chart = null;     // its cast
let selectedHouse = null;
const wheelStyle = () => store.get("astrolabe.app.wheelStyle") === "wheel" ? "wheel" : "instrument";
const showAspectLines = () => store.get("astrolabe.app.aspectLines") !== "off";

const instrument = mountInstrument($("instrument"), {
  onSelect: ({ house, planet }) => {
    if (planet) { selectedHouse = null; renderReadout(); openSheet({ kind: "planet", name: planet, fromInstrument: true }); return; }
    if (house) { selectedHouse = house; renderReadout(); openSheet({ kind: "house", house }); return; }
    // A second tap on the same house lets it go.
    selectedHouse = null; renderReadout();
  },
});

function instrumentChart(c) {
  // Selena sits exactly opposite Lilith, so the instrument leaves it off its
  // rete, as it always has; the list and the Wheel carry all four points.
  return { ascendantLongitude: c.asc, midheavenLongitude: c.mc, latitude: c.lat, bodies: c.bodies,
    points: c.points.filter((p) => p.name !== "whiteMoonSelena").map((p) => ({ ...p, isPoint: true, glyph: POINT_INFO[p.name].glyph })) };
}

function drawWheel() {
  if (!chart) return;
  const style = wheelStyle();
  document.querySelectorAll("#styleToggle button").forEach((b) => b.setAttribute("aria-selected", String(b.dataset.style === style)));
  $("instrument").hidden = style !== "instrument";
  $("flatWheel").hidden = style !== "wheel";
  $("aspectToggle").hidden = style !== "wheel";
  $("aspectToggle").textContent = showAspectLines() ? "Hide Aspect Lines" : "Show Aspect Lines";
  if (style === "wheel") {
    $("flatWheel").innerHTML = chartWheelSVG(chart, {
      selectedHouse, showAspects: showAspectLines(),
      sunSign: signAt(body(chart, "sun").longitude).name,
      studArt: wheelStudArt(),
    });
  }
}

// The Wheel's studs are the instrument's, struck at the size they'll show
// (a stud is 0.072 of the wheel) in the current metal and finish. Each one
// is kept, so tapping round the wheel doesn't strike them all again.
const canStrikeStuds = (() => {
  try { return typeof document.createElement("canvas").getContext("2d").createConicGradient === "function"; }
  catch { return false; }
})();
const studCache = new Map();
function wheelStudArt() {
  const width = $("flatWheel").getBoundingClientRect().width;
  if (!canStrikeStuds || !width) return undefined;
  const px = Math.round(width * 0.072 * 2) / 2;
  const { metal, tarnished } = resolve().instrument;
  const dpr = window.devicePixelRatio || 1;
  return (b) => {
    const key = [b.name, b.retrograde, b.glyph, b.apside, px, metal, tarnished, dpr].join("|");
    if (!studCache.has(key)) {
      try {
        const { href, box } = studImage(b, px, { metal, tarnished, dpr });
        studCache.set(key, { href, px, boxRatio: box / px });
      } catch (err) {
        console.error(err);
        studCache.set(key, null);
      }
    }
    return studCache.get(key);
  };
}

$("styleToggle").addEventListener("click", (e) => {
  const b = e.target.closest("button[data-style]");
  if (!b) return;
  store.set("astrolabe.app.wheelStyle", b.dataset.style);
  drawWheel();
  renderReadout();
});
$("styleToggle").addEventListener("keydown", (e) => {
  if (e.key !== "ArrowLeft" && e.key !== "ArrowRight") return;
  const next = wheelStyle() === "wheel" ? "instrument" : "wheel";
  store.set("astrolabe.app.wheelStyle", next);
  drawWheel(); renderReadout();
  document.querySelector(`#styleToggle [data-style="${next}"]`).focus();
});
$("aspectToggle").addEventListener("click", () => {
  store.set("astrolabe.app.aspectLines", showAspectLines() ? "off" : "on");
  drawWheel();
});
// The Wheel's houses and studs.
function wheelActivate(target) {
  const g = target.closest?.("[data-house],[data-planet],[data-point]");
  if (!g) return;
  if (g.dataset.planet) openSheet({ kind: "planet", name: g.dataset.planet });
  else if (g.dataset.point) openSheet({ kind: "point", name: g.dataset.point });
  else { selectedHouse = Number(g.dataset.house); drawWheel(); renderReadout(); openSheet({ kind: "house", house: selectedHouse }); }
}
$("flatWheel").addEventListener("click", (e) => wheelActivate(e.target));
$("flatWheel").addEventListener("keydown", (e) => {
  if (e.key === "Enter" || e.key === " ") { e.preventDefault(); wheelActivate(e.target); }
});

/** BirthChartView.holdsText. */
function holdsText(c, h) {
  const planets = c.bodies.filter((b) => c.houseOf(b.longitude) === h).map((b) => `${PLANET_GLYPHS[b.name]} ${planetName(b.name)}`);
  const points = c.points.filter((p) => c.houseOf(p.longitude) === h).map((p) => `${POINT_INFO[p.name].glyph} ${POINT_INFO[p.name].name}`);
  if (planets.length) return [...planets, ...points].join(", ");
  if (!points.length) return "No Planets — Read through Its Ruler";
  return `No Planets, but ${points.join(" and ")} ${points.length > 1 ? "Are" : "Is"} — Read through Its Ruler`;
}

function houseCountingNote(c) {
  if (c.ascSign.index === 0) {
    return "Houses count from your own rising sign, not the fixed wheel you may already know. Yours starts at Aries, so your houses do line up with the generic version — that's your rising sign agreeing with it, not the wheel being fixed.";
  }
  return `Houses count from your own rising sign, not the fixed wheel you may already know — your first house is ${c.ascSign.name}, not Aries, so every house after it lands on a different sign than the generic version does.`;
}

function renderReadout() {
  if (!chart) return;
  const c = chart;
  const row = (k, v) => `<div class="readout-row"><span class="plate-label">${esc(k)}</span><span class="v">${v}</span></div>`;
  if (selectedHouse) {
    const s = c.houseSign(selectedHouse);
    $("readout").innerHTML =
      row(`House ${ROMAN[selectedHouse - 1]}`, `<span class="glyph">${s.glyph}</span> ${s.name}`) +
      row("Keynote", esc(s.keynote)) + row("Ruled by", esc(rulerOf(s))) + row("Holds", esc(holdsText(c, selectedHouse)));
    return;
  }
  const order = ["ascendant", "midheaven", "descendant", "imumCoeli"];
  const angles = order.map((k) => c.angles.find((a) => a.kind === k)).filter(Boolean);
  $("readout").innerHTML =
    `<div class="stack gap-8"><span class="plate-label center">The Four Angles</span><div class="angles-grid">` +
    angles.map((a) => `<button type="button" data-angle="${a.kind}" aria-label="${ANGLE_INFO[a.kind].name}, ${label(a.longitude)}">` +
      `<span class="abbr">${ANGLE_INFO[a.kind].abbreviation}</span>` +
      `<span class="pos"><span class="glyph">${signAt(a.longitude).glyph}</span> ${label(a.longitude)}</span>` +
      `<span class="nm">${ANGLE_INFO[a.kind].name}</span></button>`).join("") +
    `</div></div><hr class="divider">` +
    `<p class="note">Tap a House or Planet to open it.</p>` +
    `<p class="small">${esc(houseCountingNote(c))}</p>` +
    (wheelStyle() === "instrument"
      ? `<hr class="divider"><p class="small">The outer ring is fixed and carries the houses. The pierced disc above it turns and carries the zodiac — the tapered blades reaching off its ring are star pointers, each aimed at one real bright star. Brass studs riding the disc are the planets.</p>`
      : "");
}
$("readout").addEventListener("click", (e) => {
  const b = e.target.closest("button[data-angle]");
  if (b) openSheet({ kind: "angle", angle: b.dataset.angle });
});

function renderPlacements() {
  const c = chart;
  const anyRetro = c.bodies.some((b) => b.retrograde) || c.points.some((p) => p.retrograde);
  $("rxKey").hidden = !anyRetro;
  const row = (glyph, name, lon, retro, data, aria) =>
    `<li><button type="button" class="placement-row" ${data} aria-label="${esc(aria)}">` +
    `<span class="g glyph" aria-hidden="true">${glyph}</span><span class="n">${esc(name)}</span>` +
    `<span class="d">${degMin(lon)}</span>${retro ? '<span class="rx" aria-hidden="true">℞</span>' : ""}</button></li>`;
  $("placements").innerHTML = [
    ...c.bodies.map((b) => row(PLANET_GLYPHS[b.name], planetName(b.name), b.longitude, b.retrograde, `data-planet="${b.name}"`,
      `${planetName(b.name)}, ${degMin(b.longitude)}${b.retrograde ? ", retrograde" : ""}`)),
    ...c.points.map((p) => {
      const apside = p.name === "blackMoonLilith" || p.name === "whiteMoonSelena";
      const g = apside ? moonApsideGlyph(p.name === "blackMoonLilith", 15) : POINT_INFO[p.name].glyph;
      return row(g, POINT_INFO[p.name].name, p.longitude, p.retrograde, `data-point="${p.name}"`,
        `${POINT_INFO[p.name].name}, ${degMin(p.longitude)}${p.retrograde ? ", retrograde" : ""}`);
    }),
    ...c.angles.filter((a) => a.kind === "ascendant" || a.kind === "midheaven").map((a) =>
      row(`<span class="ab">${ANGLE_INFO[a.kind].abbreviation}</span>`, ANGLE_INFO[a.kind].name, a.longitude, false, `data-angle="${a.kind}"`,
        `${ANGLE_INFO[a.kind].name}, ${degMin(a.longitude)}`)),
  ].join("");
}
$("placements").addEventListener("click", (e) => {
  const b = e.target.closest("button");
  if (!b) return;
  if (b.dataset.planet) openSheet({ kind: "planet", name: b.dataset.planet });
  else if (b.dataset.point) openSheet({ kind: "point", name: b.dataset.point });
  else if (b.dataset.angle) openSheet({ kind: "angle", angle: b.dataset.angle });
});

function open(profile) {
  current = profile;
  if (profile.id) selectProfile(profile.id);
  chart = cast(profile);
  selectedHouse = null;
  $("chartName").textContent = profile.name;
  $("chartSummary").textContent = `${shortDate(profile.date)} · ${clock(profile.time)} · ${profile.place.name || "Coordinates entered by hand"}` +
    (profile.unsaved ? " — this browser won't let the page save it" : "");
  $("editPerson").textContent = profile.id ? "Edit" : "Add Yourself";
  $("editPerson").setAttribute("aria-label", profile.id ? `Edit ${profile.name}` : "Add yourself");
  $("chartView").hidden = false;
  $("empty").hidden = true;
  renderPlacements();
  renderReadout();
  const sun = signAt(body(chart, "sun").longitude).name;
  // Drawn once the view is showing, because a hidden canvas has no width.
  instrument.show(instrumentChart(chart), `Birth chart for ${profile.name}: ${chart.ascSign.name} rising, Sun in ${sun}`);
  drawWheel();
  loadReadings(profile);
  rerenderReadingViews();
}

$("editPerson").addEventListener("click", () => current?.id ? edit(getProfile(current.id)) : edit(null));

function boot() {
  const people = listProfiles();
  if (!people.length) {
    current = null; chart = null;
    $("chartView").hidden = true;
    $("empty").hidden = false;
    rerenderReadingViews();
    return;
  }
  open(people.find((p) => p.id === selectedProfileId()) ?? people[0]);
}
$("startAdd").addEventListener("click", () => edit(null));
$("showExample").addEventListener("click", () => open(EXAMPLE));

// ---------------------------------------------------------------- Your Whole Chart

function renderWhole() {
  const out = [`<div class="stack" style="gap:4px"><h2 class="display" style="font-size:27px">Your Whole Chart</h2>` +
    `<p class="muted" style="font-size:13px">Sun, Moon, Rising, and your chart ruler — read together, not one at a time.</p></div>`];
  if (!chart) {
    out.push(`<p class="body14">Cast a chart first to see it read as a whole.</p>`);
  } else {
    const c = chart;
    const glance = readings?.atAGlance;
    out.push(`<div class="rcard"><span class="plate-label">At a Glance</span>` +
      (glance ? `<p>${md(glance)}</p>` : `<p class="muted">${esc(readingsError ?? "Reading the chart…")}</p>`) + `</div>`);
    const ruler = body(c, rulerOf(c.ascSign).toLowerCase());
    out.push(`<div class="rcard"><span class="plate-label">Your Chart at a Glance</span><dl class="glance" style="margin:0">` +
      `<div><dt>Sun</dt><dd>${signAt(body(c, "sun").longitude).name}</dd></div>` +
      `<div><dt>Moon</dt><dd>${signAt(body(c, "moon").longitude).name}</dd></div>` +
      `<div><dt>Rising</dt><dd>${c.ascSign.name}</dd></div>` +
      `<div><dt>Chart Ruler</dt><dd>${planetName(ruler.name)} · ${ORDINAL[c.houseOf(ruler.longitude) - 1]} house</dd></div></dl></div>`);
    out.push(passMismatchNote());
  }
  $("wholeBody").innerHTML = out.join("");
}

// ---------------------------------------------------------------- Areas

function areaSign(c, area) { return area.house ? c.houseSign(area.house) : c.ascSign; }

function renderAreas() {
  const el = $("areasBody");
  if (!chart) {
    el.innerHTML = `<p class="intro" style="padding:40px 20px">Cast your chart first — the areas are read off of it.</p>`;
    return;
  }
  const c = chart;
  const card = (area) => {
    const s = areaSign(c, area);
    const ruler = area.house ? rulerOf(s) : rulerOf(c.ascSign);
    const framed = area.id === "purpose";
    return `<a class="area-card${framed ? " framed" : ""}" href="#areas/${area.id}">` +
      `<span class="medallion" style="--tint: var(--el-${s.element})" aria-hidden="true"><span class="glyph">${s.glyph}</span></span>` +
      `<span class="txt"><span class="top"><span class="t">${area.title}</span>` +
      `<span class="plate-label">${area.house ? `House ${ROMAN[area.house - 1]}` : "Chart Ruler"}</span></span>` +
      `<span class="s">${s.name} · ${ruler}</span><span class="c">${esc(area.covers)}</span></span>` +
      (framed ? filigree({ radius: 11, mode: "card" }) : "") + `</a>`;
  };
  el.innerHTML =
    `<p class="intro">Six ways of reading the same wheel. The first is the planet that rules the whole chart; the other five are houses.</p>` +
    `<div style="padding-block:10px">${card(AREAS[0])}</div>` +
    `<div class="area-grid">${AREAS.slice(1).map(card).join("")}</div>`;
  mountFiligrees(el);
}

let shownPeriod = "daily";
const PERIODS = [["daily", "Daily"], ["weekly", "Weekly"], ["monthly", "Monthly"], ["yearly", "Yearly"]];

function renderArea(id) {
  const area = AREAS.find((a) => a.id === id);
  const el = $("areaBody");
  if (!area) { location.hash = "#areas"; return; }
  if (!chart) { el.innerHTML = `<p class="intro" style="padding:40px 20px">Cast your chart first — the areas are read off of it.</p>`; return; }
  const c = chart;
  const s = areaSign(c, area);
  const served = readings?.areas?.find((a) => a.area === id);
  const out = [];

  // Header, nameplate, and the sign it reads.
  let plate;
  if (served) {
    const desc = served.nameplateDescription
      ? `<p class="plate-desc">${md(served.nameplateDescription)}</p>`
      : "";
    plate = `<div class="nameplate"><div class="plate-word" role="img" aria-label="${esc(served.nameplate)}"><i></i><i></i><i></i><i></i>${esc(served.nameplate)}</div>${desc}</div>`;
  } else {
    plate = `<p class="hint">${esc(readingsError ?? "Reading the plate…")}</p>`;
  }
  out.push(`<div class="area-head"><span class="plate-label">${area.motto}</span><h2>${area.title}</h2>${plate}` +
    `<div class="sign-row"><span class="big glyph" style="color: var(--el-${s.element})" aria-hidden="true">${s.glyph}</span>` +
    `<span class="stack" style="gap:2px"><span class="nm">${s.name}</span><span class="sub">${area.house ? `House ${ROMAN[area.house - 1]}` : "Ruler of the whole chart"}</span></span></div></div>`);

  // The reading of the wheel itself.
  out.push(area.house ? houseBody(c, area.house) : purposeBody(c));

  // Horoscope (AreaHoroscopeSection).
  const h = readings?.horoscopes?.find((x) => x.area === id && x.period === shownPeriod);
  const strip = `${shownPeriod.toUpperCase()} · ${area.title.toUpperCase()} · ${s.name.toUpperCase()}`;
  let reading;
  if (h) {
    const lead = h.detail ? h.detail : h.instruction;
    reading = `<p class="h-lead">${md(lead)}</p>` + (h.clause ? `<p class="h-clause">${md(h.clause)}</p>` : "") +
      (h.detail ? `<p class="h-instruction">${md(h.instruction)}</p>` : "") +
      `<div class="h-sky"><p>${esc(h.stripLine)}</p></div>`;
  } else {
    reading = `<p class="h-clause">${esc(readingsError ?? "Reading today's sky…")}</p>`;
  }
  out.push(`<div class="section horoscope"><span class="plate-label">Horoscope</span>` +
    `<div class="periods" role="group" aria-label="Period">` + PERIODS.map(([p, t]) =>
      `<button type="button" data-period="${p}" aria-pressed="${p === shownPeriod}">${t}</button>`).join("") +
    `</div><div class="h-panel">${signTile(s, { full: true })}<span class="plate-label">${esc(strip)}</span>${reading}${filigree({ radius: 12, mode: "panel" })}</div>` +
    `</div>`);
  el.innerHTML = out.join("");
  mountFiligrees(el);
}

$("areaBody").addEventListener("click", (e) => {
  const p = e.target.closest("button[data-period]");
  if (p) {
    shownPeriod = p.dataset.period;
    renderArea(route.page);
    $("areaBody").querySelector(`button[data-period="${shownPeriod}"]`)?.focus();
    return;
  }
  handleDetailClick(e);
});

// ---------------------------------------------------------------- shared reading bodies

function occupantRow(c, b) {
  return `<div class="occupant"><span class="g glyph" aria-hidden="true">${PLANET_GLYPHS[b.name]}</span><span class="stack" style="gap:4px">` +
    `<span class="what">${subject(planetName(b.name), true)} at ${label(b.longitude, b.retrograde)}</span>` +
    (b.retrograde ? `<span class="note">Retrograde — moving backwards against the stars at your birth</span>` : "") + `</span></div>`;
}
function pointRow(c, p) {
  const apside = p.name === "blackMoonLilith" || p.name === "whiteMoonSelena";
  const g = apside ? moonApsideGlyph(p.name === "blackMoonLilith", 20) : POINT_INFO[p.name].glyph;
  return `<div class="occupant"><span class="g glyph" aria-hidden="true">${g}</span><span class="stack" style="gap:1px">` +
    `<span class="what">${POINT_INFO[p.name].name} at ${label(p.longitude, p.retrograde)}</span>` +
    (p.retrograde ? `<span class="note">Retrograde — moving backwards against the stars at your birth</span>` : "") + `</span></div>`;
}
const aspectTitle = (a) => `${planetName(a.a)} ${a.kind.id} ${planetName(a.b)}`;
function aspectRow(a) {
  const tight = a.orb <= 2;
  const sub = `${a.kind.temper} · ${a.orb.toFixed(1)}° from exact${tight ? " · tight" : ""}`;
  return `<button type="button" class="aspect-row" data-aspect="${a.a}|${a.b}" aria-label="${esc(aspectTitle(a))}, ${sub}. Opens its own explanation.">` +
    `<span class="k glyph${tight ? " tight" : ""}" aria-hidden="true">${a.kind.glyph}</span>` +
    `<span class="tx"><span>${esc(aspectTitle(a))}</span><span>${sub}</span></span><span class="chev">${icon("chevronRight")}</span></button>`;
}
/** HouseReadingBody: what sits in the house, what it's tied to, and where its ruler went. */
function houseBody(c, house) {
  const s = c.houseSign(house), roman = ROMAN[house - 1];
  const inHouse = c.bodies.filter((b) => c.houseOf(b.longitude) === house);
  const pts = c.points.filter((p) => c.houseOf(p.longitude) === house);
  const aspects = c.aspects.filter((a) => inHouse.some((b) => b.name === a.a || b.name === a.b));
  const pointHouseList = pts.map((p) => POINT_INFO[p.name].houseDescriptor).join(" and ");
  const headerTitle = !inHouse.length && !pts.length ? "Nobody home" : !inHouse.length ? "Not Quite Empty" : "What sits here";
  const occupants = (introSaid) => {
    let h = `<div class="section"><span class="plate-label">${headerTitle}</span>`;
    if (!inHouse.length && !pts.length) {
      if (!introSaid) h += `<p>No planet falls in your ${roman}. That's ordinary — there are ten bodies and twelve houses, so at least two are always empty. An empty house is read through its ruler instead, which is where ${rulerSubject(s)} has landed, below.</p>`;
    } else {
      if (!inHouse.length && !introSaid) h += `<p>No planet falls in your ${roman}, but it does house ${pointHouseList} — an empty house isn't quite the same as an untouched one. It's still read through its ruler too, which is where ${rulerSubject(s)} has landed, below.</p>`;
      h += inHouse.map((b) => occupantRow(c, b)).join("") + pts.map((p) => pointRow(c, p)).join("");
    }
    return h + `</div>`;
  };
  const aspectSection = aspects.length
    ? `<div class="section"><span class="plate-label">What It's Tied To</span><p class="small">Aspects from your ${roman} out to the rest of the chart. Tighter is louder — anything within two degrees is doing real work. Tap one to see what it means.</p>` +
      aspects.slice(0, 6).map(aspectRow).join("") + `</div>`
    : "";
  const d = dispositor(c, house);
  let ruler = `<div class="section"><span class="plate-label">Where Its Ruler Went</span>`;
  if (d) {
    const dh = c.houseOf(d.longitude);
    if (dh === house) {
      ruler += `<p>${s.name} answers to ${subject(planetName(d.name))}, and ${subject(planetName(d.name))} sits right here — this house rules itself, running on its own terms rather than through anywhere else.</p>`;
    } else {
      ruler += `<p>${s.name} answers to ${subject(planetName(d.name))}, and your ${planetName(d.name)} sits at ${label(d.longitude, d.retrograde)} in the ${ORDINAL[dh - 1]} — your ${HOUSE_TITLES[dh - 1]} house.</p>` +
        `<p>However your ${roman} behaves, it tends to play out there: ${esc(HOUSE_ESSENCES[dh - 1])}</p>`;
    }
  } else {
    ruler += `<p>${s.name} answers to ${rulerSubject(s)}.</p>`;
  }
  return `<div class="stack gap-18" style="text-align:left">${occupants(false)}${aspectSection}${ruler}</div></div>`;
}

/** PurposeReadingBody: the chart ruler, where it sits, and what it's tied to. */
function purposeBody(c) {
  const p = body(c, rulerOf(c.ascSign).toLowerCase());
  if (!p) return "";
  const h = c.houseOf(p.longitude);
  const aspects = c.aspects.filter((a) => a.a === p.name || a.b === p.name);
  return `<div class="stack gap-18" style="text-align:left">` +
    `<div class="section"><span class="plate-label">Where It Sits</span>` +
    `<div class="occupant" style="align-items:center"><span class="g glyph" aria-hidden="true">${PLANET_GLYPHS[p.name]}</span><span class="stack" style="gap:1px">` +
    `<span class="what">${subject(planetName(p.name), true)} at ${label(p.longitude, p.retrograde)}, your ${ORDINAL[h - 1]} house</span>` +
    (p.retrograde ? `<span class="note">${esc(retrogradeNote(planetName(p.name)))}</span>` : "") + `</span></div>` +
    `<p style="font-size:13px;font-weight:600;color:var(--brass)">${HOUSE_TITLES[h - 1]} — ${esc(HOUSE_COVERS[h - 1])}</p>` +
    `<p class="small" style="font-size:13px">${esc(HOUSE_ESSENCES[h - 1])}</p></div>` +
    (aspects.length ? `<div class="section"><span class="plate-label">What It's Tied To</span><p class="small">Aspects your chart ruler makes to the rest of the chart. Tighter is louder — anything within two degrees is doing real work. Tap one to see what it means.</p>${aspects.slice(0, 6).map(aspectRow).join("")}</div>` : "") +
    `<div class="section"><span class="plate-label">What Keeps It Fed</span><p class="small">Purpose isn't a sector of the wheel. It's the planet ruling your rising sign, and it depends on your birth time twice over, since the rising sign moves a whole sign every two hours. Get the minute wrong and this is the reading that changes first.</p></div>` +
    `</div>`;
}

function signTile(s, { full = false } = {}) {
  const src = `/assets/signs/${s.name.toLowerCase()}${full ? "" : "-thumb"}.jpg`;
  return `<div class="tile" style="--tint: color-mix(in srgb, var(--el-${s.element}) 24%, var(--panel))">` +
    `<img src="${src}" alt="${s.name}, illustrated in a batik style" loading="lazy" decoding="async" width="${full ? 1600 : 360}" height="${full ? 1200 : 270}"></div>`;
}

// ---------------------------------------------------------------- Signs

function renderSigns() {
  $("signGrid").innerHTML = SIGNS.map((s) =>
    `<button type="button" class="sign-card" data-sign="${s.index}">${signTile(s)}` +
    `<span class="meta"><span class="nm">${s.name}</span><span class="el-line" style="color: var(--el-${s.element})">${s.element} · ${s.ruler}</span></span></button>`).join("");
}
$("signGrid").addEventListener("click", (e) => {
  const b = e.target.closest("button[data-sign]");
  if (b) openSheet({ kind: "sign", index: Number(b.dataset.sign) });
});

// ---------------------------------------------------------------- Tarot (Coming Soon)

function ribbon(size) { return `<span class="ribbon" style="--ribbon-size:${size}px" aria-hidden="true">Coming Soon!</span>`; }

function renderTarot() {
  // TarotView.cardOfTheDay: the deck in order, one card per local day.
  const card = TAROT[readerDay() % TAROT.length];
  const tint = card.tint === "planet" ? "var(--brass)" : `var(--el-${card.tint})`;
  $("tarotBody").innerHTML =
    `<div class="soon-head"><h2>Full Tarot Is on Its Way</h2>` +
    `<p>Draw your own cards, keep the ones that matter, and read meanings written against your actual chart, not just the card. Below: today's card, and a first look at the rest of the deck.</p></div>` +
    `<div class="stack gap-10" style="align-items:center"><div class="preview-card" style="width:220px">` +
    `<div class="clip"><div class="art tarot-face" style="--tint:${tint}" aria-hidden="true"><span class="g glyph">${card.glyph}</span><span class="r">${card.roman}</span></div></div>` +
    `<div class="frame"></div>${ribbon(34)}</div>` +
    `<div class="tarot-name"><span class="n">${card.name}</span><span class="k">${card.keynote}</span></div>` +
    `<p class="sr-only">Today's card, ${card.name}: ${card.keynote}. Its art is still being made.</p></div>` +
    `<div class="button-plate" style="align-items:center;text-align:center">` +
    `<span class="metal-button inert" aria-hidden="true">${icon("shuffle")}<span>Ask Again</span></span>` +
    `<p>Drawing again arrives with full Tarot. Until then, this is how it will look.</p></div>` +
    `<div class="deck-head"><h3>The Rest of the Deck</h3><p>All twenty-two Major Arcana, made in the same batik style as the rest of Astrolabe — still face-down while the art finishes.</p>` +
    `<div class="deck" role="img" aria-label="A fan of face-down cards, standing in for the rest of the deck, still to come.">` +
    [0, 1, 2, 3, 4].map((i) => `<img src="/app/art/card-back.jpg" alt="" data-card="${i}" width="80" height="120">`).join("") + `</div></div>`;
  layDeck();
}

// ShufflingDeckFan: five backs fanned 5° apart, one lifted and slipped back
// into a new place every couple of seconds. Still under reduced motion.
let deckOrder = [0, 1, 2, 3, 4];
let deckTimer = 0;
function layDeck(pulled = null, lift = 0, tilt = 0) {
  document.querySelectorAll(".deck img").forEach((img) => {
    const id = Number(img.dataset.card);
    const slot = deckOrder.indexOf(id);
    const x = (slot - 2) * 46 - 40;
    const up = id === pulled;
    img.style.transform = `translateX(${x}px) translateY(${up ? -lift : 0}px) rotate(${up ? tilt : (slot - 2) * 5}deg) scale(${up ? 1.1 : 1})`;
    img.style.zIndex = up ? 100 : slot;
  });
}
function startDeck() {
  stopDeck();
  if (reduceMotion()) return;
  const step = () => {
    deckTimer = setTimeout(() => {
      const pick = deckOrder[Math.floor(Math.random() * 5)];
      layDeck(pick, 20 + Math.random() * 22, -12 + Math.random() * 24);
      deckTimer = setTimeout(() => {
        deckOrder = deckOrder.filter((x) => x !== pick);
        deckOrder.splice(Math.floor(Math.random() * 5), 0, pick);
        layDeck(pick, 24, 0);
        deckTimer = setTimeout(() => { layDeck(); step(); }, 500);
      }, 300);
    }, 1400 + Math.random() * 1600);
  };
  step();
}
function stopDeck() { clearTimeout(deckTimer); }

// ---------------------------------------------------------------- Sky

// The Sky Navigator lives in sky.js: the dial, the stars actually there, and
// the sensors. It listens only while its tab is showing.
let sky = null;
function renderSky() { sky = mountSky($("skyBody")); }

// ---------------------------------------------------------------- sheets

const sheetStack = [];

function openSheet(spec) {
  sheetStack.push(spec);
  const dlg = $("sheet");
  if (!dlg.open) { dlg.dataset.returnFocus = ""; lastFocus = document.activeElement; dlg.showModal(); }
  renderTopSheet();
}
let lastFocus = null;

function popSheet() {
  const spec = sheetStack.pop();
  if (spec?.kind === "editor") $("editorHome").appendChild($("editForm"));
  if (sheetStack.length) { renderTopSheet(); return; }
  $("sheet").close();
}
function closeAllSheets() {
  if (sheetStack.some((s) => s.kind === "editor")) $("editorHome").appendChild($("editForm"));
  sheetStack.length = 0;
  if ($("sheet").open) $("sheet").close();
}
$("sheetClose").addEventListener("click", popSheet);
$("sheet").addEventListener("cancel", (e) => { e.preventDefault(); popSheet(); });
$("sheet").addEventListener("click", (e) => { if (e.target === $("sheet")) closeAllSheets(); });
$("sheet").addEventListener("close", () => {
  if (sheetStack.length) closeAllSheets();
  // A planet tapped on the instrument stays lit only while its sheet is up,
  // as the app's does; recasting the view lets it go.
  if (chart && wheelStyle() === "instrument" && !selectedHouse) {
    instrument.show(instrumentChart(chart), $("instrument").querySelector("canvas")?.getAttribute("aria-label") ?? "");
  }
  lastFocus?.focus?.({ preventScroll: true });
});

function renderTopSheet({ refresh = false } = {}) {
  const spec = sheetStack[sheetStack.length - 1];
  if (!spec) return;
  const titleEl = $("sheetTitle");
  titleEl.textContent = "";
  let html = "";
  switch (spec.kind) {
    case "planet": html = planetSheet(spec.name); titleEl.textContent = ""; break;
    case "point": html = pointSheet(spec.name); break;
    case "angle": html = angleSheet(spec.angle); break;
    case "house": html = houseSheet(spec.house); break;
    case "aspect": html = aspectSheet(spec.a, spec.b); break;
    case "sign": html = signSheet(spec.index); break;
    case "settings": titleEl.textContent = "Settings"; html = settingsSheet(); break;
    case "editor": titleEl.textContent = spec.profile ? "Edit Profile" : "Add Profile"; break;
  }
  const bodyEl = $("sheetBody");
  const keepScroll = bodyEl.scrollTop;
  if (spec.kind === "editor") {
    bodyEl.innerHTML = `<div class="readable"></div>`;
    bodyEl.firstChild.appendChild($("editForm"));
  } else {
    bodyEl.innerHTML = `<div class="readable">${html}</div>`;
  }
  if (!titleEl.textContent) {
    // Name the dialog from the sheet's own heading.
    const h = bodyEl.querySelector("h2");
    $("sheet").setAttribute("aria-label", h?.textContent ?? "Details");
    $("sheet").removeAttribute("aria-labelledby");
  } else {
    $("sheet").setAttribute("aria-labelledby", "sheetTitle");
    $("sheet").removeAttribute("aria-label");
  }
  if (refresh) { bodyEl.scrollTop = keepScroll; return; }
  bodyEl.scrollTop = 0;
  if (spec.kind === "editor") $("fName").focus();
  else $("sheetClose").focus();
}

function handleDetailClick(e) {
  const t = e.target;
  const asp = t.closest("button[data-aspect]");
  if (asp) { const [a, b] = asp.dataset.aspect.split("|"); return openSheet({ kind: "aspect", a, b }); }
  const side = t.closest("button[data-side]");
  if (side) return openSheet({ kind: "planet", name: side.dataset.side });
  return false;
}

$("sheetBody").addEventListener("click", (e) => {
  if (handleDetailClick(e) !== false) return;
  const t = e.target;
  const pick = t.closest("button[data-pick]");
  if (pick) {
    const p = getProfile(pick.dataset.pick);
    if (p) { open(p); renderTopSheet({ refresh: true }); $("sheetBody").querySelector(`[data-pick="${p.id}"]`)?.focus(); }
    return;
  }
  const editBtn = t.closest("button[data-edit]");
  if (editBtn) return edit(getProfile(editBtn.dataset.edit));
  if (t.closest("button[data-add]")) return edit(null);
  if (t.closest("button[data-open-appearance]")) return appearance.open();
});

function detailHead(big, title, sub, sub2 = "", bigClass = "") {
  return `<div class="detail-head"><span class="big glyph ${bigClass}" aria-hidden="true">${big}</span>` +
    `<span class="stack" style="gap:2px"><h2>${esc(title)}</h2><span class="sub">${sub}</span>${sub2 ? `<span class="sub2">${sub2}</span>` : ""}</span></div>`;
}
const section = (labelText, text) => `<div class="section" style="gap:5px"><span class="plate-label">${esc(labelText)}</span><p class="body14">${text}</p></div>`;

function planetSheet(name) {
  const c = chart, b = body(c, name);
  const h = c.houseOf(b.longitude);
  const aspects = c.aspects.filter((a) => a.a === name || a.b === name);
  const rules = Array.from({ length: 12 }, (_, i) => i + 1).filter((x) => rulerOf(c.houseSign(x)) === planetName(name));
  const items = rules.map((x) => `House ${ROMAN[x - 1]} (${c.houseSign(x).name})`);
  const rulesText = items.length === 1 ? `It rules ${items[0]} from here.` : `It rules ${items.slice(0, -1).join(", ")} and ${items.at(-1)} from here.`;
  const kinds = ASPECT_KINDS.filter((k) => aspects.slice(0, 6).some((a) => a.kind.id === k.id));
  const anglesCard = aspects.length ? `<div class="section" style="gap:8px"><span class="plate-label">Its Aspects</span>` +
    aspects.slice(0, 6).map((a) => {
      const other = a.a === name ? a.b : a.a;
      const tight = a.orb <= 2;
      return `<button type="button" class="aspect-row" data-aspect="${a.a}|${a.b}" aria-label="${planetName(name)} ${a.kind.id} ${planetName(other)}, ${a.orb.toFixed(1)} degrees from exact${tight ? ", tight" : ""}. Opens its own explanation.">` +
        `<span class="k glyph${tight ? " tight" : ""}" aria-hidden="true">${a.kind.glyph}</span><span class="tx"><span>${a.kind.id} ${planetName(other)}</span></span>` +
        `<span style="font: 12px var(--font-mono); color: var(--muted)">${a.orb.toFixed(1)}°</span><span class="chev">${icon("chevronRight")}</span></button>`;
    }).join("") +
    `<details class="degrees"><summary>What Do These Degrees Mean?</summary><div class="in">` +
    `<div><h4>The Placement's Own Degree</h4><p>Every sign runs 30 degrees, and ${label(b.longitude, b.retrograde)} is exactly where inside that stretch ${subject(planetName(name))} actually sits — not just "in ${signAt(b.longitude).name}" generally. In this app's whole-sign houses, that degree never changes which house a planet is in; only the sign does that. What it does decide is the aspects below: two planets only really square or trine each other when their degrees line up that way, not just their signs.</p></div>` +
    `<div><h4>The Orb Next to Each Aspect</h4><p>Real placements almost never land on a clean 90° or 120° — the orb is how far off exact an aspect actually is. The tighter the orb, the more exact the aspect, and the more strongly it tends to read; a wide one is still real, just quieter. Anything at 2° or under is marked tight, and worth reading first.</p></div>` +
    `<hr class="divider">` + kinds.map((k) => `<div><h4><span class="glyph" style="color:var(--brass)">${k.glyph}</span> ${k.id[0].toUpperCase() + k.id.slice(1)}</h4><p>${esc(k.meaning)}</p></div>`).join("") +
    `</div></details></div>` : "";
  const out = [detailHead(PLANET_GLYPHS[name], planetName(name), `${label(b.longitude, b.retrograde)} · House ${ROMAN[h - 1]}`)];
  if (b.retrograde) out.push(`<p class="lede">${esc(retrogradeNote(planetName(name)))}</p>`);
  out.push(section("Where It Sits", esc(HOUSE_COVERS[h - 1])));
  if (rules.length) out.push(section("What It Governs", esc(rulesText)));
  out.push(anglesCard);
  return out.join("");
}

function pointSheet(name) {
  const c = chart, p = c.points.find((x) => x.name === name);
  const h = c.houseOf(p.longitude);
  const apside = name === "blackMoonLilith" || name === "whiteMoonSelena";
  const glyph = apside ? moonApsideGlyph(name === "blackMoonLilith", 36) : POINT_INFO[name].glyph;
  const out = [detailHead(glyph, POINT_INFO[name].name, `${label(p.longitude, p.retrograde)} · House ${ROMAN[h - 1]}`)];
  if (name === "chiron" && p.retrograde) out.push(`<p class="lede">${esc(CHIRON_RETROGRADE_NOTE)}</p>`);
  out.push(section("Where It Sits", esc(HOUSE_COVERS[h - 1])));
  return out.join("");
}

function angleSheet(kind) {
  const c = chart, a = c.angles.find((x) => x.kind === kind);
  const h = c.houseOf(a.longitude);
  return detailHead(ANGLE_INFO[kind].abbreviation, ANGLE_INFO[kind].name, `${label(a.longitude)} · House ${ROMAN[h - 1]}`,
    `ruled by ${rulerSubject(signAt(a.longitude))}`, "abbr") +
    section("Where It Sits", esc(HOUSE_COVERS[h - 1]));
}

function houseSheet(house) {
  const c = chart, s = c.houseSign(house);
  return `<div class="stack" style="gap:6px"><span class="plate-label">House ${ROMAN[house - 1]}</span>` +
    `<div class="detail-head" style="gap:10px"><span class="big glyph" style="font-size:34px;color:var(--el-${s.element});min-width:0" aria-hidden="true">${s.glyph}</span>` +
    `<span class="stack" style="gap:2px"><h2 style="font-size:24px">${HOUSE_TITLES[house - 1]}</h2><span class="sub2">${s.name} · ruled by ${rulerSubject(s)}</span></span></div>` +
    `<p style="font-size:12px;color:var(--muted)">${esc(HOUSE_COVERS[house - 1])}</p>` +
    `<p class="body14" style="padding-top:4px">${esc(HOUSE_ESSENCES[house - 1])}</p></div>` + houseBody(c, house);
}

function aspectSheet(aName, bName) {
  const c = chart;
  const a = c.aspects.find((x) => x.a === aName && x.b === bName);
  if (!a) return "";
  const tight = a.orb <= 2;
  const k = a.kind;
  const arithmetic = k.id === "conjunction"
    ? `A conjunction means the two sitting in the same spot. Yours sit ${a.orb.toFixed(1)}° apart, which is the orb above. Anything inside 2° counts as tight, and reads first.`
    : `A ${k.id} is ${k.angle}° of the wheel. Yours sit ${a.separation.toFixed(1)}° apart, so the orb above is ${a.orb.toFixed(1)}°. Anything inside 2° counts as tight, and reads first.`;
  const side = (n) => {
    const b = body(c, n), h = c.houseOf(b.longitude);
    return `<button type="button" class="aspect-row" data-side="${n}" style="padding:10px" aria-label="${planetName(n)} at ${label(b.longitude, b.retrograde)}, house ${h}. Opens its own reading.">` +
      `<span class="k glyph" style="font-size:22px;width:30px;color:var(--bright)" aria-hidden="true">${PLANET_GLYPHS[n]}</span>` +
      `<span class="tx"><span style="font-size:15px">${subject(planetName(n), true)} at ${label(b.longitude, b.retrograde)}</span><span style="font-size:12px">House ${ROMAN[h - 1]} — ${HOUSE_TITLES[h - 1]}</span></span>` +
      `<span class="chev">${icon("chevronRight")}</span></button>`;
  };
  return `<div class="detail-head"><span class="big glyph" style="font-size:38px;color:${tight ? "var(--el-fire)" : "var(--bright)"}" aria-hidden="true">${k.glyph}</span>` +
    `<span class="stack" style="gap:2px"><h2 style="font-size:25px">${esc(aspectTitle(a))}</h2><span class="sub">${k.temper} · ${a.orb.toFixed(1)}° from exact${tight ? " · tight" : ""}</span></span></div>` +
    `<div class="section" style="gap:6px"><span class="plate-label">What a ${k.id[0].toUpperCase() + k.id.slice(1)} Is</span><p class="body14">${esc(k.meaning)}</p><p style="font-size:12px;color:var(--muted)">${arithmetic}</p></div>` +
    `<div class="section"><span class="plate-label">The Two Sides</span>${side(a.a)}${side(a.b)}</div>`;
}

function signSheet(index) {
  const s = SIGNS[index];
  const r = SIGN_READINGS[s.name];
  const c = chart;
  const out = [`<div style="max-width:520px;width:100%;margin-inline:auto">${signTile(s, { full: true })}</div>`,
    `<div class="detail-head" style="gap:10px"><span class="big glyph" style="font-size:34px;color:var(--el-${s.element});min-width:0" aria-hidden="true">${s.glyph}</span>` +
    `<span class="stack" style="gap:2px"><h2>${s.name}</h2><span class="sub2">${s.element[0].toUpperCase() + s.element.slice(1)} · ruled by ${rulerSubject(s)}</span>` +
    `<span style="font-size:12px;color:color-mix(in srgb, var(--muted) 80%, transparent)">${s.dateRange}</span></span></div>`,
    `<p style="font-size:16px;color:var(--ink)">${esc(s.keynote)}</p>`,
    `<div class="section" style="gap:5px"><span class="plate-label">What It Represents</span><p style="font-size:15px">${esc(r.portrait)}</p></div>`,
    // The print, where the app offers it: under the portrait, never ahead of it.
    `<div class="rcard" style="gap:10px"><span class="plate-label">Buy a Print</span>` +
    `<p style="font-size:12px;color:var(--muted)">This tile, printed on real paper — the same art, straight from the original file.</p>` +
    `<p style="font: 400 15px var(--font-display); color: var(--resist)">12 × 16 to 24 × 32 in · prices at checkout</p>` +
    `<a class="metal-button" href="/prints/?sign=${s.name.toLowerCase()}#order" style="align-self:flex-start;font-size:11px;letter-spacing:1.6px;padding:9px 14px;border-radius:7px" aria-label="Order the ${s.name} print">Order</a></div>`,
    section("When It Runs Unchecked", esc(r.shadow)),
  ];
  if (c) {
    const h = ((s.index - c.ascSign.index + 12) % 12) + 1;
    const occ = c.bodies.filter((b) => c.houseOf(b.longitude) === h);
    out.push(`<hr class="divider"><span class="plate-label">In Your Chart</span>` +
      `<p class="body14">${s.name} is your ${ORDINAL[h - 1]} house — ${esc(HOUSE_COVERS[h - 1])}.</p>` +
      (occ.length
        ? occ.map((b) => `<p class="body14"><span class="glyph">${PLANET_GLYPHS[b.name]}</span>  ${planetName(b.name)} at ${label(b.longitude, b.retrograde)}</p>`).join("")
        : `<p style="font-size:13px;color:var(--muted)">No planet of yours sits in it, so it's read through ${rulerSubject(s)}.</p>`));
  }
  return out.join("");
}

// ---------------------------------------------------------------- Settings

function openSettings() { openSheet({ kind: "settings" }); }

function settingsSheet() {
  const people = listProfiles();
  const rows = people.map((p) => {
    const active = current?.id === p.id;
    return `<div class="profile-row"><button type="button" class="pick" data-pick="${p.id}" aria-pressed="${active}">` +
      `<span class="avatar" aria-hidden="true">${icon("person")}</span><span class="stack" style="gap:2px;min-width:0;flex:1">` +
      `<span class="nm">${esc(p.name || "Unnamed")}</span>${p.relationship ? `<span class="rel">${esc(p.relationship)}</span>` : ""}</span>` +
      (active ? `<span class="tick" aria-hidden="true">${icon("check")}</span>` : "") + `</button>` +
      `<button type="button" class="plate-button plate-label" data-edit="${p.id}" aria-label="Edit ${esc(p.name)}">Edit</button></div>`;
  }).join("");
  return `<div class="settings stack gap-18">` +
    `<h3>Profiles</h3><p class="blurb">Cast a chart for yourself, and for anyone else you'd like — a partner, a kid, a friend. Tap a name to switch to their chart. Everyone here is kept in this browser, on this device, with no account.</p>` +
    `<div class="stack gap-10">${rows}<button type="button" class="add-row" data-add>${icon("plusCircle")}<span>Add Profile</span></button></div>` +
    `<hr class="divider">` +
    `<h3>Appearance</h3><p class="blurb">The color scheme, the metal the instrument is struck from, and the type — the same choices the app offers, kept in this browser.</p>` +
    `<button type="button" class="add-row" data-open-appearance aria-haspopup="dialog"><span style="flex:1">Color, Metal, and Type</span><span class="chev">${icon("chevronRight")}</span></button>` +
    `<hr class="divider">` +
    `<p class="links"><a href="/">Follow My Astrolabe</a> · <a href="/prints/">Prints</a> · <a href="/support/">Support</a> · <a href="/privacy/">Privacy Policy</a> · Studio New Moon</p></div>`;
}

// ---------------------------------------------------------------- adding and editing people

let chosenPlace = null;
const zoneSelect = $("fZone");
for (const z of (Intl.supportedValuesOf ? Intl.supportedValuesOf("timeZone") : ["UTC"])) {
  const o = document.createElement("option"); o.value = z; o.textContent = z.replace(/_/g, " "); zoneSelect.appendChild(o);
}

// Pick a birthplace's zone in the list, whatever spelling the browser uses.
// GeoNames names zones as the tz database does today (Asia/Kolkata,
// Europe/Kyiv); some browsers list the older names. Setting a <select> to a
// value it has no option for fails silently and casts hours out, so match on
// the zone each name resolves to. Returns the value selected, or null.
const ZONE_RENAMES = {
  "Europe/Kyiv": "Europe/Kiev", "America/Nuuk": "America/Godthab",
  "Asia/Yangon": "Asia/Rangoon", "Pacific/Kanton": "Pacific/Enderbury",
};
const resolvedZone = (id) => {
  try { return new Intl.DateTimeFormat("en-US", { timeZone: id }).resolvedOptions().timeZone; }
  catch { return null; }
};
function selectZone(select, id) {
  const options = [...select.options];
  if (options.some((o) => o.value === id)) { select.value = id; return id; }
  const target = resolvedZone(id) ?? resolvedZone(ZONE_RENAMES[id]);
  if (!target) return null;
  const match = options.find((o) => o.value === target) ?? options.find((o) => resolvedZone(o.value) === target);
  if (match) { select.value = match.value; return match.value; }
  const o = document.createElement("option");
  o.value = target; o.textContent = target.replace(/_/g, " ");
  select.appendChild(o);
  select.value = target;
  return target;
}

function setChosen(place) {
  chosenPlace = place;
  $("placeChosen").hidden = !place;
  if (place) {
    $("placeChosen").textContent = `${place.label ?? place.name} · ${place.timeZoneID.replace(/_/g, " ")}`;
    $("fLat").value = place.latitude;
    $("fLon").value = place.longitude;
    const zone = selectZone(zoneSelect, place.timeZoneID);
    if (zone && !resolvedZone(place.timeZoneID)) chosenPlace = { ...place, timeZoneID: zone };
  }
}

function edit(profile) {
  const p = profile ?? { name: "", relationship: "", date: "", time: "", place: null };
  $("fName").value = p.name ?? "";
  $("fRel").value = p.relationship ?? "";
  $("fDate").value = p.date ?? "";
  $("fTime").value = p.time ?? "";
  $("fPlace").value = p.place?.name ?? "";
  $("placeResults").hidden = true;
  $("editProblem").hidden = true;
  $("deletePerson").hidden = !profile;
  $("editForm").dataset.id = profile?.id ?? "";
  $("saveButton").textContent = profile ? "Save Changes" : (listProfiles().length ? "Add Profile" : "Cast My Chart");
  setChosen(p.place ? { ...p.place, label: p.place.name } : null);
  if (!p.place) { $("fLat").value = ""; $("fLon").value = ""; zoneSelect.value = Intl.DateTimeFormat().resolvedOptions().timeZone; }
  // Replace an editor already showing rather than stacking a second one.
  if (sheetStack.at(-1)?.kind === "editor") sheetStack.pop();
  openSheet({ kind: "editor", profile });
  prepareSearch();
}

// Place data loads when someone first needs it: a small table of zones and
// region names, then one alphabetical slice of towns on the first keystroke.
let placesReady = null;
function placesUnavailable() {
  $("placeNote").hidden = false;
  $("placeNote").textContent = "Place search isn't available right now, so enter the coordinates below.";
  $("manual").open = true;
}
async function prepareSearch() {
  if (placesReady !== null) return placesReady;
  placesReady = (await loadPlaces()) !== null;
  if (placesReady) $("attribution").hidden = false;
  else placesUnavailable();
  return placesReady;
}

let searchTimer = 0;
// Each keystroke retires the searches before it, so a slow one that finishes
// late can never replace a newer list.
let searchSeq = 0;
$("fPlace").addEventListener("input", () => {
  clearTimeout(searchTimer);
  setChosen(null);
  const seq = ++searchSeq;
  const list = $("placeResults");
  list.hidden = true;
  list.innerHTML = "";
  $("fPlace").setAttribute("aria-expanded", "false");
  searchTimer = setTimeout(async () => {
    if (!(await prepareSearch())) return;
    if (seq !== searchSeq) return;
    const hits = await searchPlaces($("fPlace").value);
    if (seq !== searchSeq) return;
    if (hits === null) return placesUnavailable();
    list.innerHTML = "";
    for (const h of hits) {
      const li = document.createElement("li");
      const b = document.createElement("button");
      b.type = "button";
      b.setAttribute("role", "option");
      b.innerHTML = `${esc(h.label)} <span class="zone">· ${esc(h.timeZoneID.replace(/_/g, " "))}</span>`;
      b.addEventListener("click", () => {
        $("fPlace").value = h.label;
        setChosen(h);
        list.hidden = true;
        $("fPlace").setAttribute("aria-expanded", "false");
        $("fPlace").focus();
      });
      li.appendChild(b);
      list.appendChild(li);
    }
    list.hidden = hits.length === 0;
    $("fPlace").setAttribute("aria-expanded", String(hits.length > 0));
  }, 120);
});

$("editForm").addEventListener("submit", (e) => {
  e.preventDefault();
  const problem = (msg) => { $("editProblem").textContent = msg; $("editProblem").hidden = false; };
  const name = $("fName").value.trim();
  if (!name) return problem("Please give them a name.");
  if (!$("fDate").value || !$("fTime").value) return problem("Please fill in the date and time of birth.");
  const lat = Number($("fLat").value), lon = Number($("fLon").value);
  const hasCoords = $("fLat").value !== "" && $("fLon").value !== "" && Number.isFinite(lat) && Number.isFinite(lon);
  if (!chosenPlace && !hasCoords) return problem("Choose a birth place from the suggestions first — the chart needs a real coordinate.");
  if (chosenPlace && !resolvedZone(chosenPlace.timeZoneID)) {
    return problem("This browser doesn't recognize that place's time zone. Please use “Enter coordinates instead” and choose the time zone from the list.");
  }
  if ((!chosenPlace || $("manual").open) && !resolvedZone(zoneSelect.value)) {
    return problem("Please choose the time zone where they were born.");
  }
  const place = chosenPlace && !$("manual").open
    ? { name: chosenPlace.label ?? chosenPlace.name, latitude: chosenPlace.latitude, longitude: chosenPlace.longitude, timeZoneID: chosenPlace.timeZoneID }
    : { name: $("fPlace").value.trim(), latitude: lat, longitude: lon, timeZoneID: zoneSelect.value };
  let saved;
  try {
    saved = saveProfile({
      id: $("editForm").dataset.id || null, name, relationship: $("fRel").value,
      date: $("fDate").value, time: $("fTime").value, timeMode: "exact", place,
    });
  } catch (err) {
    return problem(err.message);
  }
  closeAllSheets();
  if (!saved) {
    // Storage refused. Cast anyway, and say plainly that it won't be kept.
    open({ id: null, unsaved: true, name, relationship: $("fRel").value, date: $("fDate").value, time: $("fTime").value, place });
  } else {
    requestPersistentStorage();
    readingsFor = null;   // the same person, re-cast, reads again
    open(saved);
  }
  if (location.hash && location.hash !== "#chart") location.hash = "#chart";
});

$("deletePerson").addEventListener("click", () => {
  const id = $("editForm").dataset.id;
  const p = getProfile(id);
  if (!p || !confirm(`Remove ${p.name}? This can't be undone.`)) return;
  deleteProfile(id);
  current = null;
  closeAllSheets();
  boot();
});

// ---------------------------------------------------------------- start

fillIcons();
buildTabs();
renderSigns();
renderTarot();
renderSky();
boot();
show(parseRoute());

if ("serviceWorker" in navigator) {
  navigator.serviceWorker.register("/app/sw.js", { scope: "/app/" }).catch(() => {
    // Not fatal: the app works as before and simply won't open offline.
  });
}

// The guide, and when it opens, live in chart/src/install-guide.js. An iPhone
// or iPad keeps a Home Screen app's storage apart from Safari's, so the people
// someone adds in Safari would not follow them across.
installGuide({
  name: "Astrolabe",
  hint: $("installHint"),
  key: "astrolabe.app.installHint.dismissed",
  note: /iPhone|iPad|iPod|Macintosh/.test(navigator.userAgent) && navigator.maxTouchPoints > 0
    ? "Do this before you add anyone: the Home Screen app keeps its saved people separate from Safari's."
    : "",
});
mountFiligrees($("installHint"));

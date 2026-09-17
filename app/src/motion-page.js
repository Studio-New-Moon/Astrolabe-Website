// Chart in Motion: the page at /app/motion/.
//
// Two ways of setting the sky moving over one of the saved people:
//
// - Transits: their birth chart holds still inside the zodiac band while the
//   real sky runs past outside it, days to years a second, and a line lights
//   whenever a moving planet makes an aspect to one of theirs.
// - A Day: the whole chart recast minute by minute at their birthplace, for
//   the day they were born or for today, so the zodiac and the planets turn
//   through houses that stay put.
//
// Everything is worked out on this device from the same engine /chart/ and
// /app/ use, so a planet sits on the same degree here as in the app. The
// drawing is `motion.js`, its own instrument, separate from the chart wheel.

import { julianDay, julianDayFromLocal, anglesFor } from "../../chart/src/angles.js";
import { longitudeOf, isRetrograde, PLANETS } from "../../chart/src/ephemeris.js";
import { pointLongitude, pointIsRetrograde, POINTS, POINT_GLYPHS } from "../../chart/src/points.js";
import { createMotionWheel } from "./motion.js";
import { listProfiles, selectedProfileId, selectProfile } from "./profiles.js";

const $ = (id) => document.getElementById(id);
const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));

// The same invented person /app/ shows before anyone is saved. Never someone
// real, and never saved.
const EXAMPLE = {
  id: null, name: "Alex Rivera", relationship: "Example — an invented person",
  date: "1990-03-16", time: "14:15", timeMode: "exact",
  place: { name: "New York, New York, United States", latitude: 40.7128, longitude: -74.0060, timeZoneID: "America/New_York" },
};

const GLYPH = { sun: "☉", moon: "☽", mercury: "☿", venus: "♀", mars: "♂",
  jupiter: "♃", saturn: "♄", uranus: "♅", neptune: "♆", pluto: "♇" };
const NAME = { sun: "Sun", moon: "Moon", mercury: "Mercury", venus: "Venus", mars: "Mars",
  jupiter: "Jupiter", saturn: "Saturn", uranus: "Uranus", neptune: "Neptune", pluto: "Pluto" };
const SIGNS = ["Aries", "Taurus", "Gemini", "Cancer", "Leo", "Virgo",
  "Libra", "Scorpio", "Sagittarius", "Capricorn", "Aquarius", "Pisces"];
const placement = (lon) => {
  const l = ((lon % 360) + 360) % 360;
  return `${Math.floor(l % 30)}° ${SIGNS[Math.floor(l / 30)]}`;
};

// A saved person may be anyone — a partner, a friend — so the page says whose
// chart it is by name rather than "your".
const possessive = (name) => `${name}'s`;
const firstName = (name) => name.trim().split(/\s+/)[0] || name;

const SPEEDS = {
  transits: [["Day", 1], ["Week", 7], ["Month", 30.436875], ["Year", 365.25]],
  day: [["10 min", 10 / 1440], ["1 hour", 1 / 24], ["4 hours", 4 / 24]],
};

// The app's five aspects and orbs, as in AstrolabeCore's Aspects.swift, so a
// line here lights exactly when the app would name the aspect. `tone` picks
// the list colour from the page's own light or dark palette; `color` is for
// the instrument, which is always dark.
const KINDS = [
  { verb: "conjunct", angle: 0,   orb: 8, color: "#E8C87A", tone: "fused" },
  { verb: "sextile",  angle: 60,  orb: 4, color: "#F3E6C4", tone: "flow" },
  { verb: "square",   angle: 90,  orb: 6, color: "#D4775F", tone: "friction" },
  { verb: "trine",    angle: 120, orb: 6, color: "#F3E6C4", tone: "flow" },
  { verb: "opposite", angle: 180, orb: 8, color: "#D4775F", tone: "friction" },
];
function match(a, b) {
  let sep = Math.abs(a - b) % 360;
  if (sep > 180) sep = 360 - sep;
  for (const k of KINDS) {
    const orb = Math.abs(sep - k.angle);
    if (orb <= k.orb) return { kind: k, orb };
  }
  return null;
}

// ---- who ----
let person = null;   // the profile on screen
let birth = null;    // what was cast from it

function cast(profile) {
  if (profile.timeMode !== "exact") return null;
  const [y, m, d] = profile.date.split("-").map(Number);
  const [hh, mm] = profile.time.split(":").map(Number);
  const { latitude: lat, longitude: lng, timeZoneID: zone } = profile.place;
  let jd;
  try {
    jd = julianDayFromLocal(y, m, d, hh, mm, zone);
  } catch {
    return null;   // a zone this browser doesn't know
  }
  const angles = anglesFor(jd, lat, lng);
  return {
    jd, lat, lng, zone,
    asc: angles.find((a) => a.kind === "ascendant").longitude,
    mc: angles.find((a) => a.kind === "midheaven").longitude,
    natal: planetsAt(jd),
  };
}

const planetsAt = (jd) => PLANETS.map((key) =>
  ({ key, glyph: GLYPH[key], longitude: longitudeOf(key, jd), retrograde: isRetrograde(key, jd) }));

// Selena is Lilith read from the other end, so it is left out, as on /app/.
const pointsAt = (jd) => POINTS.filter((p) => p !== "whiteMoonSelena").map((key) =>
  ({ key, glyph: POINT_GLYPHS[key], longitude: pointLongitude(key, jd), retrograde: pointIsRetrograde(key, jd), minor: true }));

function renderPeople(people) {
  const nav = $("people");
  nav.innerHTML = "";
  for (const p of people) {
    const b = document.createElement("button");
    b.type = "button";
    b.className = "person";
    b.setAttribute("aria-pressed", String(person?.id === p.id));
    b.innerHTML = esc(p.name) + (p.relationship ? ` <span class="rel">· ${esc(p.relationship)}</span>` : "");
    b.addEventListener("click", () => { selectProfile(p.id); show(p, people); });
    nav.appendChild(b);
  }
}

function show(profile, people) {
  person = profile;
  renderPeople(people);
  $("exampleNote").hidden = profile !== EXAMPLE;
  $("who").textContent = profile.name;
  birth = cast(profile);
  $("cantCast").hidden = !!birth;
  $("sky").hidden = !birth;
  if (!birth) {
    setPlaying(false);
    return;
  }
  setFormatters(birth.zone);
  const first = firstName(profile.name);
  $("dayBirth").textContent = `The day ${first} was born`;
  startDay();
  fit();
  setMode(mode);
}

// ---- drawing ----
const wheel = createMotionWheel($("motion"));

function drawTransits(jd, listDue) {
  const sky = planetsAt(jd);
  const aspects = [];
  for (const s of sky) for (const n of birth.natal) {
    const m = match(s.longitude, n.longitude);
    if (!m) continue;
    aspects.push({ sky: s.key, natal: n.key, orb: m.orb, kind: m.kind, color: m.kind.color,
      closeness: 1 - m.orb / m.kind.orb, conjunction: m.kind.angle === 0 });
  }
  wheel.draw({ ascendant: birth.asc, midheaven: birth.mc, sky, natal: birth.natal, aspects });
  $("date").textContent = viewerDate.format(dateOf(jd));
  if (listDue) {
    const whose = possessive(firstName(person.name));
    aspects.sort((a, b) => a.orb - b.orb);
    $("aspects").innerHTML = aspects.slice(0, 7).map((f) =>
      `<li><span class="${f.kind.tone}">${NAME[f.sky]} ${f.kind.verb} ${esc(whose)} ${NAME[f.natal]}</span>` +
      `<span class="val">${f.orb.toFixed(1)}°</span></li>`).join("") ||
      `<li><span class="val">No aspects to ${esc(whose)} planets right now</span></li>`;
  }
}

function drawDay(jd, listDue) {
  const angles = anglesFor(jd, birth.lat, birth.lng);
  const asc = angles.find((a) => a.kind === "ascendant").longitude;
  const mc = angles.find((a) => a.kind === "midheaven").longitude;
  const planets = planetsAt(jd);
  wheel.draw({ ascendant: asc, midheaven: mc, sky: [...planets, ...pointsAt(jd)], natal: null });
  const d = dateOf(jd);
  $("date").textContent = `${timeOnly.format(d)} · ${dateOnly.format(d)}`;
  if (listDue) {
    const moon = planets.find((p) => p.key === "moon");
    $("angles").innerHTML = [["Rising", asc], ["Midheaven", mc], ["Moon", moon.longitude]]
      .map(([k, v]) => `<li><span>${k}</span><span class="val">${placement(v)}</span></li>`).join("");
  }
}

// ---- time ----
const dateOf = (jd) => new Date((jd - 2440587.5) * 86400000);
// Transits run on the viewer's own calendar: today is today where they are,
// not where the person was born. A Day is about the birthplace, so it keeps
// the birthplace's clock.
const viewerDate = new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "long", year: "numeric" });
let dateOnly, timeOnly;
function setFormatters(zone) {
  dateOnly = new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "long", year: "numeric", timeZone: zone });
  timeOnly = new Intl.DateTimeFormat("en-GB", { hour: "2-digit", minute: "2-digit", hourCycle: "h23", timeZone: zone });
}
const nowJD = () => {
  const d = new Date();
  return julianDay(d.getUTCFullYear(), d.getUTCMonth() + 1, d.getUTCDate(),
    d.getUTCHours() + d.getUTCMinutes() / 60 + d.getUTCSeconds() / 3600);
};
// Local midnight at the birthplace, for the day's own calendar date there.
function midnightOf(jd) {
  const parts = Object.fromEntries(new Intl.DateTimeFormat("en-CA", {
    year: "numeric", month: "2-digit", day: "2-digit", timeZone: birth.zone,
  }).formatToParts(dateOf(jd)).map((p) => [p.type, p.value]));
  return julianDayFromLocal(+parts.year, +parts.month, +parts.day, 0, 0, birth.zone);
}

let mode = "transits";
let whichDay = "birth";
const state = { transits: { jd: nowJD(), speed: 7 }, day: { jd: 0, speed: 1 / 24 } };
let playing = false, direction = 1, last = 0, lastList = 0;

const startDay = () => { state.day.jd = whichDay === "birth" ? midnightOf(birth.jd) : nowJD(); };

function draw(ts = performance.now()) {
  if (!birth) return;
  // The lists are for reading, so they update a few times a second rather
  // than every frame; at speed a per-frame list is a blur nobody can read.
  const listDue = !playing || ts - lastList > 180;
  if (listDue) lastList = ts;
  const s = state[mode];
  if (mode === "transits") {
    drawTransits(s.jd, listDue);
    $("note").textContent = "";
  } else {
    drawDay(s.jd, listDue);
    const atBirth = whichDay === "birth" && Math.abs(s.jd - birth.jd) < 0.5 / 1440;
    $("note").textContent = atBirth ? `The moment ${firstName(person.name)} was born` : "";
  }
}

function frame(ts) {
  if (!playing || !birth) return;
  const dt = last ? Math.min((ts - last) / 1000, 0.1) : 0;
  last = ts;
  const s = state[mode];
  const before = s.jd;
  s.jd += dt * s.speed * direction;
  // On the day they were born, the wheel stops on the minute they arrived,
  // and Play carries on from there.
  if (mode === "day" && whichDay === "birth" && (before - birth.jd) * (s.jd - birth.jd) < 0) {
    s.jd = birth.jd;
    draw(ts);
    setPlaying(false);
    return;
  }
  // That day, and only that day: past midnight it comes round again. Checked
  // after the birth-moment stop, so the wrap itself never reads as a crossing.
  // The next midnight is looked up rather than added as 24 hours, because the
  // day a clock changes is 23 or 25 hours long.
  if (mode === "day" && whichDay === "birth") {
    const start = midnightOf(birth.jd);
    const end = midnightOf(start + 1.1);
    if (s.jd >= end) s.jd = start + (s.jd - end);
    else if (s.jd < start) s.jd = end - (start - s.jd);
  }
  draw(ts);
  requestAnimationFrame(frame);
}

function setPlaying(on) {
  playing = on && !!birth;
  $("play").textContent = playing ? "Pause" : "Play";
  $("play").setAttribute("aria-pressed", String(playing));
  if (playing) { last = 0; requestAnimationFrame(frame); }
}

function renderSpeeds() {
  const s = state[mode];
  $("speeds").innerHTML = SPEEDS[mode].map(([label, v]) =>
    `<button type="button" data-speed="${v}" aria-pressed="${Math.abs(v - s.speed) < 1e-9}">${label}</button>`).join("");
  $("speeds").querySelectorAll("button").forEach((b) => b.onclick = () => {
    s.speed = +b.dataset.speed;
    renderSpeeds();
  });
}

const renderReset = () => {
  $("reset").textContent = mode === "transits" ? "Today" : whichDay === "birth" ? "Birth moment" : "Now";
};

function setMode(next) {
  mode = next;
  $("tabTransits").setAttribute("aria-selected", String(mode === "transits"));
  $("tabDay").setAttribute("aria-selected", String(mode === "day"));
  $("transitPanel").hidden = mode !== "transits";
  $("dayPanel").hidden = mode !== "day";
  $("subTransits").hidden = mode !== "transits";
  $("subDay").hidden = mode !== "day";
  if (person) $("subDayWho").textContent = possessive(firstName(person.name));
  renderSpeeds();
  renderReset();
  lastList = 0;
  draw();
}

// The instrument is fitted to the stage in screen pixels, so it is re-fitted
// whenever the stage changes size, and whenever the person (and so the
// plate's latitude) changes.
const stage = $("stage");
let fittedWidth = 0;
function fit() {
  const w = stage.clientWidth;
  if (!birth || !w) return;
  fittedWidth = w;
  wheel.layout(w, birth.lat);
  draw();
}
new ResizeObserver(() => { if (stage.clientWidth !== fittedWidth) fit(); }).observe(stage);

$("tabTransits").onclick = () => setMode("transits");
$("tabDay").onclick = () => setMode("day");
$("play").onclick = () => setPlaying(!playing);
$("reverse").onclick = () => {
  direction = -direction;
  $("reverse").setAttribute("aria-pressed", String(direction < 0));
};
$("reset").onclick = () => {
  if (!birth) return;
  if (mode === "transits") state.transits.jd = nowJD();
  else state.day.jd = whichDay === "birth" ? birth.jd : nowJD();
  draw();
};
document.querySelectorAll("[data-day]").forEach((b) => b.onclick = () => {
  whichDay = b.dataset.day;
  document.querySelectorAll("[data-day]").forEach((o) => o.setAttribute("aria-pressed", String(o === b)));
  if (!birth) return;
  startDay();
  renderReset();
  draw();
});

// ---- start ----
//
// Tablets and computers only. On a phone the moving sky needs lanes the wheel
// has no room for, and the birth chart inside the band is squeezed to a size
// nobody could read, so a screen under 600px either way gets a note instead,
// and nothing is cast or animated. Both sides are checked so a phone turned
// on its side doesn't qualify. Turning a tablet or widening a window past the
// line brings the instrument in.
const ROOMY = matchMedia("(min-width: 600px) and (min-height: 600px)");
let started = false;
function applyRoom() {
  const roomy = ROOMY.matches;
  $("tooSmall").hidden = roomy;
  $("roomy").hidden = !roomy;
  if (!roomy) {
    setPlaying(false);
    return;
  }
  if (started) {
    fit();
    return;
  }
  started = true;
  const people = listProfiles();
  show(people.find((p) => p.id === selectedProfileId()) ?? people[0] ?? EXAMPLE, people);
  // Motion is opt-in for anyone who has asked their system for less of it.
  if (!matchMedia("(prefers-reduced-motion: reduce)").matches) setPlaying(true);
}
ROOMY.addEventListener("change", applyRoom);
applyRoom();

if ("serviceWorker" in navigator) {
  navigator.serviceWorker.register("/app/sw.js", { scope: "/app/" }).catch(() => {
    // Not fatal: the page works as before and simply won't open offline.
  });
}

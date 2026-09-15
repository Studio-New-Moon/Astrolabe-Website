// The four angles, and whole-sign houses.
//
// A transliteration of `Astronomy.swift` and `BirthChart.house(ofLongitude:)`
// in AstrolabeCore. Checked against the Swift by
// `App/Tools/chart-renderer/compare-angles.mjs`.
//
// This is the first part of the chart that needs a *place* as well as a
// moment. A planet's longitude is the same for everyone alive at that
// instant; the ascendant is different two streets apart, and completely
// different two time zones apart.

const D2R = Math.PI / 180;
const R2D = 180 / Math.PI;

/** Obliquity of the ecliptic, J2000.0. */
export const OBLIQUITY_DEGREES = 23.4392911;

export function normalizedDegrees(d) {
  const r = d % 360;
  return r < 0 ? r + 360 : r;
}

/** Julian Day for a calendar date in Universal Time. */
export function julianDay(year, month, day, hoursUT) {
  let y = year, m = month;
  if (m <= 2) { y -= 1; m += 12; }
  const a = Math.floor(y / 100);
  const b = 2 - a + Math.floor(a / 4);
  return Math.floor(365.25 * (y + 4716))
    + Math.floor(30.6001 * (m + 1))
    + day + b - 1524.5
    + hoursUT / 24;
}

/** Greenwich Mean Sidereal Time in degrees. */
export function greenwichSiderealDegrees(jd) {
  return normalizedDegrees(280.46061837 + 360.98564736629 * (jd - 2451545.0));
}

/** Local Mean Sidereal Time in degrees. East longitude positive. */
export function localSiderealDegrees(jd, longitude) {
  return normalizedDegrees(greenwichSiderealDegrees(jd) + longitude);
}

/**
 * Ecliptic longitude of the ascendant — the degree rising on the eastern
 * horizon, and the hinge the whole house system swings on.
 */
export function ascendant(lst, latitude) {
  const e = OBLIQUITY_DEGREES * D2R;
  const lat = latitude * D2R;
  const t = lst * D2R;
  const y = -Math.cos(t);
  const x = Math.sin(t) * Math.cos(e) + Math.tan(lat) * Math.sin(e);
  return normalizedDegrees(Math.atan2(y, x) * R2D + 180);
}

/** Midheaven — the ecliptic degree crossing the meridian. */
export function midheaven(lst) {
  const e = OBLIQUITY_DEGREES * D2R;
  const t = lst * D2R;
  return normalizedDegrees(
    Math.atan2(Math.tan(t), Math.cos(e)) * R2D + (lst > 90 && lst <= 270 ? 180 : 0),
  );
}

export const SIGNS = [
  "Aries", "Taurus", "Gemini", "Cancer", "Leo", "Virgo",
  "Libra", "Scorpio", "Sagittarius", "Capricorn", "Aquarius", "Pisces",
];

/** Zero-based sign index for an ecliptic longitude. */
export function signIndex(longitude) {
  return Math.floor(normalizedDegrees(longitude) / 30);
}

/** Degrees into that sign, 0–30. */
export function degreeWithinSign(longitude) {
  return normalizedDegrees(longitude) % 30;
}

/**
 * The whole-sign house a longitude falls in: how many signs along it sits
 * from the rising sign, 1–12.
 *
 * Whole-sign is the system the app uses, and it is why nothing here has the
 * pathologies that make other systems misbehave at high latitude — a house is
 * a sign, so there is no cusp arithmetic to degenerate. The ascendant itself
 * still moves violently near the poles; the houses built on it do not add to
 * the problem.
 */
export function wholeSignHouse(longitude, ascendantLongitude) {
  const first = signIndex(ascendantLongitude);
  const here = signIndex(longitude);
  return ((here - first) % 12 + 12) % 12 + 1;
}

/**
 * The four angles for a moment and a place, in the conventional order.
 *
 * Descendant and Imum Coeli are never separately measured — each is exactly
 * 180° from its partner, by construction.
 */
export function anglesFor(jd, latitude, longitude) {
  const lst = localSiderealDegrees(jd, longitude);
  const asc = ascendant(lst, latitude);
  const mc = midheaven(lst);
  const make = (kind, lon) => ({
    kind,
    longitude: lon,
    sign: SIGNS[signIndex(lon)],
    degreeInSign: degreeWithinSign(lon),
    house: wholeSignHouse(lon, asc),
  });
  return [
    make("ascendant", asc),
    make("midheaven", mc),
    make("descendant", normalizedDegrees(asc + 180)),
    make("imumCoeli", normalizedDegrees(mc + 180)),
  ];
}

/**
 * Wall-clock birth time in an IANA zone → Julian Day.
 *
 * This is the step the visual concept skipped and the app deliberately does
 * not: it treats the entered time as a real local time, so historical daylight
 * saving and zone changes come from the tz database rather than from an
 * assumption about the longitude. Getting it wrong moves the ascendant by
 * about 15° — half a sign — silently, for everyone born in summer.
 *
 * Two wall-clock times a year are not a single instant, and the convention
 * chosen for them is not arbitrary here: it is whichever one `BirthMoment`
 * already uses, because the app and the website have to cast the same chart.
 * Checked against Foundation by `App/Tools/chart-renderer/compare-tz.mjs`.
 *
 *   The spring gap — 02:30 on a forward transition never happens. Foundation
 *   reads it with the offset from *before* the jump, so New York's
 *   2021-03-14 02:30 resolves to 07:30 UTC, which a clock there would have
 *   shown as 03:30.
 *
 *   The autumn repeat — 01:30 on a back transition happens twice. Foundation
 *   takes the *first*, so London's 2021-10-31 01:30 is 00:30 UTC, still on
 *   summer time.
 *
 * Both fall out of one rule: prefer the offset in force before the
 * transition, and only fall back to the later one when the earlier is
 * impossible. Converging by iteration instead — the obvious implementation —
 * silently lands on the opposite convention in both cases, which is an hour
 * of error on exactly the birthdays nobody checks.
 */
export function julianDayFromLocal(year, month, day, hour, minute, timeZone) {
  const wall = Date.UTC(year, month - 1, day, hour, minute, 0, 0);
  const DAY = 86400000;

  // The zone's offset from UTC at a given instant, in milliseconds.
  const offsetAt = (utcMillis) => {
    const parts = new Intl.DateTimeFormat("en-US", {
      timeZone,
      hour12: false,
      year: "numeric", month: "2-digit", day: "2-digit",
      hour: "2-digit", minute: "2-digit", second: "2-digit",
    }).formatToParts(new Date(utcMillis));
    const f = {};
    for (const p of parts) if (p.type !== "literal") f[p.type] = Number(p.value);
    // Some engines render midnight as hour 24.
    return Date.UTC(f.year, f.month - 1, f.day, f.hour % 24, f.minute, f.second) - utcMillis;
  };

  const toJD = (ms) => ms / DAY + 2440587.5;

  // The offset in force a day before this wall time, and the instant it
  // implies. If that instant really does sit at that offset, the reading is
  // self-consistent and we are done — this is the ordinary case, and it is
  // also the earlier of the two answers when a wall time repeats.
  const before = offsetAt(wall - DAY);
  const candidate = wall - before;
  if (offsetAt(candidate) === before) return toJD(candidate);

  // Otherwise the transition falls between: try the offset from the day
  // after.
  const after = offsetAt(wall + DAY);
  const alternative = wall - after;
  if (offsetAt(alternative) === after) return toJD(alternative);

  // Neither is self-consistent, so this wall time does not exist at all — the
  // spring gap. Foundation answers with the pre-transition offset rather than
  // refusing, and so do we.
  return toJD(candidate);
}

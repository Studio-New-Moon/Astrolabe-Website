// What a reading is composed from, worked out on this device.
//
// Readings are written on a server, by the app's own Swift. That server is
// sent this and nothing else: the Ascendant, the Midheaven, and where each
// planet and point sits and whether it is retrograde. No name, no birth date,
// no birth time, no birthplace. It mirrors `NatalPositions.swift` field for
// field, and a chart built from it reads word for word like the chart cast
// from the birth itself.
//
// This is data minimisation, not anonymisation. A full set of positions pins
// the birth down to within minutes, and with the Ascendant, to a band of the
// Earth; someone determined could work the date back out. What it avoids is
// the server ever receiving, and so ever holding or logging, a birth date,
// time and place as typed. See Docs/The Chart Poster.md in the app repo.
//
// Nothing is rounded. Rounding would make the positions a little less
// identifying and the readings a little wrong: a planet a hair inside an orb,
// a cusp or a sign would read differently here than in the app. JSON carries
// every double exactly, so what arrives is what was worked out.
//
// Checked against AstrolabeCore by App/Tools/chart-renderer/compare-positions.mjs
// in the app repo, which feeds these positions to the Swift and requires every
// reading to match the chart the app would cast.

import { julianDayFromLocal, anglesFor } from "../../chart/src/angles.js";
import { longitudeOf, isRetrograde, PLANETS } from "../../chart/src/ephemeris.js";
import { pointLongitude, pointIsRetrograde, POINTS } from "../../chart/src/points.js";

/**
 * The positions for a saved profile, or null if it cannot be cast yet.
 *
 * Only an exact birth time is cast, as in `profiles.js`: a profile whose time
 * is uncertain is not quietly read as if it were exact.
 */
export function natalPositions(profile) {
  if (!profile || profile.timeMode !== "exact") return null;
  const [y, m, d] = String(profile.date).split("-").map(Number);
  const [hh, mm] = String(profile.time).split(":").map(Number);
  const { latitude, longitude, timeZoneID } = profile.place ?? {};
  return positionsAt(y, m, d, hh, mm, latitude, longitude, timeZoneID);
}

/**
 * The positions for a wall-clock birth time at a place.
 *
 * Separate from `natalPositions` so the comparison against the Swift can
 * drive it without building profiles. Returns null when anything that should
 * be a number is not, rather than sending a set the server would refuse.
 */
export function positionsAt(year, month, day, hour, minute, latitude, longitude, timeZoneID) {
  const numbers = [year, month, day, hour, minute, latitude, longitude];
  if (!numbers.every(Number.isFinite) || typeof timeZoneID !== "string") return null;

  let jd;
  try {
    jd = julianDayFromLocal(year, month, day, hour, minute, timeZoneID);
  } catch {
    return null; // an unknown zone: Intl throws a RangeError
  }
  const angles = anglesFor(jd, latitude, longitude);

  const planets = {};
  for (const name of PLANETS) {
    planets[name] = { longitude: longitudeOf(name, jd), isRetrograde: isRetrograde(name, jd) };
  }
  const points = {};
  for (const name of POINTS) {
    points[name] = { longitude: pointLongitude(name, jd), isRetrograde: pointIsRetrograde(name, jd) };
  }

  const result = {
    ascendant: angles.find((a) => a.kind === "ascendant").longitude,
    midheaven: angles.find((a) => a.kind === "midheaven").longitude,
    planets,
    points,
  };
  const all = [result.ascendant, result.midheaven,
    ...Object.values(planets).map((b) => b.longitude), ...Object.values(points).map((b) => b.longitude)];
  return all.every(Number.isFinite) ? result : null;
}

// The chart points that are not planets: the lunar node, Chiron, and the two
// ends of the Moon's own long axis.
//
// A transliteration of `Points.swift` in AstrolabeCore. Checked against the
// Swift by `App/Tools/chart-renderer/compare-points.mjs`.

import { normalizedDegrees } from "./angles.js";
import { heliocentricEarth, precessedToDate } from "./ephemeris.js";
import { START_JD, STEP_DAYS, COUNT, COORDINATES } from "./chiron-data.js";

const D2R = Math.PI / 180;

export const POINTS = ["northNode", "chiron", "blackMoonLilith", "whiteMoonSelena"];

export const POINT_NAMES = {
  northNode: "North Node",
  chiron: "Chiron",
  blackMoonLilith: "Black Moon Lilith",
  whiteMoonSelena: "White Moon Selena",
};

export const POINT_GLYPHS = {
  northNode: "☊",
  chiron: "⚷",
  blackMoonLilith: "⚸",
  whiteMoonSelena: "⚸",
};

/**
 * The *mean* lunar node, which is monotonic — always regressing, which is why
 * it is always retrograde and why astrology software uses it rather than the
 * true osculating node, which oscillates around this by roughly ±1.5° on a
 * two-week period.
 */
export function northNodeLongitude(jd) {
  const t = (jd - 2451545.0) / 36525.0;
  return normalizedDegrees(
    125.0445222 - 1934.1362608 * t + 0.0020708 * t * t + (t * t * t) / 450000,
  );
}

/**
 * Chiron's heliocentric position, read from the table with a Catmull-Rom
 * spline on its uniform 40-day grid.
 *
 * Tabulated rather than propagated from osculating elements because Chiron is
 * a centaur: its orbit crosses both Saturn's and Uranus's, so a fixed ellipse
 * cannot follow it. The Swift records what that cost — 1.62° worst by 1930,
 * which put Chiron in the wrong sign for about one birth date in twenty.
 */
export function chironHeliocentric(jd) {
  const s = (jd - START_JD) / STEP_DAYS;
  const i = Math.floor(s);
  const f = s - i;

  const sample = (k) => {
    const c = Math.min(Math.max(k, 0), COUNT - 1) * 3;
    return [COORDINATES[c], COORDINATES[c + 1], COORDINATES[c + 2]];
  };
  const spline = (a, b, c, d) => {
    const t2 = f * f, t3 = t2 * f;
    return 0.5 * ((2 * b) + (-a + c) * f + (2 * a - 5 * b + 4 * c - d) * t2
      + (-a + 3 * b - 3 * c + d) * t3);
  };

  const p0 = sample(i - 1), p1 = sample(i), p2 = sample(i + 1), p3 = sample(i + 2);
  return {
    x: spline(p0[0], p1[0], p2[0], p3[0]),
    y: spline(p0[1], p1[1], p2[1], p3[1]),
    z: spline(p0[2], p1[2], p2[2], p3[2]),
  };
}

export function chironLongitude(jd) {
  const t = (jd - 2451545.0) / 36525.0;
  const c = chironHeliocentric(jd);
  const e = heliocentricEarth(t);
  // Same J2000-frame elements as the eight planets, so the same
  // equinox-of-date conversion.
  return precessedToDate(Math.atan2(c.y - e.y, c.x - e.x) / D2R, jd);
}

/**
 * Mean longitude of the lunar perigee (Meeus 45.7).
 *
 * Black Moon Lilith and White Moon Selena share this one polynomial: Lilith is
 * the apogee end of the Moon's elliptical orbit's long axis, Selena the
 * perigee end, always exactly 180° apart because they are the same axis read
 * from its two opposite ends. That axis precesses *forward* — the coefficient
 * on T is positive, unlike the node's — which is why neither is ever
 * retrograde.
 */
export function meanLunarApsideLongitude(jd) {
  const t = (jd - 2451545.0) / 36525.0;
  return normalizedDegrees(
    83.3532465 + 4069.0137287 * t - 0.0103200 * t * t - 0.00001249172 * t * t * t,
  );
}

export const blackMoonLilithLongitude = (jd) =>
  normalizedDegrees(meanLunarApsideLongitude(jd) + 180);
export const whiteMoonSelenaLongitude = (jd) => meanLunarApsideLongitude(jd);

export function pointLongitude(point, jd) {
  switch (point) {
    case "northNode": return northNodeLongitude(jd);
    case "chiron": return chironLongitude(jd);
    case "blackMoonLilith": return blackMoonLilithLongitude(jd);
    case "whiteMoonSelena": return whiteMoonSelenaLongitude(jd);
    default: throw new Error(`unknown chart point: ${point}`);
  }
}

/**
 * The mean node regresses by construction — always retrograde, no numerical
 * check needed. The mean apsides precess forward by the same kind of
 * construction — always direct, same reasoning, opposite conclusion. Chiron
 * gets the day-straddling check the planets use, since it is a real body whose
 * apparent motion can actually reverse.
 */
export function pointIsRetrograde(point, jd) {
  if (point === "northNode") return true;
  if (point === "blackMoonLilith" || point === "whiteMoonSelena") return false;
  const before = chironLongitude(jd - 0.5);
  const after = chironLongitude(jd + 0.5);
  let delta = after - before;
  if (delta > 180) delta -= 360;
  if (delta < -180) delta += 360;
  return delta < 0;
}

// The stereographic projection a real astrolabe plate is engraved with.
//
// A transliteration of `Projection.swift` in AstrolabeCore. Checked against
// the Swift by `App/Tools/chart-renderer/compare-projection.mjs`.
//
// The sphere is projected from the south celestial pole onto the plane of the
// equator. The property that makes the instrument work is that *every* circle
// on the sphere projects to a circle on the plane — horizons, almucantars, the
// tropics — so a flat plate carries a curved sky exactly, and a maker only
// ever strikes arcs with a compass.
//
// It is also why the plate is latitude-specific: change the latitude and every
// one of those circles moves. A chart cast for Reykjavík genuinely is a
// different shape from one cast for Quito.

import { OBLIQUITY_DEGREES } from "./angles.js";

const D2R = Math.PI / 180;

export const OBLIQUITY = OBLIQUITY_DEGREES;

/**
 * Radius of the Tropic of Capricorn — the outer edge of the engraved area,
 * and the reference every other radius is scaled against.
 */
export function capricornRadius(equator) {
  return equator * Math.tan((45 + OBLIQUITY / 2) * D2R);
}

export function cancerRadius(equator) {
  return equator * Math.tan((45 - OBLIQUITY / 2) * D2R);
}

/**
 * A circle of constant altitude, projected. `altitude` 0 gives the horizon.
 *
 * Returns the offset of the circle's centre from the plate's centre (positive
 * toward the zenith, the south side of the plate) and its radius, or null.
 * Both blow up as the denominator approaches zero, which is the projection
 * honestly reporting that the circle has grown to infinite size — the case a
 * real plate handles by running off the edge of the metal.
 */
export function almucantar(altitude, latitude, equator) {
  const h = altitude * D2R;
  const phi = latitude * D2R;
  const denominator = Math.sin(phi) + Math.sin(h);
  if (Math.abs(denominator) <= 0.02) return null;
  return {
    offset: equator * Math.cos(phi) / denominator,
    radius: equator * Math.cos(h) / denominator,
  };
}

/**
 * Where a point of the zodiac lands on the rete.
 *
 * Convert the ecliptic longitude to right ascension and declination, then
 * project. The radius falls out of the declination alone and the angle is the
 * right ascension — which is why the ecliptic ring comes out as an off-centre
 * circle without anyone drawing it as one.
 *
 * The full transform rather than the beta = 0 shortcut, because a rete's star
 * pointers reach for stars nowhere near the ecliptic.
 */
export function retePoint(eclipticLongitude, eclipticLatitude = 0, equator = 1) {
  const e = OBLIQUITY * D2R;
  const l = eclipticLongitude * D2R;
  const b = eclipticLatitude * D2R;
  const dec = Math.asin(Math.sin(b) * Math.cos(e) + Math.cos(b) * Math.sin(e) * Math.sin(l));
  const ra = Math.atan2(Math.sin(l) * Math.cos(e) - Math.tan(b) * Math.sin(e), Math.cos(l));
  return { radius: equator * Math.tan((Math.PI / 2 - dec) / 2), angle: ra * 180 / Math.PI };
}

/**
 * The ecliptic ring carried on the rete. It sits off-centre, which is what
 * makes a rete look the way it does.
 *
 * `offset` is the distance from the plate's centre toward Capricorn — the
 * solstice that projects furthest out — so in a frame where Cancer is +y the
 * ring's centre is at −offset.
 */
export function ecliptic(equator) {
  const cap = capricornRadius(equator);
  const can = cancerRadius(equator);
  return { offset: (cap - can) / 2, radius: (cap + can) / 2 };
}

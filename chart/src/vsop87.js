// VSOP87D — the planetary theory of Bretagnon & Francou, evaluated in the
// browser.
//
// A transliteration of `VSOP87.swift` in AstrolabeCore, not a reimplementation:
// same truncated table, same evaluation, same light-time loop, so a chart cast
// here and a chart cast in the app are the same chart. `chart/test/compare.mjs`
// checks that against the Swift binary itself rather than taking it on trust.
//
// The D variant gives heliocentric spherical coordinates referred to the mean
// equinox *of date*, which is the frame the tropical zodiac is defined in.
// That is why nothing here precesses: choosing a different VSOP87 variant
// would silently reintroduce a frame bug the Swift file has been bitten by
// twice.

import { SERIES } from "./vsop87-data.js";

// au per day. Light time matters because a planet is seen where it was when
// the light left it, not where it is now.
const SPEED_OF_LIGHT = 173.144632674;

export function normalizedDegrees(d) {
  const r = d % 360;
  return r < 0 ? r + 360 : r;
}

/**
 * Σ over k of τ^k · Σ A·cos(B + C·τ).
 *
 * The coefficients are one flat array of (A, B, C) triples; `bounds` marks
 * where each power of τ starts and ends, so the whole series for one
 * coordinate is two allocations rather than a tree of small ones.
 */
export function value(series, tau) {
  const { coefficients: c, bounds } = series;
  let total = 0;
  let tauPower = 1;
  for (let k = 0; k < bounds.length - 1; k++) {
    let sum = 0;
    const end = bounds[k + 1] * 3;
    for (let i = bounds[k] * 3; i < end; i += 3) {
      sum += c[i] * Math.cos(c[i + 1] + c[i + 2] * tau);
    }
    total += sum * tauPower;
    tauPower *= tau;
  }
  return total;
}

const seriesFor = (body) => ({
  longitude: SERIES[`${body}L`],
  latitude: SERIES[`${body}B`],
  radius: SERIES[`${body}R`],
});

const tauOf = (jd) => (jd - 2451545.0) / 365250.0;

/** Heliocentric ecliptic longitude in radians, mean equinox of date. */
export function heliocentricLongitude(body, jd) {
  return value(seriesFor(body).longitude, tauOf(jd));
}

/** Heliocentric rectangular ecliptic coordinates, in au. */
export function rectangular(body, jd) {
  const tau = tauOf(jd);
  const s = seriesFor(body);
  const lon = value(s.longitude, tau);
  const lat = value(s.latitude, tau);
  const radius = value(s.radius, tau);
  return {
    x: radius * Math.cos(lat) * Math.cos(lon),
    y: radius * Math.cos(lat) * Math.sin(lon),
    z: radius * Math.sin(lat),
  };
}

/** Geocentric ecliptic longitude in degrees, mean equinox of date. */
export function geocentricLongitude(body, jd) {
  const earth = rectangular("earth", jd);
  let planet = rectangular(body, jd);
  // Two iterations, as in the Swift. The first correction is already smaller
  // than the table's own error; the second is free insurance.
  for (let i = 0; i < 2; i++) {
    const dx = planet.x - earth.x;
    const dy = planet.y - earth.y;
    const dz = planet.z - earth.z;
    const lightTime = Math.sqrt(dx * dx + dy * dy + dz * dz) / SPEED_OF_LIGHT;
    planet = rectangular(body, jd - lightTime);
  }
  return normalizedDegrees(
    (Math.atan2(planet.y - earth.y, planet.x - earth.x) * 180) / Math.PI,
  );
}

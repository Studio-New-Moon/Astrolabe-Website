// Geocentric ecliptic longitudes, in the browser.
//
// A transliteration of `Planets.swift` in AstrolabeCore. Three sources for
// three kinds of body, exactly as there: VSOP87 for the seven planets it
// covers, the truncated ELP-2000/82 series for the Moon, and JPL's approximate
// Keplerian elements for Pluto, which no analytic planetary theory includes.
//
// The measured worst-case errors against PyEphem over 1920–2025 are in
// `App/Tools/precision-benchmark/RESULTS.md`: 0.01614° for the Moon, 0.01490°
// for Pluto, everything else inside 0.007°. Those figures belong to the Swift,
// and they only transfer to this file for as long as the two agree — which is
// what `chart/test/compare.mjs` exists to check.

import { geocentricLongitude, heliocentricLongitude, normalizedDegrees } from "./vsop87.js";

const D2R = Math.PI / 180;

export const PLANETS = [
  "sun", "moon", "mercury", "venus", "mars",
  "jupiter", "saturn", "uranus", "neptune", "pluto",
];

// a, e, i, L, longitude of perihelion, longitude of ascending node, each with
// its rate of change per Julian century.
const el = (a, e, i, l, peri, node, da, de, di, dl, dperi, dnode) =>
  ({ a, e, i, l, peri, node, da, de, di, dl, dperi, dnode });

const ELEMENTS = {
  pluto: el(39.48211675, 0.24882730, 17.14001206, 238.92903833, 224.06891629, 110.30393684,
            -0.00031596, 0.00005170, 0.00004818, 145.20780515, -0.04062942, -0.01183482),
};

const EARTH = el(1.00000261, 0.01671123, -0.00001531, 100.46457166, 102.93768193, 0.0,
                 0.00000562, -0.00004392, -0.01294668, 35999.37244981, 0.32327364, 0.0);

/**
 * General precession in ecliptic longitude since J2000, in degrees —
 * 5028.796″ per Julian century.
 *
 * The Keplerian elements are referred to the J2000 mean equinox; a tropical
 * longitude is measured from the equinox *of date*, and the two drift apart by
 * about 1.4° per century. Leave this off and every planet in a 1930s chart
 * sits a degree past where the sky had it — enough to put a cusp-hugging
 * planet in the wrong sign.
 */
function precessedToDate(longitudeJ2000, jd) {
  const t = (jd - 2451545.0) / 36525.0;
  return normalizedDegrees(longitudeJ2000 + 1.3968878 * t);
}

/** Heliocentric ecliptic rectangular coordinates from Keplerian elements, in au. */
function heliocentric(e_, t) {
  const a = e_.a + e_.da * t;
  const e = e_.e + e_.de * t;
  const i = (e_.i + e_.di * t) * D2R;
  const l = e_.l + e_.dl * t;
  const peri = e_.peri + e_.dperi * t;
  const node = e_.node + e_.dnode * t;

  const argPeri = (peri - node) * D2R;
  let m = normalizedDegrees(l - peri);
  if (m > 180) m -= 360;
  const mRad = m * D2R;

  // Kepler's equation. Newton converges in a handful of steps at these
  // eccentricities; Pluto's 0.249 is the worst case here.
  let eAnom = mRad + e * Math.sin(mRad);
  for (let k = 0; k < 12; k++) {
    const delta = (eAnom - e * Math.sin(eAnom) - mRad) / (1 - e * Math.cos(eAnom));
    eAnom -= delta;
    if (Math.abs(delta) < 1e-12) break;
  }

  const xv = a * (Math.cos(eAnom) - e);
  const yv = a * Math.sqrt(1 - e * e) * Math.sin(eAnom);

  const cw = Math.cos(argPeri), sw = Math.sin(argPeri);
  const cn = Math.cos(node * D2R), sn = Math.sin(node * D2R);
  const ci = Math.cos(i), si = Math.sin(i);

  return {
    x: (cw * cn - sw * sn * ci) * xv + (-sw * cn - cw * sn * ci) * yv,
    y: (cw * sn + sw * cn * ci) * xv + (-sw * sn + cw * cn * ci) * yv,
    z: sw * si * xv + cw * si * yv,
  };
}

// Table 47.A of Meeus, Astronomical Algorithms 2nd ed. — (D, M, M′, F,
// coefficient in millionths of a degree). The final row's longitude
// coefficient is zero; it is kept so the table can be checked row-for-row
// against the book.
const MOON_TERMS = [
  [0,0,1,0,6288774],[2,0,-1,0,1274027],[2,0,0,0,658314],
  [0,0,2,0,213618],[0,1,0,0,-185116],[0,0,0,2,-114332],
  [2,0,-2,0,58793],[2,-1,-1,0,57066],[2,0,1,0,53322],
  [2,-1,0,0,45758],[0,1,-1,0,-40923],[1,0,0,0,-34720],
  [0,1,1,0,-30383],[2,0,0,-2,15327],[0,0,1,2,-12528],
  [0,0,1,-2,10980],[4,0,-1,0,10675],[0,0,3,0,10034],
  [4,0,-2,0,8548],[2,1,-1,0,-7888],[2,1,0,0,-6766],
  [1,0,-1,0,-5163],[1,1,0,0,4987],[2,-1,1,0,4036],
  [2,0,2,0,3994],[4,0,0,0,3861],[2,0,-3,0,3665],
  [0,1,-2,0,-2689],[2,0,-1,2,-2602],[2,-1,-2,0,2390],
  [1,0,1,0,-2348],[2,-2,0,0,2236],[0,1,2,0,-2120],
  [0,2,0,0,-2069],[2,-2,-1,0,2048],[2,0,1,-2,-1773],
  [2,0,0,2,-1595],[4,-1,-1,0,1215],[0,0,2,2,-1110],
  [3,0,-1,0,-892],[2,1,1,0,-810],[4,-1,-2,0,759],
  [0,2,-1,0,-713],[2,2,-1,0,-700],[2,1,-2,0,691],
  [2,-1,0,-2,596],[4,0,1,0,549],[0,0,4,0,537],
  [4,-1,0,0,520],[1,0,-2,0,-487],[2,1,0,-2,-399],
  [0,0,2,-2,-381],[1,1,1,0,351],[3,0,-2,0,-340],
  [4,0,-3,0,330],[2,-1,2,0,327],[0,2,1,0,-323],
  [1,1,-1,0,299],[2,0,3,0,294],[2,0,-1,-2,0],
];

/** The Moon, from the truncated ELP-2000/82 series in Meeus ch. 47. */
function moonLongitude(jd) {
  const t = (jd - 2451545.0) / 36525.0;
  const t2 = t * t, t3 = t2 * t, t4 = t3 * t;

  // Fundamental arguments, Meeus 47.1–47.5.
  const meanLong = 218.3164477 + 481267.88123421 * t - 0.0015786 * t2
    + t3 / 538841 - t4 / 65194000;
  const elong = 297.8501921 + 445267.1114034 * t - 0.0018819 * t2
    + t3 / 545868 - t4 / 113065000;
  const sunAnom = 357.5291092 + 35999.0502909 * t - 0.0001536 * t2
    + t3 / 24490000;
  const meanAnom = 134.9633964 + 477198.8675055 * t + 0.0087414 * t2
    + t3 / 69699 - t4 / 14712000;
  const argLat = 93.2720950 + 483202.0175233 * t - 0.0036539 * t2
    - t3 / 3526000 + t4 / 863310000;

  // The Venus and Jupiter beats, and the Earth's orbital eccentricity — the
  // last scales every term involving the Sun's anomaly, since those depend on
  // where the Earth is in a slowly changing orbit.
  const venusBeat = 119.75 + 131.849 * t;
  const jupiterBeat = 53.09 + 479264.290 * t;
  const eccentricity = 1 - 0.002516 * t - 0.0000074 * t2;

  let sum = 0;
  for (const [d, m, mp, f, coef] of MOON_TERMS) {
    if (coef === 0) continue;
    const arg = (d * elong + m * sunAnom + mp * meanAnom + f * argLat) * D2R;
    const scale = m === 0 ? 1 : Math.pow(eccentricity, Math.abs(m));
    sum += coef * scale * Math.sin(arg);
  }

  // Additive terms, Meeus p.342: Venus, the flattening of the Earth, Jupiter.
  sum += 3958 * Math.sin(venusBeat * D2R)
    + 1962 * Math.sin((meanLong - argLat) * D2R)
    + 318 * Math.sin(jupiterBeat * D2R);

  return normalizedDegrees(meanLong + sum / 1_000_000);
}

/**
 * Geocentric ecliptic longitude in degrees, referred to the mean equinox of
 * date — the frame the tropical zodiac is defined in.
 */
export function longitudeOf(planet, jd) {
  switch (planet) {
    case "sun": {
      // The Sun's geocentric place is the Earth's heliocentric one seen from
      // the other end — the same point, exactly 180° around.
      const earthLongitude = heliocentricLongitude("earth", jd);
      return normalizedDegrees((earthLongitude * 180) / Math.PI + 180);
    }
    case "moon":
      // No precession step: the series already yields a longitude referred to
      // the mean equinox of date.
      return moonLongitude(jd);
    case "pluto": {
      const t = (jd - 2451545.0) / 36525.0;
      const p = heliocentric(ELEMENTS.pluto, t);
      const e = heliocentric(EARTH, t);
      return precessedToDate(Math.atan2(p.y - e.y, p.x - e.x) / D2R, jd);
    }
    default:
      return geocentricLongitude(planet, jd);
  }
}

/**
 * Apparent retrograde motion — whether the longitude is decreasing. Measured
 * over a day: long enough to beat the noise in these series, short enough not
 * to smear a station.
 */
export function isRetrograde(planet, jd) {
  if (planet === "sun" || planet === "moon") return false;
  const before = longitudeOf(planet, jd - 0.5);
  const after = longitudeOf(planet, jd + 0.5);
  let delta = after - before;
  if (delta > 180) delta -= 360;
  if (delta < -180) delta += 360;
  return delta < 0;
}

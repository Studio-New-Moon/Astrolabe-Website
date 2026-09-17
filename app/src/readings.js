// Asking the reading server for this chart's readings.
//
// The server is sent the positions and nothing else — no name, no birth date,
// no birth time, no birthplace. See positions.js, which works them out here on
// the device. What comes back is written by the app's own Swift, so a reading
// on the web is the reading on a phone, word for word.
//
// Two of the things sent are the reader's clock rather than the server's:
// which instant to read the sky at, and which day it is here. A server's day
// turns over at midnight UTC, which in Chicago arrives at seven the evening
// before, and a reading that calls itself today's should not.

import { natalPositions } from "./positions.js";

/// Where the readings come from. A different one can be set in this browser —
/// `localStorage.setItem("astrolabe.readings.endpoint", "http://localhost:8791/readings")` —
/// which is how a work-in-progress server is tried without touching the site.
const DEFAULT_ENDPOINT = "https://astrolabe-readings.astrolabe-gelato-broker.workers.dev/readings";

export function endpoint() {
  try {
    return localStorage.getItem("astrolabe.readings.endpoint") || DEFAULT_ENDPOINT;
  } catch {
    return DEFAULT_ENDPOINT;
  }
}

/// The instant, as the astronomy counts it.
export const julianDayNow = (at = new Date()) => at.getTime() / 86400000 + 2440587.5;

/// Which day it is *here*, counted the way the app counts days: whole days
/// since the epoch in this device's own zone, so it changes at local midnight.
export function readerDay(at = new Date()) {
  return Math.floor((at.getTime() - at.getTimezoneOffset() * 60000) / 86400000);
}

/**
 * The readings for a saved profile, or null if it cannot be cast yet.
 *
 * Throws if the server cannot be reached or refuses, with a message fit to
 * show a reader. The caller decides what a failure looks like on the page.
 */
export async function fetchReadings(profile, { rulers = "modern", areas, periods, signal, at } = {}) {
  const positions = natalPositions(profile);
  if (!positions) return null;

  const body = {
    positions,
    julianDay: julianDayNow(at),
    readerDay: readerDay(at),
    rulers,
  };
  if (areas) body.areas = areas;
  if (periods) body.periods = periods;

  let response;
  try {
    response = await fetch(endpoint(), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
      signal,
    });
  } catch {
    throw new Error("The readings could not be reached. Check your connection and try again.");
  }

  let payload = null;
  try {
    payload = await response.json();
  } catch {
    throw new Error("The readings came back in a form this page could not read.");
  }
  if (!response.ok) {
    throw new Error(payload?.error ? `The readings were refused: ${payload.error}` : "The readings could not be composed.");
  }
  return payload;
}

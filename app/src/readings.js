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
// One place knows where a pass lives and how it is refreshed: /account/unlock/
// writes it, this only reads it. Reading never throws — a private window, or
// storage switched off, means the free reading rather than a broken page.
import { readPass } from "../../chart/src/pass.js";

/// Where the readings come from. A different one can be set in this browser —
/// `localStorage.setItem("astrolabe.readings.endpoint", "http://localhost:8791/readings")` —
/// which is how a work-in-progress server is tried without touching the site.
const DEFAULT_ENDPOINT = "https://astrolabe-readings.astrolabe-gelato-broker.workers.dev/readings";

/// A subscriber's pass, or null. It is an opaque token: it proves a
/// subscription without saying whose, and the reading server checks its
/// signature without looking anything up. Written by /account/unlock/ when a
/// sign-in link is opened.
///
/// Reading it can throw rather than return null — a private window, storage
/// switched off — and that has to mean the free reading, not a broken page.
/// Temporary: chart/src/pass.js will own this key, and this becomes an import.
export function readPass() {
  try {
    return localStorage.getItem("astrolabe.pass") || null;
  } catch {
    return null;
  }
}

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

  // The pass rides along when there is one. The server verifies it and
  // composes the paid readings; without it, the paid words are never written,
  // so there is nothing in the reply for anyone to dig out.
  const headers = { "Content-Type": "application/json" };
  const pass = readPass();
  if (pass) headers["X-Astrolabe-Pass"] = pass;

  let response;
  try {
    response = await fetch(endpoint(), {
      method: "POST",
      headers,
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

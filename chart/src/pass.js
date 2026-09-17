// The subscription pass, as a browser holds it.
//
// One file knows the storage key and the shape, so the pages that write a
// pass and the app that sends one can never drift. What's stored is the
// token string alone: its expiry is inside it, signed, so there's nothing
// beside it to fall out of step.
//
// A pass says nothing about a person — a random id and an expiry, signed by
// the Worker. See Server/gelato-broker/src/passes.js in the app repo.
//
// Every read and write is wrapped: storage throws rather than returning null
// in a private window or with site data blocked, and a reader in that state
// should get the free reading, not a broken page.

const KEY = "astrolabe.pass";
const STATUS_URL = "https://astrolabe-gelato-broker.astrolabe-gelato-broker.workers.dev/pass/status";

/** The pass this browser holds, or null. Never throws. */
export function readPass() {
  try {
    const token = localStorage.getItem(KEY);
    return token && token.includes(".") ? token : null;
  } catch {
    return null;
  }
}

/** Keeps a pass in this browser. Returns whether it could. */
export function writePass(token) {
  try {
    localStorage.setItem(KEY, token);
    return true;
  } catch {
    return false;
  }
}

/** Forgets the pass in this browser, which is what signing out means here. */
export function clearPass() {
  try {
    localStorage.removeItem(KEY);
  } catch {
    // Nothing to do: a browser that won't let go of it won't have let us
    // write it either.
  }
}

/**
 * Checks the pass with the Worker and keeps the fresher one it sends back.
 *
 * Call it once when a page opens, not per reading. It answers
 * `{ active, until }` — `until` is unix seconds — and stores the new token
 * itself, so a browser that keeps reading never needs another email.
 *
 * **A failure here is not a lapsed subscription.** If the network is down or
 * the Worker is unreachable, the pass in hand is kept and reported as it
 * stands: locking someone out because their train went into a tunnel would be
 * the wrong answer, and the reading server checks the signature anyway.
 */
export async function refreshPass({ fetchImpl = fetch, url = STATUS_URL } = {}) {
  const token = readPass();
  if (!token) return { active: false, until: null, pass: null };
  try {
    const res = await fetchImpl(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ pass: token }),
    });
    if (!res.ok) return { active: true, until: null, pass: token, unverified: true };
    const body = await res.json();
    if (!body?.active) {
      // The Worker is the authority on a subscription that has ended, so a
      // clear answer is acted on: the pass is dropped rather than left to
      // rot in storage and fail silently at every reading.
      clearPass();
      return { active: false, until: null, pass: null };
    }
    if (body.pass) writePass(body.pass);
    return { active: true, until: body.until ?? null, pass: body.pass ?? token };
  } catch {
    return { active: true, until: null, pass: token, unverified: true };
  }
}

/** The pass to send with a reading request, or null. */
export const passForReading = readPass;

// The Custom Chart Poster's half of the site: the order service it talks to,
// and the pass that lets this browser see a customer's own posters.
//
// The pass is a random id and an expiry, signed by the order service. It says
// nothing about a person; it is kept in this browser's own storage and sent
// only to the order service. See Server/gelato-broker/src/accounts.js in the
// app repo.

export const BROKER = "https://astrolabe-gelato-broker.astrolabe-gelato-broker.workers.dev";

const PASS_KEY = "astrolabe.posterPass";

export function readPass() {
  try {
    return localStorage.getItem(PASS_KEY);
  } catch {
    return null;
  }
}

/** False when this browser won't store anything (a private window, say). */
export function writePass(pass) {
  try {
    localStorage.setItem(PASS_KEY, pass);
    return localStorage.getItem(PASS_KEY) === pass;
  } catch {
    return false;
  }
}

export function clearPass() {
  try {
    localStorage.removeItem(PASS_KEY);
  } catch {
    // Nothing stored, nothing to clear.
  }
}

/**
 * POST JSON to the order service. Resolves to `{ ok, status, body }` and never
 * throws for an answer it got; a network failure rejects, so the caller can
 * say "couldn't reach the server" rather than repeating a server's words.
 */
export async function call(path, payload) {
  const res = await fetch(BROKER + path, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  const body = res.status === 204 ? {} : await res.json().catch(() => ({}));
  return { ok: res.ok, status: res.status, body };
}

export function money(cents, currency = "usd") {
  try {
    return new Intl.NumberFormat(undefined, { style: "currency", currency: currency.toUpperCase() }).format(cents / 100);
  } catch {
    return "$" + (cents / 100).toFixed(2);
  }
}

export function longDay(iso) {
  return new Date(iso).toLocaleDateString(undefined, { weekday: "long", month: "long", day: "numeric" });
}

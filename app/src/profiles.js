// The people a chart can be cast for, kept on this device and nowhere else.
//
// Mirrors `Profile.swift` in the app field for field, so a profile means the
// same thing on the web as on a phone: a name, an optional relationship, a
// birth date and time, and a birth place with the time zone that was in force
// there. Stored in localStorage, which is this browser's own storage — there
// is no account and no server copy, so the promise that nothing typed leaves
// the device holds for saved people exactly as it does for a one-off chart.
//
// The cost of that promise is worth saying plainly: clearing the browser's
// site data deletes them, and they do not follow anyone to another device.

const KEY = "astrolabe.profiles.v1";
const SELECTED = "astrolabe.profiles.selected";

/**
 * How precisely the birth time is known, as in `TimeEntryMode.swift`.
 *
 * Only "exact" is cast so far. The other three are stored now so a profile
 * saved today keeps its meaning when casting across an uncertain window
 * arrives, rather than being silently promoted to an exact time.
 */
export const TIME_MODES = ["exact", "chip", "roughWindow", "noIdea"];

const read = () => {
  try {
    const raw = localStorage.getItem(KEY);
    const list = raw ? JSON.parse(raw) : [];
    return Array.isArray(list) ? list.filter(isValid) : [];
  } catch {
    return [];
  }
};

const write = (list) => {
  try {
    localStorage.setItem(KEY, JSON.stringify(list));
    return true;
  } catch {
    // Private browsing, a full disk, or storage switched off. The caller shows
    // the chart anyway; it just cannot be kept.
    return false;
  }
};

function isValid(p) {
  return p && typeof p.id === "string" && typeof p.name === "string"
    && /^\d{4}-\d{2}-\d{2}$/.test(p.date) && /^\d{2}:\d{2}$/.test(p.time)
    && Number.isFinite(p.place?.latitude) && Number.isFinite(p.place?.longitude)
    && typeof p.place?.timeZoneID === "string";
}

const newId = () =>
  (crypto.randomUUID ? crypto.randomUUID() : `p-${Date.now()}-${Math.random().toString(16).slice(2)}`);

export function listProfiles() {
  return read().sort((a, b) => a.createdAt - b.createdAt);
}

export function getProfile(id) {
  return read().find((p) => p.id === id) ?? null;
}

/**
 * Create or update. Returns the saved profile, or null if it could not be
 * stored — in which case the caller still has the object and can cast from it.
 */
export function saveProfile(input) {
  const list = read();
  const existing = input.id ? list.find((p) => p.id === input.id) : null;
  const profile = {
    id: existing?.id ?? newId(),
    name: String(input.name ?? "").trim(),
    relationship: input.relationship ? String(input.relationship).trim() : null,
    createdAt: existing?.createdAt ?? Date.now(),
    date: input.date,
    time: input.time,
    timeMode: TIME_MODES.includes(input.timeMode) ? input.timeMode : "exact",
    place: {
      name: String(input.place?.name ?? "").trim(),
      latitude: Number(input.place?.latitude),
      longitude: Number(input.place?.longitude),
      timeZoneID: String(input.place?.timeZoneID ?? ""),
    },
  };
  if (!isValid(profile)) throw new Error("That profile is missing a date, a time or a place.");
  const next = existing ? list.map((p) => (p.id === profile.id ? profile : p)) : [...list, profile];
  return write(next) ? profile : null;
}

export function deleteProfile(id) {
  const next = read().filter((p) => p.id !== id);
  write(next);
  if (selectedProfileId() === id) selectProfile(next[0]?.id ?? null);
}

export function selectedProfileId() {
  try { return localStorage.getItem(SELECTED); } catch { return null; }
}

export function selectProfile(id) {
  try {
    if (id) localStorage.setItem(SELECTED, id);
    else localStorage.removeItem(SELECTED);
  } catch {}
}

/**
 * Ask the browser not to clear this site's storage under pressure.
 *
 * Safari in particular may evict a site's data after a stretch of disuse
 * unless it has been added to the Home Screen, and saved people are the one
 * thing here that cannot be rebuilt from the page. Asking is harmless where it
 * is refused, and it is refused silently.
 */
export async function requestPersistentStorage() {
  try {
    if (navigator.storage?.persisted && await navigator.storage.persisted()) return true;
    return navigator.storage?.persist ? await navigator.storage.persist() : false;
  } catch {
    return false;
  }
}

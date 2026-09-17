// Finding a birth place, on this device.
//
// The iPhone app searches through Apple's maps. A web page has no free
// equivalent, and every paid one means sending the place someone was born to
// somebody else's server — which would quietly break the promise that nothing
// typed here leaves the device. So the search runs over a list of the world's
// towns shipped with the site instead: no service, no bill, and it works with
// no signal.
//
// The list is GeoNames' cities1000 (geonames.org), under CC BY 4.0 — every
// populated place of 1,000 people or more, 171,035 of them as of 2026-09-17.
// Any page that uses this must credit GeoNames. Each place carries its own
// IANA time zone, which is the other half of the job: a birth place is only
// useful to a chart once it also says which clock was on the wall there.
//
// Built by App/Tools/chart-renderer/build-places.mjs in the app repo.
//
// SHARDED BY FIRST LETTER. The whole list is several megabytes, far too much
// for a phone to fetch for one search, so each place lives in the file for the
// first letter of its folded name, and only that file loads — on the first
// keystroke of a search, not with the page. The cost is that matching runs from
// the *start* of a name: "ork" will not find New York, whose shard is "n".
// People type birth towns from the beginning, so that is the case that works
// completely.

const DATA = new URL("../data/places/", import.meta.url).href;

// Reduce a place name to the form people actually type.
//
// Accents go, so "sao paulo" finds São Paulo. Punctuation goes, because the
// largest St. Louis is spelled with a period and nobody types one. Hyphens
// become spaces, for Winston-Salem. And the common abbreviations collapse to
// one form, so "saint louis", "st louis" and "st. louis" all reach the same
// city — before this, the obvious query for St. Louis, Missouri found a town of
// seven thousand in Michigan instead.
//
// The accent range is written as escapes on purpose. Typed as the literal
// combining marks it still works, but those marks are invisible and fuse onto
// the neighbouring bracket in most editors.
//
// The build script imports this same function to decide which shard a place
// belongs in, so the page and the data cannot disagree about it — **as long as
// the data is rebuilt whenever this changes.** Most rules keep a name's first
// letter, but stripping punctuation does not always: 's-Hertogenbosch starts
// with an apostrophe, so it moves from the "_" shard to "s". A page shipped
// with a new fold() and old data would search the wrong shard for it.
export const fold = (s) =>
  String(s).normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase()
    .replace(/[.'\u2019`]/g, "")
    .replace(/[-\u2010-\u2014_]/g, " ")
    .replace(/\bsainte\b/g, "ste").replace(/\bsaint\b/g, "st")
    .replace(/\bmount\b/g, "mt").replace(/\bfort\b/g, "ft")
    .replace(/\s+/g, " ")
    .trim();

/** The shard a folded name lives in: a–z, or "_" for anything else. */
export const shardOf = (folded) => {
  const c = folded.charAt(0);
  return c >= "a" && c <= "z" ? c : "_";
};

let meta = null;
const shards = new Map();

const getJSON = (url) =>
  fetch(url).then((r) => (r.ok ? r.json() : null)).catch(() => null);

/**
 * The lookup tables every shard refers to: time zones, region names, and
 * country names. Small, and loaded once.
 * Resolves to null when place data is unavailable, so a page can fall back to
 * coordinates instead of failing.
 */
export function loadPlaces() {
  if (!meta) meta = getJSON(DATA + "meta.json");
  return meta;
}

function loadShard(key) {
  if (!shards.has(key)) {
    shards.set(key, Promise.all([loadPlaces(), getJSON(`${DATA}${key}.json`)])
      .then(([m, rows]) => (m && Array.isArray(rows) ? rows.map((r) => expand(m, r)) : null)));
  }
  return shards.get(key);
}

// [name, ascii, country, admin1, lat, lon, zone, population] — "ascii" is ""
// when it matches the name, which is most places, and it halves the data.
function expand(m, [name, ascii, country, admin1, lat, lon, zone, population]) {
  const region = m.regions[`${country}.${admin1}`] ?? "";
  const countryName = m.countries[country] ?? country;
  return {
    name, region, country: countryName, countryCode: country,
    latitude: lat, longitude: lon, timeZoneID: m.zones[zone], population,
    // Matched on both. The ASCII form is what sorts the place into a shard,
    // since a name in another script has no Latin first letter; the native
    // name, accents folded, is what people type — GeoNames spells Zürich
    // "Zuerich" in ASCII, and nobody searches for that.
    key: fold(ascii || name),
    nameKey: fold(name),
    regionKey: fold(region),
    countryKey: fold(countryName),
    label: [name, region, countryName].filter(Boolean).join(", "),
  };
}

/**
 * Up to `limit` places whose names start with what has been typed.
 *
 * Anything after a comma narrows by region or country, so "portland, oregon"
 * and "portland, maine" are different answers, and "springfield, il" works by
 * country or region code. Among matches, an exact name comes first, then the
 * larger place — the Paris someone means is rarely Paris, Texas.
 *
 * Resolves to null if place data could not be loaded, and to [] for a query
 * too short to search.
 */
export async function searchPlaces(query, limit = 8) {
  const [head, ...rest] = String(query).split(",");
  const q = fold(head);
  const narrow = fold(rest.join(","));
  if (q.length < 2) return [];

  const places = await loadShard(shardOf(q));
  if (!places) return null;

  const hits = [];
  for (const p of places) {
    if (!p.key.startsWith(q) && !p.nameKey.startsWith(q)) continue;
    if (narrow && !p.regionKey.startsWith(narrow) && !p.countryKey.startsWith(narrow)
        && p.countryCode.toLowerCase() !== narrow) continue;
    hits.push(p);
  }
  const exact = (p) => p.key === q || p.nameKey === q;
  hits.sort((a, b) => exact(b) - exact(a) || b.population - a.population);
  return hits.slice(0, limit);
}

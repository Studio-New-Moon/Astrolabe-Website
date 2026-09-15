// Checks this JS ephemeris against AstrolabeCore's Swift, body by body.
//
// The Swift is the oracle, not PyEphem: the published precision figures were
// measured against the Swift, so "the website agrees with the app" is the
// property that has to hold. A JS port that quietly differed would put the
// app and the site on different charts while both claimed the same accuracy.
//
// JDs are fed on stdin rather than as a grid, because sampling only the dates
// a table was fitted on hides interpolation error — the reason `bench` grew a
// stdin mode in the first place.
//
//   node chart/test/compare.mjs [samples]

import { execFileSync } from "node:child_process";
import { existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { longitudeOf, PLANETS } from "../src/ephemeris.js";

// Walk up for the benchmark binary rather than counting "../" — this file
// lives in a worktree whose depth below the app repo is not fixed, and
// `new URL(...).pathname` would leave the space in "Astrolabe App" as %20.
const REL = join("App", "Tools", "precision-benchmark", "bench");
function findBench() {
  let dir = dirname(fileURLToPath(import.meta.url));
  for (let i = 0; i < 12; i++) {
    const candidate = join(dir, REL);
    if (existsSync(candidate)) return candidate;
    const parent = dirname(dir);
    if (parent === dir) break;
    dir = parent;
  }
  throw new Error(
    `could not find ${REL} above this file — build it with ` +
      "swiftc -O against Sources/AstrolabeCore/*.swift, or run this from a " +
      "checkout that has it.",
  );
}
const BENCH = findBench();

// 1920–2025, the span the published bound is claimed over.
const JD_START = 2422324.5; // 1920-01-01
const JD_END = 2460676.5;   // 2025-01-01
const SAMPLES = Number(process.argv[2] ?? 4000);

// Deterministic, so a failure is reproducible. Numerical Recipes LCG.
let seed = 20260915;
const rand = () => ((seed = (seed * 1664525 + 1013904223) >>> 0) / 4294967296);

const jds = Array.from({ length: SAMPLES }, () =>
  JD_START + rand() * (JD_END - JD_START),
);

// A circular difference: 359.9999° and 0.0001° are two ten-thousandths apart.
const circularDelta = (a, b) => {
  let d = Math.abs(a - b) % 360;
  return d > 180 ? 360 - d : d;
};

let worstOverall = 0;
let failed = false;
const rows = [];

for (const body of PLANETS) {
  const out = execFileSync(BENCH, [body, "-"], {
    input: jds.map((jd) => jd.toFixed(9)).join("\n") + "\n",
    maxBuffer: 1 << 28,
  }).toString();

  const lines = out.trim().split("\n");
  if (lines.length !== jds.length) {
    throw new Error(`${body}: bench returned ${lines.length} rows for ${jds.length} JDs`);
  }

  let worst = 0;
  let worstJD = 0;
  for (const line of lines) {
    const [jdText, swiftText] = line.split(",");
    const jd = Number(jdText);
    const delta = circularDelta(Number(swiftText), longitudeOf(body, jd));
    if (delta > worst) { worst = delta; worstJD = jd; }
  }

  // Tolerance is about float arithmetic, not astronomy. The two run the same
  // series in the same order; anything beyond rounding is a porting bug, and
  // the published bound (1/50° = 0.02) is a thousand times looser than this.
  const ok = worst < 1e-9;
  if (!ok) failed = true;
  if (worst > worstOverall) worstOverall = worst;
  rows.push({ body, worst, worstJD, ok });
}

const pad = (s, n) => String(s).padEnd(n);
console.log(`${pad("body", 10)} ${pad("worst Δ°", 14)} at JD`);
for (const r of rows) {
  console.log(
    `${r.ok ? "ok   " : "FAIL "} ${pad(r.body, 9)} ${pad(r.worst.toExponential(3), 13)} ${r.worstJD.toFixed(4)}`,
  );
}
console.log(
  `\n${SAMPLES} held-out dates per body, 1920–2025. ` +
    `Worst disagreement with the Swift: ${worstOverall.toExponential(3)}°`,
);
console.log(
  failed
    ? "FAILED — the website and the app would cast different charts."
    : "All ten bodies agree with AstrolabeCore to floating-point rounding.",
);
process.exit(failed ? 1 : 0);

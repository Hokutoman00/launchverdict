// End-to-end engine test. Run: node --experimental-strip-types test/engine.test.mjs
// Verifies the verdict engine reproduces the design.md §8 fixture + stats anchors,
// with no Next.js / DB / network in the loop.

import assert from "node:assert/strict";
import { normalCdf, twoPropZTest } from "../lib/stats.ts";
import { computeFlowDeltas, dominantFlow } from "../lib/window.ts";
import { buildVerdictCard } from "../lib/verdict.ts";
import {
  buildDemoEvents, DEMO_CUT, buildHealthyEvents, DEMO_CUT_HEALTHY,
} from "../lib/demo-data.ts";

let pass = 0;
function check(name, fn) {
  fn();
  pass++;
  console.log(`  ok  ${name}`);
}

const approx = (a, b, eps = 1e-6) => Math.abs(a - b) <= eps;

// --- stats anchors (spike-validated) ---
check("normalCdf(0) = 0.5", () => assert.ok(approx(normalCdf(0), 0.5, 1e-3)));
check("normalCdf(1.96) ~ 0.975", () => assert.ok(approx(normalCdf(1.96), 0.975, 1e-3)));

check("twoPropZTest reproduces the §8 fixture (z=-5.46, p~4.6e-8)", () => {
  const r = twoPropZTest(420, 298, 455, 241);
  assert.ok(approx(r.p1, 298 / 420, 1e-9), `p1=${r.p1}`);
  assert.ok(approx(r.p2, 241 / 455, 1e-9), `p2=${r.p2}`);
  assert.ok(approx(r.z, -5.46, 0.02), `z=${r.z}`);
  assert.ok(r.pValue < 1e-6 && r.pValue > 1e-9, `p=${r.pValue}`);
});

// --- engine: regressed release must call ROLLBACK on onboarding ---
check("DEMO r-1042 → ROLLBACK on onboarding, high confidence", () => {
  const events = buildDemoEvents();
  const card = buildVerdictCard(events, DEMO_CUT);
  assert.equal(card.call, "ROLLBACK", `call=${card.call}`);
  assert.equal(card.movedFlow, "onboarding", `flow=${card.movedFlow}`);
  assert.equal(card.confidence, "high", `conf=${card.confidence}`);
  assert.ok(card.before > card.after, "before>after");
  assert.ok(card.action.toLowerCase().includes("revert"), `action=${card.action}`);
  // the verdict must surface the Novus flag as the cause
  assert.ok(card.cause.toLowerCase().includes("novus"), `cause=${card.cause}`);
  assert.ok(card.correlationNote.length > 0, "correlationNote present");
});

// dominantFlow must pick onboarding over the stable checkout/search wiggles
check("dominantFlow picks the most-moved flow", () => {
  const deltas = computeFlowDeltas(buildDemoEvents(), DEMO_CUT);
  assert.equal(dominantFlow(deltas).flow, "onboarding");
});

// --- engine: healthy release must NOT cry wolf ---
check("DEMO r-1039 → SHIP_ON (no false rollback)", () => {
  const card = buildVerdictCard(buildHealthyEvents(), DEMO_CUT_HEALTHY);
  assert.equal(card.call, "SHIP_ON", `call=${card.call}`);
});

// --- engine: real drop on a thin sample → HOLD, not a forced ROLLBACK ---
// Proves HOLD is a reachable third state (harm detected, confidence too low to revert).
check("thin-but-significant drop → HOLD, not ROLLBACK", () => {
  const t = 1_000_000_000_000;
  const emit = (step, n, ts) =>
    Array.from({ length: n }, (_, i) => ({ flow: "onboarding", step, anonId: `u${i}`, ts }));
  const events = [
    // before: 160/200 = 80%
    ...emit("start", 200, t - 1000), ...emit("complete", 160, t - 1000),
    // after: 18/40 = 45% — big drop, but only 40 sessions
    ...emit("start", 40, t + 1000), ...emit("complete", 18, t + 1000),
  ];
  const cut = {
    releaseId: "r-thin", repo: "acme/web", cutTs: t,
    baseSha: "a", headSha: "b", changedFiles: ["onboarding.tsx"], novusFlags: [],
  };
  const card = buildVerdictCard(events, cut);
  assert.equal(card.call, "HOLD", `call=${card.call}`);
  assert.equal(card.confidence, "low", `conf=${card.confidence}`);
  assert.ok(card.before > card.after, "before>after");
  assert.ok(!/revert/i.test(card.action), `action must not force a revert: ${card.action}`);
});

// --- invariant: empty after-window → INSUFFICIENT, never a fabricated call ---
check("no post-release traffic → INSUFFICIENT", () => {
  const events = buildDemoEvents().filter((e) => e.ts < DEMO_CUT.cutTs);
  const card = buildVerdictCard(events, DEMO_CUT);
  assert.equal(card.call, "INSUFFICIENT", `call=${card.call}`);
});

console.log(`\n${pass} checks passed.`);

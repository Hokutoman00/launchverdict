// Seeded demo so a stranger gets a real verdict in 60s with no login.
// design.md DEMO leaf. The headline release r-1042 reproduces the §8 fixture:
// onboarding before n1=420 c1=298 (71%), after n2=455 c2=241 (53%) → ROLLBACK.

import type { FlowEvent, ReleaseCut } from "./types.ts";

const DAY = 1000 * 60 * 60 * 24;

// Deterministic pseudo-random so the demo is byte-stable across reloads.
function mulberry32(seed: number): () => number {
  let a = seed;
  return () => {
    a |= 0; a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// Emit `starts` start events and `completes` complete events for a flow,
// spread across [from, from+span). anonId is unique per start.
function emitFunnel(
  out: FlowEvent[],
  flow: string,
  starts: number,
  completes: number,
  from: number,
  span: number,
  rnd: () => number,
  idPrefix: string,
): void {
  for (let i = 0; i < starts; i++) {
    const ts = from + Math.floor(rnd() * span);
    const anonId = `${idPrefix}-${i}`;
    out.push({ flow, step: "start", anonId, ts });
    if (i < completes) {
      out.push({ flow, step: "complete", anonId, ts: ts + Math.floor(rnd() * 60000) });
    }
  }
}

export const DEMO_CUT: ReleaseCut = {
  releaseId: "r-1042",
  repo: "acme/checkout-web",
  cutTs: Date.UTC(2026, 5, 8, 12, 0, 0), // mid-window anchor
  baseSha: "a1b2c3d",
  headSha: "e4f5a6b",
  changedFiles: ["app/onboarding/Step2.tsx", "lib/auth/session.ts"],
  novusFlags: ["Step 2 'Continue' button moved below the fold on 375px viewports"],
  ciFailures: 0,
};

export function buildDemoEvents(): FlowEvent[] {
  const rnd = mulberry32(1042);
  const out: FlowEvent[] = [];
  const t = DEMO_CUT.cutTs;

  // onboarding — the regressed flow (the §8 fixture, exact counts).
  emitFunnel(out, "onboarding", 420, 298, t - 7 * DAY, 7 * DAY, rnd, "ob-b");
  emitFunnel(out, "onboarding", 455, 241, t, 7 * DAY, rnd, "ob-a");

  // checkout — stable (should NOT dominate the verdict).
  emitFunnel(out, "checkout", 610, 511, t - 7 * DAY, 7 * DAY, rnd, "co-b");
  emitFunnel(out, "checkout", 588, 494, t, 7 * DAY, rnd, "co-a");

  // search — mild, non-significant wiggle.
  emitFunnel(out, "search", 980, 642, t - 7 * DAY, 7 * DAY, rnd, "se-b");
  emitFunnel(out, "search", 1010, 651, t, 7 * DAY, rnd, "se-a");

  return out;
}

// A second, healthy release to show a SHIP_ON card in the demo gallery.
export const DEMO_CUT_HEALTHY: ReleaseCut = {
  releaseId: "r-1039",
  repo: "acme/checkout-web",
  cutTs: Date.UTC(2026, 4, 30, 12, 0, 0),
  baseSha: "9988776",
  headSha: "5544332",
  changedFiles: ["app/search/ranking.ts"],
  novusFlags: [],
  ciFailures: 0,
};

export function buildHealthyEvents(): FlowEvent[] {
  const rnd = mulberry32(1039);
  const out: FlowEvent[] = [];
  const t = DEMO_CUT_HEALTHY.cutTs;
  // search improved meaningfully + significantly → SHIP_ON "keep it".
  emitFunnel(out, "search", 900, 540, t - 7 * DAY, 7 * DAY, rnd, "se2-b"); // 60%
  emitFunnel(out, "search", 940, 658, t, 7 * DAY, rnd, "se2-a");           // 70%
  emitFunnel(out, "onboarding", 400, 284, t - 7 * DAY, 7 * DAY, rnd, "ob2-b"); // ~71% flat
  emitFunnel(out, "onboarding", 410, 291, t, 7 * DAY, rnd, "ob2-a");
  return out;
}

// A third release: a real drop, but on a thin post-release sample → HOLD.
// Shows the engine refusing to force a revert when it doesn't yet trust the signal.
export const DEMO_CUT_HOLD: ReleaseCut = {
  releaseId: "r-1044",
  repo: "acme/checkout-web",
  cutTs: Date.UTC(2026, 5, 12, 12, 0, 0),
  baseSha: "c0ffee1",
  headSha: "d00d123",
  changedFiles: ["app/signup/Plan.tsx"],
  novusFlags: ["Plan toggle hidden behind a tooltip on first paint"],
  ciFailures: 0,
};

export function buildHoldEvents(): FlowEvent[] {
  const rnd = mulberry32(1044);
  const out: FlowEvent[] = [];
  const t = DEMO_CUT_HOLD.cutTs;
  // signup: 80% → ~45%, a large drop — but only ~44 sessions landed after ship.
  emitFunnel(out, "signup", 180, 144, t - 7 * DAY, 7 * DAY, rnd, "su-b"); // 80%
  emitFunnel(out, "signup", 44, 20, t, 7 * DAY, rnd, "su-a");             // ~45%, n=44
  return out;
}

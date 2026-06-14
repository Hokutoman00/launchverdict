// Window splitting + funnel. design.md leaf-Q1 (the in-memory equivalent of
// the SQL GROUP BY used in production against @vercel/postgres).

import type { FlowEvent, FlowDelta, ReleaseCut } from "./types.ts";
import { twoPropZTest } from "./stats.ts";

export const DEFAULT_WINDOW_MS = 1000 * 60 * 60 * 24 * 7; // 7 days each side

// Count starts and completions for one flow inside [from, to).
function funnel(
  events: FlowEvent[],
  flow: string,
  from: number,
  to: number,
): { starts: number; completions: number } {
  let starts = 0;
  let completions = 0;
  for (const e of events) {
    if (e.flow !== flow) continue;
    if (e.ts < from || e.ts >= to) continue;
    if (e.step === "start") starts++;
    else if (e.step === "complete") completions++;
  }
  return { starts, completions };
}

// For a release cut, produce one FlowDelta per tracked flow.
export function computeFlowDeltas(
  events: FlowEvent[],
  cut: ReleaseCut,
  windowMs: number = DEFAULT_WINDOW_MS,
): FlowDelta[] {
  const flows = [...new Set(events.map((e) => e.flow))].sort();
  const t = cut.cutTs;
  return flows.map((flow) => {
    const before = funnel(events, flow, t - windowMs, t);
    const after = funnel(events, flow, t, t + windowMs);
    const r = twoPropZTest(before.starts, before.completions, after.starts, after.completions);
    return {
      flow,
      n1: before.starts, c1: before.completions,
      n2: after.starts, c2: after.completions,
      p1: r.p1, p2: r.p2, z: r.z, pValue: r.pValue,
      ciLow: r.ciLow, ciHigh: r.ciHigh,
    };
  });
}

// The single most-moved flow (largest significant drop dominates the verdict).
export function dominantFlow(deltas: FlowDelta[]): FlowDelta | null {
  const ranked = [...deltas].sort(
    (a, b) => Math.abs(b.p2 - b.p1) - Math.abs(a.p2 - a.p1),
  );
  return ranked[0] ?? null;
}

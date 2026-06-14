// Verdict synthesis. design.md §2 中段階 step 4 + leaf-M.
//
// The CALL is deterministic (rule over the statistics) so it can never be
// hallucinated. The LLM layer (lib/narrative.ts) only rewrites the prose
// fields; it cannot change call/numbers. This keeps Shippedness honest.

import type { FlowDelta, ReleaseCut, VerdictCard, VerdictCall, Confidence, FlowEvent } from "./types.ts";
import { computeFlowDeltas, dominantFlow } from "./window.ts";

const MIN_AFTER_SAMPLE = 30;       // below this we won't call it
const DEFAULT_MEANINGFUL = 0.05;   // |delta| below this = noise (per-flow calibrated in prod)
const SIG_ALPHA = 0.05;

function classify(d: FlowDelta, meaningful: number, conf: Confidence): VerdictCall {
  if (d.n2 < MIN_AFTER_SAMPLE) return "INSUFFICIENT";
  const delta = d.p2 - d.p1;
  const significant = d.pValue < SIG_ALPHA;
  const meaningfulMag = Math.abs(delta) >= meaningful;
  if (!significant || !meaningfulMag) return "SHIP_ON"; // no evidence of harm → keep shipping
  if (delta < 0) {
    // Harm detected. Force a revert only when we trust the signal; on a thin
    // (low-confidence) sample, hold and gather rather than over-react to noise.
    return conf === "low" ? "HOLD" : "ROLLBACK";
  }
  return "SHIP_ON"; // significant improvement
}

function confidenceOf(d: FlowDelta): Confidence {
  const n = Math.min(d.n1, d.n2);
  if (d.pValue < 0.01 && n >= 200) return "high";
  if (d.pValue < 0.05 && n >= 60) return "medium";
  return "low";
}

function pct(x: number): string {
  return `${Math.round(x * 100)}%`;
}

// Deterministic card. cause/action are templated here; narrative.ts may refine.
export function buildVerdictCard(
  events: FlowEvent[],
  cut: ReleaseCut,
  meaningful: number = DEFAULT_MEANINGFUL,
): VerdictCard {
  const deltas = computeFlowDeltas(events, cut);
  const d = dominantFlow(deltas);
  const base = {
    releaseId: cut.releaseId,
    repo: cut.repo,
    movedFlow: d?.flow ?? "—",
    correlationNote:
      "Correlation under a known cause (the diff), not proven causation. Short windows and confounders apply.",
  };

  if (!d || d.n2 < MIN_AFTER_SAMPLE) {
    return {
      ...base,
      call: "INSUFFICIENT",
      headline: `Not enough post-release traffic yet to judge ${cut.releaseId}`,
      before: d?.p1 ?? 0, after: d?.p2 ?? 0, ciLow: d?.ciLow ?? 0, ciHigh: d?.ciHigh ?? 0,
      cause: "Waiting for more sessions after the release.",
      action: "Keep monitoring; check back after more users hit the changed flow.",
      confidence: "low",
    };
  }

  const confidence = confidenceOf(d);
  const call = classify(d, meaningful, confidence);
  const dir = d.p2 < d.p1 ? "fell" : "rose";
  const causeBits: string[] = [];
  if (cut.changedFiles.length) causeBits.push(`changed ${cut.changedFiles[0]}`);
  if (cut.novusFlags.length) causeBits.push(`Novus flagged: ${cut.novusFlags[0]}`);
  if (cut.ciFailures) causeBits.push(`${cut.ciFailures} CI check(s) failing`);

  const movedLine = `${cap(d.flow)} completion ${dir} ${pct(d.p1)}→${pct(d.p2)} after ${cut.releaseId}`;
  const headline =
    call === "ROLLBACK"
      ? movedLine
      : call === "HOLD"
      ? `${movedLine} — hold and watch (thin sample)`
      : call === "SHIP_ON" && d.pValue < SIG_ALPHA && d.p2 > d.p1
      ? `${movedLine} — keep it`
      : `No meaningful change in ${d.flow} after ${cut.releaseId} — safe to keep shipping`;

  const novusFix = cut.novusFlags[0] ? ` or fix: ${cut.novusFlags[0]}` : "";
  const action =
    call === "ROLLBACK"
      ? `Revert ${cut.releaseId}${novusFix}`
      : call === "HOLD"
      ? `Don't roll back yet — the drop is real but the sample is thin. Hold ${cut.releaseId} and recheck once more users hit the flow${novusFix}.`
      : "Keep shipping. No action needed.";

  return {
    ...base,
    call,
    headline,
    before: d.p1, after: d.p2, ciLow: d.ciLow, ciHigh: d.ciHigh,
    cause: causeBits.join("; ") || "No obvious cause in the diff.",
    action,
    confidence,
  };
}

function cap(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

// leaf-M: per-flow meaningful-delta calibration via EWMA of followed verdicts.
export function calibrateThreshold(
  thresholdOld: number,
  observedDelta: number,
  followedAndRecovered: boolean,
  alpha = 0.3,
): number {
  return followedAndRecovered
    ? alpha * Math.abs(observedDelta) + (1 - alpha) * thresholdOld
    : thresholdOld; // verdicts the maker ignored don't train the rule
}

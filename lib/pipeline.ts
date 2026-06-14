// The closed loop, one function. design.md §2 wired end to end.
// ReleaseCut --(telemetry windows)--> deterministic VerdictCard
//            --(prose polish)--> --(persist)--> --(deliver to PR/status)-->

import type { ReleaseCut, VerdictCard } from "./types.ts";
import { buildVerdictCard, calibrateThreshold } from "./verdict.ts";
import { computeFlowDeltas, dominantFlow, DEFAULT_WINDOW_MS } from "./window.ts";
import { eventsAround, saveVerdict, loadThreshold, saveThreshold } from "./db.ts";
import { refineNarrative } from "./narrative.ts";
import { makeOctokit, postVerdict } from "./github.ts";

// Demo/short-cycle override so a verdict can mature in minutes, not 7 days.
function windowMs(): number {
  const m = Number(process.env.VERDICT_WINDOW_MS);
  return Number.isFinite(m) && m > 0 ? m : DEFAULT_WINDOW_MS;
}

export async function computeVerdictForCut(cut: ReleaseCut): Promise<VerdictCard> {
  const w = windowMs();
  const events = await eventsAround(cut.repo, cut.cutTs, w);

  // per-flow calibrated threshold (leaf-M); fall back to default inside buildVerdictCard
  const deltas = computeFlowDeltas(events, cut, w);
  const dom = dominantFlow(deltas);
  const threshold = dom ? await loadThreshold(cut.repo, dom.flow) : null;

  const raw = buildVerdictCard(events, cut, threshold ?? undefined);
  const card = await refineNarrative(raw);
  await saveVerdict(card);
  return card;
}

export async function deliverVerdict(
  card: VerdictCard,
  headSha: string,
  prNumber: number | undefined,
  baseUrl: string,
): Promise<void> {
  const url = `${baseUrl}/v/${encodeURIComponent(card.releaseId)}`;
  const octokit = makeOctokit();
  await postVerdict(octokit, card, headSha, prNumber, url);
}

// Train the per-flow threshold once a maker has acted on a verdict and the
// flow recovered (leaf-M). Called from a feedback endpoint / cron.
export async function trainThreshold(
  repo: string, flow: string, observedDelta: number, followedAndRecovered: boolean,
): Promise<number> {
  const old = (await loadThreshold(repo, flow)) ?? 0.05;
  const next = calibrateThreshold(old, observedDelta, followedAndRecovered);
  await saveThreshold(repo, flow, next);
  return next;
}

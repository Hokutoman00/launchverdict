// GitHub integration. design.md leaf-D1/N1/C1 (read the cut) + leaf-O1 (deliver).
//
// Read side: a release cut's *cause* is assembled from the compare diff
// (changed files), the head SHA's check runs (CI failures), and Novus's
// pre-merge PR review comments (the UX flags). Write side: the verdict is
// delivered back where the maker works — a PR comment + a commit status.

import { Octokit } from "@octokit/rest";
import type { ReleaseCut, VerdictCard } from "./types.ts";

export function makeOctokit(token = process.env.GITHUB_TOKEN): Octokit {
  if (!token) throw new Error("GITHUB_TOKEN not set");
  return new Octokit({ auth: token });
}

// The Novus bot login as it appears as a PR review author. Configurable so the
// dogfood account name can change without touching the engine.
const NOVUS_LOGIN = (process.env.NOVUS_BOT_LOGIN || "novus-ai").toLowerCase();

function splitRepo(repo: string): { owner: string; repo: string } {
  const [owner, name] = repo.split("/");
  return { owner, repo: name };
}

export async function buildReleaseCut(
  octokit: Octokit,
  repo: string,
  releaseId: string,
  baseSha: string,
  headSha: string,
  cutTs: number,
  prNumber?: number,
): Promise<ReleaseCut> {
  const { owner, repo: name } = splitRepo(repo);

  const compare = await octokit.repos.compareCommitsWithBasehead({
    owner, repo: name, basehead: `${baseSha}...${headSha}`,
  });
  const changedFiles = (compare.data.files ?? []).map((f) => f.filename);

  const checks = await octokit.checks.listForRef({ owner, repo: name, ref: headSha });
  const ciFailures = checks.data.check_runs.filter(
    (c) => c.conclusion === "failure" || c.conclusion === "timed_out",
  ).length;

  let novusFlags: string[] = [];
  if (prNumber != null) {
    const reviews = await octokit.pulls.listReviewComments({
      owner, repo: name, pull_number: prNumber, per_page: 100,
    });
    novusFlags = reviews.data
      .filter((c) => (c.user?.login ?? "").toLowerCase().includes(NOVUS_LOGIN))
      .map((c) => firstLine(c.body));
  }

  return { releaseId, repo, cutTs, baseSha, headSha, changedFiles, novusFlags, ciFailures };
}

export async function postVerdict(
  octokit: Octokit,
  card: VerdictCard,
  headSha: string,
  prNumber: number | undefined,
  verdictUrl: string,
): Promise<void> {
  const { owner, repo: name } = splitRepo(card.repo);

  const state =
    card.call === "ROLLBACK" ? "failure" : card.call === "HOLD" ? "pending" : "success";
  await octokit.repos.createCommitStatus({
    owner, repo: name, sha: headSha,
    state, context: "LaunchVerdict",
    description: truncate(`${card.call}: ${card.headline}`, 140),
    target_url: verdictUrl,
  });

  if (prNumber != null) {
    await octokit.issues.createComment({
      owner, repo: name, issue_number: prNumber, body: renderComment(card, verdictUrl),
    });
  }
}

function renderComment(card: VerdictCard, url: string): string {
  const emoji =
    card.call === "ROLLBACK" ? "↩️" : card.call === "SHIP_ON" ? "✅" : card.call === "HOLD" ? "⏸️" : "…";
  const rates =
    card.call === "INSUFFICIENT"
      ? ""
      : `\n\n**${card.movedFlow}**: ${pc(card.before)} → ${pc(card.after)} (after-rate 95% CI [${pc(card.ciLow)}, ${pc(card.ciHigh)}])`;
  return [
    `## ${emoji} LaunchVerdict — ${card.call.replace("_", " ")}`,
    `**${card.headline}**${rates}`,
    `\n**Cause:** ${card.cause}`,
    `**Do this:** ${card.action}`,
    `\n_${card.confidence} confidence · ${card.correlationNote}_`,
    `\n[Open the verdict card →](${url})`,
  ].join("\n");
}

const firstLine = (s: string) => (s || "").split("\n")[0].slice(0, 200);
const truncate = (s: string, n: number) => (s.length > n ? s.slice(0, n - 1) + "…" : s);
const pc = (x: number) => `${Math.round(x * 100)}%`;

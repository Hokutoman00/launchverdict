// GitHub webhook. design.md leaf-W1 (the release as a causal cut) + leaf-O1.
// On a merged PR we assemble the cut's cause and run the closed loop.

import { NextResponse } from "next/server";
import crypto from "node:crypto";
import { makeOctokit, buildReleaseCut } from "../../../lib/github.ts";
import { computeVerdictForCut, deliverVerdict } from "../../../lib/pipeline.ts";
import { dbConfigured, ensureSchema } from "../../../lib/db.ts";
import { pendoTrack } from "../../../lib/pendo.ts";

export const runtime = "nodejs";

function verifySignature(raw: string, sig: string | null, secret: string): boolean {
  if (!sig) return false;
  const hmac = crypto.createHmac("sha256", secret).update(raw).digest("hex");
  const expected = `sha256=${hmac}`;
  // length-safe constant-time compare
  if (sig.length !== expected.length) return false;
  return crypto.timingSafeEqual(Buffer.from(sig), Buffer.from(expected));
}

function baseUrlFrom(req: Request): string {
  return (
    process.env.PUBLIC_BASE_URL ||
    new URL(req.url).origin
  );
}

export async function POST(req: Request) {
  const secret = process.env.GITHUB_WEBHOOK_SECRET;
  if (!secret) {
    return NextResponse.json({ ok: false, reason: "webhook-secret-not-configured" }, { status: 503 });
  }
  const raw = await req.text();
  if (!verifySignature(raw, req.headers.get("x-hub-signature-256"), secret)) {
    return NextResponse.json({ ok: false, reason: "bad-signature" }, { status: 401 });
  }

  const event = req.headers.get("x-github-event");
  const payload = JSON.parse(raw);

  // Only act on a merged PR — that is the release cut.
  if (event !== "pull_request" || payload.action !== "closed" || !payload.pull_request?.merged) {
    return NextResponse.json({ ok: true, ignored: event });
  }

  const pr = payload.pull_request;
  const repo: string = payload.repository.full_name;
  const baseSha: string = pr.base.sha;
  const headSha: string = pr.merge_commit_sha || pr.head.sha;
  const releaseId = `pr-${pr.number}`;
  const cutTs = Date.parse(pr.merged_at) || Date.now();

  if (dbConfigured()) await ensureSchema();

  const octokit = makeOctokit();
  const cut = await buildReleaseCut(octokit, repo, releaseId, baseSha, headSha, cutTs, pr.number);
  const card = await computeVerdictForCut(cut);
  await deliverVerdict(card, headSha, pr.number, baseUrlFrom(req));

  await pendoTrack("webhook_processed", {
    repo,
    release_id: releaseId,
    call: card.call,
    pr_number: pr.number,
    event_type: "pull_request",
    processing_succeeded: true,
  }, pr.user?.login || "system", repo);

  return NextResponse.json({ ok: true, releaseId, call: card.call });
}

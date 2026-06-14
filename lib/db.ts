// Telemetry store. design.md leaf-C1/Q1.
//
// Deliberately thin: we store raw flow events and, at verdict time, pull the
// two windows of raw events and feed them through the SAME computeFlowDeltas
// engine the unit test verifies. No funnel math is duplicated in SQL, so the
// production path cannot diverge from the tested path.

import { sql } from "@vercel/postgres";
import type { FlowEvent } from "./types.ts";
import { DEFAULT_WINDOW_MS } from "./window.ts";

export function dbConfigured(): boolean {
  return Boolean(process.env.POSTGRES_URL || process.env.DATABASE_URL);
}

export async function ensureSchema(): Promise<void> {
  await sql`
    CREATE TABLE IF NOT EXISTS flow_events (
      id      BIGSERIAL PRIMARY KEY,
      repo    TEXT NOT NULL,
      flow    TEXT NOT NULL,
      step    TEXT NOT NULL,
      anon_id TEXT NOT NULL,
      ts      BIGINT NOT NULL
    )`;
  await sql`CREATE INDEX IF NOT EXISTS flow_events_repo_ts ON flow_events (repo, ts)`;
  await sql`
    CREATE TABLE IF NOT EXISTS verdicts (
      release_id TEXT PRIMARY KEY,
      repo       TEXT NOT NULL,
      call       TEXT NOT NULL,
      card       JSONB NOT NULL,
      created_at TIMESTAMPTZ DEFAULT now()
    )`;
  await sql`
    CREATE TABLE IF NOT EXISTS flow_thresholds (
      repo      TEXT NOT NULL,
      flow      TEXT NOT NULL,
      threshold DOUBLE PRECISION NOT NULL,
      PRIMARY KEY (repo, flow)
    )`;
}

export async function insertEvents(repo: string, events: FlowEvent[]): Promise<void> {
  if (events.length === 0) return;
  // Batched multi-row insert, fully parameterized. The repo/flow/step/anonId
  // here arrive from the unauthenticated public /api/collect beacon, so they
  // are bound as parameters ($1,$2,…) — never interpolated into SQL text.
  const params: (string | number)[] = [];
  const tuples = events.map((e) => {
    const b = params.length;
    params.push(repo, e.flow, e.step, e.anonId, Number(e.ts));
    return `($${b + 1}, $${b + 2}, $${b + 3}, $${b + 4}, $${b + 5})`;
  });
  await sql.query(
    `INSERT INTO flow_events (repo, flow, step, anon_id, ts) VALUES ${tuples.join(",")}`,
    params,
  );
}

// Raw events in [cutTs - W, cutTs + W) for one repo, mapped back to FlowEvent.
export async function eventsAround(
  repo: string,
  cutTs: number,
  windowMs: number = DEFAULT_WINDOW_MS,
): Promise<FlowEvent[]> {
  const from = cutTs - windowMs;
  const to = cutTs + windowMs;
  const { rows } = await sql<{
    flow: string; step: string; anon_id: string; ts: string;
  }>`
    SELECT flow, step, anon_id, ts
    FROM flow_events
    WHERE repo = ${repo} AND ts >= ${from} AND ts < ${to}`;
  return rows.map((r) => ({
    flow: r.flow,
    step: r.step,
    anonId: r.anon_id,
    ts: Number(r.ts),
  }));
}

export async function saveVerdict(card: {
  releaseId: string; repo: string; call: string;
}): Promise<void> {
  await sql`
    INSERT INTO verdicts (release_id, repo, call, card)
    VALUES (${card.releaseId}, ${card.repo}, ${card.call}, ${JSON.stringify(card)})
    ON CONFLICT (release_id) DO UPDATE SET call = EXCLUDED.call, card = EXCLUDED.card`;
}

export async function loadVerdict(releaseId: string): Promise<unknown | null> {
  const { rows } = await sql<{ card: unknown }>`
    SELECT card FROM verdicts WHERE release_id = ${releaseId}`;
  return rows[0]?.card ?? null;
}

export async function loadThreshold(repo: string, flow: string): Promise<number | null> {
  const { rows } = await sql<{ threshold: number }>`
    SELECT threshold FROM flow_thresholds WHERE repo = ${repo} AND flow = ${flow}`;
  return rows[0]?.threshold ?? null;
}

export async function saveThreshold(repo: string, flow: string, t: number): Promise<void> {
  await sql`
    INSERT INTO flow_thresholds (repo, flow, threshold)
    VALUES (${repo}, ${flow}, ${t})
    ON CONFLICT (repo, flow) DO UPDATE SET threshold = EXCLUDED.threshold`;
}

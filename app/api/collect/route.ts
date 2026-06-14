// Telemetry beacon ingress. design.md leaf-C1.
// A one-line snippet on the maker's site POSTs {repo, flow, step, anonId} here.
// We stamp server time (clients lie about clocks) and store the raw event.

import { NextResponse } from "next/server";
import { dbConfigured, ensureSchema, insertEvents } from "../../../lib/db.ts";
import type { FlowEvent } from "../../../lib/types.ts";

export const runtime = "nodejs";

type Beacon = { repo?: string; flow?: string; step?: string; anonId?: string };

export async function POST(req: Request) {
  if (!dbConfigured()) {
    return NextResponse.json({ ok: false, reason: "telemetry-store-not-configured" }, { status: 503 });
  }
  let body: Beacon | Beacon[];
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: false, reason: "bad-json" }, { status: 400 });
  }
  const beacons = Array.isArray(body) ? body : [body];
  const now = Date.now();

  const byRepo = new Map<string, FlowEvent[]>();
  for (const b of beacons) {
    if (!b.repo || !b.flow || !b.step || !b.anonId) continue;
    const ev: FlowEvent = { flow: b.flow, step: b.step, anonId: b.anonId, ts: now };
    const list = byRepo.get(b.repo) ?? [];
    list.push(ev);
    byRepo.set(b.repo, list);
  }
  if (byRepo.size === 0) {
    return NextResponse.json({ ok: false, reason: "no-valid-events" }, { status: 400 });
  }

  await ensureSchema();
  for (const [repo, events] of byRepo) await insertEvents(repo, events);

  const accepted = [...byRepo.values()].reduce((n, l) => n + l.length, 0);
  return NextResponse.json({ ok: true, accepted });
}

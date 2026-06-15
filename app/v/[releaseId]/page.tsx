import Link from "next/link";
import VerdictCard from "../../../components/VerdictCard.tsx";
import type { VerdictCard as Card } from "../../../lib/types.ts";
import { dbConfigured, loadVerdict } from "../../../lib/db.ts";
import { demoCardFor } from "../../../lib/demo-data.ts";
import { pendoTrack } from "../../../lib/pendo.ts";

export const dynamic = "force-dynamic";

export default async function VerdictPage({
  params,
}: {
  params: Promise<{ releaseId: string }>;
}) {
  const { releaseId } = await params;

  let card: Card | null = null;
  let seeded = false;
  if (dbConfigured()) {
    card = (await loadVerdict(releaseId)) as Card | null;
  }
  // No live store (or no row): fall back to the seeded fixture for a known
  // demo release so a public permalink renders a real card. Labeled as seeded.
  if (!card) {
    card = demoCardFor(releaseId);
    seeded = card !== null;
  }

  if (card) {
    await pendoTrack("verdict_card_viewed", {
      release_id: releaseId,
      repo: card.repo,
      call: card.call,
      confidence: card.confidence,
      moved_flow: card.movedFlow,
      is_seeded_demo: seeded,
      source: seeded ? "demo" : "live",
    }, "system", card.repo);
  }

  return (
    <main className="wrap">
      <div className="eyebrow">
        LaunchVerdict · verdict{seeded ? " (seeded demo)" : ""}
      </div>
      {card ? (
        <>
          <h1 style={{ marginBottom: 24 }}>{releaseId}</h1>
          <VerdictCard card={card} />
        </>
      ) : (
        <>
          <h1>No verdict for {releaseId} yet</h1>
          <p className="lede">
            This release either hasn&apos;t been processed or the telemetry store
            isn&apos;t connected in this environment. Try the{" "}
            <Link href="/demo" style={{ textDecoration: "underline" }}>
              live seeded demo
            </Link>{" "}
            to see a real verdict card.
          </p>
        </>
      )}
    </main>
  );
}

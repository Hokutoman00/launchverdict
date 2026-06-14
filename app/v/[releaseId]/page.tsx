import Link from "next/link";
import VerdictCard from "../../../components/VerdictCard.tsx";
import type { VerdictCard as Card } from "../../../lib/types.ts";
import { dbConfigured, loadVerdict } from "../../../lib/db.ts";

export const dynamic = "force-dynamic";

export default async function VerdictPage({
  params,
}: {
  params: Promise<{ releaseId: string }>;
}) {
  const { releaseId } = await params;

  let card: Card | null = null;
  if (dbConfigured()) {
    card = (await loadVerdict(releaseId)) as Card | null;
  }

  return (
    <main className="wrap">
      <div className="eyebrow">LaunchVerdict · verdict</div>
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

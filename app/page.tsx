import Link from "next/link";

export default function Home() {
  return (
    <main className="wrap">
      <div className="eyebrow">LaunchVerdict</div>
      <h1>Every release gets one verdict: keep it, or roll it back.</h1>
      <p className="lede">
        You ship every week with an AI builder. You don&apos;t have a data team. After
        each release you&apos;re left guessing whether it helped or quietly broke the
        one flow that pays your rent. LaunchVerdict watches the diff and the funnel,
        and hands you a single black-and-white card per release — with the number,
        the likely cause, and the one thing to do next.
      </p>
      <p className="lede" style={{ marginTop: 16 }}>
        Novus reviews the diff <em>before</em> you merge and flags UX regressions.
        LaunchVerdict renders the verdict <em>after</em> it ships. Together that&apos;s a
        closed release-confidence loop for solo makers.
      </p>
      <p className="lede" style={{ marginTop: 16 }}>
        Built for the maker who ships every week with an AI builder and no data
        team — and dogfooded on its own repo, so the first release LaunchVerdict
        judges is itself.
      </p>
      <p style={{ marginTop: 28 }}>
        <Link
          href="/demo"
          style={{
            display: "inline-block",
            border: "1px solid var(--ink)",
            borderRadius: 3,
            padding: "12px 22px",
            fontWeight: 600,
            letterSpacing: "0.02em",
          }}
        >
          See three live verdicts → no login
        </Link>
      </p>
    </main>
  );
}

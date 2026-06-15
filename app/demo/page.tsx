import VerdictCard from "../../components/VerdictCard.tsx";
import { buildVerdictCard } from "../../lib/verdict.ts";
import {
  buildDemoEvents, DEMO_CUT, buildHealthyEvents, DEMO_CUT_HEALTHY,
  buildHoldEvents, DEMO_CUT_HOLD,
} from "../../lib/demo-data.ts";

// Server component: the verdicts below are computed at request time by the same
// engine the unit test verifies. Nothing is hard-coded — change the seed and
// the card changes. This is the 60-second value path with no login.
export default function DemoPage() {
  const cards = [
    buildVerdictCard(buildDemoEvents(), DEMO_CUT),
    buildVerdictCard(buildHoldEvents(), DEMO_CUT_HOLD),
    buildVerdictCard(buildHealthyEvents(), DEMO_CUT_HEALTHY),
  ];

  return (
    <main className="wrap">
      <div className="eyebrow">LaunchVerdict · live demo (seeded)</div>
      <h1>Three releases. Three verdicts.</h1>
      <p className="lede">
        You shipped three times this week. Instead of a 40-widget dashboard, here is
        one card per release: did it help the flow that matters, or hurt it — and
        what to do now. One clearly regressed (roll back), one dropped on too thin a
        sample to trust yet (hold and watch), one improved (keep shipping). All
        computed live from seeded telemetry by the same engine that runs on real repos.
      </p>

      <div className="section-label">This week&apos;s verdicts</div>
      <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
        {cards.map((c) => (
          <VerdictCard key={c.releaseId} card={c} />
        ))}
      </div>

      <div className="section-label">How the call is made</div>
      <p className="lede">
        We treat a release as the cut point on the event timeline. We compare each
        flow&apos;s completion rate in the 7 days before vs after the cut with a
        two-proportion z-test, take the most-moved flow, and require both
        significance (p&lt;0.05) and a meaningful drop before we say <em>roll back</em>.
        The number is a correlation under a known cause — the diff — not a proof. We
        label the confidence and never fabricate a call when the data is thin.
      </p>
    </main>
  );
}

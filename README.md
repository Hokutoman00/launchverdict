# LaunchVerdict

**Every release gets one verdict: keep it, or roll it back.**

For solo makers who ship every week with an AI builder and have no data team.
After each release LaunchVerdict hands you a single black-and-white card — the
moved number, the likely cause, and the one thing to do next — instead of a
40-widget analytics dashboard you'll never open.

## The closed release-confidence loop

- **Novus** reviews the diff *before* you merge and flags UX regressions (the cause).
- **LaunchVerdict** renders the verdict *after* it ships (the effect).

When connected to a repo, LaunchVerdict reads Novus's flags from the merged PR's
review comments (whose author login contains `NOVUS_BOT_LOGIN`, default `novus-ai`) and surfaces the matching flag as the
*cause* line on the card — so the pre-merge warning and the post-ship outcome sit
on one artifact. In the seeded `/demo` the Novus flag is a fixture string standing
in for that comment; against a live repo it comes from the PR.

A "release" is treated as the **cut point** on the event timeline. We compare each
flow's completion rate in the 7 days before vs after the cut with a
**two-proportion z-test**, take the most-moved flow, and require *both*
statistical significance and a meaningful drop before we say *roll back*. The
number is a correlation under a known cause — the diff — not a proof, and the
card says so. The call is computed deterministically; the LLM only polishes the
prose and can never change the verdict or the numbers.

## See it in 60 seconds

[Live demo](https://launchverdict.vercel.app/demo) computes three real verdict
cards from seeded telemetry — no login. One release regressed onboarding
(71%→53% → **ROLL IT BACK**), one dropped on too thin a sample to trust yet
(80%→45%, n=44 → **HOLD**), one improved search (60%→70% → **KEEP SHIPPING**).

## Run locally

```bash
npm install
npm run test     # engine reproduces the §8 fixture (z=-5.46, ROLLBACK) + stats anchors
npm run dev      # http://localhost:3000/demo
```

The app and `/demo` run with **no** environment variables (seeded data path).
External integrations are guarded — see `.env.example`.

## What's verified vs. wireable

The deterministic engine (stats → window → verdict, incl. SHIP-ON / HOLD /
ROLLBACK / INSUFFICIENT) and the seeded `/demo` are covered by `npm test` and
run with no accounts. The live wiring below (GitHub webhook → cut assembly →
PR comment + commit status, Postgres telemetry, optional LLM prose polish) is
**implemented and typechecks/builds** — not stubbed — but the `/demo` data is
seeded and the live external paths (Postgres, GitHub token, and the Novus
PR-comment read) come online only once a repo + Postgres + token + Novus are
connected. The verdict *call* and *numbers* never depend on any of it: those
come from the tested engine.

## Wire the live loop

1. Add the telemetry one-liner to your site:
   ```html
   <script src="https://YOUR-APP/lv.js" data-repo="owner/name"></script>
   <script>LV.track("onboarding","start"); /* … */ LV.track("onboarding","complete");</script>
   ```
2. Point a GitHub webhook (pull_request events) at `/api/webhook`.
3. On a merged PR, LaunchVerdict assembles the cut (diff + CI + Novus flags),
   computes the verdict, and posts it back as a PR comment + commit status with a
   link to the public verdict card at `/v/<releaseId>`.

## Architecture

| Layer | File |
|---|---|
| Stats (z-test, Wilson CI, normal CDF) | `lib/stats.ts` |
| Windowing + funnel | `lib/window.ts` |
| Deterministic verdict | `lib/verdict.ts` |
| Telemetry store (reuses the tested engine, no SQL funnel) | `lib/db.ts` |
| GitHub read (cut) + write (deliver) | `lib/github.ts` |
| LLM prose polish (tool_choice forced, prose-only) | `lib/narrative.ts` |
| Closed loop | `lib/pipeline.ts` |
| Verdict card UI | `components/VerdictCard.tsx` |

Built for World Product Day 2026.

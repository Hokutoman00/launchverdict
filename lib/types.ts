// Core domain types. A "release" is redefined as a *causal cut* on the event
// timeline (cause = the known diff), not just a git tag. See design.md §2.

export type FlowEvent = {
  flow: string;        // e.g. "onboarding"
  step: string;        // e.g. "start" | "complete" | named step
  anonId: string;      // anonymous visitor id
  ts: number;          // epoch ms
};

export type ReleaseCut = {
  releaseId: string;
  repo: string;
  cutTs: number;       // epoch ms of the release (the causal cut)
  baseSha: string;
  headSha: string;
  changedFiles: string[];
  novusFlags: string[]; // UX flags Novus raised on the diff pre-merge (may be empty)
  ciFailures?: number;  // failing/timed-out check runs on head_sha
};

// Result of comparing one flow before vs after the cut. Carries uncertainty.
export type FlowDelta = {
  flow: string;
  n1: number; c1: number; // before: starts, completions
  n2: number; c2: number; // after:  starts, completions
  p1: number; p2: number; // completion rates
  z: number;
  pValue: number;         // two-sided
  ciLow: number; ciHigh: number; // Wilson 95% CI on p2
};

export type VerdictCall = "SHIP_ON" | "HOLD" | "ROLLBACK" | "INSUFFICIENT";
export type Confidence = "high" | "medium" | "low";

export type VerdictCard = {
  releaseId: string;
  repo: string;
  call: VerdictCall;
  headline: string;
  movedFlow: string;
  before: number;
  after: number;
  ciLow: number;
  ciHigh: number;
  cause: string;
  action: string;
  confidence: Confidence;
  // Honesty: this is a correlation under a known cause, not proven causation.
  correlationNote: string;
};

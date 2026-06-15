// LLM narrative refinement. design.md leaf-V1.
//
// HARD RULE: the model may only rewrite three prose fields (headline, cause,
// action) for clarity. It NEVER sees a free-text channel to change the call,
// the numbers, or the confidence — those are computed deterministically in
// verdict.ts. tool_choice forces a single structured object, so there is no
// path for the model to hallucinate a different verdict. If the key is missing
// or the call fails, we return the deterministic card untouched.

import Anthropic from "@anthropic-ai/sdk";
import type { VerdictCard } from "./types.ts";
import { pendoTrack } from "./pendo.ts";

const MODEL = "claude-opus-4-8";

const TOOL = {
  name: "verdict_prose",
  description: "Rewrite the three prose fields of a release verdict for a busy solo maker. Plain, concrete, no hype.",
  input_schema: {
    type: "object" as const,
    properties: {
      headline: { type: "string", description: "<=90 chars. States the call and the moved number." },
      cause: { type: "string", description: "<=160 chars. The likely cause from the diff/flags. No speculation beyond given facts." },
      action: { type: "string", description: "<=120 chars. The single next action." },
    },
    required: ["headline", "cause", "action"],
  },
};

export async function refineNarrative(card: VerdictCard): Promise<VerdictCard> {
  const key = process.env.ANTHROPIC_API_KEY;
  if (!key) {
    await pendoTrack("narrative_refined", {
      release_id: card.releaseId, repo: card.repo, call: card.call,
      refinement_succeeded: false, model_used: MODEL,
      headline_changed: false, cause_changed: false, action_changed: false,
    }, "system", card.repo);
    return card;
  }

  const facts = {
    call: card.call,
    flow: card.movedFlow,
    before: card.before,
    after: card.after,
    ci: [card.ciLow, card.ciHigh],
    confidence: card.confidence,
    cause_facts: card.cause,
    correlationNote: card.correlationNote,
  };

  try {
    const client = new Anthropic({ apiKey: key });
    const res = await client.messages.create({
      model: MODEL,
      max_tokens: 400,
      tools: [TOOL],
      tool_choice: { type: "tool", name: "verdict_prose" },
      messages: [
        {
          role: "user",
          content:
            "Rewrite the prose for this release verdict. You MUST NOT change or restate the call, the numbers, or the confidence — only make the three fields clearer for a solo maker. Stay strictly within the given facts (do not invent causes).\n\n" +
            JSON.stringify(facts, null, 2),
        },
      ],
    });
    const block = res.content.find((b) => b.type === "tool_use");
    if (!block || block.type !== "tool_use") {
      await pendoTrack("narrative_refined", {
        release_id: card.releaseId, repo: card.repo, call: card.call,
        refinement_succeeded: false, model_used: MODEL,
        headline_changed: false, cause_changed: false, action_changed: false,
      }, "system", card.repo);
      return card;
    }
    const out = block.input as { headline?: string; cause?: string; action?: string };
    const refined = {
      ...card,
      headline: out.headline?.trim() || card.headline,
      cause: out.cause?.trim() || card.cause,
      action: out.action?.trim() || card.action,
    };
    await pendoTrack("narrative_refined", {
      release_id: card.releaseId, repo: card.repo, call: card.call,
      refinement_succeeded: true, model_used: MODEL,
      headline_changed: refined.headline !== card.headline,
      cause_changed: refined.cause !== card.cause,
      action_changed: refined.action !== card.action,
    }, "system", card.repo);
    return refined;
  } catch {
    await pendoTrack("narrative_refined", {
      release_id: card.releaseId, repo: card.repo, call: card.call,
      refinement_succeeded: false, model_used: MODEL,
      headline_changed: false, cause_changed: false, action_changed: false,
    }, "system", card.repo);
    return card; // never let prose-polish break the deterministic verdict
  }
}

// Server-side Pendo Track Event utility.
// All events in this app are server-side (API routes, server components, lib functions).

const PENDO_TRACK_URL = "https://data.pendo.io/data/track";
const PENDO_INTEGRATION_KEY = "98ac6f04-9da0-4c14-9a74-9b0928c396df";

export async function pendoTrack(
  event: string,
  properties: Record<string, string | number | boolean>,
  visitorId = "system",
  accountId = "system",
): Promise<void> {
  try {
    await fetch(PENDO_TRACK_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-pendo-integration-key": PENDO_INTEGRATION_KEY,
      },
      body: JSON.stringify({
        type: "track",
        event,
        visitorId,
        accountId,
        timestamp: Date.now(),
        properties,
      }),
    });
  } catch {
    // Never let tracking failures break application flow
  }
}

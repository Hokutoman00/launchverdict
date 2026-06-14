/* LaunchVerdict telemetry — the one line a maker adds to their site.
 * Usage:
 *   <script src="https://YOUR-APP/lv.js" data-repo="owner/name"></script>
 *   <script>LV.track("onboarding","start"); LV.track("onboarding","complete");</script>
 * Anonymous: a random id in localStorage, no cookies, no PII. */
(function () {
  var s = document.currentScript;
  var repo = (s && s.getAttribute("data-repo")) || "";
  var endpoint = (s && s.getAttribute("data-endpoint")) || (s ? new URL(s.src).origin + "/api/collect" : "/api/collect");
  var KEY = "lv_anon";
  var anonId = localStorage.getItem(KEY);
  if (!anonId) { anonId = "a" + Math.random().toString(36).slice(2) + Date.now().toString(36); localStorage.setItem(KEY, anonId); }
  function track(flow, step) {
    try {
      navigator.sendBeacon(
        endpoint,
        new Blob([JSON.stringify({ repo: repo, flow: flow, step: step, anonId: anonId })], { type: "application/json" })
      );
    } catch (e) { /* fail silent — telemetry must never break the host site */ }
  }
  window.LV = { track: track };
})();

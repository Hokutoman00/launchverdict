// Two-proportion z-test + Wilson interval. design.md leaf-S.
//
// The spike (spikes/spike-jstat.mjs) validated these values against
// jStat.normal.cdf: cdf(0)=0.5, cdf(1.96)=0.97500. Here we inline the same
// standard-normal CDF (Abramowitz & Stegun 7.1.26 erf approximation) so the
// verdict engine carries no runtime dependency on the critical path. The unit
// test (test/engine.test.mjs) re-checks both anchor values.

export function normalCdf(x: number): number {
  // CDF via erf: Phi(x) = 0.5 * (1 + erf(x / sqrt(2)))
  const t = 1 / (1 + 0.3275911 * Math.abs(x) / Math.SQRT2);
  const y =
    1 -
    (((((1.061405429 * t - 1.453152027) * t) + 1.421413741) * t -
      0.284496736) *
      t +
      0.254829592) *
      t *
      Math.exp(-(x * x) / 2);
  return x >= 0 ? 0.5 * (1 + y) : 0.5 * (1 - y);
}

export type ZResult = {
  p1: number; p2: number; z: number; pValue: number;
  ciLow: number; ciHigh: number;
};

// n1/c1 = before starts/completions, n2/c2 = after starts/completions.
export function twoPropZTest(
  n1: number, c1: number, n2: number, c2: number,
): ZResult {
  const p1 = n1 > 0 ? c1 / n1 : 0;
  const p2 = n2 > 0 ? c2 / n2 : 0;
  const pPool = (c1 + c2) / (n1 + n2);
  const se = Math.sqrt(pPool * (1 - pPool) * (1 / n1 + 1 / n2));
  const z = se > 0 ? (p2 - p1) / se : 0;
  const pValue = 2 * (1 - normalCdf(Math.abs(z))); // two-sided
  const { low, high } = wilsonInterval(c2, n2);
  return { p1, p2, z, pValue, ciLow: low, ciHigh: high };
}

// Wilson score interval (95%) on the after-window completion rate.
export function wilsonInterval(c: number, n: number, zc = 1.96): { low: number; high: number } {
  if (n === 0) return { low: 0, high: 0 };
  const p = c / n;
  const denom = 1 + (zc * zc) / n;
  const centre = (p + (zc * zc) / (2 * n)) / denom;
  const half =
    (zc * Math.sqrt((p * (1 - p)) / n + (zc * zc) / (4 * n * n))) / denom;
  return { low: Math.max(0, centre - half), high: Math.min(1, centre + half) };
}

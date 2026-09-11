export interface SignificanceResult {
  /** Index into the original (pre-sort) input array. */
  readonly index: number;
  readonly pValue: number;
  /** The Benjamini–Hochberg-adjusted p-value ("q-value"), monotone by construction. */
  readonly adjustedPValue: number;
  readonly significant: boolean;
}

/**
 * Benjamini–Hochberg step-up procedure, controlling the false discovery rate across a
 * set of tests scanned together (`correlation/SPEC.md`'s Discovery scan). Sorts
 * p-values ascending, finds the largest rank `k` with `p(k) <= (k/m) * falseDiscoveryRate`,
 * and marks every rank `<= k` significant. Results are returned in the original input
 * order.
 */
export function benjaminiHochberg(
  pValues: readonly number[],
  falseDiscoveryRate: number,
): readonly SignificanceResult[] {
  const m = pValues.length;
  if (m === 0) {
    return [];
  }

  const sorted = pValues
    .map((p, index) => ({ p, index }))
    .sort((a, b) => a.p - b.p);

  const adjusted = new Array<number>(m);
  let runningMin = 1;
  for (let rank = m; rank >= 1; rank--) {
    const candidate = Math.min(1, (sorted[rank - 1].p * m) / rank);
    runningMin = Math.min(runningMin, candidate);
    adjusted[rank - 1] = runningMin;
  }

  let largestSignificantRank = 0;
  for (let rank = 1; rank <= m; rank++) {
    if (sorted[rank - 1].p <= (rank / m) * falseDiscoveryRate) {
      largestSignificantRank = rank;
    }
  }

  return sorted
    .map(({ p, index }, i) => ({
      index,
      pValue: p,
      adjustedPValue: adjusted[i],
      significant: i + 1 <= largestSignificantRank,
    }))
    .sort((a, b) => a.index - b.index);
}

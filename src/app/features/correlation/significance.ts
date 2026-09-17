/**
 * Benjamini–Hochberg correction. A Discovery scan runs thousands of tests, so at p 0.05
 * a stack of pure coincidences would clear the bar on its own; this controls the share
 * of false findings among those reported rather than the chance of any at all.
 */

/** Which tests survive correction, in the order they were given. */
export function benjaminiHochberg(
  pValues: readonly number[],
  threshold: number,
): readonly boolean[] {
  const total = pValues.length;
  if (total === 0) {
    return [];
  }

  const ascending = pValues
    .map((p, index) => ({ p, index }))
    .sort((left, right) => left.p - right.p);

  // The largest rank whose p clears its own share of the threshold; everything ranked
  // below it is accepted too, even where its own p does not clear that rank's share.
  let cutoff = -1;
  for (let rank = 0; rank < total; rank++) {
    if (ascending[rank].p <= ((rank + 1) / total) * threshold) {
      cutoff = rank;
    }
  }

  const significant = new Array<boolean>(total).fill(false);
  for (let rank = 0; rank <= cutoff; rank++) {
    significant[ascending[rank].index] = true;
  }
  return significant;
}

/**
 * BH-adjusted p-values (q-values), in the order given. Monotone by construction: a test
 * can never be reported as more significant than one with a smaller raw p.
 */
export function adjustedPValues(pValues: readonly number[]): readonly number[] {
  const total = pValues.length;
  if (total === 0) {
    return [];
  }

  const ascending = pValues
    .map((p, index) => ({ p, index }))
    .sort((left, right) => left.p - right.p);

  const adjusted = new Array<number>(total);
  let running = 1;
  for (let rank = total - 1; rank >= 0; rank--) {
    running = Math.min(running, (ascending[rank].p * total) / (rank + 1));
    adjusted[ascending[rank].index] = Math.min(1, running);
  }
  return adjusted;
}

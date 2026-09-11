export interface LayoutInput {
  readonly id: string;
  readonly start: number;
  readonly end: number;
}

export interface LayoutResult {
  readonly id: string;
  readonly column: number;
  readonly columnCount: number;
}

/**
 * Classic calendar day-view overlap layout. Takes already-resolved [start, end]
 * intervals (from the entries feature's `fadeout` module — Fadeout geometry is never
 * recomputed here, `calendar/SPEC.md`) and assigns each item a side-by-side column plus
 * the column count of the cluster it belongs to, so width = 1 / columnCount.
 */
export function computeOverlapLayout(items: readonly LayoutInput[]): readonly LayoutResult[] {
  const sorted = [...items].sort((a, b) => a.start - b.start || a.end - b.end);
  const results = groupIntoOverlapClusters(sorted).flatMap(layoutCluster);
  const byId = new Map(results.map((result) => [result.id, result]));
  return items.map((item) => byId.get(item.id)!);
}

function groupIntoOverlapClusters(sortedItems: readonly LayoutInput[]): readonly (readonly LayoutInput[])[] {
  const clusters: LayoutInput[][] = [];
  let current: LayoutInput[] = [];
  let currentEnd = -Infinity;

  for (const item of sortedItems) {
    if (current.length > 0 && item.start >= currentEnd) {
      clusters.push(current);
      current = [];
      currentEnd = -Infinity;
    }
    current.push(item);
    currentEnd = Math.max(currentEnd, item.end);
  }
  if (current.length > 0) {
    clusters.push(current);
  }
  return clusters;
}

function layoutCluster(cluster: readonly LayoutInput[]): readonly LayoutResult[] {
  const columnEnds: number[] = [];
  const columnById = new Map<string, number>();

  for (const item of cluster) {
    let column = columnEnds.findIndex((end) => end <= item.start);
    if (column === -1) {
      column = columnEnds.length;
      columnEnds.push(item.end);
    } else {
      columnEnds[column] = item.end;
    }
    columnById.set(item.id, column);
  }

  const columnCount = columnEnds.length;
  return cluster.map((item) => ({ id: item.id, column: columnById.get(item.id)!, columnCount }));
}

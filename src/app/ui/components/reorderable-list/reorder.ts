export interface ReorderEvent {
  readonly previousIndex: number;
  readonly currentIndex: number;
}

/**
 * Pure reducer backing the Reorderable list (`ui/SPEC.md`): returns a new array with
 * the item moved from `previousIndex` to `currentIndex`, never mutating `items`.
 */
export function reorder<T>(items: readonly T[], event: ReorderEvent): T[] {
  const result = [...items];
  const [moved] = result.splice(event.previousIndex, 1);
  result.splice(event.currentIndex, 0, moved);
  return result;
}

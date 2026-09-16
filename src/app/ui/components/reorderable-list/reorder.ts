/**
 * Applies a CDK drop (or a keyboard move) to a list. Pure and non-mutating: the caller
 * owns the signal holding the list and sets the result.
 */
export function moveItem<T>(items: readonly T[], from: number, to: number): T[] {
  const reordered = [...items];
  if (!isIndexInRange(from, items.length) || !isIndexInRange(to, items.length) || from === to) {
    return reordered;
  }
  const [moved] = reordered.splice(from, 1);
  if (moved !== undefined) {
    reordered.splice(to, 0, moved);
  }
  return reordered;
}

function isIndexInRange(index: number, length: number): boolean {
  return Number.isInteger(index) && index >= 0 && index < length;
}

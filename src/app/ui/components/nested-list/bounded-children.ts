export interface BoundedTreeOptions<T> {
  /** Maximum nesting depth; roots sit at depth 1. */
  readonly cap: number;
  readonly idOf: (node: T) => string;
  readonly childrenOf: (node: T) => readonly T[];
}

/**
 * A `cdk/tree` `childrenAccessor` that cannot run away. A Tracker may reference itself
 * (`entries/SPEC.md`), so the data handed to the tree is cyclic-capable: this stops at
 * the expansion-depth cap and drops any child that is already its own ancestor, rather
 * than recursing forever.
 */
export function boundedChildrenAccessor<T>(
  roots: readonly T[],
  options: BoundedTreeOptions<T>,
): (node: T) => readonly T[] {
  const allowed = new Map<string, readonly T[]>();

  const walk = (node: T, depth: number, ancestors: ReadonlySet<string>): void => {
    const id = options.idOf(node);
    if (allowed.has(id)) {
      return;
    }
    const nextAncestors = new Set(ancestors).add(id);
    const children =
      depth >= options.cap
        ? []
        : options.childrenOf(node).filter((child) => !nextAncestors.has(options.idOf(child)));

    allowed.set(id, children);
    for (const child of children) {
      walk(child, depth + 1, nextAncestors);
    }
  };

  for (const root of roots) {
    walk(root, 1, new Set<string>());
  }

  return (node: T) => allowed.get(options.idOf(node)) ?? [];
}

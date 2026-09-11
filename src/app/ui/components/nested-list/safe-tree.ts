/**
 * A `cdk/tree` `childrenAccessor` is a stateless `(node) => children` function called
 * once per node, with no ancestor-path context of its own — so cycle and depth-cap
 * tracking has to travel with the node itself. `SafeTreeNode` wraps the domain value
 * with exactly that: how deep it is, and the ancestor ids seen on the path down to it.
 */
export interface SafeTreeNode<T> {
  readonly value: T;
  readonly depth: number;
  /** True once a repeated ancestor (a cycle) or the depth cap stopped expansion here —
   *  no further children are exposed even if the underlying data has more. */
  readonly truncated: boolean;
  readonly ancestorIds: ReadonlySet<string>;
}

export function wrapTreeRoot<T>(value: T, getId: (value: T) => string): SafeTreeNode<T> {
  return { value, depth: 0, truncated: false, ancestorIds: new Set([getId(value)]) };
}

/**
 * Builds a `cdk/tree`-compatible `childrenAccessor` over `SafeTreeNode<T>` (the tree
 * renders these wrappers, unwrapping `.value` for display) that never recurses past
 * `depthCap` and stops at the first repeated ancestor — a Tracker reference graph is
 * allowed to be self-referencing (`trackers/SPEC.md`, Q22), so this has to be safe by
 * construction, not by hoping the data never cycles.
 */
export function createSafeChildrenAccessor<T>(
  getId: (value: T) => string,
  getChildren: (value: T) => readonly T[],
  depthCap: number,
): (node: SafeTreeNode<T>) => readonly SafeTreeNode<T>[] {
  return (node) => {
    if (node.truncated || node.depth >= depthCap) {
      return [];
    }

    return getChildren(node.value).map((childValue) => {
      const childId = getId(childValue);
      const isCycle = node.ancestorIds.has(childId);

      return {
        value: childValue,
        depth: node.depth + 1,
        truncated: isCycle,
        ancestorIds: isCycle ? node.ancestorIds : new Set([...node.ancestorIds, childId]),
      };
    });
  };
}

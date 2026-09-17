/** The Entry being edited sits at depth 1; each child is one level deeper. */
export const ROOT_DEPTH = 1;

/**
 * Only realised nesting depth matters — a self-referencing chain and a chain across
 * distinct Trackers are the same to this check, because the schema shape is never
 * consulted (entries/SPEC.md). This is the only place the cap applies; the Tracker
 * designer never checks it.
 */
export function canAddChild(parentDepth: number, cap: number): boolean {
  return parentDepth + 1 <= cap;
}

export interface ReferenceDepthState {
  readonly required: boolean;
  readonly childCount: number;
  readonly depth: number;
  readonly cap: number;
}

export function isReferenceBlocked(state: ReferenceDepthState): boolean {
  return state.required && state.childCount === 0 && !canAddChild(state.depth, state.cap);
}

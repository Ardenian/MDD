import type { Provider, Type } from '@angular/core';

/**
 * One render case for the mount harness: a component, the inputs it is rendered with,
 * and anything it needs provided in place of the real thing (ADR 0014).
 *
 * Called a *scenario*, never a "story": `tests/stories/` holds e2e specs organised by
 * user story, and the two are unrelated. A scenario carries no assertions and is never
 * run by itself — the harness mounts it and an `*.integration.ts` spec drives it.
 */
export interface Scenario<C = unknown> {
  readonly component: Type<C>;
  /** Set with `setInput`, so the component stays presentation-only (ADR 0002). */
  readonly inputs?: Readonly<Record<string, unknown>>;
  /** Fakes in place of real services — reuse `data/testing`'s, never a second set. */
  readonly providers?: readonly Provider[];
}

/** Identity function that pins the type of a scenario export. */
export function scenario<C>(definition: Scenario<C>): Scenario<C> {
  return definition;
}

import type { EnvironmentInjector, EnvironmentProviders, Provider, Type } from '@angular/core';

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
  /**
   * Fakes in place of real services — reuse `data/testing`'s, never a second set.
   *
   * A facade declared `providedIn: 'root'` must be named here too, not just the ports it
   * depends on: otherwise Angular builds it in the root injector, where the fakes are not
   * visible, and it resolves the real tokens instead (or fails with NG0201).
   */
  readonly providers?: readonly (Provider | EnvironmentProviders)[];
  /**
   * Feeds an output back in as inputs, which is what the real parent does. A
   * presentation-only component reports a change and re-renders from the input it gets
   * back; with nothing listening it would emit into the void and never update, so a
   * scenario for one is only honest if it closes that loop.
   *
   * Keyed by output name; the returned object is applied with `setInput`.
   */
  readonly bindings?: Readonly<Record<string, (value: never) => Record<string, unknown>>>;
  /**
   * Runs against the scenario's own injector before the component is created, for a
   * component that only makes sense against data that already exists — a Tracker
   * designer needs a Tracker. Anything it returns is merged into the inputs, which is
   * how an id created here reaches the component.
   */
  readonly setup?: (injector: EnvironmentInjector) => Promise<Record<string, unknown> | void>;
}

/** Identity function that pins the type of a scenario export. */
export function scenario<C>(definition: Scenario<C>): Scenario<C> {
  return definition;
}

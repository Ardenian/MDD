# A custom Angular mount harness enables Playwright integration tests

## Context

ADR 0011 splits UI coverage into e2e (real app) and integration (one component, fake
data, no backend). Playwright's only supported path to rendering a single component in
isolation is its framework-agnostic "gallery" contract — a page your own dev server
serves that implements `window.mount({ story, props })` / `window.unmount()` — with no
built-in Angular adapter; React and Vue have official examples, "anything else" is left
to the consumer ([playwright.dev/docs/test-components](https://playwright.dev/docs/test-components)).
Angular was never supported by the now-retired framework-specific CT packages either
([microsoft/playwright#14153](https://github.com/microsoft/playwright/issues/14153),
closed not-planned).

## Decision

Build our own gallery harness for Angular, in scope for v1 but tracked as its own
implementation task, separate from and not blocking individual feature work:

- A gallery page (`playwright/gallery/`) served by `ng serve`'s Vite dev server,
  implementing `window.mount`/`window.unmount` against Angular's `createComponent()`
  API and an `EnvironmentInjector` built per scenario, so each scenario can inject its
  own fake `DataAccess`/`Store`/port in place of the real one.
  - Reuses this codebase's existing in-memory fakes in `src/app/data/` (already
    maintained for Vitest) rather than inventing a second set of test doubles.
- Scenarios (`*.scenario.ts`, colocated next to the component, one named export per
  render case) are discovered via Vite's `import.meta.glob('**/*.scenario.ts')`, the
  same mechanism the framework's own React/Vue examples use for what Playwright's own
  docs call a "story."
- **Naming**: this codebase calls a `*.scenario.ts` export a *scenario*, not a
  *story* — Playwright's own term — specifically to avoid colliding with
  `tests/stories/` (ADR 0011's e2e specs, organized by *user* story). The two are
  unrelated: a `*.scenario.ts` export has no assertions and isn't run by itself, only
  mounted by the harness; a `tests/stories/*.e2e.ts` is a full test run against the
  real app.

## Considered options

- **Defer the whole integration layer indefinitely, e2e-only.** Rejected — see ADR
  0011's Consequences: UI-only concerns need coverage that doesn't require a full app
  boot and real IndexedDB writes.
- **Adopt the unofficial `sand4rt/playwright-ct-angular` package.** Rejected: built on
  the experimental CT infrastructure Playwright 1.59 retired; not the sanctioned path
  going forward, and a dependency on a package Playwright itself doesn't maintain for
  core test infra.

## Consequences

- Until this lands, UI-only concerns are covered as `@integration-candidate`-tagged e2e
  tests (ADR 0011) — expected, temporary debt.
- The harness has nothing to prove itself against until a feature component exists; it
  gets picked up alongside (not before) the first feature that needs UI-only coverage,
  not built speculatively ahead of one.

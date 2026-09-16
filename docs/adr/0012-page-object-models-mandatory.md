# Page Object Models are the only way Playwright tests touch the DOM

## Context

Without a convention, Playwright specs accumulate raw `page.locator(...)`/`getBy*`
calls duplicated across every test that touches the same UI, so a markup change breaks
tests all over the suite instead of in the one place that's supposed to know about that
markup.

## Decision

Every Playwright test (`*.e2e.ts`, `*.integration.ts`, ADR 0011) and Flow (`*.flow.ts`,
ADR 0013) interacts with the app exclusively through **Page Object Models**
(`*.pom.ts`). No spec or Flow file ever calls `page.locator`, `getBy*`, or
`page.evaluate` directly — including for setup/teardown, which goes through the shared
fixtures in `src/app/testing/support/`, never inline in a spec.

- **Colocation**: a POM lives next to the component/page it wraps
  (`tracker-designer.component.ts` → `tracker-designer.pom.ts`), the same place its
  `*.spec.ts`/`*.integration.ts`/`*.scenario.ts` live. `ui/`'s shared CDK/aria primitives
  get their own POM colocated the same way (e.g. a `ComboboxObject` next to the
  Combobox component), so every feature's POM composes the same primitive POM instead
  of re-deriving how to drive a Combobox.
- **Locators**: exclusively `data-testid`. Never role, label, text, or CSS selectors.
- **Collisions**: resolved by nesting, not namespacing. A parent POM is constructed
  with a scoping `Locator` (not a bare `Page`) and queries its own `data-testid`s
  relative to it; a repeated element (e.g. a Field row in a Draft editor) gets its own
  child POM, constructed with a further-scoped `Locator` per instance, so the same
  short `data-testid` (`"remove-button"`) is unambiguous inside each row's scope
  without needing a globally unique string.

## Considered options

- **Role/label-based locators** (`getByRole`, `getByLabel`), matching the app's
  CDK/aria-driven accessible markup. Rejected: ties every test to the accessible
  name/label text, which changes for i18n or copy reasons unrelated to the behaviour
  under test; `data-testid` decouples the two.
- **Dot-namespaced `data-testid`s** (`"tracker-designer.save-button"`) for uniqueness.
  Rejected in favour of nesting: namespacing pushes DOM structure knowledge into the id
  string itself, duplicated between the markup and every POM that references it; a
  nested POM captures the same scoping as an actual object relationship instead.

## Consequences

- A markup change updates one POM; every test using it keeps working unchanged.
- Every interactive element a POM ever queries needs an explicit `data-testid`
  attribute in its template — added by whoever writes the component, not retrofitted
  by whoever writes the test.

# E2E Playwright coverage for every v1 feature; integration layer deferred to a custom mount harness

## Context

`AGENTS.md`'s Testing section previously deferred all UI/interaction coverage past v1
("do not add component/DOM tests in v1 unless asked"), and `feature-scope.md` listed
"Integration and end-to-end test suites for UI and interaction" under *Later*. That's no
longer the plan: every v1 feature needs its user stories and happy paths proven against
a running app, not just its pure logic (already covered by Vitest).

Two shapes of UI test exist for different jobs: one that drives the whole app against
its real adapters (proves a flow persists correctly end to end), and one that drives a
single component in isolation with fake data (proves UI-only behaviour like form
validation without needing a backend or IndexedDB). Playwright has no first-party way to
render an Angular component in isolation — `@playwright/experimental-ct-*` never
supported Angular ([microsoft/playwright#14153](https://github.com/microsoft/playwright/issues/14153),
closed not-planned), and as of Playwright 1.59 the framework-specific CT packages were
retired outright in favour of a framework-agnostic "gallery" contract
(`window.mount`/`window.unmount`, see [Playwright's component testing docs](https://playwright.dev/docs/test-components))
that ships no Angular adapter. Building that adapter ourselves is real, standalone work
(ADR 0014) — v1's UI coverage can't wait for it.

## Decision

v1 ships full Playwright **e2e** coverage now, with an **integration** layer that lands
once ADR 0014's mount harness exists:

- **e2e** (`*.e2e.ts`, always in `tests/stories/`, never colocated): drives the real
  app, real routes, real adapters (IndexedDB, generated API client) end to end. Every
  v1 feature's user stories and happy paths get e2e coverage in the same change that
  implements them. "Stories" here is the plain-English *user story* sense — unrelated
  to ADR 0014's `*.scenario.ts` mount-harness fixtures.
- **integration** (`*.integration.ts`, colocated next to the component it tests, like a
  Vitest spec): drives one component through ADR 0014's mount harness with fake
  providers — no IndexedDB, no navigation, no real backend. For UI-only concerns (form
  validation, keyboard nav, error/empty states) where persistence is incidental to what's
  being proven.
- Until the harness exists, a UI-only concern is still covered — as an e2e test, tagged
  `@integration-candidate` (Playwright's built-in `test(..., { tag })`) so it's
  mechanically findable and migrates to `*.integration.ts` the moment the harness lands,
  without re-deriving which tests qualify.

Both layers drive the app exclusively through Page Object Models and Flows — see ADR
0012 and ADR 0013.

## Considered options

- **Wait for Playwright to add native Angular support before writing any UI-only
  tests.** Rejected: no such support is planned (#14153 closed not-planned), and v1
  can't defer all UI-only coverage indefinitely on a maybe.
- **e2e only, no integration layer, ever.** Rejected: every UI-only concern (e.g. Field
  validation in the Tracker Draft editor) would need a full app boot and a real
  IndexedDB write just to prove a validation message renders — slow, and it couples
  coverage of that concern to unrelated persistence machinery.

## Consequences

- The mount harness (ADR 0014) is tracked as its own v1 task, not a blocker for feature
  e2e work — features ship e2e coverage regardless of the harness's progress.
- `@integration-candidate`-tagged e2e tests are expected debt with a clear resolution
  path, not permanent — reviewed for migration whenever ADR 0014 lands.

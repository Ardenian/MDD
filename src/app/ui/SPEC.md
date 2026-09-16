# UI — Platform Spec

## Purpose

The one place for how the app looks and behaves: the `@angular/cdk` + `@angular/aria`
behavioral foundation (ADR 0006), the coordination-only singleton services that back it,
and the design-token runtime bridge (ADR 0007). `shared/` keeps its stricter "pure dumb,
zero DI" meaning for everything with no CDK/aria involvement; `ui/` is for everything
that does.

## Who may use what

Per ADR 0002: only a feature's **top-level (route-loaded) component** may inject a
`ui/` service. Every `ui/` **component** is itself presentation-only internally — no
`ui/` component injects a facade or a `data/` port; it receives everything through
`input()` / `output()` / `model()`, same as any other nested component.

## Services (`ui/services/`) — singleton coordination only

Per the boundary agreed for this repo: a service exists here only where there's real
shared runtime state to coordinate, not merely because a CDK/aria directive is reused
in more than one place.

- **`OverlayService`** — thin wrapper on `cdk/overlay` + `cdk/portal`. Owns
  positioning/stacking coordination for every positioned layer in the app. `DialogService`
  and any popover-style UI (e.g. Calendar's quick-create-on-click) are built on this,
  not on `cdk/overlay` directly.
- **`DialogService`** — built on `cdk/dialog` + `OverlayService`. Owns the one dialog
  stack (so two dialogs never fight), focus-trap-on-open and focus-restore-on-close via
  `cdk/a11y`. `open(component, config)` / `close()`.
- **`ToastService`** — owns the one live region via `cdk/a11y` `LiveAnnouncer`. Queues
  and announces non-blocking messages; this is what `core/`'s `ErrorHandler` calls into.
- **`FocusService`** — thin wrapper on `cdk/a11y` `FocusMonitor` / `InteractivityChecker`,
  for focus-origin-aware styling and programmatic focus beyond what `DialogService`
  already covers (e.g. Calendar's focus-cell keyboard navigation).
- **`DesignTokenService`** — reads the generated token mirror and applies it as CSS
  custom properties via `provideAppInitializer` (ADR 0007). No public API beyond
  bootstrap in v1; a future theme switch calls a method on it rather than being added
  from scratch.
- **`UiLocaleService`** — thin facade over the app-wide `@ngrx/store`'s `uiLocale` slice
  (ADR 0010): exposes `uiLocale`/`isExplicit` as signals and a `selectLanguage()` method
  that dispatches the change. The only thing presentation code injects for locale —
  never the raw `Store`. `core/` owns the store's actions/reducer/selectors and the
  `@ngrx/effects` that persist a change and drive `TranslateService`; this service is
  purely a read/dispatch facade over that state, the same shape of problem
  `DesignTokenService` solves for theming.

**Not services**: `Select`/`Multiselect`/`Combobox` (via `@angular/aria`) and the
Reorderable list / Nested list (via `cdk/drag-drop` / `cdk/tree`) are directive-backed
components with no cross-feature runtime state to coordinate — features import the
component, there's nothing for a service to own.

## Components (`ui/components/`)

- **Modal** — the standard dialog chrome (header/body/footer/close-button), built on
  `DialogService`. Every v1 dialog-shaped flow uses this, never `DialogService` raw:
  the Entry create/edit form (its already-specified focus-trap-on-open/focus-return-
  on-close behavior *is* this component), Settings' "Clear local data" confirmation,
  and Data Transfer's import confirm-by-typing guard.
- **Select / Multiselect** — `@angular/aria` Listbox/Select/Multiselect directives.
  Backs single-select and multi-select Fields on the Entry form, the reference-target
  and cardinality pickers in the Tracker designer, and Settings' Storage Profile picker.
- **Combobox** — `@angular/aria` Combobox. Backs the Tag input's autocomplete.
- **Reorderable list** — `cdk/drag-drop` (`CdkDropList`/`CdkDrag`), keyboard-operable
  per the existing a11y requirement. Backs Field reordering in the Tracker designer.
- **Nested list** — `cdk/tree`, using `childrenAccessor` (fits a self-referencing
  structure without forcing flattening). Backs embedded child-Entry display
  (Meal → Ingredients).
- **Table** — `cdk/table`, headless: column definitions, row data, and sort state as
  inputs, sort-change as output; a hand-built clickable-header pattern for sorting
  (stable CDK ships no sort primitive — that's Material-only). Generic and reusable the
  moment a second feature needs tabular data; **not built yet** — Correlation is v1's
  only consumer, so the concrete sortable results table (with Correlation's own column
  definitions: Signal A, Signal B, lag, coefficient, n, significance) lives in
  `features/correlation/` for now, following the promotion rule below.

## Design tokens

- Source: `src/styles/tokens/` (SCSS map — color, spacing, typography scale, radius,
  shadow/elevation, z-index, motion).
- Generated: `src/app/ui/tokens.generated.ts` (committed, never hand-edited), consumed
  only by `DesignTokenService`.
- Consumption: every stylesheet in the app (components, `src/styles/base/`) references
  `var(--token-name)` — never a literal, never the SCSS map directly.

## Promotion rule

A CDK/aria-backed piece starts in the feature that needs it. It moves into `ui/` the
moment a **second** feature needs the same shape — mirroring the promotion rule already
governing `data/`'s shared facades (ADR 0002) and this repo's docs.

## Bundle discipline

`drag-drop`, `table`, `tree`, and `scrolling` are imported only inside the lazy-loaded
feature chunk that uses them (`trackers` for Reorderable list, `entries` for Nested
list, `correlation` for Table). Only `a11y`, `overlay`, `portal`, and `bidi` — all
lightweight — may be used from `core/`/`ui/` eagerly.

## Test cases (Vitest — logic only)

- `DialogService`: opening a second dialog while one is open is rejected or queued (one
  dialog stack, never two simultaneously); closing restores focus to the triggering
  element; `Escape`/backdrop-click close honors a `disableClose` config flag.
- `ToastService`: messages queue and announce in order; a message is not dropped if one
  is already being announced.
- `DesignTokenService`: every token in the generated mirror is applied as a custom
  property on `document.documentElement` before first render; applying twice is
  idempotent.
- Reorderable list's pure reducer: given a CDK drop event (previous index, current
  index), produces the correctly reordered array without mutating the input.
- Nested list's `childrenAccessor` resolves a self-referencing (cyclic-capable) data
  shape without infinite recursion, respecting the same expansion-depth cap used
  elsewhere (`entries/SPEC.md`).
- Table's sort comparator: stable sort (equal keys preserve original relative order);
  ascending/descending toggle; a `null`/`undefined` value sorts consistently to one end.

## Out of scope

- Angular Material, in any form (ADR 0006).
- Dark/light theming (Later — `feature-scope.md`), auto-size virtual scroll (CDK
  experimental only), CDK sort/pagination (Material-only, hand-built here instead).
- A generic `ui/` Table component's actual implementation, until a second feature needs
  one — see **Table** above.

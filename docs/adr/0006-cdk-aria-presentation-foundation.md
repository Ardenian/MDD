# Presentation layer built on Angular CDK + @angular/aria, not Material

## Context

The app needs non-trivial interactive components — dialogs, selects, an autocomplete
Tag input, drag-reorderable Fields, a nested child-Entry list, a sortable results table
— each with real accessibility requirements (`AGENTS.md` already mandates AXE-clean,
WCAG AA). Hand-rolling focus trapping, keyboard navigation, and ARIA wiring for each of
these from scratch, per feature, is exactly the kind of solved problem worth not
re-solving, and worth getting wrong once instead of five times.

Angular ships two relevant unstyled libraries at this version: `@angular/cdk` (the
long-standing behavior-primitives library) and `@angular/aria` (new in Angular 22,
signal-based, and the named successor for combobox/autocomplete specifically — CDK's
own legacy combobox implementation was removed in CDK 22.0 pointing at this package).
Angular Material is a third option: a full, opinionated, pre-styled component kit built
on top of CDK.

## Decision

- The presentation layer is built on **`@angular/cdk` + `@angular/aria`** as the
  behavior/accessibility foundation, **never Angular Material**. Every visual is the
  app's own, defined via SCSS + design tokens (ADR 0007) — no Material Design look,
  ever, until this ADR is explicitly revisited.
- The mandate is **behavior-scoped, not literal**: a component builds on the matching
  CDK/aria primitive only when it has non-trivial interactive or accessibility-relevant
  behavior (focus management, keyboard nav, overlays, drag/reorder, live-region
  announcements, virtualization). Purely static/presentational components (a badge, a
  heading) are exempt — there's no primitive for them anyway, and forcing one would be
  ceremony without payoff.
- Split by which package owns which capability: **`@angular/cdk`** for a11y primitives
  (`FocusTrap`, `LiveAnnouncer`, `FocusMonitor`), overlay/portal, dialog, drag-drop,
  virtual scrolling (fixed-row-height only — auto-size virtualization remains
  experimental), table, tree, layout (`BreakpointObserver`), bidi, clipboard,
  text-field. **`@angular/aria`** for the higher-level interaction components it now
  owns: Combobox, Listbox, Select, Multiselect, Menu, Tree.
- A dedicated **`src/app/ui/`** folder (peer to `core/`, `data/`, `features/`,
  `shared/`) is the one place for how the app looks and behaves: the CDK/aria-backed
  reusable components, the coordination-only singleton services that back them
  (Overlay, Dialog, Toast, Focus — see ADR 0002's facade/injection rules for who may
  call them), and the design-token bridge (ADR 0007). `shared/` keeps its original,
  stricter "pure dumb, zero DI" meaning for everything with no CDK/aria involvement
  (pipes, presentational components). See `src/app/ui/SPEC.md` for the full roster.
- **Bundle discipline**: the heavier modules (`drag-drop`, `table`, `tree`,
  `scrolling`) are imported only inside the lazy-loaded feature chunk that uses them.
  Only the lightweight, universally-needed pieces (`a11y`, `overlay`, `portal`, `bidi`)
  may be used from `core/`/`ui/` eagerly.
- A component/service is promoted into `ui/` only once it's genuinely reusable across
  features — the same "create lazily, promote on second use" pattern this repo already
  follows for docs and for `data/`'s shared facades (ADR 0002). A CDK-backed piece with
  exactly one consumer stays in that feature's own folder.

## Considered options

- **Angular Material.** Rejected: a full opinionated visual kit fights a custom-styled
  app instead of helping it — the whole point here is design freedom with accessibility
  handled underneath, not a ready-made look.
- **Hand-roll everything (no CDK/aria).** Rejected: re-solves focus trapping, keyboard
  navigation, and ARIA wiring per feature, with real risk of getting the accessibility
  requirements wrong more than once.
- **CDK alone, hand-build combobox from `overlay` + `a11y` + `listbox`.** Rejected:
  CDK's own combobox was retired in favor of `@angular/aria`'s; hand-building the exact
  pattern the platform now ships a maintained replacement for has no upside.

## Consequences

- Two slightly different API idioms exist in the codebase: `@angular/cdk`'s directives
  are decorator-based (`@Input()`/`@Output()`, uniformly across the library, not yet
  migrated to signal `input()`/`output()`), while `@angular/aria` is signal-native. Every
  `ui/` component wrapping either still exposes its own boundary as `input()` /
  `output()` / `model()`, per the existing Angular rules — this is an internal
  implementation detail, invisible to consumers.
- Reversing this later (e.g. adopting Material) means restyling every `ui/` component to
  match, or living with two visual languages side by side.
- Only fixed-row-height virtual scrolling is available in stable CDK; a list needing
  variable-height virtualization can't get it from this foundation without dropping to
  the experimental `@angular/cdk-experimental` package.
- Stable `@angular/cdk` ships no sort/pagination affordance (that's Material-only) — a
  sortable table built on `cdk/table` needs a hand-built comparator + clickable-header
  pattern on top, not a CDK-provided primitive.

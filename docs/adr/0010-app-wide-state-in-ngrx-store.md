# App-wide cross-cutting state lives in `@ngrx/store`, not `@ngrx/signals`

## Context

ADR 0008 made `@ngrx/signals` the sole state-management tool for facades, split into
stateless DataAccess and stateful Store. Adding `@ngrx/translate` for i18n introduced a
state shape that doesn't fit that taxonomy at all: the currently selected UI locale
(`uiLocale`) must be reachable from anywhere in the app, isn't wrapped around a `data/`
port, and isn't owned by any single feature.

`IdentityContext` (`core/`, ADR 0003) already had the same shape of problem: every
adapter reads `userId`/`ownerId` from it when stamping records (hardcoded to `dev`/`dev`
in v1), which is exactly "needed by the entire application," not feature state.

`@ngrx/store` was already a project dependency, unused, alongside `@ngrx/signals`.
`@ngrx/effects` has since been added specifically to support this decision.

## Decision

`@ngrx/store` (actions/reducer/selectors) is the dedicated mechanism for state that must
be available across the entire application — currently `uiLocale` and `IdentityContext`'s
`userId`/`ownerId`. `@ngrx/signals` is unchanged for everything ADR 0008 already covers:
feature-local and shared DataAccess/Store facades.

- The store (state, actions, reducer, selectors, `provideStore()`) is defined and wired
  in `core/`, next to where `IdentityContext` already lives.
- `IdentityContext` keeps its existing plain, synchronous read API — `data/` adapters
  stay unaware anything changed underneath it. Internally it now reads from the store.
- A thin `ui/` coordination service is the only thing presentation code injects for
  locale: it exposes `uiLocale` as a signal, dispatches the change action, and drives
  `TranslateService.use()`. No component ever injects the raw `Store`, matching ADR
  0002's "presentation never injects below the facade" rule.
- `@ngrx/effects` handles the store's side effects — persisting the selected locale to
  `localStorage`, calling `TranslateService.use()` on change — instead of ad-hoc
  subscriptions, keeping them declarative and colocated with the action that triggers
  them.

## Considered options

- **Keep everything on `@ngrx/signals`** (a `ui/`-only signal service for locale,
  mirroring `DesignTokenService`, ADR 0007). Rejected: doesn't solve `IdentityContext`'s
  identically-shaped problem, and would leave two different ad-hoc patterns for "state
  needed everywhere" instead of one.
- **Leave `IdentityContext` untouched, scope the store to `uiLocale` only.** Considered
  as the lower-risk default; rejected in favor of migrating identity too, since both are
  genuinely the same category of app-wide state and maintaining two mechanisms for one
  category is the exact ambiguity ADR 0008 was written to avoid.
- **Ad-hoc subscriptions instead of `@ngrx/effects`** for the two side effects. Rejected
  once `@ngrx/effects` became available: with `@ngrx/store` already the chosen
  mechanism, its effects library keeps side effects declarative and testable rather than
  scattered through `core/`'s wiring.

## Consequences

- `AGENTS.md`'s signals-first guidance gets one explicit, narrow exception: true
  app-wide cross-cutting state (not feature state, not a `data/`-port-backed facade)
  uses `@ngrx/store` + `@ngrx/effects`; everything else stays `@ngrx/signals`. Any
  future candidate for the store is judged against the same bar `IdentityContext` and
  `uiLocale` meet: needed everywhere, not owned by one feature, not backed by a
  repository port.
- `core/SPEC.md` documents the store and the revised `IdentityContext` internals;
  `ui/SPEC.md` documents the new locale coordination service.

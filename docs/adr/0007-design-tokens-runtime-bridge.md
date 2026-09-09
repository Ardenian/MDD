# Design tokens: SCSS source of truth, generated TS mirror, runtime CSS custom properties

## Context

The presentation layer (ADR 0006) is fully hand-styled, which means color, spacing,
typography, radius, shadow, and z-index values need one authoritative source rather than
being scattered as literals across every component's stylesheet — especially with WCAG
AA contrast already a hard requirement. Dark/light theming isn't a v1 feature, but a
choice made now about *how* tokens are represented determines whether adding it later is
a method call or a rewrite.

SCSS variables (`$color-ink`) are compile-time only — they don't exist once the
stylesheet is compiled, so nothing at runtime can read or change them. CSS custom
properties (`--color-ink`) exist at runtime and can be reassigned, but authoring them
by hand loses SCSS's map/function tooling.

## Decision

- Design tokens are **authored once, in SCSS**, as a single token map under
  `src/styles/tokens/` (categories: color, spacing, typography scale, radius,
  shadow/elevation, z-index, motion). This is the single source of truth — no token
  value is ever duplicated by hand anywhere else.
- A small build step generates a **parallel TypeScript mirror** (`tokens.generated.ts`)
  from that same SCSS map — the same "generate, never hand-edit" pattern this repo
  already uses for the API client (ADR 0004).
- A **`DesignTokenService`** (`src/app/ui/`, per ADR 0006) reads the generated TS map and
  applies every token as a **CSS custom property** on `document.documentElement` via a
  `provideAppInitializer`, before the app renders.
- Components consume tokens exclusively through `var(--token-name)` in their own SCSS —
  never a raw literal, never the SCSS map directly (component stylesheets don't import
  the token source; they only reference the custom properties the service has applied).
- **v1 applies static default values only** — there is no theme switch, no
  `prefers-color-scheme` handling, no per-user customization. Dark/light theming is
  recorded as a **Later** item in `feature-scope.md`; when it lands, it's a new call
  into the same service (reassigning custom properties), not a restructuring of how
  components get their colors.

## Considered options

- **SCSS variables only, no runtime bridge.** Rejected: zero JS cost, but forecloses
  theming — adding it later means finding and replacing every `$variable` reference
  across every component stylesheet.
- **Static `:root { }` block emitted directly by SCSS, no service.** Considered
  seriously — it delivers the runtime-custom-property benefit (theming stays possible)
  with no JS at all. Rejected because it gives up the one thing a service adds: an
  actual seam something can call into later. Without it, "add theming" is still a
  rewrite of the token-emission mechanism, just a different one.
- **Hand-maintained parallel TS token file**, no codegen. Rejected: two hand-edited
  sources of truth drift; this repo already has a "generate, don't duplicate by hand"
  convention for exactly this failure mode.

## Consequences

- More machinery than the obvious static-CSS path (a build step, a generated file, an
  initializer) for a v1 that only ever applies one fixed set of values — this is
  deliberate front-loading for the deferred theming feature, not incidental complexity.
- The generated `tokens.generated.ts` is committed, like every other generated artifact
  in this repo, and never hand-edited.
- A brief flash-of-unstyled-tokens window exists between first paint and the initializer
  running; `provideAppInitializer` runs before the app renders, which keeps this
  negligible in practice but it's a real trade-off against a build-time-only `:root{}`
  block, which has none.

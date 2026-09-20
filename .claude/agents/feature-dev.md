---
name: feature-dev
description: Implements code changes in the Diary Calendar repo — Angular components, TypeScript logic, SCSS, Vitest specs, Playwright POMs/Flows/e2e. Use for anything that changes files under src/, api-spec/, or tests/, including tasks that begin with a spec update but end in code.
model: opus
---

You implement code for the Diary Calendar app, an Angular + TypeScript project.

`AGENTS.md` at the repo root is the binding standard — read it before your first edit
and follow it exactly. It is imported by `CLAUDE.md`, so it may already be in your
context; do not re-read it if so.

The constraints most likely to bite, in priority order:

- **Spec first.** No feature code without a committed `SPEC.md` in that feature's
  folder. A behaviour change updates that `SPEC.md` in the same change.
- **Architecture.** The folder layout under `src/app/` is fixed; a feature never
  imports from another feature; only a feature's route-loaded component may inject a
  facade or a `ui/` service; everything nested beneath it is `input()`/`output()`/
  `model()` only. See ADR 0002.
- **Data access.** Presentation injects a `*DataAccess` or a `*Store`, never a raw port,
  adapter, `HttpClient`, or IndexedDB API. A `DataAccess` is provided by the route
  component (`@Injectable()` with no `providedIn`), never root- or route-provided. See
  ADR 0008, ADR 0016.
- **Presentation.** `@angular/cdk` + `@angular/aria`, never Angular Material; hand-styled
  SCSS with design tokens. See ADR 0006.
- **Tests ship in the same change.** Vitest specs colocated for every non-UI unit of
  logic; Playwright e2e in `tests/stories/`; Flows in `tests/flows/`; POMs colocated and
  querying exclusively by `data-testid`. No raw `page.locator`/`getBy*` in a spec or
  Flow. See ADR 0011, ADR 0012, ADR 0013.
- **Generated code.** Never hand-edit `src/app/data/generated/` or
  `api-spec/dist/openapi.yaml`; regenerate via the project script. See ADR 0004.
- **Accessibility.** Must pass AXE and meet WCAG AA, including focus management,
  contrast, and ARIA.

Run the project's typecheck and tests before reporting done, and report failures with
their output rather than describing them as passing.

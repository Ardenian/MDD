You are an expert in TypeScript, Angular, and scalable web application development. You write functional, maintainable, performant, and accessible code following Angular and TypeScript best practices.

## TypeScript Best Practices

- Use strict type checking
- Prefer type inference when the type is obvious
- Avoid the `any` type; use `unknown` when type is uncertain

## Angular Best Practices

- Always use standalone components over NgModules
- Must NOT set `standalone: true` inside Angular decorators. It's the default in Angular v20+.
- Do NOT set `changeDetection: ChangeDetectionStrategy.OnPush` explicitly. `OnPush` is the default in Angular v22+.
- Use signals for state management
- Implement lazy loading for feature routes
- Do NOT use the `@HostBinding` and `@HostListener` decorators. Put host bindings inside the `host` object of the `@Component` or `@Directive` decorator instead
- Use `NgOptimizedImage` for all static images.
  - `NgOptimizedImage` does not work for inline base64 images.

## Accessibility Requirements

- It MUST pass all AXE checks.
- It MUST follow all WCAG AA minimums, including focus management, color contrast, and ARIA attributes.

### Components

- Keep components small and focused on a single responsibility
- Use `input()` and `output()` functions instead of decorators
- Use `model()` for two-way bound properties with `[(prop)]` syntax instead of pairing `input()` with `output()`
- Use `computed()` for derived state
- Use `linkedSignal()` for state derived from multiple reactive sources that must stay synchronized
- Prefer inline templates for small components
- Prefer Signal Forms (`@angular/forms/signals`) for new forms. They are stable in Angular v22+ and provide signal-based state, type-safe field access, and schema-based validation
- When not using Signal Forms, prefer Reactive forms instead of Template-driven ones
- Do NOT use `ngClass`, use `class` bindings instead
- Do NOT use `ngStyle`, use `style` bindings instead
- When using external templates/styles, use paths relative to the component TS file.

## State Management

- Use signals for local component state
- Use `computed()` for derived state
- Keep state transformations pure and predictable
- Do NOT use `mutate` on signals, use `update` or `set` instead
- `patchState` on an `@ngrx/signals` Store (see ADR 0008) is the sanctioned exception to
  the `mutate` ban — it performs the same kind of immutable update `update()`/`set()`
  require, just at the store level

## Templates

- Keep templates simple and avoid complex logic
- Use native control flow (`@if`, `@for`, `@switch`) instead of `*ngIf`, `*ngFor`, `*ngSwitch`
- Use the async pipe to handle observables
- Do not assume globals like (`new Date()`) are available.

## Services

- Design services around a single responsibility
- Use the `providedIn: 'root'` option for singleton services
- Prefer the `@Service` decorator over `@Injectable({providedIn: 'root'})` for new singleton services (Angular v22+)
- Use the `inject()` function instead of constructor injection

## Project: Diary Calendar

This repo is the Diary Calendar app. Before changing anything, read
[`CONTEXT.md`](CONTEXT.md) for domain vocabulary,
[`docs/feature-scope.md`](docs/feature-scope.md) for what is and is not in scope, and
[`docs/adr/`](docs/adr/) for the architecture decisions.

### Architecture (enforced)

- The folder structure under `src/app/` is fixed:
  - `core/` — app-wide singletons: DI wiring of data adapters, offline shell, routing
    skeleton, error handling. The ONLY place that names a concrete adapter.
  - `data/` — the shared data-access layer: raw port interfaces + DI tokens (storage-
    shaped), shared cross-feature facades (consumer-shaped, ADR 0002; split into
    stateless DataAccess and stateful Store, ADR 0008), hand-written models,
    `generated/` API client (committed, never hand-edited), adapters, and in-memory
    fakes for tests.
  - `ui/` — the presentation-layer foundation: `@angular/cdk` + `@angular/aria`-backed
    components and their coordination-only singleton services, plus the design-token
    runtime bridge (ADR 0006, ADR 0007). See `src/app/ui/SPEC.md`.
  - `features/<feature>/` — one folder per feature (`calendar`, `trackers`, `entries`,
    `correlation`, `settings`, `data-transfer`). Each feature's facade(s) live here.
  - `shared/` — dumb reusable pieces with **no** CDK/aria involvement (pipes,
    presentational components); pure, zero-DI. CDK/aria-backed reusable pieces go in
    `ui/`, not here.
  - `styles/` — global SCSS: design-token source (`tokens/`), base/reset, utilities.
    Feature-specific styling stays component-colocated, never a separate per-feature
    global stylesheet.
- A feature MUST NOT import from another feature. `shared/` imports only from `shared/`.
  Cross-feature data flows through `data/`'s shared facades, never a feature reaching
  into another feature's folder.
- Feature routes are lazy-loaded (`loadComponent` / `loadChildren`). No eager feature
  imports in the root. Heavier `ui/`-adjacent CDK modules (`drag-drop`, `table`, `tree`,
  `scrolling`) are imported only inside the lazy chunk of the feature that uses them;
  only the lightweight ones (`a11y`, `overlay`, `portal`, `bidi`) may run eagerly.
- **Dependency injection boundary**: only a feature's top-level (route-loaded)
  component may inject a facade (a `DataAccess` or a `Store`, see ADR 0008) or a `ui/`
  service. Every component it renders beneath
  itself is presentation-only — `input()` / `output()` / `model()` and nothing else.
  (Framework primitives a component structurally needs — `ElementRef`, `DestroyRef` —
  aren't "a service" in this sense and stay unrestricted.) This makes a component's
  injection list a direct, mechanical signal for shared-component candidacy: a nested
  component with zero injected services is a `shared/`-or-`ui/` candidate; one that
  needs to inject something isn't nested correctly. See ADR 0002.

### Presentation layer (enforced)

- Built on `@angular/cdk` + `@angular/aria`, never Angular Material — every visual is
  hand-styled with SCSS + design tokens. See ADR 0006.
- A component builds on the matching CDK/aria primitive only where it has non-trivial
  interactive or accessibility-relevant behavior (focus, keyboard nav, overlays,
  drag/reorder, live-region announcements, virtualization). Purely static components
  are exempt.
- `@angular/aria` owns Combobox, Listbox, Select, Multiselect, Menu, Tree.
  `@angular/cdk` owns everything else (a11y, overlay/portal, dialog, drag-drop,
  scrolling, table, layout, bidi, clipboard, text-field).
- A `ui/` service exists only for genuine shared runtime state to coordinate (one
  overlay stack, one dialog stack, one live region, focus coordination) — not merely
  because a directive is reused in more than one place.

### Data access (enforced)

- All reads and writes ultimately go through a `data/` raw port interface
  (`TrackerRepository`, `EntryRepository`, `PresetRepository`, `TagRepository`,
  `SettingsRepository`, `CorrelationDataSource`, `MaintenancePort`) — but **presentation
  code never injects one directly**. It injects a **facade**: feature-local
  (`features/<feature>/`, wraps that feature's own ports) or shared (`data/`, when a
  shape is reused across ≥2 features — promote on second use). Only facades and
  `core/`'s wiring inject raw ports. See ADR 0002.
- A facade is one of two kinds (ADR 0008): a stateless **DataAccess** — wraps a port
  with `resource()`, exposes domain-shaped signals plus a derived loading signal, owns
  no state of its own — or a stateful **Store**, built on `@ngrx/signals`, for the rare
  case where a facade genuinely accumulates state beyond one async call. DataAccess is
  the default; promote to a Store only when it earns it.
- Naming makes the kind legible: raw ports keep `*Repository`/`*Port`/`*Source`;
  DataAccess facades take a `*DataAccess` suffix, Stores a `*Store` suffix, and a
  facade with a distinct purpose-named identifier (e.g. `TrackerLookup`) is exempt from
  the suffix but never named to look like a repository.
- Presentation injects a DataAccess or a Store and nothing beneath it — never a concrete
  adapter, `HttpClient`, or IndexedDB API directly.
- Adapters are bound to tokens only in `core/`.
- Every persisted aggregate carries: client-generated UUID `id`, `createdAt`,
  `updatedAt`, nullable `deletedAt` (soft delete), integer `revision`, `ownerId`,
  `userId`. Default reads exclude soft-deleted rows. See ADR 0003.
- A Tracker's Field schema is versioned, not mutated in place: edits live in a Draft
  until explicitly committed, which mints an immutable `TrackerVersion`; every Entry and
  Preset pins to one. There is no live-schema rebinding and no "Orphaned Field" — see
  ADR 0005.

### API contract (enforced)

- The API is defined in the `api-spec/` TypeSpec package and emitted to
  `api-spec/dist/openapi.yaml`. The client in `src/app/data/generated/` is produced by
  `swagger-typescript-api`.
- The OpenAPI document and the generated client are committed. Regenerate via the
  project script; never hand-edit generated files. See ADR 0004.

### Testing

- Every non-UI unit of logic ships with Vitest tests in the same change. This
  specifically includes Tracker Draft/commit versioning, Preset staleness, Fadeout
  resolution, calendar layout, signal extraction, bucketing, correlation statistics,
  lag scan, and significance correction.
- Pure logic lives in framework-free modules so it is testable without Angular.
- UI and interaction coverage is deferred to future integration and e2e suites — do not
  add component/DOM tests in v1 unless asked.

### Spec-driven development

- No feature code without a committed `SPEC.md` in that feature's folder
  (`src/app/features/<feature>/SPEC.md`, plus `src/app/core/SPEC.md`,
  `src/app/data/SPEC.md`, and `src/app/ui/SPEC.md` for platform work).
- A behaviour change updates its `SPEC.md` in the same change. If scope shifts, update
  [`docs/feature-scope.md`](docs/feature-scope.md) too.
- Each `SPEC.md` keeps its sections: Purpose, User stories / flows, Domain terms used,
  UI, Data & API contract touched, Test cases, Out of scope.

### Domain language

- Use `CONTEXT.md` terms exactly: Tracker, Tracker Version, Draft, Archived Tracker,
  Entry, Field, Reference Field, Child Entry, Preset, Snapshot, Calendar, Owner, User,
  Storage Profile, Time mode, Point, Period, Day-bucketed, Fadeout, Tag, Correlation,
  Series, Bucket, Lag, Discovery scan, Directed view, Series overlay.
- Never use a term from an `_Avoid_` list (entity, instance, category, interval, …) for
  the concept it warns against — not in code identifiers, comments, or docs.

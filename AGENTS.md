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
  - `data/` — the shared data-access layer: port interfaces + DI tokens, hand-written
    models, `generated/` API client (committed, never hand-edited), adapters, and
    in-memory fakes for tests.
  - `features/<feature>/` — one folder per feature (`calendar`, `trackers`, `entries`,
    `correlation`, `settings`). Feature state (signal stores) lives here.
  - `shared/` — dumb reusable UI components, pipes, directives.
- A feature MUST NOT import from another feature. `shared/` imports only from `shared/`.
  Cross-feature data flows through `data/` ports.
- Feature routes are lazy-loaded (`loadComponent` / `loadChildren`). No eager feature
  imports in the root.

### Data access (enforced)

- All reads and writes go through a `data/` port interface (`TrackerRepository`,
  `EntryRepository`, `PresetRepository`, `TagRepository`, `SettingsRepository`,
  `CorrelationDataSource`, `MaintenancePort`).
- Presentation code injects a port TOKEN only. It must not name, import, or branch on a
  concrete service, store, adapter, `HttpClient`, or IndexedDB API.
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
  (`src/app/features/<feature>/SPEC.md`, plus `src/app/core/SPEC.md` and
  `src/app/data/SPEC.md` for platform work).
- A behaviour change updates its `SPEC.md` in the same change. If scope shifts, update
  [`docs/feature-scope.md`](docs/feature-scope.md) too.
- Each `SPEC.md` keeps its sections: Purpose, User stories / flows, Domain terms used,
  UI, Data & API contract touched, Test cases, Out of scope.

### Domain language

- Use `CONTEXT.md` terms exactly: Tracker, Tracker Version, Draft, Archived Tracker,
  Entry, Field, Reference Field, Child Entry, Preset, Snapshot, Calendar, Owner, User,
  Time mode, Point, Period, Day-bucketed, Fadeout, Tag, Correlation, Signal, Bucket, Lag,
  Discovery scan, Directed view.
- Never use a term from an `_Avoid_` list (entity, instance, category, interval, …) for
  the concept it warns against — not in code identifiers, comments, or docs.

# Core — Platform Spec

## Purpose

App-wide wiring that is not a feature: dependency injection of data adapters, offline
shell, routing skeleton, error handling, and the single implicit Calendar. `core/` is
the only place that names concrete adapters (ADR 0002).

## Responsibilities

### Adapter wiring
- Bind each `data/` port token (`TrackerRepository`, `EntryRepository`,
  `PresetRepository`, `TagRepository`, `SettingsRepository`, `CorrelationDataSource`,
  `MaintenancePort`) to its **IndexedDB adapter** via DI providers.
- A single switch point where an HTTP adapter set can replace the IndexedDB set later
  with no feature changes.

### Identity & Calendar context
- Provide `ownerId` and `userId`, both hardcoded to `"dev"` in v1, through an
  `IdentityContext` service that adapters read when stamping records (ADR 0003).
- Ensure exactly one Calendar record exists on first run (create-if-absent).

### Offline shell
- Register a **service worker** that caches the app shell (HTML, JS, CSS, fonts, icons)
  so the app loads with no network on repeat visits.
- No runtime data caching in the service worker — data offline is the IndexedDB
  adapter's job.
- Surface an "update available" prompt when a new shell is fetched.

### Routing skeleton
- Top-level routes, each **lazy-loaded**: `/calendar` (default), `/trackers`,
  `/correlation`, `/settings`.
- A layout shell (nav, skip-link, live region for route-change announcements).

### Error handling
- A global `ErrorHandler` that logs and calls `ui/`'s `ToastService` to show a
  non-blocking, accessible error message; never a white screen. `core/` is the one
  exception to "only a top-level component injects a `ui/` service" — it's the
  bootstrapping root, not a presentation component.
- Adapter/port errors are normalised to a small `DataError` type before reaching
  features.

## Domain terms used

Calendar, Owner, User, Tracker, Entry. See [`CONTEXT.md`](../../../CONTEXT.md).

## Data & API contract touched

- Consumes every `data/` port; owns their providers. Defines no models itself.

## Test cases (Vitest — logic only)

- DI: resolving each port token yields the IndexedDB adapter instance; swapping the
  provider set swaps all of them together.
- `IdentityContext` returns `dev`/`dev`; adapters stamp `ownerId`/`userId` from it.
- First-run bootstrap creates exactly one Calendar; second run creates none.
- `ErrorHandler` maps a thrown adapter error to `DataError`, does not rethrow, and
  calls `ToastService` exactly once per error.
- Route config: all four feature routes are lazy (`loadComponent`/`loadChildren`), no
  eager feature imports in the root.

## Out of scope

- Real authentication, session handling, token refresh.
- Backend sync, connectivity detection, retry queues.
- Feature flags, analytics, telemetry.
- Multi-Calendar context.

# Core — Platform Spec

## Purpose

App-wide wiring that is not a feature: dependency injection of data adapters, offline
shell, routing skeleton, error handling, and the single implicit Calendar. `core/` is
the only place that names concrete adapters (ADR 0002).

## Responsibilities

### Adapter wiring
- At bootstrap, read `activeProfileId` from `SettingsRepository` to resolve the active
  **Storage Profile**, then bind each `data/` port token (`TrackerRepository`,
  `EntryRepository`, `PresetRepository`, `TagRepository`, `SettingsRepository`,
  `CorrelationDataSource`, `MaintenancePort`) to that Profile's adapter set via DI
  providers. v1 has exactly one Profile, **Offline**, which always resolves to the
  **IndexedDB adapter** — but the wiring is Profile-driven from day one, not
  hardcoded. See [ADR 0009](../../../docs/adr/0009-storage-profile-and-data-transfer.md).
- A single switch point where an HTTP (or other) adapter set can be added as a new
  Storage Profile later with no feature changes.
- Changing the active Storage Profile (Settings) takes effect on the next app reload —
  adapters are not hot-swapped at runtime.

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
  `/correlation`, `/settings`, `/data-transfer`.
- A layout shell (nav, skip-link, live region for route-change announcements).

### Error handling
- A global `ErrorHandler` that logs and calls `ui/`'s `ToastService` to show a
  non-blocking, accessible error message; never a white screen. `core/` is the one
  exception to "only a top-level component injects a `ui/` service" — it's the
  bootstrapping root, not a presentation component.
- Adapter/port errors are normalised to a small `DataError` type before reaching
  features.

## Domain terms used

Calendar, Owner, User, Storage Profile, Tracker, Entry. See
[`CONTEXT.md`](../../../CONTEXT.md).

## Data & API contract touched

- Consumes every `data/` port; owns their providers. Defines no models itself.

## Test cases (Vitest — logic only)

- DI: resolving each port token yields the IndexedDB adapter instance; swapping the
  provider set swaps all of them together.
- Bootstrap reads `activeProfileId` from `SettingsRepository` and wires the matching
  adapter set; v1 always resolves to Offline → IndexedDB, and an unset/unknown
  `activeProfileId` falls back to Offline rather than failing bootstrap.
- `IdentityContext` returns `dev`/`dev`; adapters stamp `ownerId`/`userId` from it.
- First-run bootstrap creates exactly one Calendar; second run creates none.
- `ErrorHandler` maps a thrown adapter error to `DataError`, does not rethrow, and
  calls `ToastService` exactly once per error.
- Route config: all five feature routes are lazy (`loadComponent`/`loadChildren`), no
  eager feature imports in the root.

## Out of scope

- Real authentication, session handling, token refresh.
- Backend sync, connectivity detection, retry queues.
- Feature flags, analytics, telemetry.
- Multi-Calendar context.

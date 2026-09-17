# Core — Platform Spec

## Purpose

App-wide wiring that is not a feature: dependency injection of data adapters, offline
shell, routing skeleton, error handling, and the single implicit Calendar. `core/` is
the only place that names concrete adapters (ADR 0002).

## Status

Built: adapter wiring (`data-providers.ts`), Storage Profile resolution
(`storage-profile.ts`), the Calendar bootstrap and design-token initializers, global
error handling (`error/`), the lazy route table, the layout shell, route announcements,
and the service worker. The feature route components exist as their features' top-level
entry points and are filled in by each feature's own phase.

## Responsibilities

### Adapter wiring
- At bootstrap, read `activeProfileId` from `SettingsRepository` to resolve the active
  **Storage Profile**, then bind each `data/` port token (`TrackerRepository`,
  `EntryRepository`, `PresetRepository`, `TagRepository`, `SettingsRepository`,
  `CorrelationDataSource`, `MaintenancePort`) to that Profile's adapter set via DI
  providers. v1 has exactly one Profile, **Offline**, which always resolves to the
  **IndexedDB adapter** — but the wiring is Profile-driven from day one, not
  hardcoded. See [ADR 0009](../../../docs/adr/0009-storage-profile-and-data-transfer.md).
- `ActivePortSet` holds the resolved set and **every port token reads from it**, so the
  whole set swaps together and can never end up half one Profile and half another. The
  `PORT_SET_BUILDERS` map is the single switch point: a later HTTP adapter set is one
  entry there and no feature change.
- Bootstrap reads the Profile with the default (Offline) set before binding the one it
  names — the settings read has to come from somewhere, and in v1 both are the same
  adapter anyway.
- Changing the active Storage Profile (Settings) takes effect on the next app reload —
  adapters are not hot-swapped at runtime.

### Identity & Calendar context
- Provide `ownerId` and `userId`, both hardcoded to `"dev"` in v1, through an
  `IdentityContext` service that adapters read when stamping records (ADR 0003).
  Internally backed by the app-wide `@ngrx/store` (see below); adapters read
  `identityContext.ownerId()` / `.userId()` as plain signals and stay unaware of that.
- Ensure exactly one Calendar record exists on first run, via
  `MaintenancePort.ensureCalendar()` (create-if-absent). The Calendar gets no port of its
  own because nothing but whole-database operations ever touches it — `clearAll()` and
  `importAll()` re-seed through the same call.

### App-wide state (`@ngrx/store`)
- `@ngrx/store` (not `@ngrx/signals`) holds state that must be reachable across the
  entire application: `uiLocale` and `IdentityContext`'s `ownerId`/`userId`. Everything
  ADR 0008 covers (feature/shared facades) stays on `@ngrx/signals` — see
  [ADR 0010](../../../docs/adr/0010-app-wide-state-in-ngrx-store.md).
- `core/state/locale/` — `uiLocale` + `isExplicit`. Initial value resolves at store
  creation: an explicit `localStorage` choice wins, else the browser's language if
  supported, else English. `@ngrx/effects` persists an explicit change to `localStorage`
  and calls `TranslateService.use()`; a `provideAppInitializer` applies the resolved
  initial locale to `TranslateService` once at bootstrap.
- `core/state/identity/` — static `dev`/`dev` in v1, no actions.
- `ui/`'s `UiLocaleService` is the only thing presentation code injects to read or
  change `uiLocale` — never the raw `Store`.

### Translations (`@ngx-translate/core`)
- `core/i18n/StaticCommonTranslateLoader` statically imports the `common` namespace
  (`core/i18n/translations/{locale}/common.json`) instead of fetching it over HTTP — this
  app is offline-first (ADR 0003) with no service-worker asset caching yet, so a loader
  with zero runtime network dependency is the safer default.
- Supported locales: `en` (fallback), `de`. A feature that needs its own translated
  strings adds `features/<feature>/i18n/translations/{locale}/<feature>.json` and
  provides a child `TranslateService` (`provideChildTranslateService`) scoped to its
  lazy route, which falls back to the root (`common`) service for any key it doesn't
  define — no feature has needed this yet.

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
- A named **`modal`** outlet beside the primary one, with one lazy route, `entry`, owned
  by the entries feature. Any feature opens the Entry form by navigating into that
  outlet, so no feature imports another to reuse it.

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
- Locale reducer: `resolveInitialLocale` prefers a stored, supported locale over the
  browser's; among browser languages only a supported primary subtag matches; falls
  back to English when nothing matches. Dispatching `languageSelected` sets `uiLocale`
  and marks it explicit.
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

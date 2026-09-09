# A shared data-access layer, strictly separated from presentation

> **Revised**: the original decision (a shared layer, adapters swappable, never named by
> presentation) is unchanged. The "presentation injects a port token" detail has been
> tightened to "presentation injects a facade" — see **Decision**, point 3 onward. This
> also folds in a related rule: only a feature's top-level (route) component may inject
> anything at all; everything nested is presentation-only. See **Consequences**.

## Context

The app is frontend-only today with data in IndexedDB, but a real backend must be able
to replace that later without rewriting features. If components reach for concrete
services, stores, or storage APIs, that swap becomes a project-wide edit and the app is
untestable without a browser database.

Experience writing the first feature specs surfaced a second problem even *with* ports:
a component that injects several raw repositories to assemble what it actually needs
(e.g. Tracker names for a picker, drawn from `TrackerRepository`) still couples that
component to the storage shape, and duplicates the same assembly logic anywhere else the
same shape is needed.

## Decision

All data access goes through a **shared data-access layer** (`src/app/data/`):

1. The layer exposes **raw port interfaces per aggregate** — `TrackerRepository`,
   `EntryRepository`, `PresetRepository`, `TagRepository`, `SettingsRepository`,
   `CorrelationDataSource`, `MaintenancePort` — shaped around storage (CRUD-ish),
   defined in `data/` and nothing else.
2. Concrete **adapters** implement the ports: an IndexedDB adapter for v1, an HTTP
   adapter (built on the generated API client) for later. Adapters are **wired only in
   `core/`**, via DI providers that bind each port token to an adapter.
3. **Presentation components never inject a raw port.** They inject a **facade**
   instead — an interface-defined, DI-injected service shaped around what its
   consumers actually need rather than around storage, hiding whatever sits behind it
   (a signal store, caching, memoization). Structurally a facade is the same *kind* of
   thing a raw port is (interface + injectable implementation); the distinction is
   purpose-built-for-a-consumer vs. shaped-like-storage. Only facades (and `core/`'s
   wiring) may inject raw ports.
4. A facade has one of two homes:
   - **Feature-local** (`features/<feature>/`) — composes that feature's own ports for
     that feature's specific need (e.g. an `EntriesFacade` combining `EntryRepository` +
     `TagRepository` + Tracker/Preset lookups, shaped for the Entry form). Only that
     feature's top-level component(s) inject it.
   - **Shared** (`data/`, alongside the raw ports) — a facade whose shape is genuinely
     reusable across features (e.g. a `TrackerLookup` of `{id, name, archived}`, needed
     by Trackers, Calendar, and Correlation alike). Injectable directly by any feature's
     top-level component, since it isn't owned by one feature.
   - **Promotion rule**: a feature-local facade moves to `data/` as a shared facade the
     moment a second feature needs the same shape — the same "create lazily, promote on
     second use" pattern already governing `ui/` components and this repo's docs.
5. **Naming convention**: raw ports keep `*Repository`/`*Port`/`*Source` suffixes;
   facades get a distinct, purpose-named identifier (`EntriesFacade`, `TrackerLookup`) —
   never named to look like a repository, so which kind of thing is being injected is
   legible from the name alone.
6. Feature state (signal stores) is not a separate concept from the facade — it's the
   internal implementation detail a facade hides. Presentation never talks to a signal
   store directly, only to the facade's interface.

## Considered options

- **Components call services directly (typical Angular).** Rejected: couples every
  feature to the current persistence choice and to a live IndexedDB in tests.
- **One global store facade over everything.** Rejected: becomes a god object; per-
  aggregate ports keep each raw interface small and independently mockable.
- **Presentation injects raw ports directly** (the original version of this ADR).
  Rejected on revision: a component that must compose 2+ ports to get what it needs
  re-derives storage-shaped logic in the presentation layer, and that assembly can't be
  reused without either duplicating it or reaching into another component.

## Consequences

- Swapping IndexedDB for a backend is: add an adapter, change provider wiring in `core/`.
  No feature code changes, since facades never named a concrete adapter either.
- Every feature is unit-testable against in-memory fakes of the ports, and every
  component is unit-testable against a fake facade — smaller, purpose-shaped, easier to
  fake than a raw repository.
- **Only a feature's top-level (route-loaded) component may inject a facade or a `ui/`
  service.** Everything it renders beneath itself is presentation-only: `input()` /
  `output()` / `model()` and nothing else (framework primitives like `ElementRef` or
  `DestroyRef` aren't "a service" in this sense and stay unrestricted). This makes a
  component's injection list a direct, mechanical signal for shared-component
  candidacy — the same zero-DI test `shared/` already applies to itself, now applied to
  every nested component everywhere, not only at the point of promotion.
- Enforced by the agent rules in `AGENTS.md` (architecture + data-access sections) and
  checked in code review.

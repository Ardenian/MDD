# A shared data-access layer, strictly separated from presentation

## Context

The app is frontend-only today with data in IndexedDB, but a real backend must be able
to replace that later without rewriting features. If components reach for concrete
services, stores, or storage APIs, that swap becomes a project-wide edit and the app is
untestable without a browser database.

## Decision

All data access goes through a **shared data-access layer** (`src/app/data/`) that the
whole application depends on:

- The layer exposes **port interfaces per aggregate** — `TrackerRepository`,
  `EntryRepository`, `PresetRepository`, `TagRepository`, `CorrelationDataSource` —
  defined in `data/` and nothing else.
- Concrete **adapters** implement the ports: an IndexedDB adapter for v1, an HTTP
  adapter (built on the generated API client) for later. Adapters are **wired only in
  `core/`**, via DI providers that bind each port token to an adapter.
- **No presentation code names a concrete implementation.** Components and feature
  stores inject the port token only; they cannot tell which adapter is behind it.
- Feature state (signal stores) lives in `features/*` and calls ports. Cross-feature
  data sharing happens through the ports, not by importing another feature's store.

## Considered options

- **Components call services directly (typical Angular).** Rejected: couples every
  feature to the current persistence choice and to a live IndexedDB in tests.
- **One global store facade over everything.** Rejected: becomes a god object; per-
  aggregate ports keep each interface small and independently mockable.

## Consequences

- Swapping IndexedDB for a backend is: add an adapter, change provider wiring in `core/`.
  No feature code changes.
- Every feature is unit-testable against in-memory fakes of the ports.
- Enforced by the agent rules in `AGENTS.md` (architecture + data-access sections) and
  checked in code review.

# Facades split into stateless DataAccess and stateful Store

## Context

Every `SPEC.md` and ADR 0002 describe "facade" as the single boundary presentation code
injects instead of a raw `data/` port, but none of them say how a facade holds state
internally. As of this ADR, none of the six facades named across `data/SPEC.md` and the
feature `SPEC.md`s have been implemented yet — this decision is made ahead of that code
landing, per this repo's spec-driven-development practice. Planning them out, they split
into two very different shapes: five are thin, read-through wrappers over one repository
call (`TrackersFacade`, `EntriesFacade`, `CalendarFacade`, `SettingsFacade`,
`TrackerLookup`), while `CorrelationFacade` will own real accumulated state — scan
progress, cancellation, a ranked results list built up across an async orchestration, and
pinned-pair preferences — none of which is "the result of the last read." Angular's
`resource()` (stable at this version, Promise-compatible with the existing Promise-based
ports) and `@ngrx/signals` (already a dependency, previously unused) are two different
tools suited to these two different shapes, and conflating them under one unqualified
"facade" label was starting to blur which one a given facade will actually need.

## Decision

**Facade** stays the umbrella term for "what presentation code injects instead of a raw
port" — ADR 0002's boundary is unchanged. Two concrete kinds sit under it:

- **DataAccess** — stateless: wraps one or more ports with `resource()`, exposes
  domain-shaped signals (never `resource()`'s own vocabulary) plus a derived loading
  signal, and may use `computed()` for derivation, but owns no writable state of its
  own. Named `TrackersDataAccess`, `EntriesDataAccess`, `CalendarDataAccess`,
  `SettingsDataAccess` when built; `TrackerLookup` keeps its purpose-named identifier
  and is a DataAccess in kind.
- **Store** — stateful: built on `@ngrx/signals`, owns and `patchState`s genuinely
  accumulated state. Only `CorrelationStore` qualifies in v1.

The split criterion is "does this construct hold any state beyond the result of its
last async call?" — not uniform adoption of the heavier tool. `AGENTS.md`'s existing
"no `mutate` on signals" rule gets one clarifying line: `patchState` on a Store is the
sanctioned exception, since it performs the same kind of immutable update `update()`/
`set()` already require, just at the store level.

## Considered options

- **Apply `@ngrx/signals` uniformly to all six facades**, for naming/API consistency.
  Rejected: five of the six have no state to justify the ceremony (`withEntities`,
  `patchState`, `rxMethod`) over a plain `resource()` read.
- **Keep the single "facade" name, no DataAccess/Store split.** Rejected: the internal
  shape difference is real and load-bearing (one kind holds state and patches it, the
  other doesn't and shouldn't), and leaving it unnamed invites every future facade to
  guess.

## Consequences

- `data/SPEC.md` and every feature `SPEC.md`'s "Data & API contract touched" section
  name each planned facade in its `DataAccess`/`Store` form from the start — there is no
  earlier `*Facade`-named code to rename, since none of the six exist yet as of this ADR.
- A future facade is DataAccess by default; it's promoted to a Store only when it
  accumulates state a single `resource()` call can't express — mirroring this repo's
  existing "promote on second use" pattern for `data/`'s shared facades and `ui/`'s
  CDK-backed components.
- [ADR 0016](0016-page-provided-dataaccess.md) later gave this split a second job: it
  also decides lifetime. A DataAccess is provided by the page that uses it and rebuilt
  per visit; a Store stays root-provided because its state is meant to outlive the route.

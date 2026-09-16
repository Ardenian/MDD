# Data Access Layer — Spec

## Purpose

The shared boundary between the whole app and where data lives. Two layers live here
(ADR 0002): **raw ports**, storage-shaped, injected only by facades and by `core/`'s
wiring; and **shared facades**, consumer-shaped, injected directly by any feature's
top-level component when a data shape is reused across ≥2 features. A facade is either
a stateless **DataAccess** or a stateful **Store** (ADR 0008); this repo's only shared
facade, `TrackerLookup`, is a DataAccess. Concrete adapters are wired in `core/` and
never named by features. The API contract is generated from the `api-spec/` TypeSpec
package (ADR 0004).

## Status

As of this writing, none of the below is built yet — no `ports/`, `facades/`, `model/`,
`adapters/`, or `testing/` exist in `src/app/data/` (only this `SPEC.md`, `README.md`,
and the committed `generated/api-client.ts`). This SPEC describes the target shape those
folders take as code lands, per this repo's spec-driven-development practice; see
`README.md`'s "Planned layout" note for the same status on the folder tree.

## Structure

```
src/app/data/
  ports/            # raw interfaces + DI tokens, one file per aggregate
    tracker-repository.ts
    entry-repository.ts
    preset-repository.ts
    tag-repository.ts
    settings-repository.ts
    correlation-data-source.ts
    maintenance-port.ts
  facades/          # shared, consumer-shaped facades — promoted here on second use
    tracker-lookup.ts
  model/            # hand-written domain types re-exported for app use
  generated/        # swagger-typescript-api output — committed, never hand-edited
  adapters/
    indexeddb/      # v1 implementation of every port
    http/           # later: implementation over generated/ client
  testing/          # in-memory fakes of every port, for feature unit tests
```

## Shared facades (v1 surface)

- **`TrackerLookup`** (DataAccess): `list(): { id, name, archived }[]`, plus a derived
  `isLoading` signal. Wraps `TrackerRepository` via `resource()`, stripped to the shape
  every consumer actually needs — a name and archived-state per Tracker, nothing about
  Fields or Versions. Consumed directly by Trackers' own list view, Calendar's
  per-Tracker toggle panel, and Correlation's Signal-scope picker; none of those three
  own it, so it lives here rather than in any one `features/` folder.

## Raw ports (v1 surface)

- **TrackerRepository**: `list()`, `get(id)`, `create(input)`, `saveDraft(id, fields)`,
  `commitDraft(id)` (mints the next `TrackerVersion`; no-op if unchanged from current),
  `updateMeta(id, { name?, defaultTimeMode? })`, `archive(id)`, `unarchive(id)`,
  `getVersion(trackerId, version)`. No `delete` — see ADR 0005.
- **EntryRepository**: `get`, `listByRange(start, end, opts)`, `listByTracker`,
  `listChildren(parentId)`, `create`, `update`, `softDelete`. `create` resolves
  `trackerVersion` from the target Tracker's `currentVersion` itself.
- **PresetRepository**: `listByTracker`, `get`, `create`, `update`, `delete`.
- **TagRepository**: `listAll`, `suggest(prefix)`.
- **SettingsRepository**: `get()`, `save(patch)`. The settings model includes
  `activeProfileId`, naming the active **Storage Profile**; read by `core/` at
  bootstrap to decide adapter wiring (ADR 0009), and excluded from Data Transfer's
  export bundle as device-local, non-portable state.
- **CorrelationDataSource**: `loadEntriesForScope(range, seriesScope)` — one batched read
  of Entries + children + the specific Tracker Versions they reference + Tags.
- **MaintenancePort**: `clearAll()`; `exportAll()` — a format-versioned JSON bundle of
  every live row of every aggregate plus Settings, excluding `activeProfileId`;
  `importAll(data)` — rejects a format-version mismatch outright, otherwise replaces all
  existing data with the bundle's contents, leaving `activeProfileId` untouched
  throughout (ADR 0009, `data-transfer/SPEC.md`).

All returns are the hand-written `model/` types. Ports are transport-agnostic: no
`HttpClient`, no `Observable<HttpResponse>`, no IndexedDB types leak through.
Presentation code never injects these directly — only `facades/` and feature-local
facades do (ADR 0002).

## Record invariants (every aggregate — ADR 0003)

- `id`: client-generated UUID.
- `createdAt`, `updatedAt`: ISO timestamps; `updatedAt` set on every write.
- `deletedAt`: nullable; set = soft-deleted; default reads exclude soft-deleted rows.
- `revision`: integer, incremented on every write.
- `ownerId`, `userId`: from `IdentityContext` (`dev`/`dev` in v1).

`TrackerVersion` carries the same fields for consistency but is write-once: created by
`commitDraft` and never updated or soft-deleted (`revision` is always `1`,
`deletedAt` always `null`).

## IndexedDB adapter (v1)

- One object store per aggregate, plus a `trackerVersions` store keyed by
  `(trackerId, version)`, append-only; indices for range queries on Entries
  (`start`, `parentId`, `trackerId`, `trackerVersion`) and Tag prefix search.
- Enforces the record invariants on write; honours `deletedAt` on read; `archived`
  Trackers are excluded from "creatable"/"reference-target" queries but not from direct
  `get`/`getVersion` lookups.
- No schema-version migration story needed yet (single app version); the store version
  is bumped only when indices change. (Not to be confused with **Tracker Version** —
  that's an application-level concept stored as ordinary rows, unrelated to the
  IndexedDB database's own internal version number.)

## API contract (`api-spec/`)

- TypeSpec models mirror the `model/` types 1:1, each with the ADR 0003 fields.
- Emits OpenAPI 3.0 to `api-spec/dist/openapi.yaml` (committed).
- `swagger-typescript-api` generates `data/generated/` (committed).
- CI regenerates and fails on a diff.

## Test cases (Vitest — logic only)

- Record invariants: `create` assigns a UUID, timestamps, `revision = 1`; `update` bumps
  `revision` and `updatedAt`, preserves `createdAt`; `softDelete` sets `deletedAt` and
  excludes the row from default reads but not from `get(id)`.
- `EntryRepository.listByRange`: boundary-touching Entries included; children only with
  `opts.includeChildren`; soft-deleted excluded.
- `TrackerRepository.commitDraft`: mints `currentVersion + 1` only when the Draft's
  fields differ from the current `TrackerVersion`; a no-op Draft mints nothing.
  `archive`/`unarchive` never touch `TrackerVersion` rows or existing Entries.
- `TagRepository.suggest`: prefix match, case-insensitive, ranked by frequency.
- `TrackerLookup.list()`: returns every Tracker (including archived) as `{id, name,
  archived}` only — no Fields, no Versions; reflects a rename immediately (it's
  metadata, not versioned, per ADR 0005).
- In-memory fakes in `testing/` satisfy the same contract tests as the IndexedDB adapter
  (shared test suite runs against both).
- `generated/` is import-clean and not referenced anywhere outside `adapters/http/`.
- `MaintenancePort.exportAll()` / `importAll()`: see `data-transfer/SPEC.md` for the
  full contract and test cases (excluded `activeProfileId`, format-version rejection,
  full-replace semantics).

## Out of scope

- The HTTP adapter implementation (later milestone; port surface is fixed now).
- Sync, connectivity, retry, conflict resolution beyond the LWW contract fields.
- Query language / arbitrary filtering beyond the listed port methods.
- Cross-Tracker-Version Snapshot migration and Tracker-merge tooling (ADR 0005, Later).

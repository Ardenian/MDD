# Data Access Layer — Spec

## Purpose

The shared boundary between the whole app and where data lives. Presentation code
depends only on the **port interfaces** defined here; concrete adapters are wired in
`core/` and never named by features (ADR 0002). The API contract is generated from the
`api-spec/` TypeSpec package (ADR 0004).

## Structure

```
src/app/data/
  ports/            # interfaces + DI tokens, one file per aggregate
    tracker-repository.ts
    entry-repository.ts
    preset-repository.ts
    tag-repository.ts
    settings-repository.ts
    correlation-data-source.ts
    maintenance-port.ts
  model/            # hand-written domain types re-exported for app use
  generated/        # swagger-typescript-api output — committed, never hand-edited
  adapters/
    indexeddb/      # v1 implementation of every port
    http/           # later: implementation over generated/ client
  testing/          # in-memory fakes of every port, for feature unit tests
```

## Ports (v1 surface)

- **TrackerRepository**: `list`, `get(id)`, `create(input)`, `update(id, patch)`,
  `delete(id, migrationPlan)` — delete rejected without a complete plan.
- **EntryRepository**: `get`, `listByRange(start, end, opts)`, `listByTracker`,
  `listChildren(parentId)`, `create`, `update`, `softDelete`, `migrateTracker(plan)`.
- **PresetRepository**: `listByTracker`, `get`, `create`, `update`, `delete`.
- **TagRepository**: `listAll`, `suggest(prefix)`.
- **SettingsRepository**: `get()`, `save(patch)`.
- **CorrelationDataSource**: `loadEntriesForScope(range, signalScope)` — one batched read
  of Entries + children + schemas + Tags.
- **MaintenancePort**: `clearAll()`.

All returns are the hand-written `model/` types. Ports are transport-agnostic: no
`HttpClient`, no `Observable<HttpResponse>`, no IndexedDB types leak through.

## Record invariants (every aggregate — ADR 0003)

- `id`: client-generated UUID.
- `createdAt`, `updatedAt`: ISO timestamps; `updatedAt` set on every write.
- `deletedAt`: nullable; set = soft-deleted; default reads exclude soft-deleted rows.
- `revision`: integer, incremented on every write.
- `ownerId`, `userId`: from `IdentityContext` (`dev`/`dev` in v1).

## IndexedDB adapter (v1)

- One object store per aggregate; indices for range queries on Entries
  (`start`, `parentId`, `trackerId`) and Tag prefix search.
- Enforces the record invariants on write; honours `deletedAt` on read.
- No schema-version migration story needed yet (single app version); the store version
  is bumped only when indices change.

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
- `migrateTracker(plan)`: mapped Fields move; unmapped source values persist as Orphaned
  Fields; parent/child links preserved.
- `TagRepository.suggest`: prefix match, case-insensitive, ranked by frequency.
- In-memory fakes in `testing/` satisfy the same contract tests as the IndexedDB adapter
  (shared test suite runs against both).
- `generated/` is import-clean and not referenced anywhere outside `adapters/http/`.

## Out of scope

- The HTTP adapter implementation (later milestone; port surface is fixed now).
- Sync, connectivity, retry, conflict resolution beyond the LWW contract fields.
- Query language / arbitrary filtering beyond the listed port methods.

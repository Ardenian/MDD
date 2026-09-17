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

Built: `model/`, `ports/` (all seven), `adapters/indexeddb/` (every port), `testing/`
(engine double, data-layer factory, shared contract suite), and `facades/tracker-lookup.ts`.
`adapters/http/` is still the later milestone it always was.

## Shared domain logic in `model/`

Pure, framework-free rules more than one feature applies live beside the types they are
about, rather than in either feature: `placement.ts` (`resolveCoveredInterval`, the one
definition of what an Entry covers), `field-def.ts` (`fieldsEqual`, what makes a Draft
differ from its Version), `field-values.ts` (what a Field's value may hold and when it
is valid), `value-tree.ts` (values against a schema whose reference Fields hold further
nodes — an Entry with its children, a Preset with its filled children — with the tree
operations, validation, and rebuilding a stored tree against current Versions), and
`expansion-depth.ts` (the nesting cap). The last three are used by the Entry form and the
Preset editor alike.

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
      idb-engine.ts     # the storage seam + the only code touching `indexedDB`
      record-meta.ts    # pure ADR 0003 stamping
      records.ts        # live-row filtering, creation ordering, not-found guards
      *-repository.ts   # one per port, all logic over the engine
    http/           # later: implementation over generated/ client
  testing/          # the engine double + the data-layer factory + the contract suite
```

## Shared facades (v1 surface)

- **`TrackerLookup`** (DataAccess): `list(): { id, name, archived, hasVersion }[]`, plus a derived
  `isLoading` signal. Wraps `TrackerRepository` via `resource()`, stripped to the shape
  every consumer actually needs — a name and archived-state per Tracker, nothing about
  its Fields. `hasVersion` (a committed Version exists) was added for the Calendar's
  quick-create picker: a Tracker with no Version has no schema to log against, so a
  picker that starts an Entry must not offer it. Consumed directly by Trackers' own list view, Calendar's
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
  throughout (ADR 0009, `data-transfer/SPEC.md`); `counts()` — live rows per aggregate,
  backing the confirm-before-destroy displays Settings and Data Transfer both show;
  `ensureCalendar()` — create-if-absent for the single implicit Calendar, called by
  `core/` at bootstrap and by `clearAll()`/`importAll()` when they re-seed. The Calendar
  has no port of its own precisely because nothing but these whole-database operations
  touches it.

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
  `(trackerId, version)`, append-only, and a `calendars` store for the single implicit
  Calendar.
- **The engine seam.** No repository touches `indexedDB` itself. They all talk to
  `IdbEngine`, a deliberately key-value-only interface (`getAll`/`get`/`put`/`putAll`/
  `delete`/`clear`); `BrowserIdbEngine` is the single implementation over the real
  database. Range math, soft-delete filtering and ordering therefore live in the
  repositories, in one implementation, rather than being split between an index
  definition and a predicate — which is also what lets the whole adapter be tested
  without a database (see **Test cases**). Per-aggregate indices are a performance
  optimisation available behind this same interface if a dataset ever grows enough to
  need one; v1 does not.
- Enforces the record invariants on write; honours `deletedAt` on read; `archived`
  Trackers are excluded from "creatable"/"reference-target" queries but not from direct
  `get`/`getVersion` lookups.
- Soft-deleting an Entry cascades to its children: a child is only ever reachable
  through its parent, so leaving it live would strand it. Moving an Entry likewise moves
  every descendant, since a child's placement always mirrors its parent's.
- **Writes are serialised.** Every mutating port call is a read-then-write across
  separate IndexedDB transactions, so two calls started back to back (a rename then a
  Time-mode change; a Draft edit while a commit is in flight) would both read before
  either writes, and one would silently undo the other. One `WriteQueue` per port set runs
  every write to completion before the next starts; it is shared across repositories
  because an Entry write also registers Tags and an import rewrites every store. Reads are
  not queued. A queued method never calls another queued method on the same set, or it
  would wait on itself. This covers one tab; concurrent tabs remain an open question for
  the sync milestone.
- A Day-bucketed placement covers the user's **local** calendar day, midnight to the
  day's last millisecond (intervals are boundary-inclusive, so ending at the next
  midnight would make it touch the following day too).
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
- **How the adapter is tested.** `testing/port-contract.suite.ts` is one shared contract
  suite, parameterised by a factory, stating the behaviour any implementation of these
  ports must exhibit. `testing/in-memory-data-layer.ts` runs the **real** repositories
  against `InMemoryIdbEngine` — the engine is swapped, the logic under test is not — and
  is also what feature unit tests inject in place of the ports. So there is no second,
  hand-written set of fakes to drift out of step with the adapter: the only code the
  suite cannot reach is the thin `BrowserIdbEngine` wrapper, which e2e covers by driving
  the real database. The suite takes a factory precisely so the later HTTP adapter runs
  through it unchanged.
- `generated/` is import-clean and not referenced anywhere outside `adapters/http/`.
- `MaintenancePort.exportAll()` / `importAll()`: see `data-transfer/SPEC.md` for the
  full contract and test cases (excluded `activeProfileId`, format-version rejection,
  full-replace semantics).

## Out of scope

- The HTTP adapter implementation (later milestone; port surface is fixed now).
- Sync, connectivity, retry, conflict resolution beyond the LWW contract fields.
- Query language / arbitrary filtering beyond the listed port methods.
- Cross-Tracker-Version Snapshot migration and Tracker-merge tooling (ADR 0005, Later).

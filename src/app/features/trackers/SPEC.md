# Trackers & Presets — Feature Spec

## Purpose

Let a user design and maintain their own record types (**Trackers**), evolve their
schemas safely over time via **Tracker Versions**, and author reusable pre-filled value
bundles (**Presets**). This is the schema-authoring surface; the Calendar and Entries
features consume what it produces. See [ADR 0005](../../../../docs/adr/0005-tracker-versioning.md).

## User stories / flows

- As a user I create a Tracker "Sleep", add an integer Field "Satisfaction" (optional)
  and a single-select Field "Energy" with options low/medium/high, set its default Time
  mode to Period, and **commit** — this mints "Sleep" Version 1.
- I create a Tracker "Meal" with a reference Field "Ingredients" targeting Tracker
  "Ingredient", cardinality many, and commit — "Meal" Version 1.
- I make "Meal" reference itself via an optional reference Field "Component" so a meal
  can contain a sub-meal, and commit — the designer never checks or warns about this: a
  self-reference commits exactly like any other Field. The expansion-depth cap only
  bites later, when I'm actually nesting child Entries (see `entries/SPEC.md`).
- I open "Sleep" again, rename Field "Energy" to "EnergyLevel" — this is a **Draft**;
  nothing changes for existing Entries until I commit. I commit → "Sleep" Version 2.
  Entries created under Version 1 still show "Energy"; new Entries show "EnergyLevel".
- I change "Satisfaction" from integer to decimal in a Draft and commit → "Sleep"
  Version 3. Version 1 and 2 Entries are unaffected; they keep rendering against their
  own Version.
- I rename the Tracker "Sleep" to "Sleep & Rest" and switch its default Time mode to
  Point — this does **not** create a new Version; it applies immediately and
  retroactively as metadata (every Entry, at every Version, shows the new name).
- I author a Preset "Full English" on "Meal" Version 1, with its Ingredients pre-filled.
  "Meal" later reaches Version 3; "Full English" is flagged **stale** (still pinned to
  Version 1). I can still use it to create a new Entry (which snapshots Version 3); the
  Preset itself stays stale until I open it and explicitly re-save it.
- I **archive** Tracker "Snack": it disappears from the "new Entry" Tracker picker and
  from every reference Field's target picker, but its 2 existing Entries, and its
  history, are untouched. I later unarchive it.

## Domain terms used

Tracker, Tracker Version, Draft, Archived Tracker, Field, Reference Field, Child Entry,
Preset, Snapshot, Time mode, expansion depth. See [`CONTEXT.md`](../../../../CONTEXT.md).

## Status

Built: the Tracker list, the Tracker editor (Draft editing, reorder, commit/discard,
rename, default Time mode, archive/unarchive), the Preset panel (list, stale badges,
editor with filled children, delete), the `tracker-schema` and `preset-form` pure
modules, and `TrackersDataAccess`.

## UI

The feature has **two** route components, not one: `/trackers` (list) and
`/trackers/:trackerId` (editor). Both are top-level, so both may inject a facade; the
selected Tracker arrives as a route-bound `input()`, which is what keeps
`TrackersDataAccess` a stateless DataAccess rather than something holding a selection
(ADR 0008).

- **Tracker list**: name, current Version number, Field count, Entry count, Preset
  count, archived badge; create button; archived Trackers shown in a separate,
  collapsed section, excluded from every picker elsewhere in the app. The Entry and
  Preset counts come from `EntryRepository.countsByTracker()` /
  `PresetRepository.countsByTracker()` — one read each, rather than a per-row query.
  Both are re-read every time the list is entered, because `TrackersDataAccess` is
  provided by the page component and so is built fresh per visit (ADR 0016). Entries are
  written by other features, which cannot reach this facade to invalidate it (ADR 0002),
  so a count cached across visits would otherwise be stale.
- **Tracker editor**: the feature's other top-level (route) component — with the list,
  the only place in this feature allowed to inject a facade or a `ui/` service.
  - name; default Time mode (point / period / day-bucketed) — both apply immediately,
    no commit needed
  - **Draft** Field rows, built on `ui/`'s **Reorderable list** (`cdk/drag-drop`,
    keyboard-operable — satisfies "Field reordering operable without a pointer" below
    without hand-building drag/keyboard handling): name, data type, required toggle;
    type-specific editors — a plain add/rename/remove list for authoring a select
    Field's own option set (there's nothing to pick from yet, so no `ui/` Select here);
    reference target Tracker via `ui/`'s **Select** (via `TrackerLookup`, `data/`'s
    shared facade) and cardinality via a small `ui/` **Select**
  - a visible **Draft ≠ current Version** indicator whenever the Draft differs from the
    committed schema; **Commit** action mints the next Version; **Discard draft**
    reverts to the current Version
  - **Archive** / **Unarchive** action (no confirmation flow needed — reversible, no
    data at risk)
- **Preset panel** within the Tracker editor, offered once the Tracker has a committed
  Version: list of Presets, each showing its pinned Version and a **stale** badge when
  behind current; saving a stale Preset re-pins it to the Tracker's current Version and
  clears the badge. A visually hidden live region announces how many Presets are stale,
  since the badge alone is only visual.
- **Preset editor** — inline in the panel, not a dialog, so the Tracker editor stays this
  feature's only injection point (ADR 0002) and the editor itself is presentation-only.
  It is the Entry form in "no placement" mode, built from the same shared pieces rather
  than by importing the entries feature (which `AGENTS.md` forbids): `ui/`'s **Value node
  editor** and **Nested list** over `data/model/value-tree.ts`. A Preset always opens
  against the Tracker's **current** Version — a stale Preset's values carry over by Field
  name, a value whose Field no longer exists is dropped, and saving is what re-pins it.
  - **Validation is shape-only.** A Preset is a partial pre-fill, so no Field is required;
    what *is* filled must still be the right shape (a whole number for an integer, a
    listed option for a select). The Preset needs a name. Nesting filled children honours
    the Settings expansion-depth cap, read fresh when the editor opens, because those
    children become real child Entries when the Preset is used.
  - Only covered values are stored — a value left empty is simply not part of the Preset,
    which is what makes a used Preset leave that Field empty (ADR 0005). Each filled child
    records the Version of its own Tracker it was authored against.
- All controls keyboard reachable; Field reordering and Draft/Commit operable without a
  pointer; the stale badge and Draft indicator are announced via `aria-live`.

## Data & API contract touched

- The Tracker editor injects a feature-local `TrackersDataAccess` (a stateless
  DataAccess, ADR 0008 — never the raw ports below directly) plus `TrackerLookup`
  (`data/`'s shared facade, for the reference target picker) — per ADR 0002.
  `TrackersDataAccess` wraps `resource()` around each read below and exposes
  domain-shaped signals (e.g. `trackers`, `currentDraft`) plus a derived `isLoading`
  signal; it wraps:
- `TrackerRepository`: `list`, `get(id)`, `create(input)`, `saveDraft(id, fields)`,
  `commitDraft(id)` (mints the next `TrackerVersion`, no-ops if the Draft is unchanged
  from the current Version), `updateMeta(id, { name?, defaultTimeMode? })`, `archive(id)`,
  `unarchive(id)`, `getVersion(trackerId, version)`.
- `PresetRepository`: `listByTracker`, `get`, `create`, `update`, `delete`.
- TypeSpec models: `Tracker` (header: name, defaultTimeMode, currentVersion, archived),
  `TrackerVersion` (immutable: trackerId, version, fields), `FieldDef` (discriminated by
  `dataType`), `Preset`, `PresetFieldValue`. All carry the ADR 0003 fields.
- Pure module `tracker-schema`: Field validity, option-set validity, Draft-vs-current-
  Version diff (to decide whether a commit is a no-op), Preset staleness check. The
  Tracker *designer* never checks expansion depth.
- Pure module `preset-form`: Preset validation (shape-only plus a name) and the mapping
  from an edited Preset tree to `PresetInput`. The tree operations and the expansion-depth
  rule it builds on are shared, in `data/model/` (`value-tree.ts`, `expansion-depth.ts`).
- `TrackersDataAccess` also injects `SettingsRepository`, for the expansion-depth cap the
  Preset editor honours (settings/SPEC.md: features read their own defaults).

## Test cases (Vitest — logic only)

- Field name uniqueness within a Draft; empty name rejected.
- Select Field: duplicate options rejected.
- Reference Field requires a target Tracker; self-reference allowed; cardinality
  defaults to one; committing a Draft with a self-referencing Field never checks or
  warns about expansion depth (see `entries/SPEC.md` for where the cap is enforced).
- `commitDraft`: a Draft identical to the current Version's fields does not create a new
  Version; a Draft that changes ≥1 Field creates Version `current + 1`; the new Version's
  field list matches the Draft exactly; the previous Version's stored field list is
  unchanged.
- `updateMeta` (name / defaultTimeMode) never changes `currentVersion` and is visible
  immediately across every existing Entry's display of the Tracker.
- `archive` / `unarchive`: archived Tracker excluded from "creatable" and
  "reference-target" listings; its Entries and Versions are unaffected and still
  readable.
- Preset staleness: `preset.trackerVersion < tracker.currentVersion` → stale;
  re-saving a stale Preset sets `preset.trackerVersion = tracker.currentVersion` and
  clears staleness; using a stale Preset (without re-saving) does not change its
  `trackerVersion`.
- Preset deep-copy produces an independent value tree (mutating the copy does not touch
  the Preset).

## Out of scope

- Tracker Version history/diff viewer, cross-Version Snapshot migration, Tracker
  merging, and Field-rename-lineage tracking for Correlation — one consolidated
  **Later** theme (see [ADR 0005](../../../../docs/adr/0005-tracker-versioning.md)).
- Standalone Entry linking (children are always embedded).
- Field-level permissions, computed Fields, Field descriptions/help text.
- Importing a Tracker schema from a template library.

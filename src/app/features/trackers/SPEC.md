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

## UI

- **Tracker list**: name, current Version number, Field count, Entry count, Preset
  count, archived badge; create button; archived Trackers shown in a separate,
  collapsed section, excluded from every picker elsewhere in the app.
- **Tracker editor**: the feature's top-level (route) component — the only place in
  this feature allowed to inject a facade or a `ui/` service.
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
- **Preset panel** within the Tracker editor: list of Presets, each showing its pinned
  Version and a **stale** badge when behind current; Preset editor reuses the Entry form
  (entries feature) in "no placement" mode; saving a stale Preset re-pins it to the
  Tracker's current Version and clears the badge.
- All controls keyboard reachable; Field reordering and Draft/Commit operable without a
  pointer; the stale badge and Draft indicator are announced via `aria-live`.

## Data & API contract touched

- The Tracker editor injects a feature-local `TrackersStore` (a stateful Store, built
  on `@ngrx/signals`, ADR 0008 — never the raw ports below directly) plus
  `TrackerLookup` (`data/`'s shared facade, for the reference target picker) — per ADR
  0002. Unlike a plain DataAccess, `TrackersStore` owns the in-progress **Draft** as
  patched state — accumulated Field edits persist across the whole editing session
  until the user commits (`commitDraft`) or discards it (a local state reset; nothing
  is persisted for a discarded Draft), which a stateless resource-backed wrapper can't
  represent — alongside domain-shaped signals (`trackers`, `currentVersion`,
  `currentDraft`) and a derived `isLoading` signal; it wraps:
- `TrackerRepository`: `list`, `get(id)`, `create(input)`, `saveDraft(id, fields)`,
  `commitDraft(id)` (mints the next `TrackerVersion`, no-ops if the Draft is unchanged
  from the current Version), `updateMeta(id, { name?, defaultTimeMode? })`, `archive(id)`,
  `unarchive(id)`, `getVersion(trackerId, version)`.
- `PresetRepository`: `listByTracker`, `get`, `create`, `update`, `delete`.
- TypeSpec models: `Tracker` (header: name, defaultTimeMode, currentVersion, archived),
  `TrackerVersion` (immutable: trackerId, version, fields), `FieldDef` (discriminated by
  `dataType`), `Preset`, `PresetFieldValue`. All carry the ADR 0003 fields.
- Pure module `tracker-schema`: Field validity, option-set validity, Draft-vs-current-
  Version diff (to decide whether a commit is a no-op), Preset staleness check.
  Expansion-depth computation lives in `entries/SPEC.md`'s pure modules instead — the
  Tracker designer never checks depth, so this feature has no need for it, and a
  feature must not import another feature's module.

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

# Entries — Feature Spec

## Purpose

Create and edit **Entries**: schema-driven forms, calendar placement with **Fadeout**,
embedded **child Entries**, **Tags**, and the **Snapshot** lifecycle (binding, Orphaned
Fields, rebind, Tracker-deletion migration).

## User stories / flows

- From the Calendar I pick a time and Tracker "Sleep"; a form renders one input per live
  Field (required Fields marked); I fill Satisfaction and Energy and save. Placement
  defaults to the Tracker's Time mode (Period) but I can switch it to Point.
- I add a trailing Fadeout of 1h to a Point Entry logged at 10:01 → it now covers
  10:01–11:01.
- I create a "Meal" Entry from the "Full English" Preset; the form is pre-filled,
  including three embedded "Ingredient" children; I edit one child's "grams" and save.
- I open an old "Sleep" Entry after "Energy" was renamed to "EnergyLevel"; its "Energy"
  value shows in an **Orphaned Fields** section, read-only. I click *Rebind* → pick
  "EnergyLevel" → the value moves under it. I am then asked "Apply the same rebind to 24
  other Sleep Entries?" and confirm.
- I delete Tracker "Snack" (2 Entries). The migration flow asks me to choose a target
  Tracker ("Meal") and shows a Field map seeded by `(name, dataType)`. "kcal:int" maps
  to "calories:int"; "brand:text" has no target and I leave it unmapped. On confirm the
  2 Entries move to "Meal"; "brand" values are retained as Orphaned Fields.
- I remove an "Ingredient" child from a "Meal" Entry → the child Entry is deleted.

## Domain terms used

Entry, Tracker, Field, Snapshot, Orphaned Field, Reference Field, Child Entry / parent
Entry, Preset, Point, Period, Day-bucketed, Fadeout, Time mode, Tag. See
[`CONTEXT.md`](../../../../CONTEXT.md).

## UI

- **Entry form**: header (Tracker name, Preset picker, placement editor); one control
  per bound live Field by data type; reference Fields render an embedded child-Entry
  list with add (schema or Preset) / edit / remove; Tag input with autocomplete.
- **Placement editor**: mode toggle (point / period / day-bucketed); time input(s);
  Fadeout before/after amount inputs (hidden for day-bucketed); "Now" shortcut.
- **Orphaned Fields** section: read-only value display, *Rebind* action per Field with a
  live-Field picker (only `(dataType)`-compatible targets offered), then the bulk-apply
  prompt.
- **Migration flow** (modal/route): target Tracker picker (existing or "create new"),
  Field-map table (source Field → target Field select, seeded matches pre-selected),
  unmapped list with "retained as Orphaned" note, confirm/cancel.
- Child Entry editor is the same form in embedded mode: no placement editor (placement
  mirrors parent), depth breadcrumb, block save if a required reference cannot be added
  because the expansion-depth cap is hit.
- Full keyboard support; focus moves into the form on open and returns to the trigger on
  close; validation errors linked via `aria-describedby`; Orphaned section is a landmark.

## Data & API contract touched

- `EntryRepository`: `get`, `listByRange`, `listByTracker`, `listChildren`, `create`,
  `update`, `softDelete`, `migrateTracker(plan)`.
- `TagRepository`: `suggest(prefix)`, `listAll`.
- Reads `TrackerRepository` / `PresetRepository` for live schema and Preset values.
- Pure modules:
  - `snapshot-binding` — bind Snapshot Fields to a live schema by `(name, dataType)`;
    classify each as bound / orphaned; compute empty live Fields. (ADR 0001)
  - `fadeout` — resolve a placement + Fadeout to an absolute covered interval.
  - `migration-plan` — seed and validate a source→target Field map; compute retained
    Orphaned Fields.
- TypeSpec models: `Entry`, `Placement` (discriminated), `Fadeout`, `SnapshotField`,
  `EntryTag`, `MigrationPlan`. ADR 0003 fields on `Entry`.

## Test cases (Vitest — logic only)

- Binding: exact `(name, dataType)` match binds; name-only mismatch → orphaned;
  type-only mismatch → orphaned; single vs multi select mismatch → orphaned; stored
  select value absent from current options → orphaned.
- Bulk rebind: given a rebind on one Entry, the set of other Entries with the matching
  Orphaned Field is computed correctly (same Tracker, same `(name, dataType)`).
- Empty live Field detection when the schema gains a Field.
- Fadeout: Point 10:01 +1h trailing → [10:01, 11:01]; Period 09:02–10:03 with 30m/60m →
  [08:32, 11:03]; day-bucketed → whole day, no Fadeout permitted.
- Placement override: Entry Time mode independent of Tracker default; changing the
  Tracker default does not mutate stored Entries.
- Child Entry: placement always equals parent's; removing from the reference Field marks
  the child `softDelete`; child cannot be re-parented (API rejects).
- Required reference unsatisfiable at depth cap → form invalid → `create` rejected.
- Migration plan: seeded matches by `(name, dataType)`; unmapped source Fields appear as
  retained Orphaned Fields on migrated Entries; target Entry count increases; source
  Tracker delete only proceeds with a complete plan.
- `softDelete` sets `deletedAt`; subsequent `listByRange` excludes it; `revision` bumps
  on every `update`.

## Out of scope

- Recurring Entries.
- Bulk edit of many Entries at once (beyond the rebind bulk-apply).
- Attachments / photos on Entries.
- Undo history beyond soft delete.

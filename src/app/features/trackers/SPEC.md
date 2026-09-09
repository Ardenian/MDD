# Trackers & Presets — Feature Spec

## Purpose

Let a user design and maintain their own record types (**Trackers**) and reusable
pre-filled value bundles (**Presets**). This is the schema-authoring surface; the
Calendar and Entries features consume what it produces.

## User stories / flows

- As a user I create a Tracker "Sleep", add an integer Field "Satisfaction" (optional)
  and a single-select Field "Energy" with options low/medium/high, and set its default
  Time mode to Period.
- I create a Tracker "Meal" with a reference Field "Ingredients" targeting Tracker
  "Ingredient", cardinality many.
- I make "Meal" reference itself via an optional reference Field "Component" so a meal
  can contain a sub-meal; the designer warns that this can build an infinite form but
  lets me save.
- I rename Field "Energy" to "EnergyLevel"; existing Entries' Snapshot Fields named
  "Energy" become Orphaned (handled in the entries feature).
- I change "Satisfaction" from integer to decimal; the designer warns that every
  existing Entry's "Satisfaction" value will become Orphaned.
- I author a Preset "Full English" on "Meal" with its Ingredients pre-filled.
- I later add a required Field to "Meal"; the "Full English" Preset shows a drift badge
  listing what no longer matches the schema.
- I delete Tracker "Snack"; I am sent into the guided migration flow (entries feature)
  before the delete completes.

## Domain terms used

Tracker, Field, Reference Field, Child Entry, Preset, Snapshot, Orphaned Field, Time
mode, expansion depth. See [`CONTEXT.md`](../../../../CONTEXT.md).

## UI

- **Tracker list**: name, Field count, Entry count, Preset count; create button.
- **Tracker editor**:
  - name; default Time mode (point / period / day-bucketed)
  - Field rows, reorderable: name, data type, required toggle; type-specific editors —
    select options list (add/rename/remove); reference target Tracker + cardinality
  - destructive-change warnings inline (type change, Field remove, option remove) naming
    the count of Entries whose Snapshot Fields will orphan
  - delete Tracker → confirm → guided migration
- **Preset panel** within the Tracker editor: list of Presets; Preset editor reuses the
  Entry form (entries feature) in "no placement" mode; drift badge with a per-Field diff.
- All controls keyboard reachable; select-option and Field reordering operable without a
  pointer; warnings are `role="alert"`.

## Data & API contract touched

- `TrackerRepository`: `list`, `get`, `create`, `update`, `delete` (delete is rejected
  by the port unless caller passes a resolved migration plan).
- `PresetRepository`: `listByTracker`, `get`, `create`, `update`, `delete`.
- TypeSpec models: `Tracker`, `Field` (discriminated by `dataType`), `ReferenceFieldConfig`,
  `Preset`, `PresetValue`. All carry the ADR 0003 fields.
- Pure module `tracker-schema`: Field validity, option-set validity, self/rec reference
  detection, expansion-depth computation, Preset-vs-schema diff.

## Test cases (Vitest — logic only)

- Field name uniqueness within a Tracker; empty name rejected.
- Select Field: duplicate options rejected; removing an option is reported as a
  breaking change.
- Reference Field requires a target Tracker; self-reference allowed; cardinality
  defaults to one.
- Expansion depth: linear chain depth counted correctly; a cycle is detected and
  reported (not thrown); depth cap from settings respected.
- Infinite-form warning fires for a cyclic reference graph but does not block save.
- Preset diff: added required live Field → drift; removed live Field → drift; type
  change → drift; matching schema → no drift.
- Preset deep-copy produces an independent value tree (mutating the copy does not touch
  the Preset).
- `delete` via `TrackerRepository` without a migration plan is rejected.

## Out of scope

- Standalone Entry linking (children are always embedded — see feature-scope "Later").
- Field-level permissions, computed Fields, Field descriptions/help text.
- Importing a Tracker schema from a template library.

# Entry Snapshots bind to the live Tracker schema by (name, dataType)

> **Status: superseded by [ADR 0005](./0005-tracker-versioning.md).** Kept for history —
> the live-binding/Orphaned-Field model described below was replaced by Tracker
> Versioning before any code was built against it.

## Context

Every Entry stores a Snapshot of its Tracker's schema and the values entered against it,
so that editing a Tracker never silently rewrites history. But a Snapshot that is fully
frozen and disconnected makes ordinary schema maintenance (rename a Field, fix a typo,
add an option) destroy the link between past Entries and the Tracker they belong to,
which breaks the Calendar, Presets, and Correlation.

## Decision

A Snapshot is not frozen-and-detached. Each Snapshot Field **binds** to a live Tracker
Field whenever their **name and data type match exactly** — for select types, the
selection mode (single/multi) must also match and every stored value must be among the
Field's current options. Renaming or deleting a Field, or changing its type or options,
re-runs this match:

- A Snapshot Field with no matching live Field becomes an **Orphaned Field**: read-only,
  still shown, still stored. The user may **rebind** it to a chosen live Field, and is
  then offered to apply the same rebind to every other Entry of that Tracker with the
  matching Orphaned Field.
- A live Field with no matching Snapshot Field shows as empty on that Entry.

Deleting a Tracker is therefore not "detach its Entries" but a guided migration to
another Tracker (see the entries spec): the same `(name, dataType)` match seeds the
Field mapping, and unmapped source values are retained as Orphaned Fields.

## Considered options

- **Immutable, detached Snapshots.** Rejected: any schema edit permanently severs past
  Entries from their Tracker.
- **Stable per-Field IDs, names/types mutable.** Rejected: the user's model is
  name-and-type based ("if the names and types match, it's the same Field"); stable IDs
  would keep a Field bound through a rename to something semantically different, which is
  the opposite of what the user wants, and they were explicit that the match must be
  "very strict".

## Consequences

- Binding is derived state, recomputed from `(name, dataType)` on every relevant read;
  it is never persisted as a Field-to-Field pointer.
- The binding function is pure and is the single most test-critical unit in the app.
- "Orphaned" is a first-class UI state everywhere Entry values are shown or edited.

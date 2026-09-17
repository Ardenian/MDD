# Entries — Feature Spec

## Purpose

Create and edit **Entries**: schema-driven forms, calendar placement with **Fadeout**,
embedded **child Entries**, **Tags**, and the pinned-**Snapshot** lifecycle. See
[ADR 0005](../../../../docs/adr/0005-tracker-versioning.md) — an Entry always snapshots
the Tracker's current **Tracker Version** at creation and renders from it forever.

## Status

Built: the `fadeout` and `entry-form` pure modules, `EntriesDataAccess`,
the Entry form dialog with its placement editor and embedded-child editing, and the route
that opens it. Creating an Entry *from the Calendar* arrives with the Calendar; until then
the form is reached by URL, which is also how the Calendar will open it (see **UI**).

## User stories / flows

- From the Calendar I pick a time and Tracker "Sleep" (currently Version 3); a form
  renders one input per Version 3 Field (required Fields marked); I fill Satisfaction
  and Energy and save. The Entry now permanently references "Sleep" Version 3. Placement
  defaults to the Tracker's Time mode (Period) but I can switch it to Point.
- I add a trailing Fadeout of 1h to a Point Entry logged at 10:01 → it now covers
  10:01–11:01.
- I create a "Meal" Entry from the "Full English" Preset (pinned to Meal Version 1,
  while Meal is now at Version 3); the form pre-fills from the Preset's values, then
  renders any Version 3 Field the Preset didn't cover as empty, including three embedded
  "Ingredient" children; I edit one child's "grams" and save. The Entry (and each child)
  snapshots the *current* Version of its own Tracker.
- I open an Entry logged against "Sleep" Version 1 (before "Energy" was renamed to
  "EnergyLevel" in Version 2). It still renders "Energy" exactly as filled in — the form
  is read against Version 1's schema, not today's. Nothing is orphaned; nothing needs
  rebinding.
- I remove an "Ingredient" child from a "Meal" Entry → the child Entry is deleted.
- I try to add a required self-referencing child but the expansion-depth cap is already
  reached → the field is flagged invalid and I cannot save until I remove a level. This
  is the only place the cap applies — the Tracker Draft/commit that created this
  self-reference never checked or warned about it (see `trackers/SPEC.md`), and the same
  check applies identically to a non-self-referencing chain across distinct Trackers.

## Domain terms used

Entry, Tracker, Tracker Version, Field, Snapshot, Reference Field, Child Entry / parent
Entry, Preset, Point, Period, Day-bucketed, Fadeout, Time mode, Tag. See
[`CONTEXT.md`](../../../../CONTEXT.md).

## UI

- **How the form is opened.** This feature owns a lazy route in the app shell's `modal`
  router outlet: `/…(modal:entry/new)?trackerId=…&at=…&presetId=…` for a new Entry,
  `/…(modal:entry/<entryId>)` for a saved one. The Calendar opens the form by
  *navigating* there, never by importing this feature (which `AGENTS.md` forbids); the
  primary route stays rendered underneath, and an open form is addressable by URL. The
  route component (`EntryFormRoute`) is the top-level component that injects
  `DialogService`/`ToastService`; closing the form closes the outlet.
- **Entry form**: rendered inside a dialog `DialogService` opens, with `ui/`'s **Modal**
  as its chrome — focus moving into the form on open and back to the trigger on close
  comes from `cdk/dialog` underneath, not from hand-built behavior. The form component
  itself (`EntryFormDialog`) is where `EntriesDataAccess` is injected; the tree being
  edited is its own working state.
  - header (Tracker name + current Version badge, Preset picker, placement editor)
  - one control per Field of the Tracker's **current** Version (or, for an existing
    Entry being viewed, its **pinned** Version): single/multi-select Fields render as
    `ui/`'s **Select** / **Multiselect** (`@angular/aria`)
  - reference Fields render an embedded child-Entry list via `ui/`'s **Nested list**
    (native nested lists — see `ui/SPEC.md` for why not `cdk/tree`) with add / edit /
    remove; each child names the reference Field it belongs to, its depth against the
    cap, and the Tracker Version it pins to
  - a **Delete Entry** action on a saved Entry (soft delete, cascading to its children)
  - Tag input via `ui/`'s **Combobox** (`@angular/aria`), autocompleting against
    `EntriesDataAccess`'s Tag suggestions — each child Entry gets its own Tag input,
    entered independently and never inherited from or synced with the parent's Tags
- **Placement editor**: mode toggle (point / period / day-bucketed); time input(s);
  Fadeout before/after amount inputs (hidden for day-bucketed); "Now" shortcut.
- Viewing an existing Entry shows a small **"Tracker Version N"** label so the user
  understands why an old Entry's fields may differ from the current designer — no
  interaction, just orientation (the full history browser is a Later item).
- Child Entry editor is the same form in embedded mode: no placement editor (placement
  mirrors parent), depth breadcrumb, block save if a required reference cannot be added
  because the expansion-depth cap is hit.
- Full keyboard support; focus moves into the form on open and returns to the trigger on
  close (via Modal/`DialogService`); validation errors linked via `aria-describedby`.

## Data & API contract touched

- The Entry form injects a feature-local `EntriesDataAccess` (a stateless DataAccess,
  ADR 0008 — never the raw ports below directly) plus `TrackerLookup` (`data/`'s
  shared facade, for Preset/Tracker naming in the header) — per ADR 0002.
  `EntriesDataAccess` wraps `resource()` around each read below and exposes
  domain-shaped signals plus a derived `isLoading` signal; it wraps:
- `EntryRepository`: `get`, `listByRange`, `listByTracker`, `listChildren`, `create`,
  `update`, `softDelete`. `create` resolves `trackerVersion` itself from the target
  Tracker's `currentVersion` at call time — callers never pass it.
- `TagRepository`: `suggest(prefix)`, `listAll`.
- Reads `TrackerRepository.getVersion(trackerId, version)` to render an Entry's own
  pinned Version, and the Tracker header (`currentVersion`) to render a fresh form.
- Reads `PresetRepository` for Preset values.
- **How children are stored.** A reference Field's Snapshot value is the ordered list of
  its child Entries' ids — that is what says which reference Field a child belongs to when
  a Tracker has more than one. Saving is one pass over the form's tree: a new child is
  created under its (by then saved) parent, then the parent's Snapshot is written with its
  children's ids; a child removed from the form is soft-deleted.
- The expansion-depth cap is read from `SettingsRepository` **each time a form opens**,
  not once per app session, so lowering it in Settings applies the next time the user
  nests.
- Pure modules:
  - `fadeout` — resolve a placement + Fadeout to an absolute covered interval.
  - `entry-form` — what makes a value-tree node an *Entry* (its saved id and its own
    Tags), requiring every required Field, and the Snapshot mapping.
  - The tree itself — building values against a `TrackerVersion` independent of which
    Version is current vs. pinned, adding/removing children, validation, rebuilding a
    Preset against the current Version — is shared with the Preset editor, so it lives in
    `data/model/value-tree.ts`.
  - `expansion-depth` (also in `data/model/`, for the same reason) — given realised child
    nesting and the Settings-configured cap, determines whether one more level is allowed;
    treats a self-referencing chain and a chain across distinct Trackers identically (only
    the actual realized nesting depth matters, not the schema shape). It gates the Entry
    form and Preset authoring alike.
- The node editor (Fields, reference Fields, child header) is `ui/`'s **Value node
  editor**; the Entry form projects its Tags input into it. Its labels and the value
  problem messages live in the `common` translation namespace (`valueTree.*`), since both
  features show them.
- TypeSpec models: `Entry` (`trackerId`, `trackerVersion`, `parentEntryId`, `placement`,
  `snapshot: SnapshotField[]`, `tags`), `Placement` (discriminated), `Fadeout`,
  `SnapshotField` (`fieldName`, `value` — no `dataType`, per ADR 0005 Q11: schema is
  looked up from the pinned Version, never duplicated onto the Entry). ADR 0003 fields
  on `Entry`.

## Test cases (Vitest — logic only)

- `create` stamps `trackerVersion` = the target Tracker's `currentVersion` at call time,
  never a caller-supplied value.
- Rendering an Entry always resolves its form against `(trackerId, entry.trackerVersion)`
  — never against the Tracker's current version — so an old Entry is unaffected by
  schema changes made after it was created.
- Fadeout: Point 10:01 +1h trailing → [10:01, 11:01]; Period 09:02–10:03 with 30m/60m →
  [08:32, 11:03]; day-bucketed → whole day, no Fadeout permitted.
- Placement override: Entry Time mode independent of Tracker default; changing the
  Tracker default does not mutate stored Entries or their `trackerVersion`.
- Child Entry: placement always equals parent's; removing from the reference Field marks
  the child `softDelete`; child cannot be re-parented (API rejects); a child's
  `trackerVersion` is resolved independently from its own target Tracker's current
  Version, which may differ from the parent's.
- Required reference unsatisfiable at depth cap → form invalid → `create` rejected;
  identical whether the chain is self-referencing or crosses distinct Trackers.
- A child Entry's Tags are independent of its parent's — no inheritance either
  direction.
- Creating an Entry from a Preset copies the Preset's values regardless of the Preset's
  own `trackerVersion`, then snapshots at the *current* Tracker Version; any Field the
  Preset didn't cover renders empty; any Field the Preset covers that the current
  Version no longer has is dropped from the copy.
- `softDelete` sets `deletedAt`; subsequent `listByRange` excludes it; `revision` bumps
  on every `update`.

## Out of scope

- Cross-Tracker-Version Snapshot migration (Later — [ADR 0005](../../../../docs/adr/0005-tracker-versioning.md)).
- Child-Entry drag-and-drop reordering within a reference Field — v1 keeps creation
  order only (Later — see `feature-scope.md`).
- Recurring Entries.
- Bulk edit of many Entries at once.
- Attachments / photos on Entries.
- Undo history beyond soft delete.

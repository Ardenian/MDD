# Field declarations are Tracker metadata, not versioned Field schema

## Context

Two Correlation features need per-Field configuration: opting a numeric Field into a
per-Bucket total (`sum`), and declaring what an unlogged Bucket means for a Field
(`baseline`). The obvious home is `FieldDef`, since both are plainly *about* a Field.

But `FieldDef` lives on `TrackerVersion`, which is immutable and pinned per Entry (ADR
0005). Putting a declaration there has two problems. Changing one would mint a new
Tracker Version — splitting the Field's Series history in two (`correlation-guide.md`,
§4) purely because the user described what their own data means. And a declaration made
today has to apply when reading Entries logged under *older* Versions, which an
Entry-pinned property cannot do: the old Entries would keep reading against a Version
that never carried the declaration.

## Decision

Declarations live on the `Tracker` header as `fieldDeclarations`, keyed by Field name —
the same category as `name` and `defaultTimeMode`, which ADR 0005 already calls
"metadata, not schema". Setting one never mints a Tracker Version. They are written
through a dedicated `TrackerRepository.setFieldDeclaration(id, fieldName, declaration)`,
where `null` clears one, rather than through `updateMeta`'s flat merge.

The property is optional: absent means no declarations, which keeps every existing
Tracker fixture and construction site valid without a churn edit each.

Because they key by Field *name*, renaming a Field orphans its declaration — exactly as
a rename already orphans that Field's Series history. No special-casing; it falls out of
rules that already exist.

## Considered options

- **A property on `FieldDef`, excluded from `fieldEquals`** so it wouldn't mint a
  Version. Rejected: data sitting inside an immutable, Entry-pinned record while being
  deliberately invisible to the equality check that defines that record's identity is a
  trap for whoever reads it next.
- **`correlation-preferences.ts` (localStorage), alongside scan scope and pinned pairs.**
  Rejected: that store is per-browser and outside Data Transfer's export (ADR 0009), but
  a declaration states what a Field *means* — it has to travel with the data, not with
  the device that happened to author it.

## Consequences

- `EXPORT_FORMAT_VERSION` is bumped to 2: `Tracker`'s shape changed, and an import of a
  mismatched version is rejected outright rather than partially restored (ADR 0009).
- A declaration is read at scan time, so it applies retroactively across every Tracker
  Version an Entry might be pinned to — which is the point.
- Select-option baselines are not implemented in the first pass: one declared option has
  to zero-fill every *sibling* option's Series, which the per-option accumulators in
  `series-extraction.ts` cannot see from where they run. Boolean and numeric Fields are
  supported; select is a follow-up.

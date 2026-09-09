# Trackers are versioned; Snapshots pin to a Tracker Version

> Supersedes [ADR 0001](./0001-snapshot-binds-to-live-schema.md).

## Context

ADR 0001 tried to keep Entries connected to a Tracker's *current* schema by re-binding
Snapshot Fields to live Fields on every read, matching by `(name, dataType)`. In
practice this meant an Entry's rendering depended on the live state of a Tracker that
could keep changing under it — a rename, a type change, or an option edit could silently
flip a Field between bound and Orphaned, and "Orphaned Field" had to be handled
everywhere an Entry's values are shown or edited. Editing a Tracker was effectively
mutating history.

## Decision

A Tracker no longer has one live, mutable schema. It has a name, a default Time mode,
and a sequence of immutable, sequentially numbered **Tracker Versions**, each holding a
complete Field schema. Editing a Tracker's Fields happens in a **Draft**; nothing is
visible to Entries or Presets until the user explicitly commits it, which mints the next
Tracker Version. Renaming the Tracker or changing its default Time mode is metadata, not
schema — it does not version.

Every Entry (and Preset) records exactly which Tracker Version it was created against
and always uses the **current** Version at creation time — there is no way to
deliberately log something "as of an old Version." A Reference Field's target is the
Tracker, not a Version; a child Entry created through it resolves to whatever Version is
current when that child is created, by the same rule as any other Entry.

A Snapshot therefore stores **values only**, keyed by Field name. Its schema — types,
required-ness, options — is looked up from the immutable `(trackerId, version)` record
it points at, which is never deleted. Rendering an old Entry never needs to consult, or
reconcile against, whatever the Tracker looks like today. **Orphaned Field is
eliminated**: there is nothing to bind, so nothing can fail to bind.

A Preset pins to the Tracker Version it was authored against and is flagged **stale**
once the Tracker moves past it (`preset.trackerVersion < tracker.currentVersion`). A
stale Preset still works when used — its values simply copy into a new Entry snapshotted
at the *current* Version, per the rule above — but the Preset record itself stays stale
until the user explicitly reviews and re-saves it. Auto-repinning on use was considered
and rejected: it would quietly hide the fact that the Preset no longer matches the
schema, defeating the point of flagging it.

Because Entries no longer need to be rescued from a schema they no longer match, a
Tracker is never force-migrated on removal. "Deleting" a Tracker is **archiving**: hidden
from every "create new" and reference-target picker, but the record and all its Versions
persist, so existing Entries and existing children referencing it are unaffected. This
also retires the guided Tracker-deletion migration flow and its Orphaned-Field retention
behavior from ADR 0001 entirely.

## Considered options

- **Live-binding by `(name, dataType)`** (ADR 0001). Rejected for the reasons above:
  editing a Tracker could change how past Entries render, and "Orphaned Field" had to be
  a first-class state everywhere.
- **Stable per-Field IDs on a single mutable schema.** Rejected for the same reason ADR
  0001 rejected it: a rename would keep old Snapshots silently attached to a
  semantically different Field.
- **Auto-repin Presets on use.** Rejected: hides drift instead of surfacing it.

## Consequences

- Tracker Versions are immutable and retained forever — no pruning, no cross-version
  migration, no version-history UI in v1. All three, plus unifying a Field's rename
  lineage across Versions for Correlation, plus a deliberate Tracker-merge feature
  (e.g. consolidating "Water" into "Liquid"), are one consolidated **Later** theme: this
  is the same class of problem ADR 0001 was solving, and it's better solved once,
  later, with the full versioned history available to work from — not re-solved
  piecemeal now.
- Correlation Signals are keyed per exact `(Tracker, Field name, dataType)` as each
  Tracker Version defines it; a rename across Versions splits history into two Signals
  until the Later work above lands.
- The `TrackerRepository` port and the `Tracker`/`Entry`/`Preset` API models change
  shape: `Tracker` becomes a header (`name`, `defaultTimeMode`, `currentVersion`,
  `archived`) over a `TrackerVersion` collection; `Entry.trackerVersion` and
  `Preset.trackerVersion` are added; `MigrationPlan`/`FieldMapping` and the
  `migrateTracker` operation are removed.

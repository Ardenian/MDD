# Feature Scope

The single source of truth for what the Diary Calendar app does, does not yet do, and
will never do. Every in-scope v1 item links to the `SPEC.md` that specifies it. Domain
terms are defined in [`CONTEXT.md`](../CONTEXT.md).

## Product in one paragraph

A frontend-only Angular diary. Users design their own **Trackers** (named schemas of
typed **Fields**, including references to other Trackers), then log **Entries** onto a
**Calendar** as **Point / Period / Day-bucketed** placements with **Fadeout** uncertainty
margins. Each Entry keeps a **Snapshot** that binds back to its live Tracker. A separate
**Correlation** page mines the data for time-lagged relationships between **Signals**.
All data lives in the browser (IndexedDB) behind a shared data-access layer; a backend
can replace that later without touching features.

---

## In scope — v1

### Tracker designer — [`src/app/features/trackers/SPEC.md`](../src/app/features/trackers/SPEC.md)
- Create, rename, delete Trackers (delete triggers guided Entry migration)
- Add / rename / remove / reorder Fields; 8 data types: text, long text, integer,
  decimal, boolean, single-select, multi-select, reference
- Per-Field: required/optional; select options; reference target Tracker + cardinality
  (one / many); self-reference allowed
- Default Time mode per Tracker
- Expansion-depth cap on reference chains; infinite-form warning (non-blocking)
- Preset drift indicator when a schema change diverges a Preset

### Presets — [`src/app/features/trackers/SPEC.md`](../src/app/features/trackers/SPEC.md)
- Author zero or more Presets per Tracker, including filled child Entries
- Deep-copy a Preset into a new Entry's Snapshot; fully editable afterward
- Editing a Preset never changes Entries already made from it

### Entries — [`src/app/features/entries/SPEC.md`](../src/app/features/entries/SPEC.md)
- Schema-driven create/edit form from a Tracker's live schema or a Preset
- Placement: Point / Period / Day-bucketed, with leading/trailing Fadeout on Point and
  Period; per-Entry Time-mode override
- Embedded child-Entry editing for reference Fields; child placement locked to parent;
  removing a child deletes it; entries cannot be re-parented
- Tags with free text + autocomplete from existing Tags
- Snapshot binding by `(name, dataType)`; Orphaned Fields shown read-only
- Manual rebind of an Orphaned Field, with bulk-apply to other Entries of the Tracker
- Guided Tracker-deletion migration: map source Fields to a target Tracker's Fields
  (seeded by `(name, dataType)`), unmapped values retained as Orphaned Fields

### Calendar — [`src/app/features/calendar/SPEC.md`](../src/app/features/calendar/SPEC.md)
- Day view (vertical time grid) and Week view
- Point / Period drawn to scale; Fadeout rendered as a falloff band; Day-bucketed items
  in a day header strip
- Per-Tracker on/off toggles
- Child-Entry filter (hidden by default; shown at parent's placement when enabled)
- "Now" button to create a Point Entry at the current time
- Open an Entry to view/edit (children embedded)

### Correlation — [`src/app/features/correlation/SPEC.md`](../src/app/features/correlation/SPEC.md)
- Client-side, explicitly triggered Discovery scan over in-scope Signal pairs
- Signal extraction: numeric Field value; Tracker occurrence count; boolean/select
  state; nested child-Entry Field (numeric or presence), arbitrary depth; Tag presence
- Buckets: hour / day / week / month; Entry contributes to every Bucket it touches;
  Fadeout as linearly weighted partial membership
- Methods by pairing: Spearman (numeric×numeric), point-biserial (numeric×binary),
  Cramér's V (categorical); effect size + n + p-value
- User-set Lag range with a recommended default; best-Lag result reported with zero-Lag
- Discovery ranked list + Directed view (shared zoomable time axis + scatter)
- User-configurable guardrails: minimum n, p-value threshold, Benjamini–Hochberg
  correction on/off; standing "association, not causation" caveat
- Page-level date-range scope and Signal-scope selection

### Settings — [`src/app/features/settings/SPEC.md`](../src/app/features/settings/SPEC.md)
- Default Bucket size, default Lag range, default guardrail thresholds
- Expansion-depth cap value
- Data reset (clear local database)

### Platform — [`src/app/core/SPEC.md`](../src/app/core/SPEC.md) · [`src/app/data/SPEC.md`](../src/app/data/SPEC.md)
- Shared data-access ports + IndexedDB adapter; adapter wiring in `core/`
- Offline-first record fields on every aggregate: client UUID, `createdAt` /
  `updatedAt` / `deletedAt` (soft delete), `revision`, `ownerId` / `userId` = `dev`
- Single implicit Calendar
- Service-worker app-shell caching (loads offline on repeat visits)
- TypeSpec `api-spec/` package; committed OpenAPI + generated client
- Responsive layout; WCAG AA, AXE-clean; keyboard and focus management

---

## Later — documented, not built

- Backend adapter + sync engine (last-write-wins by `updatedAt`)
- Real authentication
- Calendar sharing and invites; multi-user contribution UI
- Multiple Calendars per Owner + switcher
- Month calendar view
- Recurring Entries
- Installable-PWA polish (install prompt, icons, update flow)
- Standalone Entry linking as an alternative to embedded children
- Richer per-Field value visualisations (rating stars, gauges, etc.)
- Deeper correlation: automatic lag recommendation from data, partial correlation,
  controlling for confounders
- Integration and end-to-end test suites for UI and interaction

---

## Out of scope — not planned

- Native mobile apps
- Data import / export
- Notifications and reminders
- AI/ML-generated insights beyond the stated statistics
- Server-side rendering

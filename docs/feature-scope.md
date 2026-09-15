# Feature Scope

The single source of truth for what the Diary Calendar app does, does not yet do, and
will never do. Every in-scope v1 item links to the `SPEC.md` that specifies it. Domain
terms are defined in [`CONTEXT.md`](../CONTEXT.md).

## Product in one paragraph

A frontend-only Angular diary. Users design their own **Trackers** — each a name plus a
sequence of immutable, versioned Field schemas (**Tracker Versions**) — then log
**Entries** onto a **Calendar** as **Point / Period / Day-bucketed** placements with
**Fadeout** uncertainty margins. Each Entry keeps a **Snapshot** pinned to the exact
Tracker Version it was created against, so it renders correctly forever regardless of
later schema changes. A separate **Correlation** page mines the data for time-lagged
relationships between **Series**. Data lives behind a shared data-access layer under a
**Storage Profile** setting that names where it's stored; v1 ships one Storage Profile,
**Offline** (the browser's IndexedDB) — a backend-backed Profile can replace or join it
later without touching features. See [ADR 0009](adr/0009-storage-profile-and-data-transfer.md).

---

## In scope — v1

### Tracker designer — [`src/app/features/trackers/SPEC.md`](../src/app/features/trackers/SPEC.md)
- Create Trackers; rename a Tracker or change its default Time mode in place (no new
  Tracker Version)
- Edit Fields in a Draft; committing a Draft that changed ≥1 Field mints the next
  **Tracker Version** (sequential integer, starting at 1)
- Add / rename / remove / reorder Fields in the Draft; 8 data types: text, long text,
  integer, decimal, boolean, single-select, multi-select, reference
- Per-Field: required/optional; select options; reference target Tracker + cardinality
  (one / many); self-reference allowed — no depth check at Draft/commit time, even for a
  self-reference; the expansion-depth cap is enforced only when Entries are created (see
  Entries below)
- Archive / unarchive a Tracker (hidden from "create new" and reference-target pickers;
  record and every Tracker Version kept; no migration)
- Preset staleness indicator when the Tracker has moved past a Preset's pinned Version

### Presets — [`src/app/features/trackers/SPEC.md`](../src/app/features/trackers/SPEC.md)
- Author zero or more Presets per Tracker, pinned to a Tracker Version, including
  filled child Entries
- Deep-copy a Preset into a new Entry's Snapshot (snapshotted at the Tracker's current
  Version); fully editable afterward
- Editing a Preset never changes Entries already made from it
- A stale Preset (pinned Version < current Version) still works when used; clearing
  the stale flag requires an explicit re-save

### Entries — [`src/app/features/entries/SPEC.md`](../src/app/features/entries/SPEC.md)
- Schema-driven create/edit form from a Tracker's current Version or a Preset
- Placement: Point / Period / Day-bucketed, with leading/trailing Fadeout on Point and
  Period; per-Entry Time-mode override
- Embedded child-Entry editing for reference Fields; child placement locked to parent;
  removing a child deletes it; entries cannot be re-parented; nesting is capped at the
  expansion-depth limit (Settings-configurable, default 5) — enforced here, not at
  Tracker Draft/commit time; children keep creation order (no reordering in v1)
- Tags with free text + autocomplete from existing Tags; a child Entry's Tags are its
  own, never inherited from its parent
- Every Entry pins to the Tracker Version current at its creation; renders from that
  Version forever, independent of later Tracker changes

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
- Series extraction: numeric Field value; Tracker occurrence count; boolean/select
  state; nested child-Entry Field (numeric or presence), arbitrary depth; Tag presence
  (including child Entries)
- Buckets: hour / day / week / month; Entry contributes to every Bucket it touches;
  Fadeout as linearly weighted partial membership
- Methods by pairing: Spearman (numeric×numeric), point-biserial (numeric×binary);
  effect size + n + p-value
- User-set Lag range with a recommended default; best-Lag result reported with zero-Lag
- Discovery ranked list + Directed view (shared zoomable time axis + scatter)
- Series overlay: pick one or more Trackers, toggle their Series (default: all on),
  view them together on the shared time axis with no correlation math — the only way to
  inspect Series outside a Discovery-scan row
- User-configurable guardrails: minimum n, p-value threshold, Benjamini–Hochberg
  correction on/off; standing "association, not causation" caveat
- Page-level date-range scope and Series-scope selection

### Settings — [`src/app/features/settings/SPEC.md`](../src/app/features/settings/SPEC.md)
- Default Bucket size, default Lag range, default guardrail thresholds
- Expansion-depth cap value (default 5)
- Storage Profile display: v1 ships exactly one, **Offline**; selecting a Profile
  requires an app reload (ADR 0009)
- Data reset (clear local database)

### Data Transfer — [`src/app/features/data-transfer/SPEC.md`](../src/app/features/data-transfer/SPEC.md)
- Export the active Storage Profile's entire dataset (every Tracker, Tracker Version,
  Entry, Preset, Tag, plus Settings) to one format-versioned JSON file
- Import: full replace only, confirm-by-typing guard showing current record counts;
  rejects a format-version mismatch outright, with no partial import
- The v1 mitigation for local-only storage's durability gap, and the anticipated path
  for moving data between Storage Profiles later (ADR 0009)

### Platform — [`src/app/core/SPEC.md`](../src/app/core/SPEC.md) · [`src/app/data/SPEC.md`](../src/app/data/SPEC.md) · [`src/app/ui/SPEC.md`](../src/app/ui/SPEC.md)
- Shared data-access ports + IndexedDB adapter; adapter wiring in `core/`, resolved from
  the active Storage Profile at bootstrap (ADR 0009)
- Presentation never injects a raw port — only feature-local or shared facades
  (`data/`), and only from a feature's top-level component (ADR 0002)
- Offline-first record fields on every aggregate: client UUID, `createdAt` /
  `updatedAt` / `deletedAt` (soft delete), `revision`, `ownerId` / `userId` = `dev`
- Single implicit Calendar
- Service-worker app-shell caching (loads offline on repeat visits)
- TypeSpec `api-spec/` package; committed OpenAPI + generated client
- Presentation layer on `@angular/cdk` + `@angular/aria`, no Angular Material, fully
  hand-styled (ADR 0006); shared behavioral foundation in `ui/` (Overlay, Dialog,
  Toast, Focus services; Modal, Select, Multiselect, Combobox, Reorderable list,
  Nested list components)
- Design tokens authored in SCSS (`src/styles/tokens/`), applied at runtime as CSS
  custom properties via `DesignTokenService` (ADR 0007)
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
- Cramér's V / categorical×categorical correlation — no v1 Series kind produces the
  multi-category input it needs (every kind reduces to a numeric mean or a [0,1]
  fraction per Bucket); revisit once one does — see `correlation/SPEC.md` → Out of scope
- Child-Entry reordering (drag-and-drop) within a "many"-cardinality reference Field
  (v1 keeps creation order; combining reorder with the self-referencing tree display is
  a bigger a11y/interaction problem deferred past v1)
- Integration and end-to-end test suites for UI and interaction
- **Tracker Version & merge migration tooling** (one consolidated theme — see
  [ADR 0005](adr/0005-tracker-versioning.md)): a read-only Tracker Version history/diff
  viewer; migrating a Snapshot from an old Tracker Version to a newer one; merging one
  Tracker's data into another (e.g. consolidating "Water" into "Liquid"); unifying a
  Field's rename lineage across Versions so Correlation treats it as one continuous
  Signal
- **Switch the generated API client to Angular's `HttpClient`** instead of the current
  fetch-based `swagger-typescript-api` output. Flagged, not yet designed — see the note
  in [ADR 0004](adr/0004-typespec-api-contract.md).
- **Dark/light theming.** The design-token runtime bridge (ADR 0007) is deliberately
  pre-wired for this — v1 applies static values only.
- **A generic `ui/` Table component**, once a second feature (beyond Correlation) needs
  tabular data — see `ui/SPEC.md`.
- **Sync-capable Storage Profiles** (e.g. a cloud-backed Profile). The Storage Profile
  abstraction (ADR 0009) is deliberately pre-wired for this — v1 ships Offline only, and
  Data Transfer's export/import is the anticipated (manual) migration path until one
  exists.

---

## Out of scope — not planned

- Native mobile apps
- Notifications and reminders
- AI/ML-generated insights beyond the stated statistics
- Server-side rendering

# Diary Calendar

A calendar-based diary web application. Users define their own structured record types
and log dated instances of them onto a shared calendar, then explore correlations
between different kinds of data (e.g. "eating dairy" vs "bloating") on a separate
analysis surface.

## Language

**Tracker**:
A user-defined record type: a name, a default Time mode, and a sequence of immutable
**Tracker Versions** holding its Field schema. "Sleep" and "Meal" are Trackers. Every
Entry belongs to exactly one Tracker, at exactly one of its Versions.
_Avoid_: entity, type, template, kind, form

**Tracker Version**:
An immutable, sequentially numbered (1, 2, 3, …) snapshot of a Tracker's Field schema,
created when the user commits a Draft that changes one or more Fields. Renaming the
Tracker or changing its default Time mode does not create a new Version. Every past
Version is kept forever, so any Entry created against it keeps rendering correctly no
matter how the Tracker changes afterward.
_Avoid_: revision, schema version, edition. Note: `revision` also exists as a literal
field name (ADR 0003) — a monotonic per-record write-counter on *every* aggregate for
conflict detection, unrelated to a Tracker's Version number. The two concepts share a
word by coincidence; `entry.revision` is never a Tracker Version.

**Draft**:
The Tracker editor's working, uncommitted state. Field changes accumulate in the Draft;
nothing is visible to Entries or Presets until the user explicitly commits it, which
mints the Tracker's next Tracker Version.
_Avoid_: unsaved changes, pending edit

**Archived Tracker**:
A Tracker hidden from every "create a new Entry" picker and from being offered as a new
reference Field's target, while its record and every Tracker Version stay intact.
Existing Entries, and existing children created through a reference Field that targets
it, are unaffected. Archiving forces no migration; an Archived Tracker can be
unarchived.
_Avoid_: deleted Tracker, disabled Tracker

**Entry**:
A single logged occurrence of a Tracker at a specific Tracker Version, placed on the
Calendar with a placement (Point, Period, or Day-bucketed) and a Snapshot of values
filled in against that Version's Fields.
_Avoid_: instance, record, occurrence, event

**Field**:
One property in a Tracker Version's schema: a name, a data type, and a required/optional
flag (plus options for select types). The user adds any number of Fields to a Tracker's
Draft. Data types: text, long text, integer, decimal, boolean, single-select,
multi-select, and **reference**.
_Avoid_: property, attribute, column

**Reference Field**:
A Field whose data type is `reference`: it points at a target Tracker (not a specific
Tracker Version) and, per its cardinality (one / many), its value is one or more
**child Entries** of that Tracker, snapshotted at whatever Version is current when each
child is created. A Tracker may reference itself. Reference chains are capped at a fixed
**expansion depth**.
_Avoid_: link Field, relation, foreign key

**Child Entry / parent Entry**:
An Entry held as the value of another Entry's reference Field is a *child* of that
*parent*. Every Entry has zero or one parent. A Child Entry's placement always mirrors
its parent's and is not independently editable; its Field values are edited only through
the parent (shown embedded there). Child Entries are hidden from Calendar views by
default and revealed by an explicit filter, where they appear at the parent's placement.
_Avoid_: sub-entry, nested entry, line item

**Preset**:
A named, reusable bundle of pre-filled Field values for one Tracker, pinned to the
Tracker Version it was authored against, including filled child Entries for its
reference Fields. Creating an Entry from a Preset deep-copies its values into the new
Entry's Snapshot — which, like any Entry, snapshots the Tracker's *current* Version —
where they stay fully editable. Editing a Preset never changes Entries already made from
it. A Preset becomes **stale** once the Tracker moves to a newer Version than the one
it's pinned to; a stale Preset still works when used, but stays stale until the user
explicitly reviews and re-saves it.
_Avoid_: template, default, quick-add

**Calendar**:
The timeline surface onto which logged occurrences are placed. Owned by one Owner and
contributed to by one or more Users.
_Avoid_: diary (the product is a diary; the surface is the calendar), timeline

**Owner**:
The account that owns a Calendar and its data. Identified by `ownerId`. Hardcoded to
`dev` until a real backend and authentication exist.

**User**:
An account that contributes data to a Calendar. A Calendar has one Owner and one or
more Users. Identified by `userId`. Hardcoded to `dev` until a real backend exists.
_Avoid_: contributor, member, account

**Storage Profile**:
Where the app's data lives and whether it syncs. Selected on the Settings page and
persisted locally; changing it requires a reload, since it determines which adapter
set the app wires at bootstrap. v1 ships exactly one Storage Profile, **Offline**
(IndexedDB, no sync) — the app is built so a future Storage Profile can point
elsewhere and sync, but none exists yet. See [ADR 0009](docs/adr/0009-storage-profile-and-data-transfer.md).
_Avoid_: profile (ambiguous with a future user-identity profile — always say "Storage
Profile")

**Time mode**:
A Tracker's *default* placement style — **point**, **period**, or **day-bucketed** —
offered to save the user a choice when creating an Entry. It is only a default: every
Entry may override it, and changing a Tracker's default never affects existing Entries
and never creates a new Tracker Version.

**Point**:
A placement at a single time of day (e.g. 10:01), optionally with a Fadeout.
_Avoid_: instant, moment

**Period**:
A placement spanning two fixed times of day (e.g. 09:02–10:03), optionally with a
Fadeout on either side.
_Avoid_: interval, range, duration

**Day-bucketed**:
A placement attached to a calendar day with no time of day and no Fadeout.
_Avoid_: all-day, undated

**Fadeout**:
An uncertainty margin extending a Point or Period placement, expressed as an amount of
time before and/or after the fixed placement, marking the span in which the user cannot
pin the exact time. A Point at 10:01 with a one-hour trailing Fadeout covers 10:01–11:01;
a Period 09:02–10:03 with 30 min leading and 60 min trailing covers 08:32–11:03.
_Avoid_: fuzz, tolerance, blur, margin of error

**Tag**:
A free-text label attached to a single Entry, independent of Trackers and schemas.
Entered as free text with autocomplete suggestions drawn from existing Tags. Independent
per Entry — a Child Entry's Tags are its own, never inherited from or shared with its
parent.
_Avoid_: label, keyword, category

**Snapshot**:
The set of Field values an Entry stores, recorded against the exact Tracker Version that
was current when the Entry was created. A Snapshot never needs to bind or rebind to
anything: its Tracker Version is immutable and kept forever, so the Snapshot always
renders correctly, unaffected by whatever the Tracker's schema does afterward.
_Avoid_: freeze, copy, live binding

## Correlation

**Correlation**:
A relationship between two Series over time, surfaced only on the dedicated Correlation
page — never on the Calendar. Reported as an effect size with a sample size and a
p-value.
_Avoid_: association, link, insight

**Series**:
A single time series derived from Entry data for correlation: a numeric Field's value, a
Tracker's Entry count ("occurrence"), a boolean or select Field's state, a numeric or
presence value drawn from a nested child Entry Field, or the presence of a Tag. Keyed to
an exact `(Tracker, Field name, data type)` as defined by whichever Tracker Version each
Entry was snapshotted against — a Field rename across Tracker Versions produces two
distinct Series rather than one continuous history. A Series drawn from a Child Entry is
further keyed to the ancestor path reaching it, which isn't fixed — see **Standalone
reading** and **Nested reading**.
_Avoid_: signal (reserved in this codebase for Angular's `signal()`/`Signal<T>` — a
Series is never called a Signal), metric, variable, feature

**Series key**:
What identifies a Series for selection and comparison: `(Tracker, Field name, data
type)`, plus the ancestor path for a Child Entry's Nested reading. Not stable across
scope changes — a Series key is only meaningful relative to the Tracker scope that
produced it (ADR 0015).
_Avoid_: series id, series name

**Standalone reading**:
A Child Entry's Series keyed to its own Tracker alone, with no ancestor path — produced
when a scan's scope excludes every one of its parent Trackers. See
[ADR 0015](docs/adr/0015-scope-dependent-child-series-identity.md).
_Avoid_: bare Series, unscoped Series

**Nested reading**:
A Child Entry's Series keyed to the full ancestor path leading to it (e.g.
`Meal → Ingredients: Ingredient`) — produced when a scan's scope includes at least its
immediate parent Tracker.
_Avoid_: scoped Series, compound Series

**Bucket**:
The time unit Series are aligned to — hour, day, week, or month. An Entry contributes
to every Bucket its placement touches; a Fadeout contributes with weight falling off
linearly across its span.
_Avoid_: bin, window, slot, period (Period is a placement)

**Lag**:
An offset, measured in Buckets, applied to one Series before correlating, so that a
cause preceding an effect can be detected. The user sets the Lag range to scan; the app
reports the strongest Lag alongside the zero-Lag result.
_Avoid_: delay, offset, shift

**Test**:
One correlation of one Series pair at one Lag. The unit the Benjamini–Hochberg
correction ranges over — a Discovery scan of 1,700 pairs across a seven-Bucket Lag
range runs roughly 12,000 Tests, not 1,700. Only the strongest-Lag Test of each pair
is shown, but every Test that ran counts toward the correction.
_Avoid_: comparison, trial, run

**Discovery scan**:
An explicitly triggered, client-side pass over every pair of in-scope Series across the
Lag range, producing a ranked list of candidate Correlations subject to the user's
significance guardrails (minimum sample size, p-value threshold, Benjamini–Hochberg
correction).
_Avoid_: auto-scan, sweep, search

**Directed view**:
The drill-in from one Discovery-scan row: the two Series on a shared zoomable time axis
plus a scatter plot, with method, lag, effect size, n, and p-value.
_Avoid_: detail view, inspector

**Series overlay**:
A stats-free view of one or more user-picked Trackers' Series, plotted together on the
shared zoomable time axis, each Series individually toggleable (default: all on). No
scatter plot, no Lag, no effect size, no significance — visual inspection only, reached
by picking Trackers directly, never a Discovery-scan drill-in.
_Avoid_: manual pair, comparison view, signal overlay (the earlier name for this
concept, retired with the Signal → Series rename)

# Diary Calendar

A calendar-based diary web application. Users define their own structured record types
and log dated instances of them onto a shared calendar, then explore correlations
between different kinds of data (e.g. "eating dairy" vs "bloating") on a separate
analysis surface.

## Language

**Tracker**:
A user-defined record type: a named schema of Fields plus a default Time mode. "Sleep"
and "Meal" are Trackers. The user authors and edits Trackers; every Entry belongs to
exactly one Tracker.
_Avoid_: entity, type, template, kind, form

**Entry**:
A single logged occurrence of a Tracker, placed on the Calendar with a placement
(Point, Period, or Day-bucketed) and values filled in against its Tracker's Fields. An
Entry carries a Snapshot of its Tracker's schema as it stood when the Entry was created.
_Avoid_: instance, record, occurrence, event

**Field**:
One property in a Tracker's schema: a name, a data type, and a required/optional flag
(plus options for select types). The user adds any number of Fields to a Tracker. Data
types: text, long text, integer, decimal, boolean, single-select, multi-select, and
**reference**.
_Avoid_: property, attribute, column

**Reference Field**:
A Field whose data type is `reference`: it points at a target Tracker and, per its
cardinality (one / many), its value is one or more **child Entries** of that Tracker. A
Tracker may reference itself. Reference chains are capped at a fixed **expansion depth**.
_Avoid_: link Field, relation, foreign key

**Child Entry / parent Entry**:
An Entry held as the value of another Entry's reference Field is a *child* of that
*parent*. Every Entry has zero or one parent. A Child Entry's placement always mirrors
its parent's and is not independently editable; its Field values are edited only through
the parent (shown embedded there). Child Entries are hidden from Calendar views by
default and revealed by an explicit filter, where they appear at the parent's placement.
_Avoid_: sub-entry, nested entry, line item

**Preset**:
A named, reusable bundle of pre-filled Field values for one Tracker, including filled
child Entries for its reference Fields. Creating an Entry from a Preset deep-copies the
Preset's values into the new Entry's Snapshot, where they stay fully editable. Editing a
Preset never changes Entries already made from it; when a Tracker's schema changes, each
Preset shows how it now diverges from that schema.
_Avoid_: template, default, quick-add

**Orphaned Field**:
A Snapshot Field on an Entry that currently binds to no live Tracker Field (its name or
data type no longer matches any). It renders read-only; the user may explicitly *rebind*
it to a chosen live Field, and is then offered to apply the same rebind to every other
Entry of that Tracker carrying the matching Orphaned Field.
_Avoid_: dangling field, lost field, stale field

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

**Time mode**:
A Tracker's *default* placement style — **point**, **period**, or **day-bucketed** —
offered to save the user a choice when creating an Entry. It is only a default: every
Entry may override it, and changing a Tracker's default never affects existing Entries.

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
Entered as free text with autocomplete suggestions drawn from existing Tags.
_Avoid_: label, keyword, category

**Snapshot**:
The copy of a Tracker's schema, together with the values entered against it, stored on
an Entry when it is created. Editing the Tracker later does not rewrite existing
Snapshots; a Snapshot Field stays bound to the live Tracker only while their name and
data type match exactly. An Entry always belongs to a Tracker — deleting a Tracker
forces its Entries to be migrated to another one, never orphaned.
_Avoid_: freeze, version, copy

## Correlation

**Correlation**:
A relationship between two Signals over time, surfaced only on the dedicated Correlation
page — never on the Calendar. Reported as an effect size with a sample size and a
p-value.
_Avoid_: association, link, insight

**Signal**:
A single time series derived from Entry data for correlation: a numeric Field's value, a
Tracker's Entry count ("occurrence"), a boolean or select Field's state, a numeric or
presence value drawn from a nested child Entry Field, or the presence of a Tag.
_Avoid_: series, metric, variable, feature

**Bucket**:
The time unit Signals are aligned to — hour, day, week, or month. An Entry contributes
to every Bucket its placement touches; a Fadeout contributes with weight falling off
linearly across its span.
_Avoid_: bin, window, slot, period (Period is a placement)

**Lag**:
An offset, measured in Buckets, applied to one Signal before correlating, so that a
cause preceding an effect can be detected. The user sets the Lag range to scan; the app
reports the strongest Lag alongside the zero-Lag result.
_Avoid_: delay, offset, shift

**Discovery scan**:
An explicitly triggered, client-side pass over every pair of in-scope Signals across the
Lag range, producing a ranked list of candidate Correlations subject to the user's
significance guardrails (minimum sample size, p-value threshold, Benjamini–Hochberg
correction).
_Avoid_: auto-scan, sweep, search

**Directed view**:
The drill-in from one Discovery-scan row (or a hand-picked Signal pair): the two Signals
on a shared zoomable time axis plus a scatter plot.
_Avoid_: detail view, inspector

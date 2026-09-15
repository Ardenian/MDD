# Calendar — Feature Spec

## Purpose

The primary surface for logging and reviewing Entries in time: **Day** and **Week**
views, placements drawn to scale with **Fadeout**, per-Tracker visibility toggles, and
the child-Entry filter.

## User stories / flows

- I open the app on the Day view for today; Entries are drawn on a vertical time grid,
  Day-bucketed Entries sit in a strip above the grid.
- I press **Now** → a Point Entry at the current time is started and the Entry form opens.
- I click an empty 14:30 slot → a new Entry at 14:30 (Point, or the chosen Tracker's
  default Time mode).
- I switch to Week view → seven day columns; density is readable; clicking an Entry
  opens it.
- I toggle "Workout" off → all Workout Entries disappear from the grid; the toggle state
  persists across views and reloads.
- I enable **Show child entries** → embedded Ingredient Entries appear at their parent
  Meal's placement, visually marked as children; disabling hides them again.
- A Period Entry 09:00–10:30 with a 30-min trailing Fadeout draws a solid block 09:00–
  10:30 and a falloff band to 11:00.

## Domain terms used

Calendar, Entry, Tracker, Point, Period, Day-bucketed, Fadeout, Child Entry. See
[`CONTEXT.md`](../../../../CONTEXT.md).

## UI

- The Calendar page is this feature's top-level (route) component — the only place
  here allowed to inject a facade or a `ui/` service.
- View switcher (Day / Week); date navigation (prev / next / today; date picker).
- **Day view**: vertical 24h grid, current-time line, Day-bucketed strip, Point markers,
  Period blocks, Fadeout falloff bands, overlap layout (side-by-side columns).
- **Week view**: 7 columns, same primitives at reduced density.
- Clicking an empty grid slot opens a small quick-create surface via `ui/`'s
  `OverlayService` (a positioned popover, not a full Modal) offering a Tracker pick
  before handing off to the Entry form.
- **Tracker toggle panel**: one switch per Tracker (from `TrackerLookup`, `data/`'s
  shared facade — name + archived state is all this needs), colour swatch; "all / none".
- **Child-entry filter**: single toggle.
- **Now** button in the day header.
- Entries are buttons (open on Enter/Space); grid is navigable by keyboard (arrow keys
  move a focus cell, Enter creates); colour is never the only signal (Tracker name shown
  or available via label); contrast meets AA against grid lines and bands.

## Data & API contract touched

- The Calendar page injects a feature-local `CalendarDataAccess` (a stateless
  DataAccess, ADR 0008 — wrapping `EntryRepository.listByRange(start, end,
  { includeChildren })` via `resource()`, exposing a domain-shaped `entries` signal
  plus a derived `isLoading` signal — the only read this feature does) plus
  `TrackerLookup` (`data/`'s shared facade, for the toggle panel) — never the raw ports
  directly, per ADR 0002.
- No writes here beyond starting an Entry (delegated to the entries feature's Modal).
- Pure module `calendar-layout` — given resolved covered intervals, compute overlap
  columns and pixel geometry for a viewport; independent of Angular.
- Local (non-synced) UI state: selected view, visible date, Tracker toggle set,
  child-entry filter — persisted in `localStorage`, read defensively (ADR-independent
  convenience state, never the source of truth).

## Test cases (Vitest — logic only)

- `calendar-layout`: two overlapping Periods → two columns; three-way overlap → three;
  non-overlapping → one column each.
- Fadeout band geometry derives from the resolved interval (reuses `fadeout` from the
  entries feature), not recomputed here.
- Day-bucketed Entries are routed to the strip, never the grid.
- `listByRange` range math: an Entry touching the range boundary is included; a
  soft-deleted Entry is excluded; children included only when requested.
- Toggle state serialisation round-trips; unknown Tracker id in stored state is ignored.

## Out of scope

- Month view (feature-scope "Later").
- Drag-to-move / drag-to-resize Entries.
- Printing / export of the calendar.
- Displaying any correlation overlay on the Calendar (Correlation lives on its own page).

# Data Transfer — Feature Spec

## Purpose

Get the active **Storage Profile**'s entire dataset out of the app as one portable file,
and back in. This is v1's only mitigation against permanent data loss (no sync, no
backend, no automatic backup — see [ADR 0009](../../../../docs/adr/0009-storage-profile-and-data-transfer.md))
and the anticipated path for moving data between Storage Profiles once a second one
exists.

## User stories / flows

- I open Data Transfer and click **Export** — the browser downloads one JSON file
  containing every Tracker, Tracker Version, Entry, Preset, and Tag, plus my Settings
  (Bucket size, Lag range, guardrail thresholds, expansion-depth cap).
- Months later, on a fresh profile (or after clearing local data), I open Data Transfer,
  pick that file, and click **Import**. I'm shown what I currently have (record counts
  per aggregate, same display Settings' "Clear local data" already uses) and warned this
  will be discarded; I type the confirmation phrase and confirm. My data is fully
  replaced by the imported file's contents and the app reloads.
- I try to import a file exported by an incompatible older version of the app — the
  import is rejected outright with a clear error before anything is touched.
- I try to import while unsure what I'll lose — the confirmation step shows me my
  current record counts first, so I'm not confirming blind.

## Domain terms used

Storage Profile, Tracker, Tracker Version, Entry, Preset, Tag. See
[`CONTEXT.md`](../../../../CONTEXT.md).

## UI

- The Data Transfer page is this feature's top-level (route) component — the only place
  here allowed to inject a facade or a `ui/` service.
- **Export**: a single button; triggers a browser download of the JSON bundle, named
  with the export date.
- **Import**: a file picker, then `ui/`'s **Modal** with a confirm-by-typing guard
  (mirrors Settings' "Clear local data") showing current record counts per aggregate
  before the replace is applied. A format-version mismatch is surfaced as an inline
  error at file-selection time, before the confirmation step is ever reached.
- Both actions are labelled form controls; the destructive import action is not
  focus-first, matching Settings' existing destructive-action pattern.

## Data & API contract touched

- The Data Transfer page injects a feature-local `DataTransferDataAccess` (a stateless
  DataAccess, ADR 0008 — never the raw port below directly) — per ADR 0002.
  `DataTransferDataAccess` wraps `resource()` around the record-count read (for the
  import-confirmation display, same shape Settings already reads), exposing a
  domain-shaped `recordCounts` signal plus a derived `isLoading` signal, and the two
  actions
  below; it wraps:
- `MaintenancePort`:
  - `exportAll()` — returns a format-versioned JSON bundle containing every **live**
    (non-soft-deleted) row of every aggregate (`Tracker`, `TrackerVersion`, `Entry`,
    `Preset`, `Tag`) plus `Settings`, **excluding** `activeProfileId` (device-local, not
    portable — see ADR 0009).
  - `importAll(data)` — validates the bundle's format-version against the app's current
    version; a mismatch is rejected with an error and nothing is touched. On a match,
    replaces all existing data with the bundle's contents (equivalent to `clearAll()`
    followed by a full restore) and re-seeds the single implicit Calendar exactly as
    `clearAll()` does. `activeProfileId` is never touched by this replace, in either
    direction — it isn't wiped and it isn't read from the bundle, since it never left
    the device to begin with (ADR 0009).
- No merge semantics — import is always a full, confirmed replace. No TypeSpec model:
  the export bundle is an internal format versioned independently of the API contract,
  never exposed over the future HTTP adapter.

## Test cases (Vitest — logic only)

- `exportAll()`: includes every live row of every aggregate and all Settings; excludes
  soft-deleted rows; excludes `activeProfileId`; stamps the bundle with the current
  format-version.
- `importAll()`: a bundle whose format-version doesn't match exactly is rejected and no
  data is modified; a matching bundle replaces all existing data and leaves exactly one
  Calendar record, same postcondition as `clearAll()`.
- Round-trip: `exportAll()` then `importAll()` on the same data (nothing else changed in
  between) is a no-op on every aggregate's live rows.
- Record-count read for the confirmation display matches what `importAll()` is about to
  discard.

## Out of scope

- Merge / conflict-resolution import (ADR 0009) — full replace only in v1.
- Partial or best-effort import across incompatible format versions.
- Scheduled or automatic export/backup.
- Exporting a subset of data (single Tracker, date range, etc.) — always the whole
  active Storage Profile's dataset.
- Moving data directly between two Storage Profiles without a manual export/import round
  trip — no second Storage Profile exists yet to design that UX against.

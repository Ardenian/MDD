# Settings — Feature Spec

## Purpose

One place for app-wide defaults and local data management. Small feature; no domain
rules of its own.

## User stories / flows

- I set the default Bucket size to weekly and the default Lag range to −7…+7; the
  Correlation page opens with those next time.
- I lower the reference **expansion-depth cap** from its default of 5 to 3; the next
  time I nest a child Entry deep enough to hit the new limit, the Entry form blocks it
  — the Tracker designer itself never checks this cap (see `entries/SPEC.md`).
- I click **Clear local data**, confirm a typed phrase, and the IndexedDB database is
  wiped and the app reloads empty.
- I open Settings and see a **Storage Profile** section showing "Offline" as the active
  (and, in v1, only) Profile — nothing to change yet, but the seam is visible for when a
  second Profile exists.

## Domain terms used

Bucket, Lag, expansion depth, Tracker, Entry, Storage Profile. See
[`CONTEXT.md`](../../../../CONTEXT.md).

## UI

- The Settings page is this feature's top-level (route) component — the only place
  here allowed to inject a facade or a `ui/` service.
- **Correlation defaults**: Bucket size, Lag range, guardrail thresholds (min n, p-value,
  BH on/off).
- **Schema**: expansion-depth cap (integer, min 1).
- **Storage Profile**: a `ui/` **Select** showing the active Profile; v1 offers exactly
  one option, "Offline", so the control is present but has nothing meaningful to switch
  to yet. Selecting a different Profile (once one exists) triggers an app reload — see
  [ADR 0009](../../../../docs/adr/0009-storage-profile-and-data-transfer.md).
- **Data**: "Clear local data" opens `ui/`'s **Modal** with a confirm-by-typing guard;
  shows current record counts per aggregate. Exporting/importing the whole dataset is a
  separate feature — see `data-transfer/SPEC.md`.
- All settings are labelled form controls; the destructive action requires the Modal
  confirmation and is not focus-first.

## Data & API contract touched

- The Settings page injects a feature-local `SettingsDataAccess` (a stateless
  DataAccess, ADR 0008 — never the raw ports below directly) — per ADR 0002.
  `SettingsDataAccess` wraps `resource()` around the read below and exposes
  domain-shaped signals plus a derived `isLoading` signal; it wraps:
- Settings persist via a `SettingsRepository` port (IndexedDB adapter) so they survive
  reloads and are covered by ADR 0003 fields like everything else.
- "Clear local data" calls a `MaintenancePort.clearAll()` implemented by the adapter
  layer in `core/` (drops every object store, re-seeds the single implicit Calendar).
- Defaults are read by the Correlation and Trackers features' own facades, each
  injecting `SettingsRepository` themselves — never by reaching into Settings' facade or
  another feature's folder.

## Test cases (Vitest — logic only)

- Expansion-depth cap rejects values < 1; non-integer coerced/rejected.
- Lag range validation: min ≤ max; zero-width allowed (lag-0 only).
- Guardrail thresholds: p in (0, 1]; min n ≥ 1.
- `clearAll()` empties every store and leaves exactly one Calendar record.
- Reading defaults before any have been saved returns the documented fallback values:
  expansion-depth cap **5**; Bucket size, Lag range, and guardrail thresholds as stated
  in `correlation/SPEC.md`; `activeProfileId` **"offline"**.

## Out of scope

- Per-user or per-device settings sync.
- Theme / appearance settings (handled globally, not here) beyond what accessibility
  requires.
- Import/export of settings.

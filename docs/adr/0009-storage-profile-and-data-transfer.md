# Local storage's exposure is accepted for v1; a Storage Profile and Data Transfer mitigate it

## Context

`feature-scope.md` has always stated, uncontested, that "all data lives in the browser
(IndexedDB)" — but nothing recorded *why* that trade-off was acceptable for an app whose
worked example is symptom tracking ("eating dairy" vs "bloating"). Examined directly, the
guarantees `IndexedDB` actually provides are narrower than "private to this app":

- **Protected against other websites.** `IndexedDB` is partitioned by origin; no other
  site can read this app's data through browser APIs. This part holds.
- **Not protected against the device.** `IndexedDB` is ordinary files in the browser's
  profile directory. Any process with filesystem access to that profile — malware,
  another OS account with permissions, a backup tool that copies the whole profile —
  reads (and can tamper with) the data directly, entirely outside the browser's
  same-origin sandbox.
- **Not protected against browser extensions.** An extension with broad host
  permissions (common — "read and change all your data on all websites") runs content
  scripts in page context and can read a page's `IndexedDB` while the tab is open.
- **Not encrypted.** Confidentiality depends entirely on OS disk encryption the app
  neither controls nor verifies.
- **Not durable.** Local to one browser profile on one device: "clear browsing data," a
  profile reset, or disk failure loses the diary permanently. `IndexedDB` also falls
  under "best-effort" storage and can be evicted under disk pressure unless the origin
  requests persistence.
- **Not shared.** `Owner`/`User` are both hardcoded to `"dev"` with no auth (unchanged
  by this ADR — see `feature-scope.md` → Later for multi-user). Locally there is exactly
  one accessor: whoever has the browser profile on the device.

This satisfies all three of this repo's bars for writing an ADR: hard to reverse (months
of accumulated diary data trapped in one browser profile — migrating later is a real
project), surprising without context (most readers would not expect a "diary" storing
health/mood data to have zero encryption and no backup path), and a genuine trade-off
(offline-first simplicity and zero infrastructure cost vs. confidentiality and
durability).

## Decision

**The trade-off is accepted for v1, explicitly, with two concrete mitigations rather
than left as an unstated assumption:**

### Storage Profile

A new concept, **Storage Profile** (`CONTEXT.md`), names where the app's data lives and
whether it syncs. It is selected on the Settings page, persisted via `SettingsRepository`
as `activeProfileId`, and read by `core/` at bootstrap to decide which adapter set binds
to the `data/` port tokens (`core/SPEC.md`) — a new bootstrap responsibility; today
`core/` wires adapters statically. Switching Profile requires an app reload: Angular's DI
is wired at bootstrap, and hot-swapping the whole adapter set at runtime is a real lift
this decision does not take on.

v1 ships exactly one Storage Profile, **Offline** (`IndexedDB`, no sync) — behaviorally
identical to what already existed. Nothing about *this* Profile's exposure changes. What
changes is that "where your data lives" becomes a named, user-visible, extensible
concept instead of an unstated architectural given — so that a future sync-capable
Profile (encrypted-at-rest, backend-hosted, whatever it turns out to be) is a new adapter
set behind the same switch point, not a rearchitecture.

`activeProfileId` is device-local state, not portable data — it is explicitly excluded
from Data Transfer's export bundle below.

### Data Transfer

A new feature, `features/data-transfer/` (`data-transfer/SPEC.md`), exports the active
Storage Profile's entire dataset to one portable, format-versioned JSON file, and can
import one back with a destructive full replace. This is the only mitigation v1 offers
against the durability gap above: with no sync and no automatic backup, export is the
sole user-controlled way to get data out before a profile reset, browser reinstall, or
`IndexedDB` eviction takes it. It is deliberately written to operate on "the active
Storage Profile's data" rather than naming Offline specifically, since it is also the
anticipated path for moving data *between* Storage Profiles once a second one exists —
export from Offline today, import into whatever Profile #2 turns out to be, later. That
migration UX is not designed here; only the mechanism (a portable dump) is put in place.

## Considered options

- **Do nothing; leave the trade-off implicit.** Rejected — it satisfies this repo's own
  bar for writing an ADR, and "diary app, no documented security model" is exactly the
  kind of gap `docs/adr/` exists to close.
- **Build encryption-at-rest for v1.** Rejected as disproportionate: it addresses only
  the device-access and extension-access exposure, not durability, not sync, and adds
  real complexity (key management, no-recovery-if-forgotten UX) for a v1 whose explicit
  premise is offline-first simplicity.
- **Build a real backend/sync engine now instead of Data Transfer.** Rejected — already
  a **Later** item (`feature-scope.md`); Data Transfer is deliberately the smaller,
  immediately buildable mitigation, and doubles as the migration path once sync-capable
  Profiles do arrive.
- **Merge semantics for import, instead of full replace.** Rejected for v1: conflict
  resolution (id collisions, concurrent edits) is a real feature of its own scope;
  full-replace-with-explicit-warning is the honest, simple v1 answer.
- **Best-effort import across format versions.** Rejected: partial/lossy import of
  personal diary data is worse than a hard rejection with a clear error.

## Consequences

- `core/`'s adapter-wiring responsibility grows: it now reads `SettingsRepository` at
  bootstrap to resolve `activeProfileId` before binding adapters, rather than wiring
  unconditionally. In v1 this always resolves to Offline → the `IndexedDB` adapter set.
- `MaintenancePort` grows two operations: `exportAll()` and `importAll(data)`. Both are
  whole-database operations in the same spirit as the existing `clearAll()`.
- `feature-scope.md`'s "Out of scope — not planned" list loses "Data import / export" —
  it is now in scope, specified in `data-transfer/SPEC.md`.
- The device-level, extension-level, and durability exposure described in Context is
  **not eliminated** by either mitigation — Storage Profile only prepares the seam for a
  future better Profile; Data Transfer only gives the user a way to get their own data
  out. Neither encrypts, authenticates, or syncs anything in v1.

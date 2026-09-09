# Offline-first data contract from day one

## Context

Using the whole app offline is a v1 requirement, and a backend with multi-user sync is a
planned later milestone. The data shapes that make sync possible (stable identity,
change tracking, soft deletes, conflict detection) are almost free to include now and
very expensive to retrofit into every model and every stored record later.

## Decision

Every persisted aggregate — Tracker, Entry, Preset, Tag — carries, from v1:

- a **client-generated UUID** as its identity (never a server sequence);
- `createdAt`, `updatedAt`, and `deletedAt` timestamps, with **soft delete** (`deletedAt`
  set, row retained) rather than physical deletion;
- a monotonic **`revision`** counter per record for conflict detection;
- `ownerId` and `userId`, hardcoded to `dev` in v1.

The v1 IndexedDB adapter writes and honours all of these fields (respecting `deletedAt`
on reads, bumping `revision` on writes). The TypeSpec contract models them on every
resource. Conflict resolution for the eventual sync engine is **last-write-wins by
`updatedAt`**; field-level merge is explicitly out of scope.

## Considered options

- **Add sync fields when the backend arrives.** Rejected: forces a data migration of
  every local record and a rewrite of every model and adapter.
- **Full CRDT / per-field versioning now.** Rejected: large complexity for a feature
  that is a later milestone; LWW is adequate for a personal diary with occasional
  multi-user contribution.

## Consequences

- The sync engine itself is deferred, but nothing in v1 blocks it.
- Physical purging of soft-deleted rows is a later, separate concern.
- Tests must cover `deletedAt` filtering and `revision` bumping in the IndexedDB adapter.

# Series selection is subordinate to Tracker scope

## Context

The Correlation page's scope picker was specified as a picker over "Trackers / specific
Series" (`correlation/SPEC.md`), and `feature-scope.md` lists Series-scope selection as
in scope for v1. Only the Tracker tier existed: `SeriesScope` carried `trackerIds` and
nothing else, and no filter was applied to what `extractSeries` produced.

Adding the second tier raises a question the first tier does not: what does a chosen
Series *mean*, given that a Series' identity is not fixed?

[ADR 0015](0015-scope-dependent-child-series-identity.md) makes that identity a function
of Tracker scope. Scoping a scan to a parent Tracker pulls its children along and keys
their Series by the full ancestor path — a Nested reading, `Meal → Ingredients: Protein`.
Scoping to the child alone leaves its Entries looking parentless, and the same data comes
out as a Standalone reading, `Ingredients: Protein`. Different key, different Series, same
diary. So a Series key is only meaningful relative to the Tracker scope that produced it
(`CONTEXT.md` → **Series key**).

If per-Series selection decided what a scan loads, that identity would be
self-referential: the selection names keys, the keys exist only because of a scope, and
the scope would be derived from the selection.

## Decision

Series selection is a **post-extraction filter**, strictly subordinate to Tracker scope.

- **Tracker scope alone loads the dataset**, and therefore alone decides whether a Child
  Entry reads as a Standalone or a Nested reading. Unchanged by this decision.
- `SeriesScope.seriesIds` narrows the Series that extraction produced, between
  `extractSeries` and the pairing step. A data source ignores the field; only the caller
  that extracts Series reads it. Omitted or empty means every extracted Series, mirroring
  `trackerIds`.
- **A selected key that the latest extraction did not produce is dropped**, and the user
  is told so by a line in the controls bar rather than left with a quietly narrowed scan.
- A vanished key is **never re-matched** onto another Series.
- The prune runs at the one moment a Series list is honestly re-derived — a scan's
  extraction — and it is one function (`forKnownSeries`), whether the stale keys came
  from a previous Tracker scope or from this device's saved preferences (ADR 0009). One
  policy, exercised twice.

## Considered options

- **Re-match a vanished key on Tracker + Field + data type.** Rejected: this is precisely
  the conflation ADR 0015 exists to prevent. `Meal → Ingredients: Protein` and
  `Ingredients: Protein` agree on Tracker, Field name and data type and are different
  Series — one is a reading of protein *as part of a meal*, the other of protein however
  it was logged. Silently re-binding one to the other would answer a question the user
  did not ask, and would do it invisibly, inside a statistics page whose whole job is not
  to overstate what it knows.
- **Let per-Series selection drive the load** (mutually-exclusive Tracker-or-Series
  modes: pick Trackers *or* pick Series). Rejected on two counts. It makes Series identity
  self-referential, as above — the set of Series on offer would depend on the set
  selected. And it removes the only control a user has over the Standalone/Nested reading,
  which ADR 0015 establishes as scope-driven and which the correlation guide documents as
  the technique for reading a Tracker referenced by more than one parent on its own.
- **Keep the selection as an exclusion list**, like the Series overlay's
  `hiddenSeriesIds`. Rejected: an exclusion list survives a scope change by *continuing to
  exclude* a key nobody can see any more, which is the same silent narrowing in a form
  that cannot be noticed or pruned. An inclusion list makes a stale key visible as a drop.

## Consequences

- The scope picker is a two-tier narrowing, read top down: Trackers decide what is loaded
  and what each Series is, Series decide what of that is compared.
- The Series tier can only offer what a scan has already extracted. Before the first scan
  of a session it says so and offers nothing; a scope change narrows the offered list by
  Tracker immediately, and the stale keys themselves go on the next scan, with the notice.
- A narrowed scan runs fewer Tests, so the Benjamini–Hochberg bar falls with the scope —
  the intended way to ask a focused question, consistent with the guide's §7 advice to
  scan narrowly.
- `scopeSeriesIds` persists to this device (ADR 0009) and is pruned through the same path
  on its first meeting with a real Series list, so an old selection can never silently
  narrow a scan made months later.
- Covered by `correlation-preferences.spec.ts` (prune, toggle, round-trip),
  `series-extraction.spec.ts` (`seriesInScope`), `discovery.spec.ts` (the filter removes
  pairs and Tests) and `tests/stories/correlation/correlation.e2e.ts` (narrow, scan,
  remember; and the drop notice).

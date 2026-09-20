# Scan scope, not a dedicated feature, decides whether a Child Entry's Series is standalone or nested

## Context

A Tracker can be referenced as a child from more than one other Tracker — e.g. a Protein
Tracker referenced by both a Meal and a Snack Tracker. Reviewing `correlation-guide.md`
against a setup like this surfaced a gap the guide doesn't cover: each parent produces
its own path-scoped Series (`Meal → Protein: grams`, `Snack → Protein: grams`), and
nothing combines them. Averages from the two can't be added together after the fact, and
even once totals exist they're never tested as one hypothesis by a Discovery scan —
`headache` correlated separately against `Meal → Protein: grams` and against
`Snack → Protein: grams` pays the multiple-comparison cost of two tests for what is
causally a single "how much protein" variable, and a real effect split across two weaker
partial signals may clear significance in neither.

## Decision

Rather than add a declared "combine across parents" flag, rely on and formalize
mechanics the code already has:

- `CorrelationDataSource.loadEntriesForScope`'s `scopeEntries` grows a scan's dataset
  only **downward** — an included parent Tracker's Entries pull in their children, but
  an included child Tracker never pulls in its parent.
- `series-extraction.ts`'s `pathOf` treats an Entry as parentless whenever its
  `parentEntryId` doesn't resolve inside the loaded dataset — indistinguishable from a
  genuinely top-level Entry.

Composing these: scoping a scan to a child Tracker while excluding every one of its
parent Trackers yields a **Standalone reading** of that child's Series, keyed to its own
Tracker alone. Scoping to a parent (which pulls its children along) yields the existing
**Nested reading**, keyed by the full ancestor path. Both readings are available today;
which one a given scan sees is controlled entirely by scope, not by anything declared on
a Tracker or Field. See `CONTEXT.md`'s **Series**, **Standalone reading**, and **Nested
reading** entries.

## Considered options

- **A declared roll-up flag on the child Tracker**, always emitting a combined bare
  Series alongside the nested one. Rejected: existing scope semantics already produce an
  equivalent result with no new engineering, and a roll-up flag would still need to
  decide how the two readings' significance testing interacts — which running them as
  separate, scope-driven scans avoids entirely.
- **Always resolve a Child Entry's Series by its own Tracker, ignoring parent context.**
  Rejected: breaks the guide's own flagship Reference-field example,
  `Meal → Ingredients: Ingredient = Dairy`, where the parent context *is* the question
  (composition, not a standalone quantity).

## Consequences

- The two readings can't come out of one Discovery scan. Getting both requires two scan
  runs with different scope selections — consistent with, not in tension with, the
  guide's own §7 advice to run focused, narrow-scope scans per question.
- This behavior is now covered by regression tests
  (`series-extraction.spec.ts`, `port-contract.suite.ts`'s `CorrelationDataSource`
  tests), so a future change to `pathOf`'s parent-resolution — e.g. "fixing" it to look
  up a parent by id regardless of scope — can't silently delete the Standalone reading
  without a test failing.
- `correlation-guide.md` documents this as the technique for reading a Tracker
  referenced by more than one parent on its own.

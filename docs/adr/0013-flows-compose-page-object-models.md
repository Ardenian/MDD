# Flows compose Page Object Models into reusable, named steps

## Context

A user story like "create a Tracker" is a fixed sequence of POM interactions (open the
designer, name it, add Fields, commit the Draft) that recurs as a setup step in many
other tests (e.g. "log an Entry against a Tracker" needs one to exist first). Without a
shared place for that sequence, every test that needs a Tracker to already exist
re-derives the same steps against the same POMs, and a Draft-editor sequencing change
breaks every one of those copies independently.

## Decision

A **Flow** (`*.flow.ts`, always in `tests/flows/`, never colocated) is a named, reusable
sequence of steps built from one or more Page Object Models — e.g. `createTracker(page,
{ name, fields })`. Flows are the one place in test code allowed to import Page Object
Models across feature boundaries (a Flow spanning Trackers and Entries composes both
features' POMs); `AGENTS.md`'s "a feature MUST NOT import from another feature" rule
governs production code and doesn't apply here, since Flows never ship in the app
bundle.

`*.e2e.ts` specs live in `tests/stories/`, organized by user story, and call into
`tests/flows/` for setup, then into colocated POMs directly for the behaviour actually
under test.

## Considered options

- **Colocate Flows with the feature they primarily belong to**, only breaking
  cross-feature ones out to a shared location. Rejected: whether a Flow stays
  single-feature isn't stable over time (a step gets added elsewhere later), so
  classification would need periodic revisiting; keeping the whole category in one
  place removes that question entirely.
- **No Flows — every spec composes POMs directly.** Rejected: setup sequences shared
  across many specs would be copied rather than named once, with the same drift risk
  POMs themselves exist to prevent.

## Consequences

- `tests/flows/` is the one directory in this codebase where cross-feature imports are
  expected and correct, not a violation to flag in review.
- A Draft-editor sequencing change is fixed in `createTracker`'s Flow once; every spec
  that calls it keeps working.

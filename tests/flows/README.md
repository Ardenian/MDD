# Flows

`*.flow.ts` files only — named, reusable sequences of Page Object Model steps (e.g.
`createTracker(page, { name, fields })`), composed from one or more POMs and possibly
spanning features. The one place test code may import across feature boundaries. See
[ADR 0013](../../docs/adr/0013-flows-compose-page-object-models.md).

No `test()` blocks here — those live in [`tests/stories/`](../stories/).

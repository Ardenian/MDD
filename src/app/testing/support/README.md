# Testing support

Cross-cutting Playwright fixtures that no single feature or `ui/` component owns:

- `app-fixture.ts` — the IndexedDB-reset fixture that gives each e2e story a clean slate.
- `mount-fixture.ts` — mounts one component in the ADR 0014 gallery for an
  `*.integration.ts` spec, in place of booting the whole app.

Test-only, excluded from the production build.

This is also the only place `page.evaluate` may be called: everything a spec or Flow
touches goes through a Page Object Model (ADR 0012), and both fixtures here need to reach
into the page itself — one to clear the database, the other to call `window.mount`.

Not for Page Object Models, Flows, or spec files — those are colocated with the
component/page they cover (POMs, integration tests, mount-harness scenarios) or live
under [`tests/`](../../../../tests) (Flows, e2e specs). See
[ADR 0012](../../../../docs/adr/0012-page-object-models-mandatory.md) and
[ADR 0013](../../../../docs/adr/0013-flows-compose-page-object-models.md).

# Stories (e2e)

`*.e2e.ts` files only — one per user story/happy path, driving the real app through its
real adapters (IndexedDB, generated API client). "Story" here is the plain-English
*user story* sense; unrelated to ADR 0014's `*.scenario.ts` mount-harness fixtures. See
[ADR 0011](../../docs/adr/0011-e2e-first-testing-integration-deferred-to-mount-harness.md).

Specs drive the app through Page Object Models (colocated with each component, see
[ADR 0012](../../docs/adr/0012-page-object-models-mandatory.md)) and setup through
[`tests/flows/`](../flows/) — never a raw `page.locator`/`getBy*`/`page.evaluate` call
here.

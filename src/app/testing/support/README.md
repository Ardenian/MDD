# Testing support

Cross-cutting Playwright fixtures that no single feature or `ui/` component owns — e.g.
the IndexedDB-reset fixture that gives each e2e test a clean slate. Test-only, excluded
from the production build.

Not for Page Object Models, Flows, or spec files — those are colocated with the
component/page they cover (POMs, integration tests, mount-harness scenarios) or live
under [`tests/`](../../../../tests) (Flows, e2e specs). See
[ADR 0012](../../../../docs/adr/0012-page-object-models-mandatory.md) and
[ADR 0013](../../../../docs/adr/0013-flows-compose-page-object-models.md).

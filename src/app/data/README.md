# data/

The shared data-access layer: raw ports (storage-shaped) plus shared cross-feature
facades (consumer-shaped). Presentation code never injects a raw port directly — only
a facade, feature-local or shared. Concrete adapters are wired in `core/`. See
[`SPEC.md`](./SPEC.md), [ADR 0002](../../../docs/adr/0002-shared-data-access-layer.md),
and [ADR 0004](../../../docs/adr/0004-typespec-api-contract.md).

Layout:

```
ports/        raw interfaces + DI tokens, one file per aggregate
facades/      shared, consumer-shaped facades — promoted here on second use
model/        hand-written domain types
generated/    swagger-typescript-api output — committed, never hand-edited
adapters/
  indexeddb/  v1 implementation of every port, over the IdbEngine seam
  http/       later: implementation over generated/ client (not built)
testing/      the engine double, the data-layer factory, the shared contract suite
```

Feature tests inject `createInMemoryDataLayer()` from `testing/` rather than a
hand-written fake: it wires the real repositories to an in-memory engine, so a test
exercises production logic. See `SPEC.md` → Test cases.

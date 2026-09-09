# data/

The shared data-access layer. Presentation code depends only on the port interfaces
here; concrete adapters are wired in `core/`. See [`SPEC.md`](./SPEC.md),
[ADR 0002](../../../docs/adr/0002-shared-data-access-layer.md), and
[ADR 0004](../../../docs/adr/0004-typespec-api-contract.md).

Planned layout (create folders as code lands, under a committed `SPEC.md`):

```
ports/        interfaces + DI tokens, one file per aggregate
model/        hand-written domain types
generated/    swagger-typescript-api output — committed, never hand-edited
adapters/
  indexeddb/  v1 implementation of every port
  http/       later: implementation over generated/ client
testing/      in-memory fakes of every port
```

# @ard/api-spec

TypeSpec source of truth for the Diary Calendar API contract. See
[ADR 0004](../docs/adr/0004-typespec-api-contract.md) and
[`src/app/data/SPEC.md`](../src/app/data/SPEC.md).

## Commands

```bash
pnpm install                       # from the repo root (pnpm workspace)
pnpm --filter @ard/api-spec build  # compile main.tsp -> dist/openapi.yaml
pnpm run api:sync                  # build + regenerate src/app/data/generated
```

## Rules

- `dist/openapi.yaml` and `src/app/data/generated/` are **committed**.
- Never hand-edit generated files.
- Every persisted aggregate keeps the `AggregateMeta` fields (ADR 0003).
- Requires Node 22+.

# TypeSpec is the single source of truth for the API contract

> **Flagged for revisit:** switch the generated client from the current fetch-based
> `swagger-typescript-api` to a generator that emits an Angular `HttpClient`-based
> client. Not yet designed or decided — the choice of generator, the impact on the
> `data/` port return type (`Promise` vs `Observable`), and whether it pulls the HTTP
> adapter into scope all still need working through. See
> [feature-scope.md](../feature-scope.md) → Later. The decision recorded below (TypeSpec
> as the contract source, committed generated output) is unaffected either way.

## Context

The app needs a stable contract between the data-access ports and any future backend,
even though no backend exists in v1. We want one authoritative definition, type safety
in the Angular app, and the freedom to hand-write the IndexedDB adapter (which no
generated HTTP client can serve).

## Decision

- The repo is a **pnpm workspace**. The API contract lives in a dedicated package,
  `api-spec/`, authored in **TypeSpec** (`@typespec/compiler` + `http` + `rest` +
  `openapi3`), emitting **OpenAPI 3.0** to `api-spec/dist/`.
- A client is generated from that OpenAPI document with **swagger-typescript-api** into
  `src/app/data/generated/`. Both `api-spec/dist/openapi.yaml` and the generated client
  are **committed**, so the Angular app builds without the TypeSpec toolchain.
- The generated client is an **implementation detail of the future HTTP adapter**, never
  imported by presentation code (see ADR 0002). Generated files are never hand-edited.

## Considered options

- **Hand-written TypeScript types only.** Rejected: no language-agnostic contract for a
  future backend, and drift between client and server becomes undetectable.
- **`@hey-api/openapi-ts` / `ng-openapi-gen`.** Reasonable alternatives; the team chose
  `swagger-typescript-api` for a single-file, framework-agnostic output that the data
  layer wraps anyway.
- **Generate a full Angular service client and use it directly.** Rejected: it cannot
  back the IndexedDB adapter, and it would leak the transport into features.

## Consequences

- Regenerating is a scripted step (`pnpm --filter api-spec build` then the client
  generator), run in CI and committed.
- Node 22+ is required by the TypeSpec compiler; CI must not run older Node.
- The TypeSpec toolchain stays out of the Angular app's dependency tree.

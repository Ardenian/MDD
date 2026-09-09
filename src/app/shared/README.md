# shared/

Dumb, reusable UI building blocks: presentational components, pipes, directives.

Rules (see [`AGENTS.md`](../../../AGENTS.md)):

- Imports only from `shared/`. Never from `features/`, `core/`, or `data/`.
- No data access, no repository/port injection, no router navigation logic.
- Inputs/outputs only; state is passed in.

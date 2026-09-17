# Component gallery (ADR 0014)

The mount harness Playwright's component testing needs and does not ship for Angular: a
page implementing `window.mount` / `window.unmount` over Angular's `createComponent()`,
served by its own `ng serve` target on port 4201.

- `main.ts` — the harness. Finds every `*.scenario.ts` under `src/` with Vite's
  `import.meta.glob`, builds a fresh `EnvironmentInjector` per mount, and renders one
  component into `#mount-root`.
- `scenario.ts` — what a scenario is: a component, the inputs to render it with, and the
  providers standing in for real services.

A **scenario** is not a _story_. `tests/stories/` holds e2e specs named after user
stories; a scenario carries no assertions and is never run on its own — an
`*.integration.ts` spec beside the component mounts it and drives it through that
component's Page Object Model.

Run the suite with `pnpm run e2e` (the `integration` project boots this server itself),
or open the gallery by hand with `pnpm run gallery`.

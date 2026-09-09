# styles/

Global SCSS: the design-token source of truth and base/reset styles. Feature-specific
styling stays component-colocated (per `AGENTS.md`) — there is no per-feature global
stylesheet. See [`ui/SPEC.md`](../app/ui/SPEC.md) → Design tokens, and
[ADR 0007](../../docs/adr/0007-design-tokens-runtime-bridge.md).

Planned layout (create folders as code lands):

```
tokens/       the SCSS token map (color, spacing, typography, radius, shadow, z-index,
              motion) — the single authored source; also compiled into
              src/app/ui/tokens.generated.ts, consumed only by DesignTokenService
base/         reset, base typography
utilities/    small SCSS utilities, if any
```

Nothing here is consumed directly by component stylesheets — components reference
`var(--token-name)`, applied at runtime by `DesignTokenService`, never the token map or
these partials directly.

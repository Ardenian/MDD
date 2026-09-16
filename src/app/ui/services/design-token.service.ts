import { DOCUMENT, inject, Service } from '@angular/core';
import { DESIGN_TOKENS } from '../tokens.generated';

/**
 * Applies the generated token mirror as CSS custom properties on the document root
 * before first render (ADR 0007). v1 applies one static set; a future theme switch calls
 * `apply()` again with a different map rather than changing how components get colours.
 */
@Service()
export class DesignTokenService {
  private readonly document = inject(DOCUMENT);

  apply(tokens: Readonly<Record<string, string>> = DESIGN_TOKENS): void {
    const root = this.document.documentElement;
    for (const [name, value] of Object.entries(tokens)) {
      root.style.setProperty(`--${name}`, value);
    }
  }
}

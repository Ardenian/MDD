import { DOCUMENT } from '@angular/common';
import { Service, inject } from '@angular/core';
import { DESIGN_TOKENS } from '../tokens.generated';

/**
 * Applies every generated design token as a CSS custom property on the document root
 * (ADR 0007) — the runtime bridge between the SCSS-authored token source and every
 * stylesheet's `var(--token-name)` references. No public API beyond bootstrap in v1; a
 * future theme switch calls a method here rather than being built from scratch.
 */
@Service()
export class DesignTokenService {
  private readonly document = inject(DOCUMENT);
  private applied = false;

  apply(): void {
    if (this.applied) {
      return;
    }

    const root = this.document.documentElement;
    for (const [name, value] of Object.entries(DESIGN_TOKENS)) {
      root.style.setProperty(name, value);
    }

    this.applied = true;
  }
}

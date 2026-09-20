import { Component, input } from '@angular/core';

/**
 * A small text marker sitting beside a label — "Average", "Sum" and the like.
 *
 * Always carries its own visible words: the distinction it draws has to survive without
 * colour, which is both the WCAG AA contract and the only way it reads in a dense table.
 */
@Component({
  selector: 'ui-badge',
  template: `<span class="badge" data-testid="badge">{{ label() }}</span>`,
  styles: `
    .badge {
      display: inline-block;
      margin-inline-start: var(--space-2);
      padding: 0 var(--space-2);
      border: 1px solid var(--color-border);
      border-radius: var(--radius-sm);
      background: var(--color-surface-sunken);
      color: var(--color-ink-muted);
      font-size: var(--text-xs);
      font-weight: var(--weight-medium);
      line-height: 1.6;
      white-space: nowrap;
    }
  `,
})
export class Badge {
  readonly label = input.required<string>();
}

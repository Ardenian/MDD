import { Component, input, output } from '@angular/core';

let nextId = 0;

/**
 * The standard dialog chrome. Presentational only — it injects nothing and knows nothing
 * about how it was opened; `DialogService` is what a feature's top-level component calls
 * to put one on screen, and `cdk/dialog` underneath it owns the focus trap and restore.
 */
@Component({
  selector: 'ui-modal',
  template: `
    <section class="modal" data-testid="modal" [attr.aria-labelledby]="titleId">
      <header class="modal__header">
        <h2 class="modal__title" [id]="titleId" data-testid="modal-title">{{ title() }}</h2>
        <button
          type="button"
          class="modal__close"
          data-testid="modal-close"
          [attr.aria-label]="closeLabel()"
          (click)="dismissed.emit()"
        >
          <span aria-hidden="true">&times;</span>
        </button>
      </header>

      <div class="modal__body" data-testid="modal-body">
        <ng-content />
      </div>

      <footer class="modal__footer" data-testid="modal-footer">
        <ng-content select="[modal-actions]" />
      </footer>
    </section>
  `,
  styles: `
    .modal {
      display: flex;
      flex-direction: column;
      gap: var(--space-5);
      max-width: min(40rem, calc(100vw - var(--space-6)));
      max-height: calc(100vh - var(--space-7));
      padding: var(--space-6);
      border-radius: var(--radius-lg);
      background: var(--color-surface-raised);
      box-shadow: var(--shadow-lg);
      color: var(--color-ink);
    }

    .modal__header {
      display: flex;
      align-items: flex-start;
      justify-content: space-between;
      gap: var(--space-4);
    }

    .modal__title {
      margin: 0;
      font-size: var(--text-lg);
      font-weight: var(--weight-bold);
      line-height: var(--leading-tight);
    }

    .modal__close {
      display: grid;
      place-items: center;
      width: var(--control-height-sm);
      height: var(--control-height-sm);
      border: none;
      border-radius: var(--radius-sm);
      background: transparent;
      color: var(--color-ink-muted);
      font-size: var(--text-lg);
      cursor: pointer;
    }

    .modal__close:hover {
      background: var(--color-surface-hover);
      color: var(--color-ink);
    }

    .modal__body {
      overflow-y: auto;
    }

    .modal__footer {
      display: flex;
      justify-content: flex-end;
      gap: var(--space-3);
    }

    .modal__footer:empty {
      display: none;
    }
  `,
})
export class Modal {
  readonly title = input.required<string>();
  readonly closeLabel = input('Close');

  readonly dismissed = output<void>();

  protected readonly titleId = `ui-modal-title-${++nextId}`;
}

import { Component, input, output } from '@angular/core';
import type { Toast } from '../../services/toast.service';

/**
 * Renders queued toasts. Announcing them is `ToastService`'s job via the live region, so
 * this markup is `aria-hidden`-free but deliberately not a live region itself — two
 * announcements for one message would be worse than none.
 */
@Component({
  selector: 'ui-toast-list',
  template: `
    <ul class="toasts" data-testid="toast-list">
      @for (toast of toasts(); track toast.id) {
        <li
          class="toasts__item"
          [class.toasts__item--error]="toast.tone === 'error'"
          [attr.data-testid]="toast.id"
        >
          <span class="toasts__message" data-testid="toast-message">{{ toast.message }}</span>
          <button
            type="button"
            class="toasts__dismiss"
            data-testid="toast-dismiss"
            [attr.aria-label]="dismissLabel()"
            (click)="dismissed.emit(toast.id)"
          >
            <span aria-hidden="true">&times;</span>
          </button>
        </li>
      }
    </ul>
  `,
  styles: `
    .toasts {
      position: fixed;
      right: var(--space-5);
      bottom: var(--space-5);
      z-index: var(--z-toast);
      display: flex;
      flex-direction: column;
      gap: var(--space-3);
      margin: 0;
      padding: 0;
      list-style: none;
    }

    .toasts:empty {
      display: none;
    }

    .toasts__item {
      display: flex;
      align-items: center;
      gap: var(--space-4);
      max-width: min(28rem, calc(100vw - var(--space-7)));
      padding: var(--space-3) var(--space-4);
      border-left: 4px solid var(--color-accent);
      border-radius: var(--radius-md);
      background: var(--color-surface-raised);
      box-shadow: var(--shadow-md);
      color: var(--color-ink);
    }

    .toasts__item--error {
      border-left-color: var(--color-danger);
    }

    .toasts__message {
      flex: 1;
      font-size: var(--text-sm);
    }

    .toasts__dismiss {
      border: none;
      background: transparent;
      color: var(--color-ink-muted);
      cursor: pointer;
    }
  `,
})
export class ToastList {
  readonly toasts = input.required<readonly Toast[]>();
  readonly dismissLabel = input('Dismiss');

  readonly dismissed = output<string>();
}

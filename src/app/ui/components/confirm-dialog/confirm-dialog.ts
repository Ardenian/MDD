import { Component, computed, input, output, signal } from '@angular/core';
import { Modal } from '../modal/modal';
import { matchesConfirmPhrase } from './confirm-phrase';

/** One "here is what you are about to lose" row. Keys are the caller's, for its POM. */
export interface ConfirmDetail {
  readonly key: string;
  readonly label: string;
  readonly value: string;
}

/**
 * The standard guard in front of an irreversible action: what will happen, what it
 * costs, and a phrase that has to be typed out before the button does anything.
 *
 * Presentation-only — it injects nothing and every string arrives already translated,
 * so it carries no domain vocabulary of its own. A feature's top-level component is what
 * calls `DialogService` to put one on screen.
 */
@Component({
  selector: 'ui-confirm-dialog',
  imports: [Modal],
  template: `
    <ui-modal [title]="title()" [closeLabel]="cancelLabel()" (dismissed)="cancelled.emit()">
      <div class="confirm" data-testid="confirm-dialog">
        <p class="confirm__body">{{ body() }}</p>

        @if (details().length > 0) {
          <dl class="confirm__details" data-testid="confirm-details">
            @for (detail of details(); track detail.key) {
              <div class="confirm__detail" [attr.data-testid]="detail.key">
                <dt>{{ detail.label }}</dt>
                <dd data-testid="detail-value">{{ detail.value }}</dd>
              </div>
            }
          </dl>
        }

        <label class="confirm__field">
          <span>{{ prompt() }}</span>
          <input
            type="text"
            data-testid="confirm-phrase"
            autocomplete="off"
            [value]="typed()"
            (input)="typed.set($any($event.target).value)"
          />
        </label>
      </div>

      <button modal-actions type="button" data-testid="cancel" (click)="cancelled.emit()">
        {{ cancelLabel() }}
      </button>
      <button
        modal-actions
        type="button"
        class="confirm__submit"
        data-testid="confirm"
        [disabled]="!matches()"
        (click)="confirmed.emit()"
      >
        {{ confirmLabel() }}
      </button>
    </ui-modal>
  `,
  styles: `
    .confirm {
      display: flex;
      flex-direction: column;
      gap: var(--space-4);
    }

    .confirm__body {
      margin: 0;
    }

    .confirm__details {
      display: flex;
      flex-wrap: wrap;
      gap: var(--space-4);
      margin: 0;
    }

    .confirm__detail {
      display: flex;
      gap: var(--space-2);
    }

    .confirm__detail dt {
      color: var(--color-ink-muted);
    }

    .confirm__detail dd {
      margin: 0;
      font-weight: var(--weight-medium);
    }

    .confirm__field {
      display: flex;
      flex-direction: column;
      gap: var(--space-2);
    }

    .confirm__submit:not(:disabled) {
      border-color: var(--color-danger);
      background: var(--color-danger);
      color: var(--color-surface);
    }
  `,
})
export class ConfirmDialog {
  readonly title = input.required<string>();
  readonly body = input.required<string>();
  /** The word to type out, and the sentence asking for it — both already translated. */
  readonly phrase = input.required<string>();
  readonly prompt = input.required<string>();
  readonly confirmLabel = input.required<string>();
  readonly cancelLabel = input.required<string>();
  readonly details = input<readonly ConfirmDetail[]>([]);

  readonly confirmed = output<void>();
  readonly cancelled = output<void>();

  protected readonly typed = signal('');

  protected readonly matches = computed(() => matchesConfirmPhrase(this.typed(), this.phrase()));
}

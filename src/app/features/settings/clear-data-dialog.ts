import { Component, computed, input, output, signal } from '@angular/core';
import { TranslatePipe } from '@ngx-translate/core';
import type { RecordCounts } from '../../data/model/export-bundle';
import { Modal } from '../../ui/components/modal/modal';

/**
 * The confirm-by-typing guard in front of "Clear local data". Presentation-only: it
 * injects nothing, holds only what the user has typed, and emits the decision upward —
 * the Settings page is what calls `DialogService` and does the clearing (ADR 0002).
 */
@Component({
  selector: 'app-clear-data-dialog',
  imports: [TranslatePipe, Modal],
  template: `
    <ui-modal
      [title]="'settings.data.confirm.title' | translate"
      [closeLabel]="'settings.data.confirm.cancel' | translate"
      (dismissed)="cancelled.emit()"
    >
      <div class="clear-data" data-testid="clear-data-dialog">
        <p>{{ 'settings.data.confirm.body' | translate }}</p>

        <dl class="clear-data__counts" data-testid="record-counts">
          @for (row of rows(); track row.key) {
            <div class="clear-data__count" [attr.data-testid]="row.key">
              <dt>{{ 'settings.data.counts.' + row.key | translate }}</dt>
              <dd data-testid="count-value">{{ row.count }}</dd>
            </div>
          }
        </dl>

        <label class="clear-data__field">
          <span>{{ 'settings.data.confirm.prompt' | translate: { phrase: phrase() } }}</span>
          <input
            type="text"
            data-testid="confirm-phrase"
            autocomplete="off"
            [value]="typed()"
            (input)="typed.set($any($event.target).value)"
          />
        </label>
      </div>

      <button modal-actions type="button" data-testid="cancel-clear" (click)="cancelled.emit()">
        {{ 'settings.data.confirm.cancel' | translate }}
      </button>
      <button
        modal-actions
        type="button"
        class="clear-data__confirm"
        data-testid="confirm-clear"
        [disabled]="!matches()"
        (click)="confirmed.emit()"
      >
        {{ 'settings.data.confirm.submit' | translate }}
      </button>
    </ui-modal>
  `,
  styles: `
    .clear-data {
      display: flex;
      flex-direction: column;
      gap: var(--space-4);
    }

    .clear-data__counts {
      display: flex;
      flex-wrap: wrap;
      gap: var(--space-4);
      margin: 0;
    }

    .clear-data__count {
      display: flex;
      gap: var(--space-2);
    }

    .clear-data__count dt {
      color: var(--color-ink-muted);
    }

    .clear-data__count dd {
      margin: 0;
      font-weight: var(--weight-medium);
    }

    .clear-data__field {
      display: flex;
      flex-direction: column;
      gap: var(--space-2);
    }

    .clear-data__confirm:not(:disabled) {
      border-color: var(--color-danger);
      background: var(--color-danger);
      color: var(--color-surface);
    }
  `,
})
export class ClearDataDialog {
  readonly counts = input<RecordCounts | null>(null);
  /** The word the user has to type out; supplied translated by the page. */
  readonly phrase = input.required<string>();

  readonly confirmed = output<void>();
  readonly cancelled = output<void>();

  protected readonly typed = signal('');

  /** Case-insensitive and trimmed: the guard is deliberateness, not typing accuracy. */
  protected readonly matches = computed(
    () => this.typed().trim().toLocaleLowerCase() === this.phrase().toLocaleLowerCase(),
  );

  protected readonly rows = computed(() => {
    const counts = this.counts();
    if (counts === null) {
      return [];
    }
    return (Object.keys(counts) as (keyof RecordCounts)[]).map((key) => ({
      key,
      count: counts[key],
    }));
  });
}

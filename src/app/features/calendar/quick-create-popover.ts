import { afterNextRender, Component, ElementRef, inject, input, output } from '@angular/core';
import { TranslatePipe } from '@ngx-translate/core';

export interface QuickCreateTracker {
  readonly id: string;
  readonly name: string;
  readonly colorIndex: number;
}

let nextId = 0;

/**
 * The small Tracker pick shown where the user asked to log something, before handing off
 * to the Entry form. Presentation-only; `ElementRef` is the one framework primitive it
 * needs, to move focus into itself — an overlay does not do that on its own.
 */
@Component({
  selector: 'app-quick-create-popover',
  imports: [TranslatePipe],
  template: `
    <div
      class="quick-create"
      role="dialog"
      [attr.aria-labelledby]="headingId"
      data-testid="quick-create"
    >
      <p class="quick-create__heading" [id]="headingId">{{ heading() }}</p>

      @if (trackers().length === 0) {
        <p class="quick-create__empty" data-testid="no-trackers">
          {{ 'calendar.quickCreate.noTrackers' | translate }}
        </p>
      } @else {
        <ul class="quick-create__list" [attr.aria-label]="'calendar.quickCreate.label' | translate">
          @for (tracker of trackers(); track tracker.id) {
            <li>
              <button
                type="button"
                class="quick-create__pick"
                [attr.data-testid]="tracker.id"
                (click)="picked.emit(tracker.id)"
              >
                <span
                  class="quick-create__swatch"
                  aria-hidden="true"
                  [style.background]="'var(--color-tracker-' + (tracker.colorIndex + 1) + ')'"
                ></span>
                {{ tracker.name }}
              </button>
            </li>
          }
        </ul>
      }

      <button
        type="button"
        class="quick-create__cancel"
        data-testid="cancel"
        (click)="cancelled.emit()"
      >
        {{ 'calendar.quickCreate.cancel' | translate }}
      </button>
    </div>
  `,
  styles: `
    .quick-create {
      display: flex;
      flex-direction: column;
      gap: var(--space-3);
      min-width: 14rem;
      padding: var(--space-4);
      border: 1px solid var(--color-border);
      border-radius: var(--radius-md);
      background: var(--color-surface-raised);
      box-shadow: var(--shadow-md);
      color: var(--color-ink);
    }

    .quick-create__heading {
      margin: 0;
      font-weight: var(--weight-medium);
    }

    .quick-create__empty {
      margin: 0;
      color: var(--color-ink-muted);
    }

    .quick-create__list {
      display: flex;
      flex-direction: column;
      gap: var(--space-1);
      margin: 0;
      padding: 0;
      list-style: none;
    }

    .quick-create__pick,
    .quick-create__cancel {
      display: flex;
      align-items: center;
      gap: var(--space-3);
      width: 100%;
      padding: var(--space-2) var(--space-3);
      border: 1px solid transparent;
      border-radius: var(--radius-sm);
      background: transparent;
      color: var(--color-ink);
      text-align: start;
      cursor: pointer;
    }

    .quick-create__pick:hover {
      background: var(--color-surface-hover);
    }

    .quick-create__cancel {
      justify-content: center;
      border-color: var(--color-border-strong);
    }

    .quick-create__swatch {
      width: var(--space-4);
      height: var(--space-4);
      border-radius: var(--radius-sm);
    }
  `,
})
export class QuickCreatePopover {
  readonly trackers = input.required<readonly QuickCreateTracker[]>();
  readonly heading = input.required<string>();

  readonly picked = output<string>();
  readonly cancelled = output<void>();

  protected readonly headingId = `quick-create-heading-${++nextId}`;

  constructor() {
    const host: ElementRef<HTMLElement> = inject(ElementRef);
    afterNextRender(() => host.nativeElement.querySelector<HTMLElement>('button')?.focus());
  }
}

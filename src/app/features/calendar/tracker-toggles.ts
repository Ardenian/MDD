import { Component, input, output } from '@angular/core';
import { TranslatePipe } from '@ngx-translate/core';

export interface TrackerToggle {
  readonly id: string;
  readonly name: string;
  readonly archived: boolean;
  readonly colorIndex: number;
  readonly visible: boolean;
}

/** One switch per Tracker plus the child-Entry filter. Presentation-only (ADR 0002). */
@Component({
  selector: 'app-tracker-toggles',
  imports: [TranslatePipe],
  template: `
    <fieldset class="toggles" data-testid="tracker-toggles">
      <legend class="toggles__legend">{{ 'calendar.trackers.legend' | translate }}</legend>

      <div class="toggles__bulk">
        <button type="button" data-testid="show-all" (click)="allSet.emit(true)">
          {{ 'calendar.trackers.all' | translate }}
        </button>
        <button type="button" data-testid="show-none" (click)="allSet.emit(false)">
          {{ 'calendar.trackers.none' | translate }}
        </button>
      </div>

      <ul class="toggles__list">
        @for (tracker of trackers(); track tracker.id) {
          <li [attr.data-testid]="tracker.id">
            <label class="toggles__item">
              <input
                type="checkbox"
                role="switch"
                data-testid="toggle"
                [checked]="tracker.visible"
                (change)="
                  visibilityChange.emit({ id: tracker.id, visible: $any($event.target).checked })
                "
              />
              <span
                class="toggles__swatch"
                aria-hidden="true"
                [style.background]="'var(--color-tracker-' + (tracker.colorIndex + 1) + ')'"
              ></span>
              <span>{{ tracker.name }}</span>
              @if (tracker.archived) {
                <span class="toggles__archived"
                  >({{ 'calendar.trackers.archived' | translate }})</span
                >
              }
            </label>
          </li>
        }
      </ul>

      <label class="toggles__item toggles__children">
        <input
          type="checkbox"
          role="switch"
          data-testid="show-children"
          [checked]="showChildren()"
          (change)="showChildrenChange.emit($any($event.target).checked)"
        />
        <span>{{ 'calendar.trackers.showChildren' | translate }}</span>
      </label>
    </fieldset>
  `,
  styles: `
    .toggles {
      display: flex;
      flex-direction: column;
      gap: var(--space-3);
      margin: 0;
      padding: var(--space-4);
      border: 1px solid var(--color-border);
      border-radius: var(--radius-md);
      background: var(--color-surface);
    }

    .toggles__legend {
      padding: 0 var(--space-2);
      font-weight: var(--weight-medium);
    }

    .toggles__bulk {
      display: flex;
      gap: var(--space-2);
    }

    .toggles__bulk button {
      padding: var(--space-1) var(--space-3);
      border: 1px solid var(--color-border-strong);
      border-radius: var(--radius-sm);
      background: var(--color-surface);
      color: var(--color-ink);
      cursor: pointer;
    }

    .toggles__list {
      display: flex;
      flex-direction: column;
      gap: var(--space-2);
      margin: 0;
      padding: 0;
      list-style: none;
    }

    .toggles__item {
      display: flex;
      align-items: center;
      gap: var(--space-3);
    }

    .toggles__swatch {
      width: var(--space-4);
      height: var(--space-4);
      border-radius: var(--radius-sm);
    }

    .toggles__archived {
      color: var(--color-ink-muted);
      font-size: var(--text-sm);
    }

    .toggles__children {
      padding-top: var(--space-3);
      border-top: 1px solid var(--color-border);
    }
  `,
})
export class TrackerToggles {
  readonly trackers = input.required<readonly TrackerToggle[]>();
  readonly showChildren = input.required<boolean>();

  readonly visibilityChange = output<{ id: string; visible: boolean }>();
  readonly allSet = output<boolean>();
  readonly showChildrenChange = output<boolean>();
}

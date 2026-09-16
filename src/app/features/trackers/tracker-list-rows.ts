import { Component, input, output } from '@angular/core';
import { TranslatePipe } from '@ngx-translate/core';
import type { TrackerListRow } from './trackers-data-access';

/** Presentation-only: injects nothing, emits the opened Tracker id upward (ADR 0002). */
@Component({
  selector: 'app-tracker-list-rows',
  imports: [TranslatePipe],
  template: `
    <ul class="tracker-rows" [attr.data-testid]="testId()">
      @for (row of rows(); track row.id) {
        <li class="tracker-rows__row" [attr.data-testid]="row.id">
          <button type="button" class="tracker-rows__open" data-testid="open-tracker" (click)="opened.emit(row.id)">
            <span class="tracker-rows__name" data-testid="tracker-name">{{ row.name }}</span>
          </button>

          <span class="tracker-rows__version" data-testid="tracker-version">
            @if (row.currentVersion > 0) {
              {{ 'trackers.list.version' | translate: { version: row.currentVersion } }}
            } @else {
              {{ 'trackers.list.noVersion' | translate }}
            }
          </span>

          <span class="tracker-rows__counts" data-testid="tracker-counts">
            {{
              'trackers.list.counts'
                | translate: { fields: row.fieldCount, entries: row.entryCount, presets: row.presetCount }
            }}
          </span>

          @if (row.archived) {
            <span class="tracker-rows__badge" data-testid="archived-badge">
              {{ 'trackers.list.archivedBadge' | translate }}
            </span>
          }
        </li>
      }
    </ul>
  `,
  styles: `
    .tracker-rows {
      display: flex;
      flex-direction: column;
      gap: var(--space-2);
      margin: 0;
      padding: 0;
      list-style: none;
    }

    .tracker-rows:empty {
      display: none;
    }

    .tracker-rows__row {
      display: flex;
      flex-wrap: wrap;
      align-items: center;
      gap: var(--space-4);
      padding: var(--space-4);
      border: 1px solid var(--color-border);
      border-radius: var(--radius-md);
      background: var(--color-surface);
    }

    .tracker-rows__open {
      border: none;
      background: transparent;
      color: var(--color-accent);
      font-size: var(--text-md);
      font-weight: var(--weight-medium);
      cursor: pointer;
    }

    .tracker-rows__version,
    .tracker-rows__counts {
      color: var(--color-ink-muted);
      font-size: var(--text-sm);
    }

    .tracker-rows__counts {
      margin-inline-start: auto;
    }

    .tracker-rows__badge {
      padding: var(--space-1) var(--space-3);
      border-radius: var(--radius-full);
      background: var(--color-surface-sunken);
      color: var(--color-ink-muted);
      font-size: var(--text-xs);
    }
  `,
})
export class TrackerListRows {
  readonly rows = input.required<readonly TrackerListRow[]>();
  readonly testId = input('tracker-list');

  readonly opened = output<string>();
}

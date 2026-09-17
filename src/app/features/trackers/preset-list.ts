import { Component, computed, input, output } from '@angular/core';
import { TranslatePipe } from '@ngx-translate/core';

export interface PresetRow {
  readonly id: string;
  readonly name: string;
  readonly trackerVersion: number;
  readonly stale: boolean;
}

/** Presentation-only: injects nothing, emits which Preset to edit or delete (ADR 0002). */
@Component({
  selector: 'app-preset-list',
  imports: [TranslatePipe],
  template: `
    @if (rows().length === 0) {
      <p class="presets__empty" data-testid="presets-empty">
        {{ 'trackers.presets.empty' | translate }}
      </p>
    } @else {
      <ul class="presets" data-testid="preset-list">
        @for (row of rows(); track row.id) {
          <li class="presets__row" data-testid="preset-row" [attr.data-preset-id]="row.id">
            <span class="presets__name" data-testid="preset-name">{{ row.name }}</span>
            <span class="presets__meta" data-testid="pinned-version">
              {{ 'trackers.presets.pinned' | translate: { version: row.trackerVersion } }}
            </span>
            @if (row.stale) {
              <span class="presets__badge" data-testid="stale-badge">{{
                'trackers.presets.stale' | translate
              }}</span>
            }
            <span class="presets__actions">
              <button type="button" data-testid="edit-preset" (click)="edited.emit(row.id)">
                {{ 'trackers.presets.edit' | translate }}
              </button>
              <button type="button" data-testid="delete-preset" (click)="deleted.emit(row.id)">
                {{ 'trackers.presets.delete' | translate }}
              </button>
            </span>
          </li>
        }
      </ul>
    }

    <!-- Announces staleness as it appears — the badge alone is only visual. -->
    <p class="visually-hidden" aria-live="polite" data-testid="stale-summary">
      @if (staleCount() > 0) {
        {{
          'trackers.presets.staleSummary'
            | translate: { count: staleCount(), current: currentVersion() }
        }}
      }
    </p>
  `,
  styles: `
    .presets {
      display: flex;
      flex-direction: column;
      gap: var(--space-2);
      margin: 0;
      padding: 0;
      list-style: none;
    }

    .presets__row {
      display: flex;
      flex-wrap: wrap;
      align-items: center;
      gap: var(--space-4);
      padding: var(--space-3) var(--space-4);
      border: 1px solid var(--color-border);
      border-radius: var(--radius-md);
      background: var(--color-surface);
    }

    .presets__name {
      font-weight: var(--weight-medium);
    }

    .presets__meta,
    .presets__empty {
      color: var(--color-ink-muted);
      font-size: var(--text-sm);
    }

    .presets__badge {
      padding: var(--space-1) var(--space-3);
      border-radius: var(--radius-full);
      background: var(--color-warning);
      color: var(--color-ink-inverted);
      font-size: var(--text-xs);
      font-weight: var(--weight-medium);
    }

    .presets__actions {
      display: flex;
      gap: var(--space-2);
      margin-inline-start: auto;
    }

    .presets__actions button {
      padding: var(--space-2) var(--space-3);
      border: 1px solid var(--color-border-strong);
      border-radius: var(--radius-md);
      background: var(--color-surface);
      color: var(--color-ink);
      cursor: pointer;
    }
  `,
})
export class PresetList {
  readonly rows = input.required<readonly PresetRow[]>();
  readonly currentVersion = input.required<number>();

  readonly edited = output<string>();
  readonly deleted = output<string>();

  protected readonly staleCount = computed(() => this.rows().filter((row) => row.stale).length);
}

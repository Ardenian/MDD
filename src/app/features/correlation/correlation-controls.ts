import { Component, computed, input, model, output } from '@angular/core';
import { TranslatePipe } from '@ngx-translate/core';
import type { TrackerSummary } from '../../data/facades/tracker-lookup';
import type { BucketSize, Guardrails, LagRange } from '../../data/model/settings';
import { Select } from '../../ui/components/select/select';
import type { SelectOption } from '../../ui/components/select/select-option';

export interface ScanSettings {
  readonly start: string;
  readonly end: string;
  readonly bucketSize: BucketSize;
  readonly lagRange: LagRange;
  readonly guardrails: Guardrails;
  readonly showAll: boolean;
}

/**
 * Everything that decides what a scan looks at, and nothing about running one.
 * Presentation-only: it writes back through `model()` and asks the page to scan.
 */
@Component({
  selector: 'app-correlation-controls',
  imports: [TranslatePipe, Select],
  template: `
    <section class="controls" data-testid="correlation-controls">
      <div class="controls__row">
        <label class="controls__field">
          <span>{{ 'correlation.controls.from' | translate }}</span>
          <input
            type="date"
            data-testid="range-start"
            [value]="settings().start"
            (change)="patch({ start: $any($event.target).value })"
          />
        </label>
        <label class="controls__field">
          <span>{{ 'correlation.controls.to' | translate }}</span>
          <input
            type="date"
            data-testid="range-end"
            [value]="settings().end"
            (change)="patch({ end: $any($event.target).value })"
          />
        </label>

        <ui-select
          data-testid="bucket-size"
          [label]="'correlation.controls.bucketSize' | translate"
          [options]="bucketOptions()"
          [clearable]="false"
          [value]="settings().bucketSize"
          (valueChange)="setBucketSize($event)"
        />
      </div>

      <fieldset class="controls__group" data-testid="scope">
        <legend>{{ 'correlation.controls.scope' | translate }}</legend>
        <p class="controls__hint">
          {{
            (scopeTrackerIds().length === 0
              ? 'correlation.controls.scopeAll'
              : 'correlation.controls.scopeSome'
            ) | translate: { count: scopeTrackerIds().length }
          }}
        </p>
        <ul class="controls__trackers">
          @for (tracker of selectableTrackers(); track tracker.id) {
            <li>
              <label class="controls__toggle" [attr.data-testid]="tracker.id">
                <input
                  type="checkbox"
                  data-testid="scope-toggle"
                  [checked]="scopeTrackerIds().includes(tracker.id)"
                  (change)="scopeToggled.emit(tracker.id)"
                />
                <span>{{ tracker.name }}</span>
              </label>
            </li>
          }
        </ul>
      </fieldset>

      <fieldset class="controls__group" data-testid="guardrails">
        <legend>{{ 'correlation.controls.guardrails' | translate }}</legend>
        <div class="controls__row">
          <label class="controls__field">
            <span>{{ 'correlation.controls.lagMin' | translate }}</span>
            <input
              type="number"
              step="1"
              data-testid="lag-min"
              [value]="settings().lagRange.min"
              (input)="patchLag({ min: number($event) })"
            />
          </label>
          <label class="controls__field">
            <span>{{ 'correlation.controls.lagMax' | translate }}</span>
            <input
              type="number"
              step="1"
              data-testid="lag-max"
              [value]="settings().lagRange.max"
              (input)="patchLag({ max: number($event) })"
            />
          </label>
          <label class="controls__field">
            <span>{{ 'correlation.controls.minSampleSize' | translate }}</span>
            <input
              type="number"
              step="1"
              min="1"
              data-testid="min-sample-size"
              [value]="settings().guardrails.minSampleSize"
              (input)="patchGuardrails({ minSampleSize: number($event) })"
            />
          </label>
          <label class="controls__field">
            <span>{{ 'correlation.controls.pThreshold' | translate }}</span>
            <input
              type="number"
              step="0.001"
              min="0"
              max="1"
              data-testid="p-threshold"
              [value]="settings().guardrails.pThreshold"
              (input)="patchGuardrails({ pThreshold: number($event) })"
            />
          </label>
        </div>

        <label class="controls__toggle">
          <input
            type="checkbox"
            data-testid="benjamini-hochberg"
            [checked]="settings().guardrails.benjaminiHochberg"
            (change)="patchGuardrails({ benjaminiHochberg: checked($event) })"
          />
          <span>{{ 'correlation.controls.benjaminiHochberg' | translate }}</span>
        </label>

        <label class="controls__toggle">
          <input
            type="checkbox"
            data-testid="show-all"
            [checked]="settings().showAll"
            (change)="patch({ showAll: checked($event) })"
          />
          <span>{{ 'correlation.controls.showAll' | translate }}</span>
        </label>
      </fieldset>

      <div class="controls__actions">
        @if (scanning()) {
          <button type="button" data-testid="cancel-scan" (click)="cancelled.emit()">
            {{ 'correlation.controls.cancel' | translate }}
          </button>
        } @else {
          <button type="button" data-testid="find-correlations" (click)="scanRequested.emit()">
            {{ 'correlation.controls.find' | translate }}
          </button>
        }
      </div>
    </section>
  `,
  styles: `
    .controls {
      display: flex;
      flex-direction: column;
      gap: var(--space-4);
      padding: var(--space-5);
      border: 1px solid var(--color-border);
      border-radius: var(--radius-md);
    }

    .controls__row {
      display: flex;
      flex-wrap: wrap;
      gap: var(--space-4);
      align-items: flex-end;
    }

    .controls__group {
      display: flex;
      flex-direction: column;
      gap: var(--space-3);
      margin: 0;
      border: none;
      padding: 0;
    }

    .controls__group legend {
      padding: 0;
      font-weight: var(--weight-medium);
    }

    .controls__field {
      display: flex;
      flex-direction: column;
      gap: var(--space-2);
    }

    .controls__trackers {
      display: flex;
      flex-wrap: wrap;
      gap: var(--space-3);
      margin: 0;
      padding: 0;
      list-style: none;
    }

    .controls__toggle {
      display: inline-flex;
      align-items: center;
      gap: var(--space-2);
    }

    .controls__hint {
      margin: 0;
      color: var(--color-ink-muted);
      font-size: var(--text-sm);
    }
  `,
})
export class CorrelationControls {
  readonly settings = model.required<ScanSettings>();
  readonly trackers = input.required<readonly TrackerSummary[]>();
  readonly scopeTrackerIds = input.required<readonly string[]>();
  readonly scanning = input(false);
  /** Bucket-size labels arrive translated: this component injects nothing. */
  readonly bucketLabels = input.required<Readonly<Record<BucketSize, string>>>();

  readonly scopeToggled = output<string>();
  readonly scanRequested = output<void>();
  readonly cancelled = output<void>();

  /** An Archived Tracker is out of every picker, and one with no Version has no data. */
  protected readonly selectableTrackers = computed(() =>
    this.trackers().filter((tracker) => !tracker.archived && tracker.hasVersion),
  );

  protected readonly bucketOptions = computed<readonly SelectOption[]>(() =>
    (['hour', 'day', 'week', 'month'] as const).map((size) => ({
      value: size,
      label: this.bucketLabels()[size],
    })),
  );

  protected patch(change: Partial<ScanSettings>): void {
    this.settings.update((settings) => ({ ...settings, ...change }));
  }

  protected patchLag(change: Partial<LagRange>): void {
    this.settings.update((settings) => ({
      ...settings,
      lagRange: { ...settings.lagRange, ...change },
    }));
  }

  protected patchGuardrails(change: Partial<Guardrails>): void {
    this.settings.update((settings) => ({
      ...settings,
      guardrails: { ...settings.guardrails, ...change },
    }));
  }

  protected setBucketSize(value: string | null): void {
    if (value !== null) {
      this.patch({ bucketSize: value as BucketSize });
    }
  }

  protected number(event: Event): number {
    const raw = (event.target as HTMLInputElement).value;
    return raw.trim() === '' ? Number.NaN : Number(raw);
  }

  protected checked(event: Event): boolean {
    return (event.target as HTMLInputElement).checked;
  }
}

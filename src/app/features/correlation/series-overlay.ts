import { Component, computed, input, output } from '@angular/core';
import { TranslatePipe } from '@ngx-translate/core';
import type { TrackerSummary } from '../../data/facades/tracker-lookup';
import { Multiselect } from '../../ui/components/multiselect/multiselect';
import type { SelectOption } from '../../ui/components/select/select-option';
import type { Series } from './series-extraction';
import { seriesLabel, type SeriesWords } from './series-naming';
import { TimeSeriesChart } from './time-series-chart';

/**
 * Several Trackers' Series drawn together, with no statistics at all — no coefficient, no
 * lag, no significance. It is the only way to look at Series outside a scan result, and
 * deliberately answers nothing: looking is not a finding.
 *
 * Presentation-only; toggling a Series off only changes what is drawn, never what is
 * loaded.
 */
@Component({
  selector: 'app-series-overlay',
  imports: [TranslatePipe, Multiselect, TimeSeriesChart],
  template: `
    <section class="overlay" data-testid="series-overlay">
      <h2>{{ 'correlation.overlay.heading' | translate }}</h2>
      <p class="overlay__hint">{{ 'correlation.overlay.hint' | translate }}</p>

      <ui-multiselect
        data-testid="overlay-trackers"
        [label]="'correlation.overlay.trackers' | translate"
        [options]="trackerOptions()"
        [value]="selectedCopy()"
        (valueChange)="trackersChanged.emit($event)"
      />

      @if (candidates().length > 0) {
        <fieldset class="overlay__series" data-testid="overlay-series-toggles">
          <legend>{{ 'correlation.overlay.series' | translate }}</legend>
          @for (series of candidates(); track series.id) {
            <label class="overlay__toggle" [attr.data-testid]="series.id">
              <input
                type="checkbox"
                data-testid="series-toggle"
                [checked]="!hiddenSeriesIds().includes(series.id)"
                (change)="seriesToggled.emit(series.id)"
              />
              <span>{{ labelOf(series) }}</span>
            </label>
          }
        </fieldset>

        <app-time-series-chart
          [series]="plotted()"
          [caption]="'correlation.overlay.chartCaption' | translate"
          [bucketLabel]="'correlation.results.bucket' | translate"
        />
      } @else if (selectedTrackerIds().length > 0) {
        <p data-testid="overlay-empty">{{ 'correlation.overlay.empty' | translate }}</p>
      }
    </section>
  `,
  styles: `
    .overlay {
      display: flex;
      flex-direction: column;
      gap: var(--space-4);
      align-items: flex-start;
      padding: var(--space-5);
      border: 1px solid var(--color-border);
      border-radius: var(--radius-md);
    }

    .overlay h2 {
      margin: 0;
      font-size: var(--text-md);
    }

    .overlay__hint {
      margin: 0;
      color: var(--color-ink-muted);
      font-size: var(--text-sm);
    }

    .overlay__series {
      display: flex;
      flex-wrap: wrap;
      gap: var(--space-3);
      margin: 0;
      border: none;
      padding: 0;
    }

    .overlay__toggle {
      display: inline-flex;
      align-items: center;
      gap: var(--space-2);
    }
  `,
})
export class SeriesOverlay {
  readonly trackers = input.required<readonly TrackerSummary[]>();
  readonly selectedTrackerIds = input.required<readonly string[]>();
  /** Every Series of the chosen Trackers, drawn or not. */
  readonly candidates = input.required<readonly Series[]>();
  readonly hiddenSeriesIds = input<readonly string[]>([]);
  /**
   * Already translated, since a chart legend and a checkbox need one plain string and
   * this component injects nothing to translate with.
   */
  readonly seriesWords = input.required<SeriesWords>();

  readonly trackersChanged = output<readonly string[]>();
  readonly seriesToggled = output<string>();

  /** The Multiselect owns its value, so it gets a copy rather than this component's. */
  protected readonly selectedCopy = computed(() => [...this.selectedTrackerIds()]);

  protected readonly trackerOptions = computed<readonly SelectOption[]>(() =>
    this.trackers()
      .filter((tracker) => !tracker.archived && tracker.hasVersion)
      .map((tracker) => ({ value: tracker.id, label: tracker.name })),
  );

  protected readonly plotted = computed(() =>
    this.candidates()
      .filter((series) => !this.hiddenSeriesIds().includes(series.id))
      .map((series) => ({ id: series.id, label: this.labelOf(series), values: series.values })),
  );

  protected labelOf(series: Series): string {
    return seriesLabel(series, this.seriesWords());
  }
}

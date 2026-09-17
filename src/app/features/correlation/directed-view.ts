import { Component, computed, input, output } from '@angular/core';
import { TranslatePipe } from '@ngx-translate/core';
import { correlate } from './correlation-stats';
import type { PairResult } from './discovery';
import { shift } from './lag-scan';
import { ScatterPlot } from './scatter-plot';
import { TimeSeriesChart } from './time-series-chart';

/**
 * One pair, up close: both Series on a shared time axis, a scatter of the Buckets they
 * share, and a lag slider that recomputes the coefficient as it moves — so the reported
 * lag can be checked against its neighbours rather than taken on trust.
 *
 * Presentation-only, so the recomputation is a pure call, not a facade.
 */
@Component({
  selector: 'app-directed-view',
  imports: [TranslatePipe, TimeSeriesChart, ScatterPlot],
  template: `
    <section class="directed" data-testid="directed-view">
      <header class="directed__header">
        <h2 data-testid="directed-title">
          {{
            'correlation.directed.title' | translate: { a: labelOf(pair().a), b: labelOf(pair().b) }
          }}
        </h2>
        <button type="button" data-testid="close-directed" (click)="closed.emit()">
          {{ 'correlation.directed.close' | translate }}
        </button>
      </header>

      <p class="directed__readout" data-testid="readout">
        {{
          'correlation.directed.readout'
            | translate
              : {
                  method: 'correlation.method.' + current().method | translate,
                  coefficient: current().coefficient,
                  n: current().n,
                  p: current().p,
                }
        }}
      </p>

      <p class="directed__caveat" data-testid="caveat">
        {{ 'correlation.caveat' | translate }}
      </p>

      <label class="directed__lag">
        <span>{{ 'correlation.directed.lag' | translate: { lag: lag() } }}</span>
        <input
          type="range"
          data-testid="lag-slider"
          [min]="lagMin()"
          [max]="lagMax()"
          step="1"
          [value]="lag()"
          (input)="lagChanged.emit(+$any($event.target).value)"
        />
      </label>

      <app-time-series-chart
        [series]="plotted()"
        [caption]="'correlation.directed.chartCaption' | translate"
        [bucketLabel]="'correlation.results.bucket' | translate"
      />

      <app-scatter-plot
        [a]="pair().a.values"
        [b]="shifted()"
        [xLabel]="labelOf(pair().a)"
        [yLabel]="labelOf(pair().b)"
        [caption]="'correlation.directed.scatterCaption' | translate"
      />

      <button
        type="button"
        data-testid="pin-from-directed"
        [attr.aria-pressed]="pinned()"
        (click)="pinToggled.emit(pair().id)"
      >
        {{ (pinned() ? 'correlation.results.unpin' : 'correlation.results.pin') | translate }}
      </button>
    </section>
  `,
  styles: `
    .directed {
      display: flex;
      flex-direction: column;
      gap: var(--space-4);
      align-items: flex-start;
      padding: var(--space-5);
      border: 1px solid var(--color-border);
      border-radius: var(--radius-md);
    }

    .directed__header {
      display: flex;
      justify-content: space-between;
      gap: var(--space-4);
      width: 100%;
    }

    .directed__header h2 {
      margin: 0;
      font-size: var(--text-md);
    }

    .directed__readout {
      margin: 0;
      font-weight: var(--weight-medium);
    }

    .directed__caveat {
      margin: 0;
      color: var(--color-ink-muted);
      font-size: var(--text-sm);
    }

    .directed__lag {
      display: flex;
      flex-direction: column;
      gap: var(--space-2);
      width: 100%;
      max-width: 24rem;
    }
  `,
})
export class DirectedView {
  readonly pair = input.required<PairResult>();
  readonly lag = input.required<number>();
  readonly lagMin = input.required<number>();
  readonly lagMax = input.required<number>();
  readonly pinned = input(false);

  readonly lagChanged = output<number>();
  readonly pinToggled = output<string>();
  readonly closed = output<void>();

  /** The second Series moved to the lag on show, which is what the charts plot. */
  protected readonly shifted = computed(() => shift(this.pair().b.values, this.lag()));

  /**
   * Recomputed for the lag on show rather than read off the scan: the slider exists to
   * answer "and what about one Bucket later?", which the scan's single best result
   * cannot.
   */
  protected readonly current = computed(() => {
    const pair = this.pair();
    const result = correlate(pair.a.values, this.shifted(), pair.method);
    return result ?? { method: pair.method, coefficient: 0, n: 0, p: 1 };
  });

  protected readonly plotted = computed(() => [
    { id: this.pair().a.id, label: this.labelOf(this.pair().a), values: this.pair().a.values },
    { id: this.pair().b.id, label: this.labelOf(this.pair().b), values: this.shifted() },
  ]);

  protected labelOf(series: { path: string; name: string }): string {
    return [series.path, series.name].filter((part) => part !== '').join(' · ');
  }
}

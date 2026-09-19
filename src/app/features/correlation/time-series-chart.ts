import { Component, computed, input } from '@angular/core';
import { type ChartBox, extentOf, linePath } from './chart-geometry';
import type { SeriesValue } from './correlation-stats';

export interface PlottedSeries {
  readonly id: string;
  readonly label: string;
  readonly values: readonly SeriesValue[];
}

const BOX: ChartBox = { width: 600, height: 200, padding: 12 };

/**
 * Several Series on one shared time axis. Presentation-only: it injects nothing, and
 * every string it shows arrives translated.
 *
 * Each Series is drawn in its own colour *and* its own dash pattern, so the chart is
 * still readable without colour vision, and the same numbers are published underneath as
 * a table for anyone not reading the picture at all.
 */
@Component({
  selector: 'app-time-series-chart',
  template: `
    <figure class="chart" data-testid="time-series-chart">
      <svg
        class="chart__svg"
        [attr.viewBox]="viewBox"
        role="img"
        [attr.aria-label]="caption()"
        preserveAspectRatio="none"
      >
        @for (line of lines(); track line.id) {
          <path
            class="chart__line"
            [attr.data-testid]="'line-' + line.id"
            [attr.d]="line.path"
            [attr.stroke]="line.colour"
            [attr.stroke-dasharray]="line.dash"
            fill="none"
          />
        }
      </svg>

      <figcaption class="chart__legend" data-testid="chart-legend">
        @for (line of lines(); track line.id) {
          <span class="chart__key" [attr.data-testid]="'key-' + line.id">
            <svg class="chart__swatch" viewBox="0 0 24 8" aria-hidden="true">
              <path
                d="M0,4 L24,4"
                [attr.stroke]="line.colour"
                [attr.stroke-dasharray]="line.dash"
                fill="none"
              />
            </svg>
            <span data-testid="legend-label">{{ line.label }}</span>
          </span>
        }
      </figcaption>

      <table class="visually-hidden" data-testid="chart-table">
        <caption>
          {{
            caption()
          }}
        </caption>
        <thead>
          <tr>
            <th scope="col">{{ bucketLabel() }}</th>
            @for (line of lines(); track line.id) {
              <th scope="col">{{ line.label }}</th>
            }
          </tr>
        </thead>
        <tbody>
          @for (row of rows(); track row.index) {
            <tr>
              <th scope="row">{{ row.index + 1 }}</th>
              @for (cell of row.cells; track $index) {
                <td>{{ cell }}</td>
              }
            </tr>
          }
        </tbody>
      </table>
    </figure>
  `,
  styles: `
    .chart {
      display: flex;
      flex-direction: column;
      gap: var(--space-3);
      margin: 0;
    }

    .chart__svg {
      width: 100%;
      height: 12rem;
      border: 1px solid var(--color-border);
      border-radius: var(--radius-md);
      background: var(--color-surface);
    }

    .chart__line {
      stroke-width: 2;
      vector-effect: non-scaling-stroke;
    }

    .chart__legend {
      display: flex;
      flex-wrap: wrap;
      gap: var(--space-4);
      font-size: var(--text-sm);
    }

    .chart__key {
      display: inline-flex;
      align-items: center;
      gap: var(--space-2);
    }

    .chart__swatch {
      width: 1.5rem;
      height: 0.5rem;
      stroke-width: 2;
    }
  `,
})
export class TimeSeriesChart {
  readonly series = input.required<readonly PlottedSeries[]>();
  /** Describes the chart for anyone who cannot see it; supplied translated. */
  readonly caption = input.required<string>();
  readonly bucketLabel = input.required<string>();
  /** Shared scale draws every Series against one axis; separate gives each its own. */
  readonly sharedScale = input(false);

  protected readonly viewBox = `0 0 ${BOX.width} ${BOX.height}`;

  protected readonly lines = computed(() => {
    const all = this.series();
    const shared = extentOf(all.flatMap((series) => series.values));

    return all.map((series, index) => ({
      id: series.id,
      label: series.label,
      path: linePath(series.values, this.sharedScale() ? shared : extentOf(series.values), BOX),
      colour: PALETTE[index % PALETTE.length],
      dash: DASHES[index % DASHES.length],
    }));
  });

  protected readonly rows = computed(() => {
    const all = this.series();
    const length = all.reduce((longest, series) => Math.max(longest, series.values.length), 0);

    return Array.from({ length }, (_, index) => ({
      index,
      cells: all.map((series) => format(series.values[index])),
    }));
  });
}

/** Distinguishable in both themes; paired with a dash pattern so colour is never alone. */
const PALETTE = [
  'var(--color-accent)',
  'var(--color-danger)',
  'var(--color-ink)',
  'var(--color-accent-hover)',
];

const DASHES = ['none', '6 4', '2 3', '10 3 2 3'];

function format(value: SeriesValue | undefined): string {
  return value === undefined || value === null ? '—' : String(Math.round(value * 1000) / 1000);
}

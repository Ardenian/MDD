import { Component, computed, input } from '@angular/core';
import { type ChartBox, scatterPoints } from './chart-geometry';
import type { SeriesValue } from './correlation-stats';

const BOX: ChartBox = { width: 300, height: 300, padding: 16 };

/**
 * One Bucket per dot: the first Series across, the second up. Presentation-only, with the
 * same pairs published as a table for anyone not reading the picture.
 */
@Component({
  selector: 'app-scatter-plot',
  template: `
    <figure class="scatter" data-testid="scatter-plot">
      <svg class="scatter__svg" [attr.viewBox]="viewBox" role="img" [attr.aria-label]="caption()">
        @for (point of points(); track $index) {
          <circle class="scatter__dot" [attr.cx]="point.x" [attr.cy]="point.y" r="4" />
        }
      </svg>

      <figcaption class="scatter__axes">
        <span data-testid="scatter-x">{{ xLabel() }}</span>
        <span data-testid="scatter-y">{{ yLabel() }}</span>
      </figcaption>

      <table class="visually-hidden" data-testid="scatter-table">
        <caption>
          {{
            caption()
          }}
        </caption>
        <thead>
          <tr>
            <th scope="col">{{ xLabel() }}</th>
            <th scope="col">{{ yLabel() }}</th>
          </tr>
        </thead>
        <tbody>
          @for (pair of pairs(); track $index) {
            <tr>
              <td>{{ pair[0] }}</td>
              <td>{{ pair[1] }}</td>
            </tr>
          }
        </tbody>
      </table>
    </figure>
  `,
  styles: `
    .scatter {
      display: flex;
      flex-direction: column;
      gap: var(--space-2);
      margin: 0;
    }

    .scatter__svg {
      width: 100%;
      max-width: 18rem;
      aspect-ratio: 1;
      border: 1px solid var(--color-border);
      border-radius: var(--radius-md);
      background: var(--color-surface);
    }

    .scatter__dot {
      fill: var(--color-accent);
      fill-opacity: 0.65;
    }

    .scatter__axes {
      display: flex;
      justify-content: space-between;
      gap: var(--space-3);
      color: var(--color-ink-muted);
      font-size: var(--text-sm);
    }
  `,
})
export class ScatterPlot {
  readonly a = input.required<readonly SeriesValue[]>();
  readonly b = input.required<readonly SeriesValue[]>();
  readonly xLabel = input.required<string>();
  readonly yLabel = input.required<string>();
  readonly caption = input.required<string>();

  protected readonly viewBox = `0 0 ${BOX.width} ${BOX.height}`;

  protected readonly points = computed(() => scatterPoints(this.a(), this.b(), BOX));

  protected readonly pairs = computed(() => {
    const [a, b] = [this.a(), this.b()];
    const rows: [number, number][] = [];
    for (let index = 0; index < Math.min(a.length, b.length); index++) {
      const left = a[index];
      const right = b[index];
      if (left !== null && right !== null) {
        rows.push([left, right]);
      }
    }
    return rows;
  });
}

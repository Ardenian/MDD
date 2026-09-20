import { Component, computed, input } from '@angular/core';
import { TranslatePipe } from '@ngx-translate/core';
import { Badge } from '../../ui/components/badge/badge';
import type { Series } from './series-extraction';
import { seriesText, seriesWord } from './series-naming';

/**
 * How a Series is named wherever it is shown.
 *
 * The wording lives here rather than in `series-extraction.ts`, whose `name` is the
 * user's own word for the Field and carries no app vocabulary. Which reading a number is
 * — a mean or a total — is a fact about the Series' kind, so it is said out loud every
 * time rather than left for the reader to assume.
 *
 * Presentation-only: it injects nothing.
 */
@Component({
  selector: 'app-series-label',
  imports: [TranslatePipe, Badge],
  template: `
    <span class="series-label" data-testid="series-label">
      <span data-testid="series-label-text">{{ text() }}</span>
      @if (badgeKey(); as key) {
        <ui-badge [label]="key | translate" />
      }
    </span>
  `,
  styles: `
    .series-label {
      display: inline-flex;
      align-items: baseline;
    }
  `,
})
export class SeriesLabel {
  readonly series = input.required<Series>();

  protected readonly text = computed(() => seriesText(this.series()));

  protected readonly badgeKey = computed<string | null>(() => {
    const word = seriesWord(this.series());
    return word === null ? null : `correlation.series.${word}`;
  });
}

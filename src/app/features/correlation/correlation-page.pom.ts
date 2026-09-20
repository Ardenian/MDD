import { expect, type Locator, type Page } from '@playwright/test';
import { MultiselectObject } from '../../ui/components/multiselect/multiselect.pom';
import { SelectObject } from '../../ui/components/select/select.pom';
import { ResultRowObject, ResultsTableObject } from './results-table.pom';

/** The controls bar: what a scan looks at, and the guardrails it must clear. */
export class CorrelationControlsObject {
  constructor(private readonly root: Locator) {}

  get bucketSize(): SelectObject {
    return new SelectObject(this.root.getByTestId('bucket-size'));
  }

  get rangeStart(): Locator {
    return this.root.getByTestId('range-start');
  }

  get rangeEnd(): Locator {
    return this.root.getByTestId('range-end');
  }

  get minSampleSize(): Locator {
    return this.root.getByTestId('guardrails').getByTestId('min-sample-size');
  }

  get pThreshold(): Locator {
    return this.root.getByTestId('guardrails').getByTestId('p-threshold');
  }

  get benjaminiHochberg(): Locator {
    return this.root.getByTestId('guardrails').getByTestId('benjamini-hochberg');
  }

  get showAll(): Locator {
    return this.root.getByTestId('guardrails').getByTestId('show-all');
  }

  get lagMin(): Locator {
    return this.root.getByTestId('guardrails').getByTestId('lag-min');
  }

  get lagMax(): Locator {
    return this.root.getByTestId('guardrails').getByTestId('lag-max');
  }

  /** Scope toggles are keyed by Tracker id inside the scope fieldset (ADR 0012 nesting). */
  scopeToggle(trackerId: string): Locator {
    return this.root.getByTestId('scope').getByTestId(trackerId).getByTestId('scope-toggle');
  }

  /** The second tier: the Series of the in-scope Trackers, as the last scan found them. */
  get seriesScope(): SeriesScopeObject {
    return new SeriesScopeObject(this.root.getByTestId('series-scope'));
  }

  async setRange(start: string, end: string): Promise<void> {
    await this.rangeStart.fill(start);
    await this.rangeEnd.fill(end);
  }

  async find(): Promise<void> {
    await this.root.getByTestId('find-correlations').click();
  }

  async cancel(): Promise<void> {
    await this.root.getByTestId('cancel-scan').click();
  }
}

/**
 * The Series tier of the scope picker. Its toggles are keyed by Series key, so they are
 * reached by nesting inside this fieldset rather than by namespacing the id (ADR 0012).
 */
export class SeriesScopeObject {
  constructor(private readonly root: Locator) {}

  get self(): Locator {
    return this.root;
  }

  get toggles(): Locator {
    return this.root.getByTestId('series-scope-toggle');
  }

  toggle(seriesId: string): Locator {
    return this.root.getByTestId(seriesId).getByTestId('series-scope-toggle');
  }

  /** What the picker says is in scope — "every Series", or how many were chosen. */
  get hint(): Locator {
    return this.root.getByTestId('series-scope-hint');
  }

  /** The live region that says selections were dropped; empty when none were. */
  get notice(): Locator {
    return this.root.getByTestId('series-scope-notice');
  }

  /** Shown in place of the toggles until a scan has found some Series to offer. */
  get emptyHint(): Locator {
    return this.root.getByTestId('series-scope-empty');
  }
}

export class DirectedViewObject {
  constructor(private readonly root: Locator) {}

  get self(): Locator {
    return this.root;
  }

  get title(): Locator {
    return this.root.getByTestId('directed-title');
  }

  get readout(): Locator {
    return this.root.getByTestId('readout');
  }

  get caveat(): Locator {
    return this.root.getByTestId('caveat');
  }

  get chart(): Locator {
    return this.root.getByTestId('time-series-chart');
  }

  get scatter(): Locator {
    return this.root.getByTestId('scatter-plot');
  }

  get lagSlider(): Locator {
    return this.root.getByTestId('lag-slider');
  }

  async setLag(lag: number): Promise<void> {
    await this.lagSlider.fill(String(lag));
  }

  async close(): Promise<void> {
    await this.root.getByTestId('close-directed').click();
  }
}

export class SeriesOverlayObject {
  constructor(private readonly root: Locator) {}

  get self(): Locator {
    return this.root;
  }

  get trackers(): MultiselectObject {
    return new MultiselectObject(this.root.getByTestId('overlay-trackers'));
  }

  get chart(): Locator {
    return this.root.getByTestId('time-series-chart');
  }

  get legendKeys(): Locator {
    return this.root.getByTestId('chart-legend').getByTestId('legend-label');
  }

  seriesToggle(seriesId: string): Locator {
    return this.root
      .getByTestId('overlay-series-toggles')
      .getByTestId(seriesId)
      .getByTestId('series-toggle');
  }

  get seriesToggles(): Locator {
    return this.root.getByTestId('overlay-series-toggles').getByTestId('series-toggle');
  }
}

export class CorrelationPageObject {
  private readonly root: Locator;

  constructor(private readonly page: Page) {
    // Not scoped to the app shell, so the same object drives the page mounted alone in
    // the ADR 0014 gallery as well as inside the running app.
    this.root = page.getByTestId('correlation-page');
  }

  async open(): Promise<void> {
    await this.page.getByTestId('app-nav').getByTestId('/correlation').click();
    await this.root.waitFor();
  }

  get self(): Locator {
    return this.root;
  }

  get caveat(): Locator {
    return this.root.getByTestId('caveat').first();
  }

  get controls(): CorrelationControlsObject {
    return new CorrelationControlsObject(this.root.getByTestId('correlation-controls'));
  }

  get results(): ResultsTableObject {
    return new ResultsTableObject(this.root.getByTestId('results-table'));
  }

  get table(): Locator {
    return this.results.self;
  }

  get emptyMessage(): Locator {
    return this.root.getByTestId('results-empty');
  }

  /** The pair and Test counts a finished scan reports, whether or not it found anything. */
  get resultsSummary(): Locator {
    return this.root.getByTestId('results-summary');
  }

  get rows(): Locator {
    return this.results.rows;
  }

  firstRow(): ResultRowObject {
    return this.results.firstRow();
  }

  async sortBy(column: string): Promise<void> {
    await this.results.sortBy(column);
  }

  get directed(): DirectedViewObject {
    return new DirectedViewObject(this.root.getByTestId('directed-view'));
  }

  get overlay(): SeriesOverlayObject {
    return new SeriesOverlayObject(this.root.getByTestId('series-overlay'));
  }

  /**
   * A scan is asynchronous. Waiting for the progress line to *disappear* would pass
   * instantly whenever it has not appeared yet, so this waits on a counter that only ever
   * moves when a scan has actually finished.
   */
  async findCorrelations(): Promise<void> {
    const before = Number((await this.root.getAttribute('data-scan-count')) ?? '0');
    await this.controls.find();
    await expect(this.root).toHaveAttribute('data-scan-count', String(before + 1), {
      timeout: 30_000,
    });
  }
}

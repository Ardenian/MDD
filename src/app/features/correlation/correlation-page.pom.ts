import { expect, type Locator, type Page } from '@playwright/test';
import { MultiselectObject } from '../../ui/components/multiselect/multiselect.pom';
import { SelectObject } from '../../ui/components/select/select.pom';

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

/** One row of the results table, scoped by the pair's own id. */
export class ResultRowObject {
  constructor(private readonly root: Locator) {}

  get self(): Locator {
    return this.root;
  }

  get seriesA(): Locator {
    return this.root.getByTestId('seriesA');
  }

  get seriesB(): Locator {
    return this.root.getByTestId('seriesB');
  }

  get lag(): Locator {
    return this.root.getByTestId('lag');
  }

  get coefficient(): Locator {
    return this.root.getByTestId('coefficient');
  }

  get sampleSize(): Locator {
    return this.root.getByTestId('n');
  }

  async open(): Promise<void> {
    await this.root.getByTestId('open-pair').click();
  }

  async pin(): Promise<void> {
    await this.root.getByTestId('pin-pair').click();
  }

  get pinButton(): Locator {
    return this.root.getByTestId('pin-pair');
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
    return this.root.getByTestId('chart-legend').locator('> *');
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
    this.root = page.getByTestId('main-content').getByTestId('correlation-page');
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

  get table(): Locator {
    return this.root.getByTestId('results-table');
  }

  get emptyMessage(): Locator {
    return this.root.getByTestId('results-empty');
  }

  get rows(): Locator {
    return this.table.locator('tbody tr');
  }

  row(pairId: string): ResultRowObject {
    return new ResultRowObject(this.table.getByTestId(pairId));
  }

  /** The strongest finding, which is where the table opens. */
  firstRow(): ResultRowObject {
    return new ResultRowObject(this.rows.first());
  }

  async sortBy(column: string): Promise<void> {
    await this.table.getByTestId(`sort-${column}`).click();
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

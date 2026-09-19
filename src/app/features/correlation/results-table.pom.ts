import { type Locator, type Page } from '@playwright/test';

/** One row of the results table. What pair it shows is read from its cells. */
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

/**
 * The ranked results. Scoped to the table itself so it can be driven either inside the
 * page or mounted on its own in the ADR 0014 gallery.
 */
export class ResultsTableObject {
  constructor(private readonly root: Locator) {}

  static on(page: Page): ResultsTableObject {
    return new ResultsTableObject(page.getByTestId('results-table'));
  }

  get self(): Locator {
    return this.root;
  }

  get rows(): Locator {
    return this.root.getByTestId('result-row');
  }

  /** The strongest finding, which is where the table opens. */
  firstRow(): ResultRowObject {
    return new ResultRowObject(this.rows.first());
  }

  /** The column header cell, which is what carries `aria-sort`. */
  header(column: string): Locator {
    return this.root.getByTestId(`header-${column}`);
  }

  async sortBy(column: string): Promise<void> {
    await this.root.getByTestId(`sort-${column}`).click();
  }
}

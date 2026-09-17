import { expect, type Locator, type Page } from '@playwright/test';
import { SelectObject } from '../../ui/components/select/select.pom';
import { ConfirmDialogObject } from '../../ui/components/confirm-dialog/confirm-dialog.pom';

/** The Correlation defaults section, scoped to its own fieldset. */
export class CorrelationDefaultsObject {
  constructor(private readonly root: Locator) {}

  get bucketSize(): SelectObject {
    return new SelectObject(this.root.getByTestId('bucket-size'));
  }

  get lagMin(): Locator {
    return this.root.getByTestId('lag-min');
  }

  get lagMax(): Locator {
    return this.root.getByTestId('lag-max');
  }

  get minSampleSize(): Locator {
    return this.root.getByTestId('min-sample-size');
  }

  get pThreshold(): Locator {
    return this.root.getByTestId('p-threshold');
  }

  get benjaminiHochberg(): Locator {
    return this.root.getByTestId('benjamini-hochberg');
  }

  get lagRangeError(): Locator {
    return this.root.getByTestId('lag-range-error');
  }

  get pThresholdError(): Locator {
    return this.root.getByTestId('p-threshold-error');
  }
}

export class SettingsPageObject {
  private readonly root: Locator;

  constructor(private readonly page: Page) {
    this.root = page.getByTestId('settings-page');
  }

  async open(): Promise<void> {
    await this.page.getByTestId('app-nav').getByTestId('/settings').click();
    await this.root.waitFor();
  }

  async reload(): Promise<void> {
    await this.page.reload();
    await this.root.waitFor();
  }

  get self(): Locator {
    return this.root;
  }

  get correlation(): CorrelationDefaultsObject {
    return new CorrelationDefaultsObject(this.root.getByTestId('correlation-defaults'));
  }

  get expansionDepthCap(): Locator {
    return this.root.getByTestId('schema-settings').getByTestId('expansion-depth-cap');
  }

  get expansionDepthCapError(): Locator {
    return this.root.getByTestId('schema-settings').getByTestId('expansion-depth-cap-error');
  }

  get storageProfile(): SelectObject {
    return SelectObject.within(this.root.getByTestId('storage-profile'));
  }

  get saveButton(): Locator {
    return this.root.getByTestId('save-settings');
  }

  get blocked(): Locator {
    return this.root.getByTestId('settings-blocked');
  }

  async save(): Promise<void> {
    await this.saveButton.click();
  }

  /**
   * Saving is asynchronous, so a test that navigates straight afterwards can outrun the
   * write. The page reflects what is persisted, which is what this waits for.
   */
  async waitForSavedCap(cap: number): Promise<void> {
    await expect(this.root).toHaveAttribute('data-saved-cap', String(cap));
  }

  async waitForSavedBucketSize(size: string): Promise<void> {
    await expect(this.root).toHaveAttribute('data-saved-bucket-size', size);
  }

  /**
   * Clearing reloads the app, so the reload has to be awaited before the test moves on —
   * see `DataTransferPageObject.completeImport`.
   */
  async clearLocalDataAndConfirm(phrase: string): Promise<void> {
    const dialog = await this.clearLocalData();
    await dialog.type(phrase);
    await Promise.all([this.page.waitForEvent('load'), dialog.confirm()]);
    await this.root.waitFor();
  }

  async clearLocalData(): Promise<ConfirmDialogObject> {
    await this.root.getByTestId('data-settings').getByTestId('clear-local-data').click();
    const dialog = new ConfirmDialogObject(this.page);
    await dialog.self.waitFor();
    return dialog;
  }
}

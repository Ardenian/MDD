import type { Download, Locator, Page } from '@playwright/test';
import { ConfirmDialogObject } from '../../ui/components/confirm-dialog/confirm-dialog.pom';

export class DataTransferPageObject {
  private readonly root: Locator;

  constructor(private readonly page: Page) {
    // Not scoped to the app shell, so the same object drives the page mounted alone in
    // the ADR 0014 gallery as well as inside the running app.
    this.root = page.getByTestId('data-transfer-page');
  }

  async open(): Promise<void> {
    await this.page.getByTestId('app-nav').getByTestId('/data-transfer').click();
    await this.root.waitFor();
  }

  get self(): Locator {
    return this.root;
  }

  private get exportSection(): Locator {
    return this.root.getByTestId('export-section');
  }

  private get importSection(): Locator {
    return this.root.getByTestId('import-section');
  }

  get importError(): Locator {
    return this.importSection.getByTestId('import-error');
  }

  get selectedFile(): Locator {
    return this.importSection.getByTestId('selected-file');
  }

  get importButton(): Locator {
    return this.importSection.getByTestId('start-import');
  }

  /** The download event belongs to the page, so waiting for it belongs in the POM. */
  async export(): Promise<Download> {
    const [download] = await Promise.all([
      this.page.waitForEvent('download'),
      this.exportSection.getByTestId('export-data').click(),
    ]);
    return download;
  }

  /** The exported file's contents, parsed — what a test actually wants to assert on. */
  async exportBundle(): Promise<Record<string, unknown>> {
    const download = await this.export();
    const stream = await download.createReadStream();
    const chunks: Buffer[] = [];
    for await (const chunk of stream) {
      chunks.push(Buffer.from(chunk));
    }
    return JSON.parse(Buffer.concat(chunks).toString('utf8')) as Record<string, unknown>;
  }

  async chooseFile(name: string, contents: string): Promise<void> {
    await this.importSection.getByTestId('import-file').setInputFiles({
      name,
      mimeType: 'application/json',
      buffer: Buffer.from(contents, 'utf8'),
    });
  }

  async startImport(): Promise<ConfirmDialogObject> {
    await this.importButton.click();
    const dialog = new ConfirmDialogObject(this.page);
    await dialog.self.waitFor();
    return dialog;
  }

  /**
   * A confirmed import replaces the whole dataset and reloads the app, so anything the
   * test does next must wait for that reload — a click issued against the outgoing
   * document is simply lost. The listener is registered before the click, not after.
   */
  async completeImport(phrase: string): Promise<void> {
    const dialog = await this.startImport();
    await dialog.type(phrase);
    await Promise.all([this.page.waitForEvent('load'), dialog.confirm()]);
    await this.root.waitFor();
  }
}

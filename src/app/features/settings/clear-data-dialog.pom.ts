import type { Locator, Page } from '@playwright/test';
import type { RecordCounts } from '../../data/model/export-bundle';
import { ModalObject } from '../../ui/components/modal/modal.pom';

/**
 * The confirm-by-typing guard in front of clearing local data. The actions are projected
 * into the Modal's own footer, so they are scoped to it rather than to the body content.
 */
export class ClearDataDialogObject {
  private readonly modal: ModalObject;

  constructor(page: Page) {
    this.modal = new ModalObject(page.getByTestId('modal'));
  }

  get self(): Locator {
    return this.modal.self;
  }

  private get body(): Locator {
    return this.modal.body.getByTestId('clear-data-dialog');
  }

  get confirmButton(): Locator {
    return this.modal.actions.getByTestId('confirm-clear');
  }

  /** Counts are keyed by aggregate, scoped inside the counts list (ADR 0012 nesting). */
  count(aggregate: keyof RecordCounts): Locator {
    return this.body.getByTestId('record-counts').getByTestId(aggregate).getByTestId('count-value');
  }

  async type(phrase: string): Promise<void> {
    await this.body.getByTestId('confirm-phrase').fill(phrase);
  }

  async confirm(): Promise<void> {
    await this.confirmButton.click();
  }

  async cancel(): Promise<void> {
    await this.modal.actions.getByTestId('cancel-clear').click();
    await this.self.waitFor({ state: 'detached' });
  }
}

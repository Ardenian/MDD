import type { Locator, Page } from '@playwright/test';
import { ModalObject } from '../modal/modal.pom';

/**
 * The confirm-by-typing guard. Its actions are projected into the Modal's own footer, so
 * they are scoped to that rather than to the body content.
 */
export class ConfirmDialogObject {
  private readonly modal: ModalObject;

  constructor(page: Page) {
    this.modal = new ModalObject(page.getByTestId('modal'));
  }

  get self(): Locator {
    return this.modal.self;
  }

  private get body(): Locator {
    return this.modal.body.getByTestId('confirm-dialog');
  }

  get confirmButton(): Locator {
    return this.modal.actions.getByTestId('confirm');
  }

  /** A detail row is keyed by whatever the caller keyed it with (ADR 0012 nesting). */
  detail(key: string): Locator {
    return this.body.getByTestId('confirm-details').getByTestId(key).getByTestId('detail-value');
  }

  async type(phrase: string): Promise<void> {
    await this.body.getByTestId('confirm-phrase').fill(phrase);
  }

  async confirm(): Promise<void> {
    await this.confirmButton.click();
  }

  async cancel(): Promise<void> {
    await this.modal.actions.getByTestId('cancel').click();
    await this.self.waitFor({ state: 'detached' });
  }
}

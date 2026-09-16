import type { Locator } from '@playwright/test';

export class ToastListObject {
  constructor(private readonly root: Locator) {}

  static within(scope: Locator): ToastListObject {
    return new ToastListObject(scope.getByTestId('toast-list'));
  }

  get messages(): Locator {
    return this.root.getByTestId('toast-message');
  }

  async dismissFirst(): Promise<void> {
    await this.root.getByTestId('toast-dismiss').first().click();
  }
}

import type { Locator } from '@playwright/test';

/** Scoped to the modal itself, so a feature POM composes it rather than re-deriving it. */
export class ModalObject {
  constructor(private readonly root: Locator) {}

  static within(scope: Locator): ModalObject {
    return new ModalObject(scope.getByTestId('modal'));
  }

  get self(): Locator {
    return this.root;
  }

  get title(): Locator {
    return this.root.getByTestId('modal-title');
  }

  get body(): Locator {
    return this.root.getByTestId('modal-body');
  }

  get actions(): Locator {
    return this.root.getByTestId('modal-footer');
  }

  async close(): Promise<void> {
    await this.root.getByTestId('modal-close').click();
  }
}

import type { Locator } from '@playwright/test';

export class QuickCreatePopoverObject {
  constructor(private readonly root: Locator) {}

  get self(): Locator {
    return this.root;
  }

  get noTrackers(): Locator {
    return this.root.getByTestId('no-trackers');
  }

  tracker(trackerId: string): Locator {
    return this.root.getByTestId(trackerId);
  }

  async pick(trackerId: string): Promise<void> {
    await this.tracker(trackerId).click();
  }

  async cancel(): Promise<void> {
    await this.root.getByTestId('cancel').click();
  }
}

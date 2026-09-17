import type { Locator } from '@playwright/test';

export class TrackerTogglesObject {
  constructor(private readonly root: Locator) {}

  toggle(trackerId: string): Locator {
    return this.root.getByTestId(trackerId).getByTestId('toggle');
  }

  async setVisible(trackerId: string, visible: boolean): Promise<void> {
    await this.toggle(trackerId).setChecked(visible);
  }

  async showAll(): Promise<void> {
    await this.root.getByTestId('show-all').click();
  }

  async showNone(): Promise<void> {
    await this.root.getByTestId('show-none').click();
  }

  get showChildrenSwitch(): Locator {
    return this.root.getByTestId('show-children');
  }

  async showChildren(show: boolean): Promise<void> {
    await this.showChildrenSwitch.setChecked(show);
  }
}

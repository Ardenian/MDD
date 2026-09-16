import type { Locator, Page } from '@playwright/test';
import { TrackerListRowsObject } from './tracker-list-rows.pom';

export class TrackersPageObject {
  private readonly root: Locator;

  constructor(private readonly page: Page) {
    this.root = page.getByTestId('main-content');
  }

  async open(): Promise<void> {
    await this.page.getByTestId('app-nav').getByTestId('/trackers').click();
  }

  get heading(): Locator {
    return this.root.getByTestId('page-title');
  }

  get emptyMessage(): Locator {
    return this.root.getByTestId('trackers-empty');
  }

  get list(): TrackerListRowsObject {
    return new TrackerListRowsObject(this.root.getByTestId('tracker-list'));
  }

  get archivedList(): TrackerListRowsObject {
    return new TrackerListRowsObject(this.root.getByTestId('archived-tracker-list'));
  }

  get archivedSection(): Locator {
    return this.root.getByTestId('archived-section');
  }

  /** Creating navigates straight into the designer, which is where Fields are authored. */
  async createTracker(name: string): Promise<void> {
    await this.root.getByTestId('new-tracker-name').fill(name);
    await this.root.getByTestId('create-tracker').click();
  }
}

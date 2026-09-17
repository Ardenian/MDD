import type { Locator, Page } from '@playwright/test';
import { TrackerListRowsObject } from './tracker-list-rows.pom';

export class TrackersPageObject {
  private readonly root: Locator;

  constructor(private readonly page: Page) {
    this.root = page.getByTestId('main-content').getByTestId('trackers-page');
  }

  async open(): Promise<void> {
    await this.page.getByTestId('app-nav').getByTestId('/trackers').click();
    // Fail here, on the navigation itself, rather than later on whatever was expected.
    await this.root.waitFor();
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

  /** The archived section is collapsed by design (trackers/SPEC.md), so open it to read it. */
  async expandArchived(): Promise<void> {
    if ((await this.archivedSection.getAttribute('open')) === null) {
      await this.archivedSection.getByTestId('archived-summary').click();
    }
  }

  /** Creating navigates straight into the designer, which is where Fields are authored. */
  async createTracker(name: string): Promise<void> {
    await this.root.getByTestId('new-tracker-name').fill(name);
    await this.root.getByTestId('create-tracker').click();
  }
}

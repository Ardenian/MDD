import type { Locator } from '@playwright/test';

/** One Tracker row, scoped by its id so short ids inside it stay unambiguous (ADR 0012). */
export class TrackerRowObject {
  constructor(private readonly root: Locator) {}

  get self(): Locator {
    return this.root;
  }

  get name(): Locator {
    return this.root.getByTestId('tracker-name');
  }

  get version(): Locator {
    return this.root.getByTestId('tracker-version');
  }

  get counts(): Locator {
    return this.root.getByTestId('tracker-counts');
  }

  get archivedBadge(): Locator {
    return this.root.getByTestId('archived-badge');
  }

  async open(): Promise<void> {
    await this.root.getByTestId('open-tracker').click();
  }
}

export class TrackerListRowsObject {
  constructor(private readonly root: Locator) {}

  get self(): Locator {
    return this.root;
  }

  row(trackerId: string): TrackerRowObject {
    return new TrackerRowObject(this.root.getByTestId(trackerId));
  }

  /**
   * A row's `data-testid` is the Tracker's own id — unique inside this list's scope, so
   * no namespacing is needed. Tests get the id from the Flow that created the Tracker.
   */
  get names(): Locator {
    return this.root.getByTestId('tracker-name');
  }
}

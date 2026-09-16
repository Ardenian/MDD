import type { Locator, Page } from '@playwright/test';
import { ReorderableListObject } from '../../ui/components/reorderable-list/reorderable-list.pom';
import { SelectObject } from '../../ui/components/select/select.pom';
import { DraftFieldRowObject } from './draft-field-row.pom';

export class TrackerDesignerPageObject {
  private readonly root: Locator;

  constructor(private readonly page: Page) {
    this.root = page.getByTestId('main-content');
  }

  /** The designer is reached by opening a Tracker, so its id is in the URL. */
  trackerId(): string {
    return this.page.url().split('/trackers/')[1] ?? '';
  }

  get nameInput(): Locator {
    return this.root.getByTestId('tracker-name');
  }

  async rename(name: string): Promise<void> {
    await this.nameInput.fill(name);
    await this.nameInput.blur();
  }

  get defaultTimeMode(): SelectObject {
    return SelectObject.within(this.root.getByTestId('tracker-time-mode'));
  }

  get draftStatus(): Locator {
    return this.root.getByTestId('draft-status');
  }

  get problems(): Locator {
    return this.root.getByTestId('draft-problems');
  }

  get fields(): ReorderableListObject {
    return ReorderableListObject.within(this.root);
  }

  /** Draft rows are keyed by position, so a row POM is scoped per index (ADR 0012). */
  field(index: number): DraftFieldRowObject {
    return new DraftFieldRowObject(
      this.root.getByTestId('reorderable-list').getByTestId(String(index)),
    );
  }

  async addField(): Promise<void> {
    await this.root.getByTestId('add-field').click();
  }

  async commit(): Promise<void> {
    await this.root.getByTestId('commit-draft').click();
  }

  async discard(): Promise<void> {
    await this.root.getByTestId('discard-draft').click();
  }

  get commitButton(): Locator {
    return this.root.getByTestId('commit-draft');
  }

  async toggleArchived(): Promise<void> {
    await this.root.getByTestId('archive-toggle').click();
  }

  async backToTrackers(): Promise<void> {
    await this.root.getByTestId('back-to-trackers').click();
  }
}

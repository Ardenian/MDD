import type { Locator, Page } from '@playwright/test';
import { QuickCreatePopoverObject } from './quick-create-popover.pom';
import { TrackerTogglesObject } from './tracker-toggles.pom';

/** One Entry on the Calendar — in the grid with its Fadeout bands, or in the day strip. */
export class CalendarEntryObject {
  constructor(private readonly root: Locator) {}

  get button(): Locator {
    return this.root.getByTestId('entry-button');
  }

  get fadeBefore(): Locator {
    return this.root.getByTestId('fade-before');
  }

  get fadeAfter(): Locator {
    return this.root.getByTestId('fade-after');
  }

  async open(): Promise<void> {
    await this.button.click();
  }
}

/** One day column, scoped by its `YYYY-MM-DD` key (ADR 0012 nesting). */
export class CalendarDayObject {
  constructor(private readonly root: Locator) {}

  get label(): Locator {
    return this.root.getByTestId('day-label');
  }

  /** Half-hour slots from midnight: slot 29 starts at 14:30. */
  slot(index: number): Locator {
    return this.root.getByTestId(`slot-${index}`);
  }

  /** Wherever the Entry is drawn in this day — grid or strip. */
  entry(entryId: string): CalendarEntryObject {
    return new CalendarEntryObject(this.root.getByTestId(entryId));
  }

  stripEntry(entryId: string): CalendarEntryObject {
    return new CalendarEntryObject(this.root.getByTestId('strip').getByTestId(entryId));
  }

  get nowLine(): Locator {
    return this.root.getByTestId('now-line');
  }

  /** Every Entry drawn in this day, on the grid and in the strip alike. */
  get entries(): Locator {
    return this.root.getByTestId('entry-button');
  }

  get timedEntries(): Locator {
    return this.root.getByTestId('timed-layer').getByTestId('entry-button');
  }

  get stripEntries(): Locator {
    return this.root.getByTestId('strip').getByTestId('entry-button');
  }

  /**
   * The Fadeout bands in this day. Scoped to the day rather than to one Entry, so a test
   * can assert on them without having to know the Entry's id first.
   */
  get fadeBefore(): Locator {
    return this.root.getByTestId('fade-before');
  }

  get fadeAfter(): Locator {
    return this.root.getByTestId('fade-after');
  }

  /** Opens an Entry by position, for tests that never learn its id. */
  async openEntry(index = 0): Promise<void> {
    await this.entries.nth(index).click();
  }
}

export class CalendarPageObject {
  private readonly root: Locator;

  constructor(private readonly page: Page) {
    this.root = page.getByTestId('main-content');
  }

  async open(): Promise<void> {
    await this.page.getByTestId('app-nav').getByTestId('/calendar').click();
    await this.grid.waitFor();
  }

  /** The visible date is a URL parameter, so a day is directly addressable. */
  async openDay(day: string): Promise<void> {
    await this.page.goto(`/calendar?date=${day}`);
    await this.grid.waitFor();
  }

  async reload(): Promise<void> {
    await this.page.reload();
    await this.grid.waitFor();
  }

  private get toolbar(): Locator {
    return this.root.getByTestId('calendar-toolbar');
  }

  get title(): Locator {
    return this.toolbar.getByTestId('page-title');
  }

  get grid(): Locator {
    return this.root.getByTestId('calendar-grid');
  }

  get dayLabels(): Locator {
    return this.grid.getByTestId('day-label');
  }

  async switchTo(view: 'day' | 'week'): Promise<void> {
    await this.toolbar.getByTestId(`view-${view}`).click();
  }

  async previous(): Promise<void> {
    await this.toolbar.getByTestId('previous').click();
  }

  async next(): Promise<void> {
    await this.toolbar.getByTestId('next').click();
  }

  async today(): Promise<void> {
    await this.toolbar.getByTestId('today').click();
  }

  async goToDate(day: string): Promise<void> {
    await this.toolbar.getByTestId('date-picker').fill(day);
  }

  async now(): Promise<void> {
    await this.toolbar.getByTestId('now').click();
  }

  /** The day a Date falls on, for Entries logged "now" rather than at a fixed instant. */
  dayOf(date: Date): CalendarDayObject {
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return this.day(`${date.getFullYear()}-${month}-${day}`);
  }

  day(key: string): CalendarDayObject {
    return new CalendarDayObject(this.grid.getByTestId(key));
  }

  get toggles(): TrackerTogglesObject {
    return new TrackerTogglesObject(this.root.getByTestId('tracker-toggles'));
  }

  /** The popover renders in the overlay container, outside the page's main content. */
  get quickCreate(): QuickCreatePopoverObject {
    return new QuickCreatePopoverObject(this.page.getByTestId('quick-create'));
  }
}

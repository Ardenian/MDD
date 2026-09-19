import { expect, test } from '../../testing/support/mount-fixture';
import { CalendarPageObject } from './calendar-page.pom';

/** The day the scenario opens on, which is today — the page's own default. */
function today(): string {
  const now = new Date();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  return `${now.getFullYear()}-${month}-${day}`;
}

/**
 * Keyboard navigation and the empty-state message are UI-only concerns: they need the
 * grid on screen, not a database or an app boot (ADR 0011, ADR 0014).
 */
test.describe('Calendar interaction', () => {
  test('the grid is operable by keyboard, and focus returns to the slot', async ({
    harness,
    mountPage,
  }) => {
    await harness.mount('calendar-page.scenario.ts#oneTracker');
    const calendar = new CalendarPageObject(mountPage);
    const day = calendar.day(today());

    await day.slot(28).focus();
    await day.slot(28).press('ArrowDown');
    await expect(day.slot(29)).toBeFocused();
    await day.slot(29).press('Enter');
    await expect(calendar.quickCreate.self).toBeVisible();

    await calendar.quickCreate.cancel();

    // Focus comes back to where it left, rather than to the top of the page.
    await expect(calendar.quickCreate.self).toHaveCount(0);
    await expect(day.slot(29)).toBeFocused();
  });

  test('quick-create explains when no Tracker is ready to log against', async ({
    harness,
    mountPage,
  }) => {
    await harness.mount('calendar-page.scenario.ts#noCommittedTracker');
    const calendar = new CalendarPageObject(mountPage);

    await calendar.day(today()).slot(20).click();

    await expect(calendar.quickCreate.noTrackers).toBeVisible();
  });
});

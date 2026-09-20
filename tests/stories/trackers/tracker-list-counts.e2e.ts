import { CalendarPageObject } from '../../../src/app/features/calendar/calendar-page.pom';
import { EntryFormDialogObject } from '../../../src/app/features/entries/entry-form-dialog.pom';
import { TrackersPageObject } from '../../../src/app/features/trackers/trackers-page.pom';
import { expect, test } from '../../../src/app/testing/support/app-fixture';
import { createTracker } from '../../flows/create-tracker.flow';

test.describe('The Tracker list’s counts', () => {
  /**
   * Navigates entirely in-app: a `page.goto` would rebuild the app and refill every
   * cache, which is exactly what used to hide a stale Entry count here.
   */
  test('an Entry logged from the Calendar is counted on the Tracker list', async ({ appPage }) => {
    const sleepId = await createTracker(appPage, {
      name: 'Sleep',
      fields: [{ name: 'Satisfaction', dataType: 'integer' }],
    });

    const calendar = new CalendarPageObject(appPage);
    await calendar.open();
    await calendar.dayOf(new Date()).slot(20).click();
    await calendar.quickCreate.pick(sleepId);
    await new EntryFormDialogObject(appPage).save();
    await expect(calendar.dayOf(new Date()).entries).toHaveCount(1);

    const list = new TrackersPageObject(appPage);
    await list.open();
    await expect(list.list.row(sleepId).counts).toContainText('1 Entries');
  });
});

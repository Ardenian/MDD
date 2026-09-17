import { CalendarPageObject } from '../../../src/app/features/calendar/calendar-page.pom';
import { EntryFormDialogObject } from '../../../src/app/features/entries/entry-form-dialog.pom';
import { expect, test } from '../../../src/app/testing/support/app-fixture';
import { readLiveEntries } from '../../../src/app/testing/support/local-database';
import { createTracker } from '../../flows/create-tracker.flow';
import { logEntry } from '../../flows/log-entry.flow';

/** A Monday well away from any DST change, in the browser's own timezone. */
const DAY = '2026-03-02';
const local = (hours: number, minutes = 0) => new Date(2026, 2, 2, hours, minutes).toISOString();

test.describe('Calendar', () => {
  test('a Period sits on the grid and a Day-bucketed Entry in the strip above it', async ({
    appPage,
  }) => {
    const sleepId = await createTracker(appPage, {
      name: 'Sleep',
      fields: [{ name: 'Satisfaction', dataType: 'integer' }],
      defaultTimeMode: 'period',
    });
    await logEntry(appPage, { trackerId: sleepId, at: local(9) });
    await logEntry(appPage, { trackerId: sleepId, at: local(9), mode: 'dayBucketed' });
    const entries = await readLiveEntries(appPage);
    const period = entries.find((entry) => entry.placement.kind === 'period')!;
    const wholeDay = entries.find((entry) => entry.placement.kind === 'dayBucketed')!;
    const calendar = new CalendarPageObject(appPage);

    await calendar.openDay(DAY);

    await expect(calendar.day(DAY).entry(period.id).button).toBeVisible();
    await expect(calendar.day(DAY).stripEntry(period.id).button).toHaveCount(0);
    await expect(calendar.day(DAY).stripEntry(wholeDay.id).button).toBeVisible();
  });

  test('a trailing Fadeout draws a falloff band after the block', async ({ appPage }) => {
    const sleepId = await createTracker(appPage, {
      name: 'Sleep',
      fields: [{ name: 'Satisfaction', dataType: 'integer' }],
      defaultTimeMode: 'period',
    });
    const form = new EntryFormDialogObject(appPage);
    await form.openNew({ trackerId: sleepId, at: local(9) });
    await form.placement.setFadeout(0, 30);
    await form.save();
    const [entry] = await readLiveEntries(appPage);
    const calendar = new CalendarPageObject(appPage);

    await calendar.openDay(DAY);

    await expect(calendar.day(DAY).entry(entry!.id).fadeAfter).toBeVisible();
    await expect(calendar.day(DAY).entry(entry!.id).fadeBefore).toHaveCount(0);
  });

  test('clicking an empty slot starts an Entry there, in the Tracker’s default Time mode', async ({
    appPage,
  }) => {
    const sleepId = await createTracker(appPage, {
      name: 'Sleep',
      fields: [{ name: 'Satisfaction', dataType: 'integer' }],
      defaultTimeMode: 'period',
    });
    const calendar = new CalendarPageObject(appPage);
    await calendar.openDay(DAY);

    await calendar.day(DAY).slot(29).click();
    await calendar.quickCreate.pick(sleepId);

    const form = new EntryFormDialogObject(appPage);
    await expect(form.placement.mode.option('period')).toHaveAttribute('aria-selected', 'true');
    await expect(form.placement.start).toHaveValue(`${DAY}T14:30`);
    await form.save();

    const [entry] = await readLiveEntries(appPage);
    await expect(calendar.day(DAY).entry(entry!.id).button).toBeVisible();
  });

  test('Now starts a Point Entry at the current time', async ({ appPage }) => {
    const sleepId = await createTracker(appPage, {
      name: 'Sleep',
      fields: [{ name: 'Satisfaction', dataType: 'integer' }],
      defaultTimeMode: 'period',
    });
    const calendar = new CalendarPageObject(appPage);
    await calendar.open();

    await calendar.now();
    await calendar.quickCreate.pick(sleepId);

    const form = new EntryFormDialogObject(appPage);
    await expect(form.placement.mode.option('point')).toHaveAttribute('aria-selected', 'true');
    await expect(form.placement.at).not.toHaveValue('');
  });

  test('Week view shows seven days, remembers itself, and opens an Entry on click', async ({
    appPage,
  }) => {
    const sleepId = await createTracker(appPage, {
      name: 'Sleep',
      fields: [{ name: 'Satisfaction', dataType: 'integer' }],
    });
    await logEntry(appPage, { trackerId: sleepId, at: local(9) });
    const [entry] = await readLiveEntries(appPage);
    const calendar = new CalendarPageObject(appPage);
    await calendar.openDay(DAY);

    await calendar.switchTo('week');
    await expect(calendar.dayLabels).toHaveCount(7);
    await calendar.reload();
    await expect(calendar.dayLabels).toHaveCount(7);

    await calendar.day(DAY).entry(entry!.id).open();

    await expect(new EntryFormDialogObject(appPage).form).toBeVisible();
  });

  test('a Tracker toggled off disappears, and stays off after a reload', async ({ appPage }) => {
    const sleepId = await createTracker(appPage, {
      name: 'Sleep',
      fields: [{ name: 'Hours', dataType: 'decimal' }],
    });
    const workoutId = await createTracker(appPage, {
      name: 'Workout',
      fields: [{ name: 'Minutes', dataType: 'integer' }],
    });
    await logEntry(appPage, { trackerId: sleepId, at: local(7) });
    await logEntry(appPage, { trackerId: workoutId, at: local(18) });
    const entries = await readLiveEntries(appPage);
    const sleep = entries.find((entry) => entry.trackerId === sleepId)!;
    const workout = entries.find((entry) => entry.trackerId === workoutId)!;
    const calendar = new CalendarPageObject(appPage);
    await calendar.openDay(DAY);

    await calendar.toggles.setVisible(workoutId, false);
    await expect(calendar.day(DAY).entry(workout.id).button).toHaveCount(0);
    await expect(calendar.day(DAY).entry(sleep.id).button).toBeVisible();

    await calendar.reload();
    await expect(calendar.day(DAY).entry(workout.id).button).toHaveCount(0);

    await calendar.toggles.showAll();
    await expect(calendar.day(DAY).entry(workout.id).button).toBeVisible();
  });

  test('child Entries appear at their parent only when asked for, and open the parent', async ({
    appPage,
  }) => {
    const ingredientId = await createTracker(appPage, {
      name: 'Ingredient',
      fields: [{ name: 'grams', dataType: 'decimal' }],
    });
    const mealId = await createTracker(appPage, {
      name: 'Meal',
      fields: [
        {
          name: 'Ingredients',
          dataType: 'reference',
          targetTrackerId: ingredientId,
          cardinality: 'many',
        },
      ],
    });
    const form = new EntryFormDialogObject(appPage);
    await form.openNew({ trackerId: mealId, at: local(12) });
    await form.entry.reference('Ingredients').addChild();
    await form.child(0).field('grams').fill('40');
    await form.save();
    const child = (await readLiveEntries(appPage)).find((entry) => entry.parentEntryId !== null)!;
    const calendar = new CalendarPageObject(appPage);
    await calendar.openDay(DAY);

    await expect(calendar.day(DAY).entry(child.id).button).toHaveCount(0);

    await calendar.toggles.showChildren(true);
    const childOnCalendar = calendar.day(DAY).entry(child.id);
    await expect(childOnCalendar.button).toBeVisible();
    await expect(childOnCalendar.button).toHaveAttribute('aria-label', /Meal/);

    await childOnCalendar.open();
    await expect(form.children).toHaveCount(1);
  });
});

test.describe('Calendar interaction', { tag: '@integration-candidate' }, () => {
  test('the grid is operable by keyboard, and focus returns to the slot', async ({ appPage }) => {
    await createTracker(appPage, {
      name: 'Sleep',
      fields: [{ name: 'Hours', dataType: 'decimal' }],
    });
    const calendar = new CalendarPageObject(appPage);
    await calendar.openDay(DAY);
    const day = calendar.day(DAY);

    await day.slot(28).focus();
    await day.slot(28).press('ArrowDown');
    await expect(day.slot(29)).toBeFocused();
    await day.slot(29).press('Enter');
    await expect(calendar.quickCreate.self).toBeVisible();

    await calendar.quickCreate.cancel();

    await expect(calendar.quickCreate.self).toHaveCount(0);
    await expect(day.slot(29)).toBeFocused();
  });

  test('quick-create explains when no Tracker is ready to log against', async ({ appPage }) => {
    await createTracker(appPage, { name: 'Snack', fields: [], commit: false });
    const calendar = new CalendarPageObject(appPage);
    await calendar.openDay(DAY);

    await calendar.day(DAY).slot(20).click();

    await expect(calendar.quickCreate.noTrackers).toBeVisible();
  });
});

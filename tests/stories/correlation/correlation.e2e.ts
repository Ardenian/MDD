import { CorrelationPageObject } from '../../../src/app/features/correlation/correlation-page.pom';
import { expect, test } from '../../../src/app/testing/support/app-fixture';
import { createTracker } from '../../flows/create-tracker.flow';
import { logDailySeries } from '../../flows/log-daily-series.flow';

/** Eight days of paired data: `effect` is `cause` two days later, exactly. */
const CAUSE = [1, 5, 2, 8, 3, 9, 4, 7];
const EFFECT = [6, 3, 1, 5, 2, 8, 3, 9];

async function twoRelatedTrackers(page: Parameters<typeof createTracker>[0]) {
  const causeId = await createTracker(page, {
    name: 'Coffee',
    fields: [{ name: 'Cups', dataType: 'integer' }],
  });
  const effectId = await createTracker(page, {
    name: 'Sleep',
    fields: [{ name: 'Hours', dataType: 'decimal' }],
  });

  await logDailySeries(page, {
    trackerId: causeId,
    field: 'Cups',
    values: CAUSE,
    startDaysAgo: 9,
  });
  await logDailySeries(page, {
    trackerId: effectId,
    field: 'Hours',
    values: EFFECT,
    startDaysAgo: 9,
  });

  return { causeId, effectId };
}

test.describe('Correlation', () => {
  test('a scan ranks the pairs it finds and says what it cannot promise', async ({ appPage }) => {
    await twoRelatedTrackers(appPage);

    const correlation = new CorrelationPageObject(appPage);
    await correlation.open();

    // Eight days of diary is a small sample, so the guardrails come down to match it.
    await correlation.controls.minSampleSize.fill('4');
    await correlation.controls.pThreshold.fill('0.2');
    await correlation.findCorrelations();

    await expect(correlation.table).toBeVisible();
    await expect(correlation.rows.first()).toBeVisible();
    // The caveat is always on screen, whatever the scan found.
    await expect(correlation.caveat).toBeVisible();
  });

  test('a row opens the Directed view, where the lag can be moved', async ({ appPage }) => {
    await twoRelatedTrackers(appPage);

    const correlation = new CorrelationPageObject(appPage);
    await correlation.open();
    await correlation.controls.minSampleSize.fill('4');
    await correlation.controls.pThreshold.fill('0.2');
    await correlation.findCorrelations();

    await correlation.firstRow().open();

    await expect(correlation.directed.self).toBeVisible();
    await expect(correlation.directed.chart).toBeVisible();
    await expect(correlation.directed.scatter).toBeVisible();

    const before = await correlation.directed.readout.textContent();
    await correlation.directed.setLag(1);

    // The coefficient is recomputed for the lag on show, not read off the scan.
    await expect(correlation.directed.readout).not.toHaveText(before ?? '');
  });

  test('tightening the guardrails shrinks the list', async ({ appPage }) => {
    await twoRelatedTrackers(appPage);

    const correlation = new CorrelationPageObject(appPage);
    await correlation.open();
    await correlation.controls.minSampleSize.fill('4');
    await correlation.controls.pThreshold.fill('0.5');
    await correlation.findCorrelations();
    const loose = await correlation.rows.count();

    // More Buckets than the diary has days: nothing can clear this.
    await correlation.controls.minSampleSize.fill('50');
    await correlation.findCorrelations();

    expect(loose).toBeGreaterThan(0);
    await expect(correlation.emptyMessage).toBeVisible();
  });

  test('a pinned pair stays pinned across a reload', async ({ appPage }) => {
    await twoRelatedTrackers(appPage);

    const correlation = new CorrelationPageObject(appPage);
    await correlation.open();
    await correlation.controls.minSampleSize.fill('4');
    await correlation.controls.pThreshold.fill('0.2');
    await correlation.findCorrelations();

    const row = correlation.firstRow();
    await row.pin();
    await expect(row.pinButton).toHaveAttribute('aria-pressed', 'true');

    await appPage.reload();
    await correlation.controls.minSampleSize.fill('4');
    await correlation.controls.pThreshold.fill('0.2');
    await correlation.findCorrelations();

    await expect(correlation.firstRow().pinButton).toHaveAttribute('aria-pressed', 'true');
  });

  test('@integration-candidate the results table sorts by a clicked column', async ({
    appPage,
  }) => {
    await twoRelatedTrackers(appPage);

    const correlation = new CorrelationPageObject(appPage);
    await correlation.open();
    await correlation.controls.minSampleSize.fill('4');
    await correlation.controls.pThreshold.fill('0.5');
    await correlation.findCorrelations();

    await correlation.sortBy('n');

    await expect(correlation.table.getByTestId('sort-n')).toBeVisible();
    await expect(correlation.rows.first()).toBeVisible();
  });

  test('the Series overlay plots Trackers without correlating them', async ({ appPage }) => {
    const { causeId } = await twoRelatedTrackers(appPage);

    const correlation = new CorrelationPageObject(appPage);
    await correlation.open();

    await correlation.overlay.trackers.toggle(causeId);

    await expect(correlation.overlay.chart).toBeVisible();
    // No scan was run, so there is nothing ranked and nothing to open.
    await expect(correlation.table).toHaveCount(0);
    await expect(correlation.directed.self).toHaveCount(0);
  });

  test('a Series toggled off leaves the overlay chart', async ({ appPage }) => {
    const { causeId } = await twoRelatedTrackers(appPage);

    const correlation = new CorrelationPageObject(appPage);
    await correlation.open();
    await correlation.overlay.trackers.toggle(causeId);
    // The overlay loads its Series before it can draw them.
    await expect(correlation.overlay.chart).toBeVisible();

    const before = await correlation.overlay.legendKeys.count();
    expect(before).toBeGreaterThan(1);

    await correlation.overlay.seriesToggles.first().uncheck();

    await expect(correlation.overlay.legendKeys).toHaveCount(before - 1);
  });
});

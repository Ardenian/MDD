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

/**
 * The Series keys `series-extraction.ts` mints for a top-level Tracker. They are stable
 * and deterministic, which is exactly what lets a selection be persisted and a test name
 * one — and what makes a key from a different Tracker scope unusable (ADR 0015).
 */
function occurrenceSeries(trackerId: string): string {
  return `${trackerId}|occurrence`;
}

function fieldSeries(trackerId: string, field: string): string {
  return `${trackerId}|field|${field}`;
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

  test('a scan can be narrowed to particular Series, and remembers which', async ({ appPage }) => {
    const { causeId, effectId } = await twoRelatedTrackers(appPage);

    const correlation = new CorrelationPageObject(appPage);
    await correlation.open();
    const scope = correlation.controls.seriesScope;

    // There is nothing to choose between until a scan has found some Series.
    await expect(scope.emptyHint).toBeVisible();

    await correlation.controls.minSampleSize.fill('4');
    await correlation.controls.pThreshold.fill('0.2');
    await correlation.findCorrelations();

    // Both Trackers' Entry counts and both their Fields, every one of them in scope.
    await expect(scope.toggles).toHaveCount(4);
    await expect(correlation.rows.first()).toBeVisible();

    // Narrow to the two Fields: how often either was logged is beside the question.
    await scope.toggle(occurrenceSeries(causeId)).uncheck();
    await scope.toggle(occurrenceSeries(effectId)).uncheck();
    await expect(scope.hint).toContainText('2');

    await correlation.findCorrelations();

    await expect(scope.toggle(occurrenceSeries(causeId))).not.toBeChecked();
    await expect(scope.toggle(fieldSeries(causeId, 'Cups'))).toBeChecked();
    // Every chosen key survived the extraction, so nothing was dropped.
    await expect(scope.notice).toHaveText('');
    await expect(correlation.rows.first()).toBeVisible();

    // The selection is this device's, so it outlives the page it was made on.
    await appPage.reload();
    await correlation.controls.minSampleSize.fill('4');
    await correlation.controls.pThreshold.fill('0.2');
    await correlation.findCorrelations();

    await expect(scope.toggle(occurrenceSeries(causeId))).not.toBeChecked();
    await expect(scope.toggle(fieldSeries(effectId, 'Hours'))).toBeChecked();
    await expect(scope.notice).toHaveText('');
  });

  test('a Series the new Tracker scope cannot produce is dropped, and said so', async ({
    appPage,
  }) => {
    const { causeId } = await twoRelatedTrackers(appPage);

    const correlation = new CorrelationPageObject(appPage);
    await correlation.open();
    await correlation.controls.minSampleSize.fill('4');
    await correlation.controls.pThreshold.fill('0.2');
    await correlation.findCorrelations();

    const scope = correlation.controls.seriesScope;
    await scope.toggle(occurrenceSeries(causeId)).uncheck();

    // Tracker scope comes first: the other Tracker's Series are no longer produced at
    // all, so the keys chosen from them cannot be honoured.
    await correlation.controls.scopeToggle(causeId).check();
    await correlation.findCorrelations();

    await expect(scope.notice).not.toHaveText('');
    await expect(scope.toggles).toHaveCount(2);
    await expect(scope.toggle(fieldSeries(causeId, 'Cups'))).toBeChecked();
    await expect(scope.toggle(occurrenceSeries(causeId))).not.toBeChecked();
    // One Series left in scope is no pair at all.
    await expect(correlation.emptyMessage).toBeVisible();
  });
});

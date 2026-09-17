import { expect, test } from '../../testing/support/mount-fixture';
import { ResultsTableObject } from './correlation-page.pom';

/**
 * Sorting is a UI-only concern: it needs rows on screen, not a scan, a database or an
 * app boot. Mounted through the ADR 0014 harness instead of driven as an e2e story.
 */
test.describe('Results table sorting', () => {
  test.beforeEach(async ({ harness }) => {
    await harness.mount('results-table.scenario.ts#ranked');
  });

  test('opens on the strongest finding, whichever way it points', async ({ mountPage }) => {
    const table = ResultsTableObject.on(mountPage);

    // −0.9 outranks +0.6: direction is a property of the relationship, not its strength.
    await expect(table.firstRow().coefficient).toHaveText('-0.90');
  });

  test('sorts by sample size when its header is clicked', async ({ mountPage }) => {
    const table = ResultsTableObject.on(mountPage);

    await table.sortBy('n');

    await expect(table.firstRow().sampleSize).toHaveText('80');
    await expect(table.header('n')).toHaveAttribute('aria-sort', 'descending');
  });

  test('reverses the order when the same header is clicked again', async ({ mountPage }) => {
    const table = ResultsTableObject.on(mountPage);

    await table.sortBy('n');
    await table.sortBy('n');

    await expect(table.firstRow().sampleSize).toHaveText('12');
    await expect(table.header('n')).toHaveAttribute('aria-sort', 'ascending');
  });

  test('sorts a name column alphabetically on first click', async ({ mountPage }) => {
    const table = ResultsTableObject.on(mountPage);

    await table.sortBy('seriesA');

    await expect(table.firstRow().seriesA).toContainText('Apple');
    await expect(table.header('seriesA')).toHaveAttribute('aria-sort', 'ascending');
  });
});

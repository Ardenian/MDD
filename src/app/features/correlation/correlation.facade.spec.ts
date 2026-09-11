import { TestBed } from '@angular/core/testing';
import { CORRELATION_DATA_SOURCE } from '../../data/ports/correlation-data-source';
import { FakeCorrelationDataSource } from '../../data/testing/correlation-data-source.fake';
import { FakeEntryRepository } from '../../data/testing/entry-repository.fake';
import { FakeTrackerRepository } from '../../data/testing/tracker-repository.fake';
import type { FieldDef } from '../../data/model/tracker';
import type { Placement } from '../../data/model/entry';
import type { DiscoveryGuardrails } from './discovery';
import { CorrelationFacadeService, type CorrelationScanInput } from './correlation.facade';

const satisfaction: FieldDef = { name: 'Satisfaction', required: false, dataType: 'integer' };
const guardrails: DiscoveryGuardrails = { minSampleSize: 3, pValueThreshold: 0.05, benjaminiHochberg: false };

function pointAt(iso: string): Placement {
  return { kind: 'point', at: iso, fadeout: null };
}

function setup() {
  const trackerRepository = new FakeTrackerRepository();
  const entryRepository = new FakeEntryRepository(trackerRepository);
  const dataSource = new FakeCorrelationDataSource(entryRepository, trackerRepository);

  TestBed.configureTestingModule({
    providers: [{ provide: CORRELATION_DATA_SOURCE, useValue: dataSource }, CorrelationFacadeService],
  });

  return {
    trackerRepository,
    entryRepository,
    facade: TestBed.inject(CorrelationFacadeService),
  };
}

async function createCommittedTracker(trackerRepository: FakeTrackerRepository, name: string, fields: readonly FieldDef[]) {
  const tracker = await trackerRepository.create({ name, defaultTimeMode: 'point' });
  await trackerRepository.saveDraft(tracker.id, fields);
  return trackerRepository.commitDraft(tracker.id);
}

const baseInput: Omit<CorrelationScanInput, 'trackerIds'> = {
  from: '2026-01-01T00:00:00.000Z',
  to: '2026-01-10T00:00:00.000Z',
  bucketSize: 'day',
  lagRange: { min: 0, max: 0 },
  guardrails,
};

describe('CorrelationFacadeService', () => {
  it('runScan finds a Signal correlation from real Entry data', async () => {
    const { facade, trackerRepository, entryRepository } = setup();
    const sleep = await createCommittedTracker(trackerRepository, 'Sleep', [satisfaction]);

    for (let day = 1; day <= 6; day++) {
      await entryRepository.create({
        trackerId: sleep.id,
        parentEntryId: null,
        placement: pointAt(`2026-01-0${day}T10:00:00.000Z`),
        snapshot: [{ fieldName: 'Satisfaction', value: day }],
        tags: [],
      });
    }

    const results = await facade.runScan({ ...baseInput, trackerIds: 'all' });

    // Sleep.Satisfaction vs Sleep.occurrence: both derived from the same 6 Entries with
    // strictly increasing/constant patterns, so *some* pair should surface; the point of
    // this test is that live data flows end-to-end through generateSignals + runDiscovery.
    expect(results.length).toBeGreaterThan(0);
  });

  it('directedView returns null when a named Signal does not exist in scope', async () => {
    const { facade, trackerRepository } = setup();
    await createCommittedTracker(trackerRepository, 'Sleep', [satisfaction]);

    const view = await facade.directedView({ ...baseInput, trackerIds: 'all' }, 'nope.Satisfaction', 'also-nope', 0);

    expect(view).toBeNull();
  });

  it('directedView returns aligned scatter points for a real Signal pair at lag 0', async () => {
    const { facade, trackerRepository, entryRepository } = setup();
    const sleep = await createCommittedTracker(trackerRepository, 'Sleep', [satisfaction]);

    for (let day = 1; day <= 4; day++) {
      await entryRepository.create({
        trackerId: sleep.id,
        parentEntryId: null,
        placement: pointAt(`2026-01-0${day}T10:00:00.000Z`),
        snapshot: [{ fieldName: 'Satisfaction', value: day * 2 }],
        tags: [],
      });
    }

    const view = await facade.directedView(
      { ...baseInput, trackerIds: 'all' },
      `${sleep.id}.Satisfaction`,
      `${sleep.id}.occurrence`,
      0,
    );

    expect(view).not.toBeNull();
    expect(view!.scatter).toHaveLength(4);
    expect(view!.scatter.map((p) => p.a)).toEqual([2, 4, 6, 8]);
    expect(view!.scatter.every((p) => p.b === 1)).toBe(true); // 1 Entry per day -> occurrence 1
  });
});

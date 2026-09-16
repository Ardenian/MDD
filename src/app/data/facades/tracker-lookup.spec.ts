import { ApplicationRef } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { TRACKER_REPOSITORY } from '../ports/tracker-repository';
import { createInMemoryDataLayer, type DataLayer } from '../testing/in-memory-data-layer';
import { TrackerLookup } from './tracker-lookup';

describe('TrackerLookup', () => {
  let layer: DataLayer;

  beforeEach(() => {
    layer = createInMemoryDataLayer();
    TestBed.configureTestingModule({
      providers: [{ provide: TRACKER_REPOSITORY, useValue: layer.trackers }],
    });
  });

  async function lookup(): Promise<TrackerLookup> {
    const instance = TestBed.inject(TrackerLookup);
    await TestBed.inject(ApplicationRef).whenStable();
    return instance;
  }

  it('reduces every Tracker to id, name and archived state', async () => {
    await layer.trackers.create({ name: 'Sleep', defaultTimeMode: 'period', fields: [] });

    const instance = await lookup();

    expect(instance.list()).toEqual([
      { id: expect.any(String), name: 'Sleep', archived: false },
    ]);
  });

  it('includes archived Trackers, flagged', async () => {
    const tracker = await layer.trackers.create({ name: 'Snack', defaultTimeMode: 'point' });
    await layer.trackers.archive(tracker.id);

    const instance = await lookup();

    expect(instance.list()).toEqual([{ id: tracker.id, name: 'Snack', archived: true }]);
  });

  it('reflects a rename once reloaded', async () => {
    const tracker = await layer.trackers.create({ name: 'Sleep', defaultTimeMode: 'period' });
    const instance = await lookup();

    await layer.trackers.updateMeta(tracker.id, { name: 'Sleep & Rest' });
    instance.reload();
    await TestBed.inject(ApplicationRef).whenStable();

    expect(instance.list()).toEqual([{ id: tracker.id, name: 'Sleep & Rest', archived: false }]);
  });

  it('reports loading while the first read is in flight', () => {
    const instance = TestBed.inject(TrackerLookup);

    expect(instance.isLoading()).toBe(true);
    expect(instance.list()).toEqual([]);
  });
});

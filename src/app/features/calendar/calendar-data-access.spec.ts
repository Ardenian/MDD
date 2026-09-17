import { ApplicationRef, Injector, runInInjectionContext, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { ENTRY_REPOSITORY } from '../../data/ports/entry-repository';
import { createInMemoryDataLayer, type DataLayer } from '../../data/testing/in-memory-data-layer';
import { CalendarDataAccess, type CalendarQuery } from './calendar-data-access';

describe('CalendarDataAccess', () => {
  let layer: DataLayer;

  beforeEach(() => {
    layer = createInMemoryDataLayer();
    TestBed.configureTestingModule({
      providers: [{ provide: ENTRY_REPOSITORY, useValue: layer.entries }],
    });
  });

  async function seed() {
    const tracker = await layer.trackers.create({
      name: 'Meal',
      defaultTimeMode: 'point',
      fields: [{ name: 'grams', required: false, dataType: 'decimal' }],
    });
    const placement = { kind: 'point', at: '2026-03-02T12:00:00.000Z' } as const;
    const parent = await layer.entries.create({
      trackerId: tracker.id,
      parentEntryId: null,
      placement,
      snapshot: [],
      tags: [],
    });
    await layer.entries.create({
      trackerId: tracker.id,
      parentEntryId: parent.id,
      placement,
      snapshot: [],
      tags: [],
    });
  }

  function view(query: ReturnType<typeof signal<CalendarQuery>>) {
    const access = TestBed.inject(CalendarDataAccess);
    return runInInjectionContext(TestBed.inject(Injector), () => access.entriesFor(query));
  }

  it('reads the visible range, and children only when the filter asks for them', async () => {
    await seed();
    const query = signal<CalendarQuery>({
      start: '2026-03-02T00:00:00.000Z',
      end: '2026-03-02T23:59:59.999Z',
      includeChildren: false,
    });
    const entries = view(query);
    await TestBed.inject(ApplicationRef).whenStable();
    expect(entries.entries()).toHaveLength(1);

    query.update((current) => ({ ...current, includeChildren: true }));
    await TestBed.inject(ApplicationRef).whenStable();

    expect(entries.entries()).toHaveLength(2);
  });

  it('follows the range as it moves', async () => {
    await seed();
    const query = signal<CalendarQuery>({
      start: '2026-03-03T00:00:00.000Z',
      end: '2026-03-03T23:59:59.999Z',
      includeChildren: false,
    });
    const entries = view(query);
    await TestBed.inject(ApplicationRef).whenStable();
    expect(entries.entries()).toEqual([]);

    query.set({
      start: '2026-03-02T00:00:00.000Z',
      end: '2026-03-02T23:59:59.999Z',
      includeChildren: false,
    });
    await TestBed.inject(ApplicationRef).whenStable();

    expect(entries.entries()).toHaveLength(1);
  });
});

import type { Entry, SnapshotField } from '../../data/model/entry';
import type { FieldDef } from '../../data/model/field-def';
import type { Placement } from '../../data/model/placement';
import type { Tracker } from '../../data/model/tracker';
import type { TrackerVersion } from '../../data/model/tracker-version';
import type { CorrelationDataset } from '../../data/ports/correlation-data-source';
import { createBucketAxis } from './bucketing';
import { extractSeries, type Series } from './series-extraction';

const meta = {
  createdAt: '2026-03-10T00:00:00.000Z',
  updatedAt: '2026-03-10T00:00:00.000Z',
  deletedAt: null,
  revision: 1,
  ownerId: 'owner',
  userId: 'user',
};

function tracker(id: string, name: string): Tracker {
  return {
    ...meta,
    id,
    name,
    defaultTimeMode: 'point',
    archived: false,
    currentVersion: 1,
    draftFields: [],
  };
}

function version(trackerId: string, fields: readonly FieldDef[]): TrackerVersion {
  return { ...meta, id: `${trackerId}-v1`, trackerId, version: 1, fields };
}

function entry(
  id: string,
  trackerId: string,
  day: string,
  snapshot: readonly SnapshotField[] = [],
  extra: Partial<Entry> = {},
): Entry {
  const placement: Placement = { kind: 'dayBucketed', day };
  return {
    ...meta,
    id,
    trackerId,
    trackerVersion: 1,
    parentEntryId: null,
    placement,
    snapshot,
    tags: [],
    ...extra,
  };
}

/** Three daily Buckets: 10th, 11th, 12th of March 2026. */
const axis = createBucketAxis(
  {
    start: new Date(2026, 2, 10).getTime(),
    end: new Date(2026, 2, 12, 23, 59).getTime(),
  },
  'day',
);

function find(series: readonly Series[], name: string, path?: string): Series | undefined {
  return series.find(
    (candidate) => candidate.name === name && (path === undefined || candidate.path === path),
  );
}

describe('extractSeries', () => {
  it('averages a numeric Field within each Bucket', () => {
    const dataset: CorrelationDataset = {
      tags: [],
      trackers: [tracker('sleep', 'Sleep')],
      trackerVersions: [
        version('sleep', [{ name: 'Hours', dataType: 'decimal', required: false }]),
      ],
      entries: [
        entry('a', 'sleep', '2026-03-10', [{ fieldName: 'Hours', value: 7 }]),
        entry('b', 'sleep', '2026-03-10', [{ fieldName: 'Hours', value: 9 }]),
        entry('c', 'sleep', '2026-03-12', [{ fieldName: 'Hours', value: 6 }]),
      ],
    };

    expect(find(extractSeries(dataset, axis), 'Hours')?.values).toEqual([8, null, 6]);
  });

  it('counts occurrences, and counts an empty Bucket as none rather than as a gap', () => {
    const dataset: CorrelationDataset = {
      tags: [],
      trackers: [tracker('coffee', 'Coffee')],
      trackerVersions: [version('coffee', [])],
      entries: [
        entry('a', 'coffee', '2026-03-10'),
        entry('b', 'coffee', '2026-03-10'),
        entry('c', 'coffee', '2026-03-12'),
      ],
    };

    const occurrences = extractSeries(dataset, axis).find((series) => series.kind === 'occurrence');

    expect(occurrences?.values).toEqual([2, 0, 1]);
    expect(occurrences?.path).toBe('Coffee');
  });

  it('counts nothing before the first Entry and after the last as no data, not as zero', () => {
    const dataset: CorrelationDataset = {
      tags: [],
      trackers: [tracker('coffee', 'Coffee')],
      trackerVersions: [version('coffee', [])],
      entries: [entry('a', 'coffee', '2026-03-11')],
    };

    const occurrences = extractSeries(dataset, axis).find((series) => series.kind === 'occurrence');

    // Otherwise two Trackers started in the same week would correlate perfectly on the
    // emptiness they share rather than on anything logged.
    expect(occurrences?.values).toEqual([null, 1, null]);
  });

  it('gives a select Field one Series per option, each a fraction', () => {
    const field: FieldDef = {
      name: 'Energy',
      dataType: 'singleSelect',
      required: false,
      options: ['low', 'high'],
    };
    const dataset: CorrelationDataset = {
      tags: [],
      trackers: [tracker('sleep', 'Sleep')],
      trackerVersions: [version('sleep', [field])],
      entries: [
        entry('a', 'sleep', '2026-03-10', [{ fieldName: 'Energy', value: 'high' }]),
        entry('b', 'sleep', '2026-03-10', [{ fieldName: 'Energy', value: 'low' }]),
        entry('c', 'sleep', '2026-03-12', [{ fieldName: 'Energy', value: 'low' }]),
      ],
    };

    const series = extractSeries(dataset, axis);

    expect(find(series, 'Energy = high')?.values).toEqual([0.5, null, 0]);
    expect(find(series, 'Energy = low')?.values).toEqual([0.5, null, 1]);
  });

  it('reads a Bucket with Entries but no match as 0, and one with no Entries as a gap', () => {
    const field: FieldDef = {
      name: 'Energy',
      dataType: 'singleSelect',
      required: false,
      options: ['low', 'high'],
    };
    const dataset: CorrelationDataset = {
      tags: [],
      trackers: [tracker('sleep', 'Sleep')],
      trackerVersions: [version('sleep', [field])],
      entries: [entry('a', 'sleep', '2026-03-11', [{ fieldName: 'Energy', value: 'low' }])],
    };

    expect(find(extractSeries(dataset, axis), 'Energy = high')?.values).toEqual([null, 0, null]);
  });

  it('gives a multi-select one Series per option, counting every option chosen', () => {
    const field: FieldDef = {
      name: 'Symptoms',
      dataType: 'multiSelect',
      required: false,
      options: ['bloating', 'headache'],
    };
    const dataset: CorrelationDataset = {
      tags: [],
      trackers: [tracker('symptom', 'Symptom')],
      trackerVersions: [version('symptom', [field])],
      entries: [
        entry('a', 'symptom', '2026-03-10', [
          { fieldName: 'Symptoms', value: ['bloating', 'headache'] },
        ]),
        entry('b', 'symptom', '2026-03-10', [{ fieldName: 'Symptoms', value: ['headache'] }]),
      ],
    };

    const series = extractSeries(dataset, axis);

    expect(find(series, 'Symptoms = bloating')?.values[0]).toBeCloseTo(0.5, 10);
    expect(find(series, 'Symptoms = headache')?.values[0]).toBeCloseTo(1, 10);
  });

  it('reads a boolean Field as the fraction of Entries where it is true', () => {
    const dataset: CorrelationDataset = {
      tags: [],
      trackers: [tracker('workout', 'Workout')],
      trackerVersions: [
        version('workout', [{ name: 'Outdoors', dataType: 'boolean', required: false }]),
      ],
      entries: [
        entry('a', 'workout', '2026-03-10', [{ fieldName: 'Outdoors', value: true }]),
        entry('b', 'workout', '2026-03-10', [{ fieldName: 'Outdoors', value: false }]),
      ],
    };

    expect(find(extractSeries(dataset, axis), 'Outdoors')?.values[0]).toBeCloseTo(0.5, 10);
  });

  it('names a nested Field by the path that reaches it', () => {
    const dataset: CorrelationDataset = {
      tags: [],
      trackers: [tracker('meal', 'Meal'), tracker('ingredient', 'Ingredient')],
      trackerVersions: [
        version('meal', [
          {
            name: 'Ingredients',
            dataType: 'reference',
            required: false,
            targetTrackerId: 'ingredient',
            cardinality: 'many',
          },
        ]),
        version('ingredient', [{ name: 'grams', dataType: 'decimal', required: false }]),
      ],
      entries: [
        entry('parent', 'meal', '2026-03-10', [{ fieldName: 'Ingredients', value: ['child'] }]),
        entry('child', 'ingredient', '2026-03-10', [{ fieldName: 'grams', value: 120 }], {
          parentEntryId: 'parent',
        }),
      ],
    };

    const nested = find(extractSeries(dataset, axis), 'grams');

    expect(nested?.path).toBe('Meal → Ingredients: Ingredient');
    expect(nested?.values).toEqual([120, null, null]);
  });

  it('reads a Child Entry as a Standalone reading when its parent is outside the dataset', () => {
    // A scan scoped to the child Tracker alone, with the parent Tracker excluded, never
    // loads the parent Entry — this is exactly that shape of dataset (ADR 0015).
    const dataset: CorrelationDataset = {
      tags: [],
      trackers: [tracker('ingredient', 'Ingredient')],
      trackerVersions: [
        version('ingredient', [{ name: 'grams', dataType: 'decimal', required: false }]),
      ],
      entries: [
        entry('child', 'ingredient', '2026-03-10', [{ fieldName: 'grams', value: 120 }], {
          parentEntryId: 'parent',
        }),
      ],
    };

    const standalone = find(extractSeries(dataset, axis), 'grams');

    expect(standalone?.path).toBe('Ingredient');
    expect(standalone?.values).toEqual([120, null, null]);
  });

  it('gives a Period Entry a synthetic entryDuration in minutes', () => {
    const dataset: CorrelationDataset = {
      tags: [],
      trackers: [tracker('sleep', 'Sleep')],
      trackerVersions: [version('sleep', [])],
      entries: [
        entry('a', 'sleep', '2026-03-10', [], {
          placement: {
            kind: 'period',
            start: new Date(2026, 2, 10, 1, 0).toISOString(),
            end: new Date(2026, 2, 10, 8, 30).toISOString(),
          },
        }),
      ],
    };

    expect(find(extractSeries(dataset, axis), 'entryDuration')?.values).toEqual([450, null, null]);
  });

  it('gives no entryDuration to a Point or a Day-bucketed Entry', () => {
    // A Point has no span at all; a Day-bucketed Entry's span is always exactly one day,
    // and a Series that never varies cannot correlate with anything.
    const dataset: CorrelationDataset = {
      tags: [],
      trackers: [tracker('sleep', 'Sleep')],
      trackerVersions: [version('sleep', [])],
      entries: [
        entry('a', 'sleep', '2026-03-10'),
        entry('b', 'sleep', '2026-03-11', [], {
          placement: { kind: 'point', at: new Date(2026, 2, 11, 9, 0).toISOString() },
        }),
      ],
    };

    expect(find(extractSeries(dataset, axis), 'entryDuration')).toBeUndefined();
  });

  it('adds a total alongside the mean only for a Field declared with sum', () => {
    const declared = {
      ...tracker('sleep', 'Sleep'),
      fieldDeclarations: { Hours: { sum: true } },
    } as const;
    const dataset: CorrelationDataset = {
      tags: [],
      trackers: [declared],
      trackerVersions: [
        version('sleep', [{ name: 'Hours', dataType: 'decimal', required: false }]),
      ],
      entries: [
        entry('a', 'sleep', '2026-03-10', [{ fieldName: 'Hours', value: 7 }]),
        entry('b', 'sleep', '2026-03-10', [{ fieldName: 'Hours', value: 9 }]),
      ],
    };

    const series = extractSeries(dataset, axis);
    const mean = series.find((candidate) => candidate.kind === 'numeric');
    const total = series.find((candidate) => candidate.kind === 'sum');

    expect(mean?.values[0]).toBe(8);
    expect(total?.values[0]).toBe(16);
    // The name stays the user's own word; the page adds the Average/Sum wording.
    expect(total?.name).toBe('Hours');
  });

  it('gives a total the same declared baseline as its mean', () => {
    const declared = {
      ...tracker('water', 'Water'),
      fieldDeclarations: { glasses: { sum: true, baseline: 0 } },
    } as const;
    const dataset: CorrelationDataset = {
      tags: [],
      trackers: [declared],
      trackerVersions: [
        version('water', [{ name: 'glasses', dataType: 'integer', required: false }]),
      ],
      entries: [
        entry('a', 'water', '2026-03-10', [{ fieldName: 'glasses', value: 4 }]),
        entry('b', 'water', '2026-03-12', [{ fieldName: 'glasses', value: 6 }]),
      ],
    };

    const series = extractSeries(dataset, axis);

    // Otherwise the total would quietly correlate over fewer Buckets than the mean of
    // the very same Entries.
    expect(series.find((candidate) => candidate.kind === 'numeric')?.values).toEqual([4, 0, 6]);
    expect(series.find((candidate) => candidate.kind === 'sum')?.values).toEqual([4, 0, 6]);
  });

  it('produces no sum Series for a numeric Field that was never declared', () => {
    const dataset: CorrelationDataset = {
      tags: [],
      trackers: [tracker('sleep', 'Sleep')],
      trackerVersions: [
        version('sleep', [{ name: 'Hours', dataType: 'decimal', required: false }]),
      ],
      entries: [entry('a', 'sleep', '2026-03-10', [{ fieldName: 'Hours', value: 7 }])],
    };

    expect(extractSeries(dataset, axis).some((series) => series.kind === 'sum')).toBe(false);
  });

  it('fills an unlogged Bucket with a declared boolean baseline, within the active window', () => {
    const declared = {
      ...tracker('health', 'Health'),
      fieldDeclarations: { headache: { baseline: false } },
    } as const;
    const dataset: CorrelationDataset = {
      tags: [],
      trackers: [declared],
      trackerVersions: [
        version('health', [{ name: 'headache', dataType: 'boolean', required: false }]),
      ],
      entries: [
        entry('a', 'health', '2026-03-10', [{ fieldName: 'headache', value: true }]),
        entry('b', 'health', '2026-03-12', [{ fieldName: 'headache', value: true }]),
      ],
    };

    // The 11th has no Entry at all: without a declaration that is a gap, with one it is
    // a recorded "no headache".
    expect(find(extractSeries(dataset, axis), 'headache')?.values).toEqual([1, 0, 1]);
  });

  it('leaves an unlogged Bucket alone when no baseline was declared', () => {
    const dataset: CorrelationDataset = {
      tags: [],
      trackers: [tracker('health', 'Health')],
      trackerVersions: [
        version('health', [{ name: 'headache', dataType: 'boolean', required: false }]),
      ],
      entries: [
        entry('a', 'health', '2026-03-10', [{ fieldName: 'headache', value: true }]),
        entry('b', 'health', '2026-03-12', [{ fieldName: 'headache', value: true }]),
      ],
    };

    expect(find(extractSeries(dataset, axis), 'headache')?.values).toEqual([1, null, 1]);
  });

  it('never fills a declared baseline outside the Tracker active window', () => {
    const declared = {
      ...tracker('health', 'Health'),
      fieldDeclarations: { headache: { baseline: false } },
    } as const;
    const dataset: CorrelationDataset = {
      tags: [],
      trackers: [declared],
      trackerVersions: [
        version('health', [{ name: 'headache', dataType: 'boolean', required: false }]),
      ],
      entries: [entry('a', 'health', '2026-03-11', [{ fieldName: 'headache', value: true }])],
    };

    // Same guard the occurrence Series already applies: emptiness before a Tracker was
    // ever kept is not a recorded zero.
    expect(find(extractSeries(dataset, axis), 'headache')?.values).toEqual([null, 1, null]);
  });

  it('fills an unlogged Bucket with a declared numeric baseline', () => {
    const declared = {
      ...tracker('water', 'Water'),
      fieldDeclarations: { glasses: { baseline: 0 } },
    } as const;
    const dataset: CorrelationDataset = {
      tags: [],
      trackers: [declared],
      trackerVersions: [
        version('water', [{ name: 'glasses', dataType: 'integer', required: false }]),
      ],
      entries: [
        entry('a', 'water', '2026-03-10', [{ fieldName: 'glasses', value: 4 }]),
        entry('b', 'water', '2026-03-12', [{ fieldName: 'glasses', value: 6 }]),
      ],
    };

    expect(find(extractSeries(dataset, axis), 'glasses')?.values).toEqual([4, 0, 6]);
  });

  it('resolves a nested Field two levels down', () => {
    const dataset: CorrelationDataset = {
      tags: [],
      trackers: [
        tracker('meal', 'Meal'),
        tracker('ingredient', 'Ingredient'),
        tracker('source', 'Source'),
      ],
      trackerVersions: [
        version('meal', [
          {
            name: 'Ingredients',
            dataType: 'reference',
            required: false,
            targetTrackerId: 'ingredient',
            cardinality: 'many',
          },
        ]),
        version('ingredient', [
          {
            name: 'From',
            dataType: 'reference',
            required: false,
            targetTrackerId: 'source',
            cardinality: 'one',
          },
        ]),
        version('source', [{ name: 'Distance', dataType: 'integer', required: false }]),
      ],
      entries: [
        entry('meal-1', 'meal', '2026-03-10', [{ fieldName: 'Ingredients', value: ['ing-1'] }]),
        entry('ing-1', 'ingredient', '2026-03-10', [{ fieldName: 'From', value: 'src-1' }], {
          parentEntryId: 'meal-1',
        }),
        entry('src-1', 'source', '2026-03-10', [{ fieldName: 'Distance', value: 40 }], {
          parentEntryId: 'ing-1',
        }),
      ],
    };

    expect(find(extractSeries(dataset, axis), 'Distance')?.path).toBe(
      'Meal → Ingredients: Ingredient → From: Source',
    );
  });

  it('reads a Tag as the fraction of the Bucket carrying it, children included', () => {
    const dataset: CorrelationDataset = {
      tags: [],
      trackers: [tracker('meal', 'Meal')],
      trackerVersions: [version('meal', [])],
      entries: [
        entry('a', 'meal', '2026-03-10', [], { tags: ['dairy'] }),
        entry('b', 'meal', '2026-03-10'),
        entry('c', 'meal', '2026-03-12', [], { tags: ['dairy'] }),
      ],
    };

    const dairy = extractSeries(dataset, axis).find((series) => series.kind === 'tag');

    expect(dairy?.name).toBe('dairy');
    expect(dairy?.values).toEqual([0.5, null, 1]);
  });

  it('reads each Entry against its own pinned Version, not the Tracker current one', () => {
    const dataset: CorrelationDataset = {
      tags: [],
      trackers: [tracker('sleep', 'Sleep')],
      trackerVersions: [
        version('sleep', [{ name: 'Hours', dataType: 'decimal', required: false }]),
        {
          ...version('sleep', [{ name: 'Duration', dataType: 'decimal', required: false }]),
          id: 'sleep-v2',
          version: 2,
        },
      ],
      entries: [
        entry('old', 'sleep', '2026-03-10', [{ fieldName: 'Hours', value: 7 }]),
        entry('new', 'sleep', '2026-03-12', [{ fieldName: 'Duration', value: 8 }], {
          trackerVersion: 2,
        }),
      ],
    };

    const series = extractSeries(dataset, axis);

    expect(find(series, 'Hours')?.values).toEqual([7, null, null]);
    expect(find(series, 'Duration')?.values).toEqual([null, null, 8]);
  });

  it('skips an Entry whose pinned Version is missing rather than guessing a schema', () => {
    const dataset: CorrelationDataset = {
      tags: [],
      trackers: [tracker('sleep', 'Sleep')],
      trackerVersions: [],
      entries: [entry('a', 'sleep', '2026-03-10', [{ fieldName: 'Hours', value: 7 }])],
    };

    expect(extractSeries(dataset, axis)).toEqual([]);
  });

  it('weights an Entry by how much of the Bucket it occupies', () => {
    const dataset: CorrelationDataset = {
      tags: [],
      trackers: [tracker('sleep', 'Sleep')],
      trackerVersions: [
        version('sleep', [{ name: 'Hours', dataType: 'decimal', required: false }]),
      ],
      entries: [
        // Half of the 10th, all of the 11th.
        entry('a', 'sleep', '2026-03-10', [{ fieldName: 'Hours', value: 10 }], {
          placement: {
            kind: 'period',
            start: new Date(2026, 2, 10, 12).toISOString(),
            end: new Date(2026, 2, 12, 0).toISOString(),
          },
        }),
        entry('b', 'sleep', '2026-03-10', [{ fieldName: 'Hours', value: 20 }]),
      ],
    };

    // The 10th holds a half-share of 10 and a full share of 20 → (5 + 20) / 1.5.
    const values = find(extractSeries(dataset, axis), 'Hours')?.values;

    expect(values?.[0]).toBeCloseTo(25 / 1.5, 10);
    expect(values?.[1]).toBeCloseTo(10, 10);
  });

  it('leaves out a Series that never has a value', () => {
    const dataset: CorrelationDataset = {
      tags: [],
      trackers: [tracker('sleep', 'Sleep')],
      trackerVersions: [version('sleep', [{ name: 'Note', dataType: 'text', required: false }])],
      entries: [entry('a', 'sleep', '2026-03-10', [{ fieldName: 'Note', value: 'slept badly' }])],
    };

    // Free text has no ordering to correlate, so it yields no Series of its own.
    expect(extractSeries(dataset, axis).map((series) => series.kind)).toEqual(['occurrence']);
  });

  it('is deterministic: the same data always yields the same Series in the same order', () => {
    const dataset: CorrelationDataset = {
      tags: [],
      trackers: [tracker('sleep', 'Sleep'), tracker('coffee', 'Coffee')],
      trackerVersions: [
        version('sleep', [{ name: 'Hours', dataType: 'decimal', required: false }]),
        version('coffee', [{ name: 'Cups', dataType: 'integer', required: false }]),
      ],
      entries: [
        entry('a', 'sleep', '2026-03-10', [{ fieldName: 'Hours', value: 7 }]),
        entry('b', 'coffee', '2026-03-10', [{ fieldName: 'Cups', value: 2 }]),
      ],
    };

    const first = extractSeries(dataset, axis).map((series) => series.id);
    const second = extractSeries(dataset, axis).map((series) => series.id);

    expect(first).toEqual(second);
    expect(first).toEqual([...first].sort());
  });
});

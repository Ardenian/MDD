import { generateSignals, runDiscovery, type DiscoveryOptions, type TaggedSignal } from './discovery';
import type { Entry, Placement, SnapshotField } from '../../data/model/entry';
import type { FieldDef, TrackerVersion } from '../../data/model/tracker';

let nextId = 0;
function id(): string {
  nextId += 1;
  return `id-${nextId}`;
}

function version(trackerId: string, fields: readonly FieldDef[]): TrackerVersion {
  return {
    id: id(),
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
    deletedAt: null,
    revision: 1,
    ownerId: 'dev',
    userId: 'dev',
    trackerId,
    version: 1,
    fields,
  };
}

function entry(
  trackerId: string,
  placement: Placement,
  snapshot: readonly SnapshotField[] = [],
  tags: readonly string[] = [],
): Entry {
  return {
    id: id(),
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
    deletedAt: null,
    revision: 1,
    ownerId: 'dev',
    userId: 'dev',
    trackerId,
    trackerVersion: 1,
    parentEntryId: null,
    placement,
    snapshot,
    tags,
  };
}

function pointAt(iso: string): Placement {
  return { kind: 'point', at: iso, fadeout: null };
}

function day(offset: number): string {
  return new Date(Date.parse('2026-01-01T00:00:00.000Z') + offset * 86_400_000).toISOString().slice(0, 10);
}

function numericSignal(name: string, values: readonly number[]): TaggedSignal {
  return { name, kind: 'numeric', points: values.map((value, i) => ({ bucketKey: day(i), value })) };
}

const baseOptions: DiscoveryOptions = {
  bucketSize: 'day',
  lagRange: { min: 0, max: 0 },
  guardrails: { minSampleSize: 3, pValueThreshold: 0.05, benjaminiHochberg: false },
};

describe('generateSignals', () => {
  it('limits the generated Signal set to the in-scope Trackers', () => {
    const satisfaction: FieldDef = { name: 'Satisfaction', required: false, dataType: 'integer' };
    const entries = [
      entry('sleep', pointAt('2026-01-01T09:00:00.000Z'), [{ fieldName: 'Satisfaction', value: 5 }]),
      entry('workout', pointAt('2026-01-01T09:00:00.000Z'), []),
    ];
    const versions = [version('sleep', [satisfaction])];

    const signals = generateSignals(entries, versions, { trackerIds: ['sleep'] }, 'day');

    expect(signals.some((s) => s.name.startsWith('workout'))).toBe(false);
    expect(signals.some((s) => s.name === 'sleep.Satisfaction')).toBe(true);
    expect(signals.some((s) => s.name === 'sleep.occurrence')).toBe(true);
  });

  it('generates one fraction Signal per select option and per Tag actually used', () => {
    const energy: FieldDef = {
      name: 'Energy',
      required: false,
      dataType: 'singleSelect',
      options: ['low', 'medium', 'high'],
    };
    const entries = [
      entry('sleep', pointAt('2026-01-01T09:00:00.000Z'), [{ fieldName: 'Energy', value: 'low' }], ['insomnia']),
    ];
    const versions = [version('sleep', [energy])];

    const signals = generateSignals(entries, versions, { trackerIds: 'all' }, 'day');

    expect(signals.filter((s) => s.name.startsWith('sleep.Energy=')).map((s) => s.name).sort()).toEqual([
      'sleep.Energy=high',
      'sleep.Energy=low',
      'sleep.Energy=medium',
    ]);
    expect(signals.some((s) => s.name === 'sleep#insomnia')).toBe(true);
  });
});

describe('runDiscovery', () => {
  it('excludes a pair whose best-Lag overlap is below the minimum sample size', () => {
    const a = numericSignal('A', [1, 2, 3, 4, 5]);
    const b: TaggedSignal = {
      name: 'B',
      kind: 'numeric',
      points: [
        { bucketKey: day(0), value: 1 },
        { bucketKey: day(1), value: 2 },
      ], // only 2 overlapping Buckets with A
    };

    const results = runDiscovery([a, b], { ...baseOptions, guardrails: { ...baseOptions.guardrails, minSampleSize: 3 } });

    expect(results).toEqual([]);
  });

  it('excludes a pair with enough overlap for scanLags but below the configured minSampleSize', () => {
    const a = numericSignal('A', [1, 2, 3, 4]); // 4 overlapping Buckets — enough for scanLags itself
    const b = numericSignal('B', [4, 3, 2, 1]);

    const results = runDiscovery([a, b], {
      ...baseOptions,
      guardrails: { ...baseOptions.guardrails, minSampleSize: 10 },
    });

    expect(results).toEqual([]);
  });

  it('ranks pairs by |effect size| descending', () => {
    const a = numericSignal('A', [1, 2, 3, 4, 5, 6]);
    const strong = numericSignal('Strong', [2, 4, 6, 8, 10, 12]); // perfectly correlated with A
    const weak = numericSignal('Weak', [3, 1, 4, 1, 5, 9]); // not monotonic with A

    const results = runDiscovery([a, strong, weak], baseOptions);

    const pairNames = results.map((r) => `${r.signalA}-${r.signalB}`);
    expect(pairNames[0]).toBe('A-Strong');
    expect(Math.abs(results[0].effectSize)).toBeGreaterThan(Math.abs(results[1].effectSize));
  });

  it('produces identical output across repeated runs on the same input', () => {
    const a = numericSignal('A', [1, 2, 3, 4, 5, 6]);
    const b = numericSignal('B', [6, 5, 4, 3, 2, 1]);

    const first = runDiscovery([a, b], baseOptions);
    const second = runDiscovery([a, b], baseOptions);

    expect(second).toEqual(first);
  });

  it('stops scanning further pairs once cancelled, without throwing', () => {
    const signals = [
      numericSignal('A', [1, 2, 3, 4, 5]),
      numericSignal('B', [5, 4, 3, 2, 1]),
      numericSignal('C', [1, 3, 2, 5, 4]),
    ];

    // 3 signals -> 3 possible pairs (A-B, A-C, B-C). Cancel right after the first pair
    // is checked, so exactly one pair (A-B, formed first by the i<j loop) is processed.
    let calls = 0;
    const isCancelled = () => {
      calls += 1;
      return calls > 1;
    };

    let results: ReturnType<typeof runDiscovery> = [];
    expect(() => {
      results = runDiscovery(signals, { ...baseOptions, isCancelled });
    }).not.toThrow();

    expect(results).toHaveLength(1);
    expect(`${results[0].signalA}-${results[0].signalB}`).toBe('A-B');
  });
});

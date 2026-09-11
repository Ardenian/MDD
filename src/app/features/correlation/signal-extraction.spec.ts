import {
  buildExtractionContext,
  extractNestedNumericSignal,
  extractNumericFieldSignal,
  extractOccurrenceSignal,
  extractSelectStateSignal,
  extractTagPresenceSignal,
} from './signal-extraction';
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
  snapshot: readonly SnapshotField[],
  tags: readonly string[] = [],
  entryId = id(),
): Entry {
  return {
    id: entryId,
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

describe('extractNumericFieldSignal', () => {
  it('reports the weighted mean of a numeric Field per Bucket', () => {
    const trackerId = 'sleep';
    const satisfaction: FieldDef = { name: 'Satisfaction', required: false, dataType: 'integer' };
    const entries = [
      entry(trackerId, pointAt('2026-01-01T09:00:00.000Z'), [{ fieldName: 'Satisfaction', value: 4 }]),
      entry(trackerId, pointAt('2026-01-01T21:00:00.000Z'), [{ fieldName: 'Satisfaction', value: 8 }]),
    ];
    const ctx = buildExtractionContext(entries, [version(trackerId, [satisfaction])], 'day');

    const signal = extractNumericFieldSignal(ctx, trackerId, 'Satisfaction', 'Sleep.Satisfaction');

    expect(signal.points).toEqual([{ bucketKey: '2026-01-01', value: 6 }]);
  });
});

describe('extractOccurrenceSignal', () => {
  it('counts Entries of a Tracker per Bucket', () => {
    const trackerId = 'workout';
    const entries = [
      entry(trackerId, pointAt('2026-01-01T09:00:00.000Z'), []),
      entry(trackerId, pointAt('2026-01-01T18:00:00.000Z'), []),
      entry(trackerId, pointAt('2026-01-02T09:00:00.000Z'), []),
    ];
    const ctx = buildExtractionContext(entries, [], 'day');

    const signal = extractOccurrenceSignal(ctx, trackerId, 'Workout.occurrence');

    expect([...signal.points].sort((a, b) => a.bucketKey.localeCompare(b.bucketKey))).toEqual([
      { bucketKey: '2026-01-01', value: 2 },
      { bucketKey: '2026-01-02', value: 1 },
    ]);
  });
});

describe('extractSelectStateSignal', () => {
  const trackerId = 'sleep';
  const energy: FieldDef = {
    name: 'Energy',
    required: false,
    dataType: 'singleSelect',
    options: ['low', 'medium', 'high'],
  };

  it('reports 0, not undefined, for a Bucket with Entries but no matches', () => {
    const entries = [
      entry(trackerId, pointAt('2026-01-01T09:00:00.000Z'), [{ fieldName: 'Energy', value: 'medium' }]),
      entry(trackerId, pointAt('2026-01-01T21:00:00.000Z'), [{ fieldName: 'Energy', value: 'high' }]),
    ];
    const ctx = buildExtractionContext(entries, [version(trackerId, [energy])], 'day');

    const signal = extractSelectStateSignal(ctx, trackerId, 'Energy', 'low', 'Sleep.Energy=low');

    expect(signal.points).toEqual([{ bucketKey: '2026-01-01', value: 0 }]);
  });

  it('computes the correct fraction when some Entries match', () => {
    const entries = [
      entry(trackerId, pointAt('2026-01-01T09:00:00.000Z'), [{ fieldName: 'Energy', value: 'low' }]),
      entry(trackerId, pointAt('2026-01-01T15:00:00.000Z'), [{ fieldName: 'Energy', value: 'medium' }]),
      entry(trackerId, pointAt('2026-01-01T21:00:00.000Z'), [{ fieldName: 'Energy', value: 'medium' }]),
    ];
    const ctx = buildExtractionContext(entries, [version(trackerId, [energy])], 'day');

    const signal = extractSelectStateSignal(ctx, trackerId, 'Energy', 'medium', 'Sleep.Energy=medium');

    expect(signal.points).toEqual([{ bucketKey: '2026-01-01', value: 2 / 3 }]);
  });

  it('yields an independent Signal per option for a multi-select Field', () => {
    const symptoms: FieldDef = {
      name: 'Symptoms',
      required: false,
      dataType: 'multiSelect',
      options: ['bloating', 'headache'],
    };
    const entries = [
      entry(trackerId, pointAt('2026-01-01T09:00:00.000Z'), [
        { fieldName: 'Symptoms', value: ['bloating', 'headache'] },
      ]),
      entry(trackerId, pointAt('2026-01-01T15:00:00.000Z'), [{ fieldName: 'Symptoms', value: ['headache'] }]),
    ];
    const ctx = buildExtractionContext(entries, [version(trackerId, [symptoms])], 'day');

    const bloating = extractSelectStateSignal(ctx, trackerId, 'Symptoms', 'bloating', 'x');
    const headache = extractSelectStateSignal(ctx, trackerId, 'Symptoms', 'headache', 'y');

    expect(bloating.points).toEqual([{ bucketKey: '2026-01-01', value: 0.5 }]);
    expect(headache.points).toEqual([{ bucketKey: '2026-01-01', value: 1 }]);
  });
});

describe('extractTagPresenceSignal', () => {
  it('reports the fraction of Entries carrying a given Tag', () => {
    const trackerId = 'sleep';
    const entries = [
      entry(trackerId, pointAt('2026-01-01T09:00:00.000Z'), [], ['insomnia']),
      entry(trackerId, pointAt('2026-01-01T21:00:00.000Z'), [], []),
    ];
    const ctx = buildExtractionContext(entries, [], 'day');

    const signal = extractTagPresenceSignal(ctx, trackerId, 'insomnia', 'Sleep#insomnia');

    expect(signal.points).toEqual([{ bucketKey: '2026-01-01', value: 0.5 }]);
  });
});

describe('nested child-Field Signals', () => {
  it('resolves a depth-2 reference path (Meal -> Ingredient -> Component) to the leaf Field', () => {
    const mealTracker = 'meal';
    const ingredientTracker = 'ingredient';
    const componentTracker = 'component';

    const weight: FieldDef = { name: 'Weight', required: false, dataType: 'decimal' };
    const placement = pointAt('2026-01-01T12:00:00.000Z');

    const componentEntry = entry(componentTracker, placement, [{ fieldName: 'Weight', value: 42 }], [], 'component-1');
    const ingredientEntry = entry(
      ingredientTracker,
      placement,
      [{ fieldName: 'Components', value: ['component-1'] }],
      [],
      'ingredient-1',
    );
    const mealEntry = entry(
      mealTracker,
      placement,
      [{ fieldName: 'Ingredients', value: ['ingredient-1'] }],
      [],
      'meal-1',
    );

    const ctx = buildExtractionContext(
      [mealEntry, ingredientEntry, componentEntry],
      [version(componentTracker, [weight])],
      'day',
    );

    const signal = extractNestedNumericSignal(
      ctx,
      mealTracker,
      ['Ingredients', 'Components'],
      'Weight',
      'Meal->Ingredients->Components.Weight',
    );

    expect(signal.points).toEqual([{ bucketKey: '2026-01-01', value: 42 }]);
  });

  it('resolves nothing for a path with no matching children, rather than throwing', () => {
    const mealTracker = 'meal';
    const mealEntry = entry(mealTracker, pointAt('2026-01-01T12:00:00.000Z'), [], [], 'meal-1');
    const ctx = buildExtractionContext([mealEntry], [], 'day');

    const signal = extractNestedNumericSignal(ctx, mealTracker, ['Ingredients'], 'Weight', 'x');

    expect(signal.points).toEqual([]);
  });
});

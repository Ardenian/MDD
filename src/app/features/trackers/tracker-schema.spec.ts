import type { FieldDef } from '../../data/model/field-def';
import {
  deepCopyValues,
  draftDiffersFromVersion,
  findFieldProblems,
  isDraftValid,
  isPresetStale,
} from './tracker-schema';

const satisfaction: FieldDef = { name: 'Satisfaction', required: false, dataType: 'integer' };
const energy: FieldDef = {
  name: 'Energy',
  required: false,
  dataType: 'singleSelect',
  options: ['low', 'high'],
};
const ingredients: FieldDef = {
  name: 'Ingredients',
  required: false,
  dataType: 'reference',
  targetTrackerId: 'tracker-ingredient',
  cardinality: 'many',
};

describe('findFieldProblems', () => {
  it('accepts a well-formed Draft', () => {
    expect(findFieldProblems([satisfaction, energy, ingredients])).toEqual([]);
    expect(isDraftValid([satisfaction, energy, ingredients])).toBe(true);
  });

  it('rejects an empty Field name', () => {
    expect(findFieldProblems([{ ...satisfaction, name: '   ' }])).toEqual([
      { kind: 'empty-name', index: 0 },
    ]);
  });

  it('rejects a duplicate Field name regardless of case', () => {
    const problems = findFieldProblems([satisfaction, { ...satisfaction, name: 'satisfaction' }]);

    expect(problems).toEqual([{ kind: 'duplicate-name', index: 1, name: 'satisfaction' }]);
  });

  it('rejects a select Field with no options', () => {
    expect(findFieldProblems([{ ...energy, options: [] }])).toEqual([
      { kind: 'empty-option-set', index: 0 },
    ]);
  });

  it('rejects duplicate options within one select Field', () => {
    expect(findFieldProblems([{ ...energy, options: ['low', 'Low'] }])).toEqual([
      { kind: 'duplicate-option', index: 0, option: 'Low' },
    ]);
  });

  it('requires a reference Field to name a target Tracker', () => {
    expect(findFieldProblems([{ ...ingredients, targetTrackerId: '' }])).toEqual([
      { kind: 'missing-reference-target', index: 0 },
    ]);
  });

  it('allows a self-referencing Field, and never mentions expansion depth', () => {
    const selfReference: FieldDef = { ...ingredients, targetTrackerId: 'tracker-meal' };

    expect(findFieldProblems([selfReference])).toEqual([]);
  });

  it('reports a problem per offending Field', () => {
    const problems = findFieldProblems([
      { ...satisfaction, name: '' },
      { ...energy, options: [] },
    ]);

    expect(problems).toEqual([
      { kind: 'empty-name', index: 0 },
      { kind: 'empty-option-set', index: 1 },
    ]);
  });
});

describe('draftDiffersFromVersion', () => {
  it('is false when the Draft matches the current Version exactly', () => {
    expect(draftDiffersFromVersion([satisfaction, energy], [satisfaction, energy])).toBe(false);
  });

  it('is true when a Field is added', () => {
    expect(draftDiffersFromVersion([satisfaction, energy], [satisfaction])).toBe(true);
  });

  it('is true when a Field is renamed', () => {
    expect(draftDiffersFromVersion([{ ...energy, name: 'EnergyLevel' }], [energy])).toBe(true);
  });

  it('is true when a data type changes', () => {
    expect(
      draftDiffersFromVersion([{ ...satisfaction, dataType: 'decimal' }], [satisfaction]),
    ).toBe(true);
  });

  it('is true when select options change', () => {
    expect(
      draftDiffersFromVersion([{ ...energy, options: ['low', 'medium', 'high'] }], [energy]),
    ).toBe(true);
  });

  it('is true when Fields are reordered — a schema is a sequence', () => {
    expect(draftDiffersFromVersion([energy, satisfaction], [satisfaction, energy])).toBe(true);
  });

  it('is true when a reference target or cardinality changes', () => {
    expect(draftDiffersFromVersion([{ ...ingredients, cardinality: 'one' }], [ingredients])).toBe(
      true,
    );
  });

  it('treats a Tracker with no committed Version as changed only if the Draft has Fields', () => {
    expect(draftDiffersFromVersion([], undefined)).toBe(false);
    expect(draftDiffersFromVersion([satisfaction], undefined)).toBe(true);
  });
});

describe('isPresetStale', () => {
  it('is stale once the Tracker has moved past the pinned Version', () => {
    expect(isPresetStale(1, 3)).toBe(true);
  });

  it('is not stale while pinned to the current Version', () => {
    expect(isPresetStale(3, 3)).toBe(false);
  });
});

describe('deepCopyValues', () => {
  it('produces a tree that shares nothing with the original', () => {
    const original = { values: [{ fieldName: 'Ingredients', value: ['egg'] }] };

    const copy = deepCopyValues(original);
    copy.values[0]?.value.push('bacon');

    expect(original.values[0]?.value).toEqual(['egg']);
  });
});

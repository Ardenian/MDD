import { buildEntryFormModel, formModelToSnapshot, isEntryFormValid, missingRequiredFields } from './entry-form';
import type { FieldDef } from '../../data/model/tracker';

const satisfaction: FieldDef = { name: 'Satisfaction', required: true, dataType: 'integer' };
const notes: FieldDef = { name: 'Notes', required: false, dataType: 'text' };
const energy: FieldDef = {
  name: 'Energy',
  required: false,
  dataType: 'singleSelect',
  options: ['low', 'medium', 'high'],
};
const ingredients: FieldDef = {
  name: 'Ingredients',
  required: true,
  dataType: 'reference',
  targetTrackerId: 'tracker-ingredient',
  cardinality: 'many',
};

describe('buildEntryFormModel', () => {
  it('defaults every Field by its data type when there is no Preset', () => {
    const model = buildEntryFormModel([satisfaction, notes, energy, ingredients]);

    expect(model).toEqual([
      { field: satisfaction, value: null },
      { field: notes, value: '' },
      { field: energy, value: null },
      { field: ingredients, value: [] },
    ]);
  });

  it('fills a Field from a matching Preset value', () => {
    const model = buildEntryFormModel([satisfaction], [{ fieldName: 'Satisfaction', value: 7 }]);
    expect(model).toEqual([{ field: satisfaction, value: 7 }]);
  });

  it('drops a Preset value whose Field no longer exists on the current Version', () => {
    const model = buildEntryFormModel([notes], [{ fieldName: 'Satisfaction', value: 7 }]);
    expect(model).toEqual([{ field: notes, value: '' }]);
  });
});

describe('formModelToSnapshot', () => {
  it('maps each Field input to a SnapshotField keyed by fieldName', () => {
    const model = buildEntryFormModel([satisfaction, notes], [{ fieldName: 'Satisfaction', value: 7 }]);
    expect(formModelToSnapshot(model)).toEqual([
      { fieldName: 'Satisfaction', value: 7 },
      { fieldName: 'Notes', value: '' },
    ]);
  });
});

describe('missingRequiredFields / isEntryFormValid', () => {
  it('flags a required Field left at its empty default', () => {
    const model = buildEntryFormModel([satisfaction, notes]);
    expect(missingRequiredFields(model)).toEqual([satisfaction]);
    expect(isEntryFormValid(model)).toBe(false);
  });

  it('is valid once every required Field has a non-empty value', () => {
    const model = buildEntryFormModel([satisfaction], [{ fieldName: 'Satisfaction', value: 5 }]);
    expect(isEntryFormValid(model)).toBe(true);
  });

  it('flags a required reference Field whose child list is empty (e.g. depth-cap-blocked)', () => {
    const model = buildEntryFormModel([ingredients]);
    expect(missingRequiredFields(model)).toEqual([ingredients]);

    const filled = buildEntryFormModel([ingredients], [{ fieldName: 'Ingredients', value: ['child-1'] }]);
    expect(isEntryFormValid(filled)).toBe(true);
  });

  it('treats a required text Field of only whitespace as empty', () => {
    const requiredText: FieldDef = { name: 'Title', required: true, dataType: 'text' };
    const model = buildEntryFormModel([requiredText], [{ fieldName: 'Title', value: '   ' }]);
    expect(isEntryFormValid(model)).toBe(false);
  });
});

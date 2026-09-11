import { fieldDefsEqual } from './field-defs-equal';
import type { FieldDef } from '../model/tracker';

const text: FieldDef = { name: 'Notes', required: false, dataType: 'text' };
const satisfaction: FieldDef = { name: 'Satisfaction', required: true, dataType: 'integer' };
const energy: FieldDef = {
  name: 'Energy',
  required: false,
  dataType: 'singleSelect',
  options: ['low', 'medium', 'high'],
};
const ingredient: FieldDef = {
  name: 'Ingredients',
  required: false,
  dataType: 'reference',
  targetTrackerId: 'tracker-ingredient',
  cardinality: 'many',
};

describe('fieldDefsEqual', () => {
  it('is true for identical field lists', () => {
    expect(fieldDefsEqual([text, satisfaction], [text, satisfaction])).toBe(true);
  });

  it('is false when lengths differ', () => {
    expect(fieldDefsEqual([text], [text, satisfaction])).toBe(false);
  });

  it('is false when order differs (reordering is a schema change)', () => {
    expect(fieldDefsEqual([text, satisfaction], [satisfaction, text])).toBe(false);
  });

  it('is false when a name, required flag, or data type differs', () => {
    expect(fieldDefsEqual([text], [{ ...text, name: 'Note' }])).toBe(false);
    expect(fieldDefsEqual([text], [{ ...text, required: true }])).toBe(false);
    expect(fieldDefsEqual([satisfaction], [{ ...satisfaction, dataType: 'decimal' }])).toBe(false);
  });

  it('compares select options', () => {
    expect(fieldDefsEqual([energy], [energy])).toBe(true);
    expect(fieldDefsEqual([energy], [{ ...energy, options: ['low', 'medium'] }])).toBe(false);
    expect(fieldDefsEqual([energy], [{ ...energy, options: ['low', 'medium', 'extreme'] }])).toBe(
      false,
    );
  });

  it('compares reference target and cardinality', () => {
    expect(fieldDefsEqual([ingredient], [ingredient])).toBe(true);
    expect(
      fieldDefsEqual([ingredient], [{ ...ingredient, cardinality: 'one' }]),
    ).toBe(false);
    expect(
      fieldDefsEqual([ingredient], [{ ...ingredient, targetTrackerId: 'tracker-other' }]),
    ).toBe(false);
  });
});

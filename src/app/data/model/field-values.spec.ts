import type { FieldDef } from './field-def';
import {
  coerceValue,
  emptyValueFor,
  isEmptyValue,
  validateValue,
  validateValues,
} from './field-values';

const text: FieldDef = { name: 'Notes', required: true, dataType: 'text' };
const integer: FieldDef = { name: 'Satisfaction', required: false, dataType: 'integer' };
const decimal: FieldDef = { name: 'Grams', required: true, dataType: 'decimal' };
const flag: FieldDef = { name: 'Rested', required: true, dataType: 'boolean' };
const single: FieldDef = {
  name: 'Energy',
  required: true,
  dataType: 'singleSelect',
  options: ['low', 'high'],
};
const multi: FieldDef = {
  name: 'Moods',
  required: false,
  dataType: 'multiSelect',
  options: ['calm', 'tired'],
};
const refOne: FieldDef = {
  name: 'Main',
  required: true,
  dataType: 'reference',
  targetTrackerId: 't',
  cardinality: 'one',
};
const refMany: FieldDef = {
  name: 'Ingredients',
  required: false,
  dataType: 'reference',
  targetTrackerId: 't',
  cardinality: 'many',
};

describe('emptyValueFor', () => {
  it('gives each data type its natural empty value', () => {
    expect([text, integer, flag, single, multi, refMany].map(emptyValueFor)).toEqual([
      '',
      null,
      false,
      null,
      [],
      [],
    ]);
  });
});

describe('validateValue', () => {
  it('flags a required value that is empty', () => {
    expect(validateValue(text, '  ')).toBe('required');
    expect(validateValue(decimal, null)).toBe('required');
    expect(validateValue(single, null)).toBe('required');
    expect(validateValue(refOne, [])).toBe('required');
  });

  it('never treats false as a missing boolean', () => {
    expect(validateValue(flag, false)).toBeNull();
  });

  it('accepts an empty optional value', () => {
    expect(validateValue(integer, null)).toBeNull();
    expect(validateValue(multi, [])).toBeNull();
  });

  it('rejects a fractional integer and an unparseable number', () => {
    expect(validateValue(integer, 2.5)).toBe('not-an-integer');
    expect(validateValue(decimal, Number.NaN)).toBe('not-a-number');
    expect(validateValue(decimal, 12.5)).toBeNull();
  });

  it('rejects an option the Field does not define', () => {
    expect(validateValue(single, 'medium')).toBe('unknown-option');
    expect(validateValue(multi, ['calm', 'angry'])).toBe('unknown-option');
  });

  it('allows only one child through a cardinality-one reference', () => {
    expect(validateValue(refOne, ['a', 'b'])).toBe('too-many-children');
    expect(validateValue(refMany, ['a', 'b'])).toBeNull();
  });
});

describe('validateValues', () => {
  it('reports only the Fields with a problem, keyed by name', () => {
    expect(validateValues([text, integer], { Notes: '', Satisfaction: 3 })).toEqual({
      Notes: 'required',
    });
  });

  it('treats a Field missing from the values as empty', () => {
    expect(validateValues([text], {})).toEqual({ Notes: 'required' });
  });
});

describe('coerceValue', () => {
  it('keeps a value whose shape matches the Field', () => {
    expect(coerceValue(integer, 4)).toBe(4);
    expect(coerceValue(multi, ['calm'])).toEqual(['calm']);
  });

  it('falls back to empty for a shape the Field cannot hold', () => {
    expect(coerceValue(integer, 'four')).toBeNull();
    expect(coerceValue(flag, 'yes')).toBe(false);
    expect(coerceValue(multi, 'calm')).toEqual([]);
    expect(coerceValue(single, 7)).toBeNull();
    expect(coerceValue(refMany, [1, 'id-2'])).toEqual(['id-2']);
  });

  it('copies arrays rather than sharing them', () => {
    const stored = ['calm'];
    const coerced = coerceValue(multi, stored);

    expect(coerced).toEqual(stored);
    expect(coerced).not.toBe(stored);
  });
});

describe('isEmptyValue', () => {
  it('matches what validation treats as missing', () => {
    expect(isEmptyValue(text, '')).toBe(true);
    expect(isEmptyValue(flag, false)).toBe(false);
    expect(isEmptyValue(refMany, [])).toBe(true);
  });
});

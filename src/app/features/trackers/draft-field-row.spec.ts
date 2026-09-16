import type { FieldDef } from '../../data/model/field-def';
import { withDataType } from './draft-field-row';

const text: FieldDef = { name: 'Notes', required: true, dataType: 'text' };

describe('withDataType', () => {
  it('keeps the name and required flag across a type change', () => {
    expect(withDataType(text, 'integer')).toEqual({
      name: 'Notes',
      required: true,
      dataType: 'integer',
    });
  });

  it('seeds an empty option set when becoming a select Field', () => {
    expect(withDataType(text, 'singleSelect')).toEqual({
      name: 'Notes',
      required: true,
      dataType: 'singleSelect',
      options: [],
    });
  });

  it('carries options between the two select types', () => {
    const single: FieldDef = {
      name: 'Energy',
      required: false,
      dataType: 'singleSelect',
      options: ['low', 'high'],
    };

    expect(withDataType(single, 'multiSelect')).toMatchObject({
      dataType: 'multiSelect',
      options: ['low', 'high'],
    });
  });

  it('seeds a reference Field with no target and single cardinality', () => {
    expect(withDataType(text, 'reference')).toEqual({
      name: 'Notes',
      required: true,
      dataType: 'reference',
      targetTrackerId: '',
      cardinality: 'one',
    });
  });

  it('drops options when leaving a select type', () => {
    const single: FieldDef = {
      name: 'Energy',
      required: false,
      dataType: 'singleSelect',
      options: ['low'],
    };

    expect(withDataType(single, 'text')).toEqual({
      name: 'Energy',
      required: false,
      dataType: 'text',
    });
  });
});

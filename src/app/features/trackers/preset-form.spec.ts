import type { FieldDef } from '../../data/model/field-def';
import { addChild } from '../../data/model/value-tree';
import { createPresetNode, toPresetInput, validatePreset } from './preset-form';

const energy: FieldDef = {
  name: 'Energy',
  required: true,
  dataType: 'singleSelect',
  options: ['low', 'high'],
};
const portion: FieldDef = { name: 'Portion', required: true, dataType: 'integer' };
const grams: FieldDef = { name: 'grams', required: true, dataType: 'decimal' };
const ingredients: FieldDef = {
  name: 'Ingredients',
  required: true,
  dataType: 'reference',
  targetTrackerId: 'ingredient',
  cardinality: 'many',
};

const meal = (stored: { fieldName: string; value: unknown }[] = []) =>
  createPresetNode('root', {
    trackerId: 'meal',
    trackerVersion: 3,
    fields: [energy, portion, ingredients],
    fieldName: null,
    stored,
    children: [],
  });

const ingredient = (key: string, value: unknown) =>
  createPresetNode(key, {
    trackerId: 'ingredient',
    trackerVersion: 2,
    fields: [grams],
    fieldName: 'Ingredients',
    stored: [{ fieldName: 'grams', value }],
    children: [],
  });

describe('validatePreset', () => {
  it('requires nothing of the Fields, since a Preset is a partial pre-fill', () => {
    expect(validatePreset('Full English', meal(), 5)).toEqual({ nameMissing: false, tree: {} });
  });

  it('still checks the shape of what is filled in', () => {
    expect(
      validatePreset('Full English', { ...meal(), values: { Energy: null, Portion: 1.5 } }, 5).tree,
    ).toEqual({
      root: { Portion: 'not-an-integer' },
    });
  });

  it('needs a name to pick it by', () => {
    expect(validatePreset('   ', meal(), 5).nameMissing).toBe(true);
  });
});

describe('toPresetInput', () => {
  it('stores only covered values, and each child with the Version it was authored against', () => {
    const tree = addChild(
      meal([{ fieldName: 'Energy', value: 'high' }]),
      'root',
      ingredient('a', 120),
    );

    expect(toPresetInput('meal', ' Full English ', tree)).toEqual({
      trackerId: 'meal',
      name: 'Full English',
      values: [{ fieldName: 'Energy', value: 'high' }],
      children: [
        {
          fieldName: 'Ingredients',
          trackerId: 'ingredient',
          trackerVersion: 2,
          values: [{ fieldName: 'grams', value: 120 }],
          children: [],
        },
      ],
    });
  });

  it('produces a value tree that shares nothing with the form', () => {
    const moods: FieldDef = {
      name: 'Moods',
      required: false,
      dataType: 'multiSelect',
      options: ['calm', 'tired'],
    };
    const root = createPresetNode('root', {
      trackerId: 'mood',
      trackerVersion: 1,
      fields: [moods],
      fieldName: null,
      stored: [{ fieldName: 'Moods', value: ['calm'] }],
      children: [],
    });

    const input = toPresetInput('mood', 'Calm', root);
    (input.values[0]!.value as string[]).push('tired');

    expect(root.values['Moods']).toEqual(['calm']);
  });
});

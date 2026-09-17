import type { FieldDef } from '../../data/model/field-def';
import { addChild, updateNode } from '../../data/model/value-tree';
import {
  createNode,
  type EntryFormNode,
  persistedIds,
  toSnapshot,
  validateForm,
} from './entry-form';

const grams: FieldDef = { name: 'grams', required: true, dataType: 'decimal' };
const satisfaction: FieldDef = { name: 'Satisfaction', required: false, dataType: 'integer' };
const ingredients: FieldDef = {
  name: 'Ingredients',
  required: false,
  dataType: 'reference',
  targetTrackerId: 'ingredient',
  cardinality: 'many',
};
const component: FieldDef = {
  name: 'Component',
  required: true,
  dataType: 'reference',
  targetTrackerId: 'meal',
  cardinality: 'one',
};

function meal(key = 'root', fields: readonly FieldDef[] = [satisfaction, ingredients]) {
  return createNode({ key, trackerId: 'meal', trackerVersion: 3, fields });
}

function ingredient(key: string, value: number | null = 50) {
  return createNode({
    key,
    trackerId: 'ingredient',
    trackerVersion: 1,
    fields: [grams],
    fieldName: 'Ingredients',
    stored: [{ fieldName: 'grams', value }],
  });
}

describe('createNode', () => {
  it('starts unsaved, with its own Tags and values read against the given Version', () => {
    expect(
      createNode({
        key: 'k',
        trackerId: 'meal',
        trackerVersion: 3,
        fields: [satisfaction],
        tags: ['dairy'],
      }),
    ).toEqual({
      key: 'k',
      entryId: null,
      trackerId: 'meal',
      trackerVersion: 3,
      fieldName: null,
      fields: [satisfaction],
      values: { Satisfaction: null },
      tags: ['dairy'],
      children: [],
    });
  });

  it('keeps each child’s Tags its own', () => {
    const tree = updateNode(addChild(meal(), 'root', ingredient('a')), 'a', (node) => ({
      ...node,
      tags: ['dairy'],
    }));

    expect(tree.tags).toEqual([]);
    expect(tree.children[0]?.tags).toEqual(['dairy']);
  });
});

describe('validateForm', () => {
  it('requires every required Field of an Entry', () => {
    expect(validateForm(addChild(meal(), 'root', ingredient('a', null)), 5)).toEqual({
      a: { grams: 'required' },
    });
  });

  it('asks for a child on a required reference while one can still be nested', () => {
    expect(validateForm(meal('root', [component]), 5)).toEqual({ root: { Component: 'required' } });
  });

  it('marks a required reference unsatisfiable once the depth cap is reached', () => {
    const leaf = createNode({
      key: 'leaf',
      trackerId: 'meal',
      trackerVersion: 3,
      fields: [component],
      fieldName: 'Component',
    });

    expect(validateForm(addChild(meal('root', [component]), 'root', leaf), 2)).toEqual({
      leaf: { Component: 'depth-cap-reached' },
    });
  });
});

describe('toSnapshot', () => {
  it('writes one value per Field in Version order, with children as their ids', () => {
    const tree = updateNode(addChild(meal(), 'root', ingredient('a')), 'root', (node) => ({
      ...node,
      values: { Satisfaction: 4 },
    }));

    expect(toSnapshot(tree, () => 'saved-a')).toEqual([
      { fieldName: 'Satisfaction', value: 4 },
      { fieldName: 'Ingredients', value: ['saved-a'] },
    ]);
  });
});

describe('persistedIds', () => {
  it('collects every Entry id already saved anywhere in the tree', () => {
    const saved: EntryFormNode = { ...ingredient('a'), entryId: 'entry-a' };
    const root: EntryFormNode = { ...meal(), entryId: 'entry-root' };
    const tree = addChild(addChild(root, 'root', saved), 'root', ingredient('new'));

    expect([...persistedIds(tree)].sort()).toEqual(['entry-a', 'entry-root']);
  });
});

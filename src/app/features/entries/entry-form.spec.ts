import type { FieldDef } from '../../data/model/field-def';
import {
  addChild,
  childrenOf,
  createNode,
  findNode,
  hasProblems,
  initialValues,
  persistedIds,
  removeNode,
  toSnapshot,
  updateNode,
  validateForm,
} from './entry-form';

const grams: FieldDef = { name: 'grams', required: true, dataType: 'decimal' };
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

describe('initialValues', () => {
  it('reads stored values against the given Version, not today’s schema', () => {
    expect(initialValues([energy], [{ fieldName: 'Energy', value: 'high' }])).toEqual({
      Energy: 'high',
    });
  });

  it('renders a Field the source did not cover as empty', () => {
    expect(
      initialValues([satisfaction, energy], [{ fieldName: 'Satisfaction', value: 4 }]),
    ).toEqual({
      Satisfaction: 4,
      Energy: null,
    });
  });

  it('drops a stored value whose Field the Version no longer has', () => {
    expect(initialValues([satisfaction], [{ fieldName: 'Retired', value: 'x' }])).toEqual({
      Satisfaction: null,
    });
  });

  it('holds no values for reference Fields — those are the children', () => {
    expect(initialValues([ingredients], [{ fieldName: 'Ingredients', value: ['a'] }])).toEqual({});
  });

  it('shares nothing with the source it copied from', () => {
    const source = [{ fieldName: 'Moods', value: ['calm'] }];
    const moods: FieldDef = {
      name: 'Moods',
      required: false,
      dataType: 'multiSelect',
      options: ['calm'],
    };

    const values = initialValues([moods], source);
    (source[0]!.value as string[]).push('tired');

    expect(values['Moods']).toEqual(['calm']);
  });
});

describe('tree editing', () => {
  it('adds children under a reference Field and keeps creation order', () => {
    const tree = addChild(addChild(meal(), 'root', ingredient('a')), 'root', ingredient('b'));

    expect(childrenOf(tree, 'Ingredients').map((child) => child.key)).toEqual(['a', 'b']);
  });

  it('removes a child without touching its siblings', () => {
    const tree = removeNode(
      addChild(addChild(meal(), 'root', ingredient('a')), 'root', ingredient('b')),
      'a',
    );

    expect(tree.children.map((child) => child.key)).toEqual(['b']);
  });

  it('never removes the root', () => {
    const root = meal();

    expect(removeNode(root, 'root')).toBe(root);
  });

  it('finds a nested node with its depth', () => {
    const inner = createNode({
      key: 'inner',
      trackerId: 'meal',
      trackerVersion: 3,
      fields: [],
      fieldName: 'Component',
    });
    const middle = addChild(
      createNode({
        key: 'middle',
        trackerId: 'meal',
        trackerVersion: 3,
        fields: [],
        fieldName: 'Component',
      }),
      'middle',
      inner,
    );
    const tree = addChild(meal(), 'root', middle);

    expect(findNode(tree, 'inner')).toMatchObject({ depth: 3, node: { key: 'inner' } });
    expect(findNode(tree, 'missing')).toBeUndefined();
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
  it('reports scalar problems per node', () => {
    const tree = addChild(meal(), 'root', ingredient('a', null));

    expect(validateForm(tree, 5)).toEqual({ a: { grams: 'required' } });
  });

  it('is clean for a valid tree', () => {
    expect(hasProblems(validateForm(addChild(meal(), 'root', ingredient('a')), 5))).toBe(false);
  });

  it('flags a cardinality-one reference holding two children', () => {
    const root = meal('root', [component]);
    const child = (key: string) =>
      createNode({ key, trackerId: 'meal', trackerVersion: 3, fields: [], fieldName: 'Component' });

    expect(
      validateForm(addChild(addChild(root, 'root', child('a')), 'root', child('b')), 5),
    ).toEqual({
      root: { Component: 'too-many-children' },
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
    const tree = addChild(meal('root', [component]), 'root', leaf);

    expect(validateForm(tree, 2)).toEqual({ leaf: { Component: 'depth-cap-reached' } });
  });

  it('treats a chain across distinct Trackers exactly like a self-reference', () => {
    const otherTrackerRequired: FieldDef = { ...component, targetTrackerId: 'side-dish' };
    const leaf = createNode({
      key: 'leaf',
      trackerId: 'side-dish',
      trackerVersion: 1,
      fields: [otherTrackerRequired],
      fieldName: 'Component',
    });
    const tree = addChild(meal('root', [component]), 'root', leaf);

    expect(validateForm(tree, 2)).toEqual({ leaf: { Component: 'depth-cap-reached' } });
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
    const saved = createNode({
      key: 'a',
      entryId: 'entry-a',
      trackerId: 'ingredient',
      trackerVersion: 1,
      fields: [grams],
      fieldName: 'Ingredients',
    });
    const tree = addChild(
      addChild({ ...meal(), entryId: 'entry-root' }, 'root', saved),
      'root',
      ingredient('new'),
    );

    expect([...persistedIds(tree)].sort()).toEqual(['entry-a', 'entry-root']);
  });
});

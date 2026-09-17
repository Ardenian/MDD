import type { FieldDef } from './field-def';
import {
  addChild,
  childrenOf,
  type CurrentSchema,
  findNode,
  hasProblems,
  initialValues,
  problemCount,
  removeNode,
  treeFromStored,
  updateNode,
  validateTree,
  type ValueNode,
} from './value-tree';

interface TestNode extends ValueNode<TestNode> {
  readonly label?: string;
}

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

function node(key: string, fields: readonly FieldDef[], extra: Partial<TestNode> = {}): TestNode {
  return {
    key,
    trackerId: 'meal',
    trackerVersion: 1,
    fieldName: null,
    fields,
    values: initialValues(fields),
    children: [],
    ...extra,
  };
}

function ingredient(key: string, value: number | null = 50): TestNode {
  return node(key, [grams], {
    trackerId: 'ingredient',
    fieldName: 'Ingredients',
    values: initialValues([grams], [{ fieldName: 'grams', value }]),
  });
}

describe('initialValues', () => {
  it('reads stored values against the given Fields, not today’s schema', () => {
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

  it('drops a stored value whose Field no longer exists', () => {
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
  const meal = () => node('root', [satisfaction, ingredients]);

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
    const middle = addChild(
      node('middle', [], { fieldName: 'Component' }),
      'middle',
      node('inner', [], { fieldName: 'Component' }),
    );
    const tree = addChild(meal(), 'root', middle);

    expect(findNode(tree, 'inner')).toMatchObject({ depth: 3, node: { key: 'inner' } });
    expect(findNode(tree, 'missing')).toBeUndefined();
  });

  it('keeps the node type’s own properties through an update', () => {
    const tree = updateNode(
      addChild(meal(), 'root', { ...ingredient('a'), label: 'kept' }),
      'a',
      (child) => ({
        ...child,
        values: { grams: 5 },
      }),
    );

    expect(tree.children[0]).toMatchObject({ label: 'kept', values: { grams: 5 } });
  });
});

describe('validateTree', () => {
  it('reports scalar problems per node', () => {
    const tree = addChild(node('root', [ingredients]), 'root', ingredient('a', null));

    expect(validateTree(tree, 5, { requireValues: true })).toEqual({ a: { grams: 'required' } });
  });

  it('flags a cardinality-one reference holding two children', () => {
    const child = (key: string) => node(key, [], { fieldName: 'Component' });
    const tree = addChild(
      addChild(node('root', [component]), 'root', child('a')),
      'root',
      child('b'),
    );

    expect(validateTree(tree, 5, { requireValues: true })).toEqual({
      root: { Component: 'too-many-children' },
    });
  });

  it('marks a required reference unsatisfiable once the depth cap is reached', () => {
    const tree = addChild(
      node('root', [component]),
      'root',
      node('leaf', [component], { fieldName: 'Component' }),
    );

    expect(validateTree(tree, 2, { requireValues: true })).toEqual({
      leaf: { Component: 'depth-cap-reached' },
    });
  });

  it('treats a chain across distinct Trackers exactly like a self-reference', () => {
    const leaf = node('leaf', [{ ...component, targetTrackerId: 'side-dish' }], {
      trackerId: 'side-dish',
      fieldName: 'Component',
    });
    const tree = addChild(node('root', [component]), 'root', leaf);

    expect(validateTree(tree, 2, { requireValues: true })).toEqual({
      leaf: { Component: 'depth-cap-reached' },
    });
  });

  it('asks nothing of a partial pre-fill, but still checks the shape of what is filled', () => {
    const partial = node('root', [grams, component, satisfaction], {
      values: { grams: null, Satisfaction: 2.5 },
    });

    const problems = validateTree(partial, 1, { requireValues: false });

    expect(problems).toEqual({ root: { Satisfaction: 'not-an-integer' } });
    expect(problemCount(problems)).toBe(1);
  });

  it('is clean for a valid tree', () => {
    expect(
      hasProblems(
        validateTree(addChild(node('root', [ingredients]), 'root', ingredient('a')), 5, {
          requireValues: true,
        }),
      ),
    ).toBe(false);
  });
});

describe('treeFromStored', () => {
  const schemas: Record<string, CurrentSchema> = {
    meal: {
      trackerId: 'meal',
      trackerVersion: 3,
      fields: [energy, { ...grams, name: 'Portion' }, ingredients],
    },
    ingredient: { trackerId: 'ingredient', trackerVersion: 2, fields: [grams] },
  };
  const make = (parts: {
    trackerId: string;
    trackerVersion: number;
    fields: readonly FieldDef[];
    fieldName: string | null;
    stored: readonly { fieldName: string; value: unknown }[];
    children: readonly TestNode[];
  }): TestNode => ({
    key: `${parts.trackerId}-${parts.children.length}`,
    trackerId: parts.trackerId,
    trackerVersion: parts.trackerVersion,
    fieldName: parts.fieldName,
    fields: parts.fields,
    values: initialValues(parts.fields, parts.stored),
    children: parts.children,
  });
  const currentSchema = async (trackerId: string) => schemas[trackerId]!;

  it('rebuilds values and children against each Tracker’s current Version', async () => {
    const tree = await treeFromStored(
      {
        trackerId: 'meal',
        values: [
          { fieldName: 'Energy', value: 'high' },
          { fieldName: 'Retired', value: 'gone' },
        ],
        children: [
          { fieldName: 'Ingredients', values: [{ fieldName: 'grams', value: 2 }], children: [] },
        ],
      },
      5,
      currentSchema,
      make,
    );

    expect(tree).toMatchObject({ trackerVersion: 3, values: { Energy: 'high', Portion: null } });
    expect(tree.children).toMatchObject([
      {
        trackerId: 'ingredient',
        trackerVersion: 2,
        fieldName: 'Ingredients',
        values: { grams: 2 },
      },
    ]);
  });

  it('drops a child whose reference Field the current Version no longer has', async () => {
    const tree = await treeFromStored(
      {
        trackerId: 'meal',
        values: [],
        children: [{ fieldName: 'Garnish', values: [], children: [] }],
      },
      5,
      currentSchema,
      make,
    );

    expect(tree.children).toEqual([]);
  });

  it('nests nothing past the cap', async () => {
    const tree = await treeFromStored(
      {
        trackerId: 'meal',
        values: [],
        children: [{ fieldName: 'Ingredients', values: [], children: [] }],
      },
      1,
      currentSchema,
      make,
    );

    expect(tree.children).toEqual([]);
  });
});

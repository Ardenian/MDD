import { boundedChildrenAccessor } from './bounded-children';

interface Node {
  readonly id: string;
  children: Node[];
}

function node(id: string, children: Node[] = []): Node {
  return { id, children };
}

function accessorFor(roots: Node[], cap: number) {
  return boundedChildrenAccessor(roots, {
    cap,
    idOf: (item: Node) => item.id,
    childrenOf: (item: Node) => item.children,
  });
}

describe('boundedChildrenAccessor', () => {
  it('returns the real children while under the cap', () => {
    const leaf = node('leaf');
    const root = node('root', [leaf]);

    const children = accessorFor([root], 5);

    expect(children(root)).toEqual([leaf]);
    expect(children(leaf)).toEqual([]);
  });

  it('stops expanding at the cap', () => {
    const third = node('third');
    const second = node('second', [third]);
    const root = node('root', [second]);

    const children = accessorFor([root], 2);

    expect(children(root)).toEqual([second]);
    expect(children(second)).toEqual([]);
  });

  it('never recurses forever on a self-referencing shape', () => {
    const root = node('root');
    root.children = [root];

    const children = accessorFor([root], 5);

    expect(children(root)).toEqual([]);
  });

  it('drops a child that is already its own ancestor', () => {
    const root = node('root');
    const child = node('child', [root]);
    root.children = [child];

    const children = accessorFor([root], 5);

    expect(children(root)).toEqual([child]);
    expect(children(child)).toEqual([]);
  });

  it('treats a cap of 1 as roots only', () => {
    const root = node('root', [node('child')]);

    expect(accessorFor([root], 1)(root)).toEqual([]);
  });

  it('returns nothing for a node it has never seen', () => {
    const children = accessorFor([node('root')], 5);

    expect(children(node('stranger'))).toEqual([]);
  });

  it('expands a chain across distinct nodes to exactly the cap', () => {
    const fourth = node('fourth');
    const third = node('third', [fourth]);
    const second = node('second', [third]);
    const root = node('root', [second]);

    const children = accessorFor([root], 3);

    expect(children(second)).toEqual([third]);
    expect(children(third)).toEqual([]);
  });
});

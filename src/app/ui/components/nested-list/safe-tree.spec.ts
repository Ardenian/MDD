import { createSafeChildrenAccessor, wrapTreeRoot } from './safe-tree';

interface Node {
  readonly id: string;
  readonly childIds: readonly string[];
}

function harness(nodes: readonly Node[]) {
  const byId = new Map(nodes.map((node) => [node.id, node]));
  const getId = (node: Node) => node.id;
  const getChildren = (node: Node) => node.childIds.map((id) => byId.get(id)).filter((n): n is Node => !!n);
  return { getId, getChildren };
}

describe('createSafeChildrenAccessor', () => {
  it('resolves a linear (acyclic) chain fully', () => {
    const nodes: Node[] = [
      { id: 'a', childIds: ['b'] },
      { id: 'b', childIds: ['c'] },
      { id: 'c', childIds: [] },
    ];
    const { getId, getChildren } = harness(nodes);
    const accessor = createSafeChildrenAccessor(getId, getChildren, 5);

    const root = wrapTreeRoot(nodes[0], getId);
    const level1 = accessor(root);
    const level2 = accessor(level1[0]);
    const level3 = accessor(level2[0]);

    expect(level1.map((n) => n.value.id)).toEqual(['b']);
    expect(level2.map((n) => n.value.id)).toEqual(['c']);
    expect(level3).toEqual([]);
  });

  it('truncates a direct self-reference instead of expanding forever', () => {
    const nodes: Node[] = [{ id: 'meal', childIds: ['meal'] }];
    const { getId, getChildren } = harness(nodes);
    const accessor = createSafeChildrenAccessor(getId, getChildren, 5);

    const root = wrapTreeRoot(nodes[0], getId);
    const level1 = accessor(root);

    expect(level1).toHaveLength(1);
    expect(level1[0].truncated).toBe(true);
    expect(accessor(level1[0])).toEqual([]);
  });

  it('truncates an indirect cycle (a -> b -> a)', () => {
    const nodes: Node[] = [
      { id: 'a', childIds: ['b'] },
      { id: 'b', childIds: ['a'] },
    ];
    const { getId, getChildren } = harness(nodes);
    const accessor = createSafeChildrenAccessor(getId, getChildren, 10);

    const root = wrapTreeRoot(nodes[0], getId);
    const level1 = accessor(root);
    const level2 = accessor(level1[0]);

    expect(level2[0].truncated).toBe(true);
    expect(accessor(level2[0])).toEqual([]);
  });

  it('stops at the depth cap for a long acyclic chain, without ever throwing', () => {
    const nodes: Node[] = Array.from({ length: 10 }, (_, i) => ({
      id: `n${i}`,
      childIds: i < 9 ? [`n${i + 1}`] : [],
    }));
    const { getId, getChildren } = harness(nodes);
    const accessor = createSafeChildrenAccessor(getId, getChildren, 3);

    let level = [wrapTreeRoot(nodes[0], getId)];
    let depth = 0;
    expect(() => {
      while (level.length > 0 && depth < 20) {
        level = accessor(level[0]) as typeof level;
        depth += 1;
      }
    }).not.toThrow();

    // Depth cap 3: root(0) -> n1(1) -> n2(2) -> n3(3, blocked) -> [] at depth 3.
    expect(depth).toBe(4);
  });
});

import { moveItem } from './reorder';

describe('moveItem', () => {
  const items = ['a', 'b', 'c', 'd'];

  it('moves an item forward', () => {
    expect(moveItem(items, 0, 2)).toEqual(['b', 'c', 'a', 'd']);
  });

  it('moves an item backward', () => {
    expect(moveItem(items, 3, 1)).toEqual(['a', 'd', 'b', 'c']);
  });

  it('never mutates the input', () => {
    moveItem(items, 0, 3);

    expect(items).toEqual(['a', 'b', 'c', 'd']);
  });

  it('returns an equal copy when the item does not move', () => {
    const result = moveItem(items, 2, 2);

    expect(result).toEqual(items);
    expect(result).not.toBe(items);
  });

  it('ignores an index outside the list', () => {
    expect(moveItem(items, -1, 2)).toEqual(items);
    expect(moveItem(items, 1, 9)).toEqual(items);
  });

  it('handles an empty list', () => {
    expect(moveItem([], 0, 0)).toEqual([]);
  });
});

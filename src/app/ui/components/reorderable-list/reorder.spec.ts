import { reorder } from './reorder';

describe('reorder', () => {
  it('moves an item forward without mutating the input', () => {
    const items = ['a', 'b', 'c', 'd'];

    const result = reorder(items, { previousIndex: 0, currentIndex: 2 });

    expect(result).toEqual(['b', 'c', 'a', 'd']);
    expect(items).toEqual(['a', 'b', 'c', 'd']);
  });

  it('moves an item backward', () => {
    const items = ['a', 'b', 'c', 'd'];
    expect(reorder(items, { previousIndex: 3, currentIndex: 1 })).toEqual(['a', 'd', 'b', 'c']);
  });

  it('is a no-op when previousIndex equals currentIndex', () => {
    const items = ['a', 'b', 'c'];
    expect(reorder(items, { previousIndex: 1, currentIndex: 1 })).toEqual(['a', 'b', 'c']);
  });

  it('handles a single-item array', () => {
    expect(reorder(['only'], { previousIndex: 0, currentIndex: 0 })).toEqual(['only']);
  });
});

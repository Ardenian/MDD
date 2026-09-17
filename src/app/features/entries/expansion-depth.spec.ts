import { canAddChild, isReferenceBlocked, ROOT_DEPTH } from './expansion-depth';

describe('canAddChild', () => {
  it('allows nesting while the child would stay within the cap', () => {
    expect(canAddChild(ROOT_DEPTH, 5)).toBe(true);
    expect(canAddChild(4, 5)).toBe(true);
  });

  it('refuses a child that would exceed the cap', () => {
    expect(canAddChild(5, 5)).toBe(false);
  });

  it('allows no children at all under a cap of 1', () => {
    expect(canAddChild(ROOT_DEPTH, 1)).toBe(false);
  });
});

describe('isReferenceBlocked', () => {
  it('blocks a required, still-empty reference that can no longer gain a child', () => {
    expect(isReferenceBlocked({ required: true, childCount: 0, depth: 3, cap: 3 })).toBe(true);
  });

  it('does not block one that can still be satisfied by nesting', () => {
    expect(isReferenceBlocked({ required: true, childCount: 0, depth: 2, cap: 3 })).toBe(false);
  });

  it('does not block an optional reference, or one already satisfied', () => {
    expect(isReferenceBlocked({ required: false, childCount: 0, depth: 3, cap: 3 })).toBe(false);
    expect(isReferenceBlocked({ required: true, childCount: 1, depth: 3, cap: 3 })).toBe(false);
  });
});

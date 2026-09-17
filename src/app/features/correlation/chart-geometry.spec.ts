import { type ChartBox, extentOf, linePath, scaleX, scaleY, scatterPoints } from './chart-geometry';

const box: ChartBox = { width: 100, height: 50, padding: 5 };

describe('extentOf', () => {
  it('spans the smallest and largest value present', () => {
    expect(extentOf([3, 9, 5])).toEqual({ min: 3, max: 9 });
  });

  it('ignores gaps', () => {
    expect(extentOf([null, 4, null, 8])).toEqual({ min: 4, max: 8 });
  });

  it('gives a Series that never moves a band to sit in the middle of', () => {
    expect(extentOf([7, 7, 7])).toEqual({ min: 6.5, max: 7.5 });
  });

  it('falls back to 0..1 for a Series with nothing in it', () => {
    expect(extentOf([null, null])).toEqual({ min: 0, max: 1 });
  });
});

describe('scaleY', () => {
  const extent = { min: 0, max: 10 };

  it('puts the largest value at the top of the drawing area', () => {
    expect(scaleY(10, extent, box)).toBe(box.padding);
  });

  it('puts the smallest at the bottom', () => {
    expect(scaleY(0, extent, box)).toBe(box.height - box.padding);
  });

  it('puts the middle in the middle', () => {
    expect(scaleY(5, extent, box)).toBe(box.height / 2);
  });
});

describe('scaleX', () => {
  it('spreads Buckets evenly from edge to edge', () => {
    expect(scaleX(0, 3, box)).toBe(box.padding);
    expect(scaleX(2, 3, box)).toBe(box.width - box.padding);
    expect(scaleX(1, 3, box)).toBe(box.width / 2);
  });

  it('centres a single Bucket rather than pinning it to the left edge', () => {
    expect(scaleX(0, 1, box)).toBe(box.width / 2);
  });
});

describe('linePath', () => {
  it('moves to the first point and draws to the rest', () => {
    expect(linePath([0, 10], { min: 0, max: 10 }, box)).toBe('M5,45 L95,5');
  });

  it('breaks the line at a gap rather than drawing through it', () => {
    const path = linePath([0, null, 10], { min: 0, max: 10 }, box);

    // Two move commands: the line stops at the gap and starts again after it.
    expect(path.split('M')).toHaveLength(3);
  });

  it('has nothing to draw for a Series with no values', () => {
    expect(linePath([null, null], { min: 0, max: 1 }, box)).toBe('');
  });
});

describe('scatterPoints', () => {
  it('plots only Buckets where both Series have a value', () => {
    expect(scatterPoints([1, null, 3], [4, 5, null], box)).toHaveLength(1);
  });

  it('places the pair at the extremes in opposite corners', () => {
    const points = scatterPoints([0, 10], [0, 10], box);

    expect(points[0]).toEqual({ x: box.padding, y: box.height - box.padding });
    expect(points[1]).toEqual({ x: box.width - box.padding, y: box.padding });
  });

  it('has nothing to plot when the Series never overlap', () => {
    expect(scatterPoints([1, null], [null, 2], box)).toEqual([]);
  });
});

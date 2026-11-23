import { getPathContentBounds } from '@figpot/src/features/translators/vectors/getPathContentBounds';

describe('getPathContentBounds()', () => {
  it('should include curve extrema and not only control points', () => {
    // Round cap of a horizontal line: a half circle of radius 2.5 on the left of (0, 0)
    const bounds = getPathContentBounds([
      { command: 'move-to', params: { x: 0, y: -2.5 } },
      { command: 'curve-to', params: { c1x: -1.38071, c1y: -2.5, c2x: -2.5, c2y: -1.38071, x: -2.5, y: 0 } },
      { command: 'curve-to', params: { c1x: -2.5, c1y: 1.38071, c2x: -1.38071, c2y: 2.5, x: 0, y: 2.5 } },
      { command: 'line-to', params: { x: 75, y: 2.5 } },
      { command: 'line-to', params: { x: 75, y: -2.5 } },
      { command: 'close-path', params: null },
    ]);

    expect(bounds).toEqual({ x: -2.5, y: -2.5, width: 77.5, height: 5 });
  });

  it('should return null without drawing', () => {
    expect(getPathContentBounds([])).toBeNull();
  });
});

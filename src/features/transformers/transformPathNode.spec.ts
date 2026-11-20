import { getPolygonPath } from '@figpot/src/features/transformers/transformPathNode';

describe('getPolygonPath()', () => {
  it('starts a regular polygon at the top center', () => {
    const path = getPolygonPath({ type: 'REGULAR_POLYGON', size: { x: 18, y: 18 }, count: 6 } as any) as string;

    expect(path.startsWith('M 9 0 L')).toBe(true);
    expect(path.split(' L ')).toHaveLength(6);
    expect(path.endsWith(' Z')).toBe(true);
  });

  it('alternates outer and inner points for a star', () => {
    const path = getPolygonPath({ type: 'STAR', size: { x: 10, y: 10 }, count: 5, starInnerScale: 0.5 } as any) as string;

    expect(path.split(' L ')).toHaveLength(10);
    // The second point is an inner one, at half the radius
    const [x, y] = path.split(' L ')[1].split(' ').map(Number);
    expect(Math.hypot(x - 5, y - 5)).toBeCloseTo(2.5);
  });
});

import { getPolygonPath } from '@figpot/src/features/transformers/transformPathNode';

function getPoints(path: string): number[][] {
  return path
    .replace(/^M /, '')
    .replace(/ Z$/, '')
    .split(' L ')
    .map((point) => point.split(' ').map((value) => Math.round(Number(value) * 100) / 100));
}

describe('getPolygonPath()', () => {
  it('puts the points of a regular polygon on the ellipse of its size, from the top center', () => {
    // Points of an hexagon given by Figma in its stroke geometry
    const path = getPolygonPath({ type: 'REGULAR_POLYGON', size: { x: 18, y: 18 }, count: 6 }) as string;

    expect(getPoints(path)).toEqual([
      [9, 0],
      [16.79, 4.5],
      [16.79, 13.5],
      [9, 18],
      [1.21, 13.5],
      [1.21, 4.5],
    ]);
  });

  it('alternates outer and inner points for a star', () => {
    // Points of a star given by Figma in its stroke geometry
    const points = getPoints(getPolygonPath({ type: 'STAR', size: { x: 10, y: 10 }, count: 5, starInnerScale: 0.54 }) as string);

    expect(points).toHaveLength(10);
    expect(points[0]).toEqual([5, 0]);
    expect(points[2]).toEqual([9.76, 3.45]);
    expect(points[5]).toEqual([5, 7.7]);
  });

  it('gives nothing without size or with too few points', () => {
    expect(getPolygonPath({ type: 'REGULAR_POLYGON', size: undefined, count: 6 })).toBeNull();
    expect(getPolygonPath({ type: 'REGULAR_POLYGON', size: { x: 10, y: 10 }, count: 2 })).toBeNull();
  });
});

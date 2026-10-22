import { translateEvenOddToNonZero } from '@figpot/src/features/translators/vectors/translateEvenOddToNonZero';
import { PathContent } from '@figpot/src/models/entities/penpot/shapes/path';

function square(x: number, y: number, size: number, clockwise: boolean): PathContent {
  const points = clockwise
    ? [
        [x, y],
        [x + size, y],
        [x + size, y + size],
        [x, y + size],
      ]
    : [
        [x, y],
        [x, y + size],
        [x + size, y + size],
        [x + size, y],
      ];

  return [
    { command: 'move-to', params: { x: points[0][0], y: points[0][1] } },
    ...points.slice(1).map(([px, py]) => ({ command: 'line-to' as const, params: { x: px, y: py } })),
    { command: 'close-path', params: null },
  ];
}

function signedArea(content: PathContent): number[] {
  const areas: number[] = [];
  let points: { x: number; y: number }[] = [];

  const flush = () => {
    if (points.length > 0) {
      let area = 0;
      for (let i = 0; i < points.length; i++) {
        const next = points[(i + 1) % points.length];
        area += points[i].x * next.y - next.x * points[i].y;
      }
      areas.push(area / 2);
    }
    points = [];
  };

  for (const segment of content) {
    if (segment.command === 'move-to') {
      flush();
    }
    if (segment.params) {
      points.push({ x: segment.params.x, y: segment.params.y });
    }
  }
  flush();

  return areas;
}

describe('translateEvenOddToNonZero()', () => {
  it('should reverse a hole drawn in the same direction as its outer contour', () => {
    const content = [...square(0, 0, 100, true), ...square(25, 25, 50, true)];
    const result = translateEvenOddToNonZero(content);
    const [outer, hole] = signedArea(result);

    expect(Math.sign(outer)).toBe(1);
    expect(Math.sign(hole)).toBe(-1);
    expect(result.filter((segment) => segment.command === 'close-path')).toHaveLength(2);
  });

  it('should keep contours already alternating, and separate contours untouched', () => {
    const alternating = [...square(0, 0, 100, true), ...square(25, 25, 50, false)];
    expect(translateEvenOddToNonZero(alternating)).toEqual(alternating);

    const separate = [...square(0, 0, 10, true), ...square(50, 50, 10, true)];
    expect(translateEvenOddToNonZero(separate)).toEqual(separate);
  });

  it('should alternate orientation on several nesting levels', () => {
    const content = [...square(0, 0, 100, true), ...square(10, 10, 80, true), ...square(20, 20, 60, true)];
    const areas = signedArea(translateEvenOddToNonZero(content)).map(Math.sign);

    expect(areas).toEqual([1, -1, 1]);
  });

  it('should reverse curves by swapping their control points', () => {
    const content: PathContent = [
      ...square(0, 0, 100, true),
      { command: 'move-to', params: { x: 50, y: 20 } },
      { command: 'curve-to', params: { x: 80, y: 50, c1x: 70, c1y: 20, c2x: 80, c2y: 30 } },
      { command: 'curve-to', params: { x: 50, y: 80, c1x: 80, c1y: 70, c2x: 70, c2y: 80 } },
      { command: 'curve-to', params: { x: 20, y: 50, c1x: 30, c1y: 80, c2x: 20, c2y: 70 } },
      { command: 'curve-to', params: { x: 50, y: 20, c1x: 20, c1y: 30, c2x: 30, c2y: 20 } },
      { command: 'close-path', params: null },
    ];

    const result = translateEvenOddToNonZero(content);
    const hole = result.slice(5);

    expect(hole[0]).toEqual({ command: 'move-to', params: { x: 50, y: 20 } });
    expect(hole[1]).toEqual({ command: 'curve-to', params: { x: 20, y: 50, c1x: 30, c1y: 20, c2x: 20, c2y: 30 } });
    expect(hole[hole.length - 1]).toEqual({ command: 'close-path', params: null });
  });
});

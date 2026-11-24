import {
  transformAxisAlignedDimensionAndPosition,
  transformDimensionAndRotationAndPosition,
} from '@figpot/src/features/transformers/partials/transformDimensionAndRotationAndPosition';

type Node = Parameters<typeof transformDimensionAndRotationAndPosition>[0];
const identity: Parameters<typeof transformDimensionAndRotationAndPosition>[1] = [
  [1, 0, 0],
  [0, 1, 0],
];

describe('transformDimensionAndRotationAndPosition()', () => {
  it('should give a zero-width node the minimum size Penpot uses', () => {
    const node = { size: { x: 0, y: 24 }, absoluteBoundingBox: { x: 100, y: 100, width: 0, height: 24 } } as unknown as Node;

    const dimension = transformDimensionAndRotationAndPosition(node, identity);

    expect(dimension.width).toBe(0.01);
    expect(dimension.height).toBe(24);
    expect(dimension.selrect).toMatchObject({ width: 0.01, x2: 100.01 });
  });

  it('should keep the minimum size on a rotated node', () => {
    const node = { size: { x: 50, y: 0 }, absoluteBoundingBox: { x: 0, y: 0, width: 35.36, height: 35.36 } } as unknown as Node;
    const rotated: Parameters<typeof transformDimensionAndRotationAndPosition>[1] = [
      [Math.SQRT1_2, Math.SQRT1_2, 0],
      [-Math.SQRT1_2, Math.SQRT1_2, 0],
    ];

    const dimension = transformDimensionAndRotationAndPosition(node, rotated);

    expect(dimension.width).toBe(50);
    expect(dimension.height).toBe(0.01);
  });
});

describe('transformAxisAlignedDimensionAndPosition()', () => {
  it('should give a zero-height geometry the minimum size Penpot uses', () => {
    const dimension = transformAxisAlignedDimensionAndPosition(10, 20, 30, 0);

    expect(dimension.height).toBe(0.01);
    expect(dimension.selrect).toMatchObject({ height: 0.01, y2: 20.01 });
    expect(dimension.points?.[2]).toEqual({ x: 40, y: 20.01 });
  });
});

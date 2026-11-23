import { computeBoolContent } from '@figpot/src/features/translators/vectors/computeBoolContent';
import { PenpotNode } from '@figpot/src/models/entities/penpot/node';

const square = (id: string, x: number, y: number): PenpotNode => ({ id, type: 'rect', name: id, x, y, width: 100, height: 100 });

const squarePath = (id: string, x: number, y: number): PenpotNode => ({
  id,
  type: 'path',
  name: id,
  content: [
    { command: 'move-to', params: { x, y } },
    { command: 'line-to', params: { x: x + 100, y } },
    { command: 'line-to', params: { x: x + 100, y: y + 100 } },
    { command: 'line-to', params: { x, y: y + 100 } },
    { command: 'close-path', params: null },
  ],
});

function lookup(nodes: PenpotNode[]) {
  const nodesById = new Map(nodes.map((node) => [node.id, node]));

  return (id: string) => nodesById.get(id);
}

// The points a content goes through, to compare contents whatever the order Penpot gives them in
function points(content: ReturnType<typeof computeBoolContent>) {
  return new Set((content ?? []).flatMap((segment) => (segment.params && 'x' in segment.params ? [`${segment.params.x},${segment.params.y}`] : [])));
}

describe('computeBoolContent()', () => {
  it('computes the union of two overlapping rectangles', () => {
    const nodes = [square('a', 0, 0), square('b', 50, 50)];

    const content = computeBoolContent('union', ['a', 'b'], lookup(nodes));

    expect(points(content)).toEqual(new Set(['50,100', '0,100', '0,0', '100,0', '100,50', '150,50', '150,150', '50,150']));
  });

  it('keeps the rounded corners of a rectangle', () => {
    const nodes = [{ ...square('a', 0, 0), r1: 20, r2: 20, r3: 20, r4: 20 } as PenpotNode, square('b', 500, 500)];

    const content = computeBoolContent('union', ['a', 'b'], lookup(nodes));

    expect(content?.some((segment) => segment.command === 'curve-to')).toBe(true);
    expect(points(content)).not.toContain('0,0');
  });

  it('follows the rotation of a rectangle', () => {
    // A square of 100 rotated by 45 degrees around its center (50, 50), as figpot describes it
    const cos = Math.cos(Math.PI / 4);
    const rotated = {
      ...square('a', 0, 0),
      rotation: 45,
      transform: { a: cos, b: cos, c: -cos, d: cos, e: 0, f: 0 },
      transformInverse: { a: cos, b: -cos, c: cos, d: cos, e: 0, f: 0 },
      points: [
        { x: 50, y: 50 - 100 * cos },
        { x: 50 + 100 * cos, y: 50 },
        { x: 50, y: 50 + 100 * cos },
        { x: 50 - 100 * cos, y: 50 },
      ],
    } as PenpotNode;

    const content = computeBoolContent('union', ['a', 'b'], lookup([rotated, square('b', 500, 500)]));
    const ys = (content ?? []).flatMap((segment) => (segment.params && 'y' in segment.params ? [segment.params.y] : []));

    // The top corner of the diamond, above the square it was
    expect(Math.min(...ys)).toBeCloseTo(50 - 100 * cos, 3);
  });

  it('computes the intersection of two overlapping paths', () => {
    const nodes = [squarePath('a', 0, 0), squarePath('b', 50, 50)];

    const content = computeBoolContent('intersection', ['a', 'b'], lookup(nodes));

    expect(points(content)).toEqual(new Set(['50,50', '100,50', '100,100', '50,100']));
  });

  it('combines the layers of a group operand', () => {
    const nodes: PenpotNode[] = [
      { id: 'group', type: 'group', name: 'group', shapes: ['a'] } as PenpotNode,
      squarePath('a', 0, 0),
      squarePath('b', 50, 50),
    ];

    const content = computeBoolContent('difference', ['group', 'b'], lookup(nodes));

    expect(points(content)).toEqual(new Set(['0,0', '100,0', '100,50', '50,50', '50,100', '0,100']));
  });

  it('gives an empty content for operands that do not overlap', () => {
    const nodes = [square('a', 0, 0), square('b', 500, 500)];

    expect(computeBoolContent('intersection', ['a', 'b'], lookup(nodes))).toEqual([]);
  });

  it('gives nothing when an operand cannot be combined', () => {
    const nodes = [square('a', 0, 0), { id: 'text', type: 'text', name: 'text' } as PenpotNode];

    expect(computeBoolContent('union', ['a', 'text'], lookup(nodes))).toBeUndefined();
    expect(computeBoolContent('union', ['a', 'missing'], lookup(nodes))).toBeUndefined();
  });
});

import { hasVectorNetwork, translateVectorNetwork } from '@figpot/src/features/translators/vectors/translateVectorNetwork';

describe('translateVectorNetwork()', () => {
  it('chains unordered segments into a closed path scaled to the node size', () => {
    const vectorNetwork = {
      vertices: [{ position: { x: 20, y: 10 } }, { position: { x: 0, y: 10 } }, { position: { x: 10, y: 0 } }],
      segments: [
        { start: 0, end: 1 },
        { start: 2, end: 0 },
        { start: 1, end: 2 },
      ],
    };

    expect(translateVectorNetwork(vectorNetwork, { x: 10, y: 5 })).toEqual({ path: 'M 10 5 L 0 5 L 5 0 L 10 5 Z', windingRule: 'NONZERO' });
  });

  it('keeps open runs and curves', () => {
    const vectorNetwork = {
      vertices: [{ position: { x: 0, y: 0 } }, { position: { x: 10, y: 10 } }],
      segments: [{ start: 0, end: 1, startTangent: { x: 5, y: 0 }, endTangent: { x: 0, y: -5 } }],
    };

    expect(translateVectorNetwork(vectorNetwork, { x: 10, y: 10 }).path).toBe('M 0 0 C 5 0 10 5 10 10');
  });

  it('detects a usable vector network', () => {
    expect(hasVectorNetwork({ vectorNetwork: { vertices: [], segments: [{ start: 0, end: 1 }] } })).toBe(true);
    expect(hasVectorNetwork({ vectorNetwork: { vertices: [], segments: [] } })).toBe(false);
    expect(hasVectorNetwork({})).toBe(false);
  });
});

describe('translateVectorNetwork() bounds', () => {
  it('scales from the bounds of the curves, not only of the vertices', () => {
    // A half circle bulging to x = 10 between two vertices at x = 0: its drawn width is 10, already the node size
    const k = 0.5523 * 10;
    const vectorNetwork = {
      vertices: [{ position: { x: 0, y: 0 } }, { position: { x: 0, y: 20 } }],
      segments: [{ start: 0, end: 1, startTangent: { x: k * 1.81, y: 0 }, endTangent: { x: k * 1.81, y: 0 } }],
    };

    const path = translateVectorNetwork(vectorNetwork, { x: 10, y: 20 }, true).path;
    const numbers = path.match(/-?\d+(\.\d+)?/g)!.map(Number);

    expect(numbers[0]).toBeCloseTo(0);
    expect(numbers[numbers.length - 1]).toBeCloseTo(20);
    // The end vertex keeps x = 0 (no horizontal stretch from a zero vertex width)
    expect(numbers[numbers.length - 2]).toBeCloseTo(0);
  });
});

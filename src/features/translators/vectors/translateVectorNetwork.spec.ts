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

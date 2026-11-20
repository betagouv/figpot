import svgPathParser from 'svg-path-parser';

import { isFlipOnly, translateFlippedCommands } from '@figpot/src/features/translators/vectors/translateCommands';

describe('translateFlippedCommands()', () => {
  it('detects mirrored nodes without rotation', () => {
    expect(isFlipOnly([[1, 0, 7.5], [0, -1, 18.5]])).toBe(true);
    expect(isFlipOnly([[-1, 0, 31], [0, 1, -2.75]])).toBe(true);
    expect(isFlipOnly([[1, 0, 0], [0, 1, 0]])).toBe(false);
    expect(isFlipOnly([[0, -1, 0], [1, 0, 0]])).toBe(false);
  });

  it('mirrors every point with the node transform', () => {
    const segments = translateFlippedCommands(svgPathParser.parseSVG('M0 0L10 2C1 1 2 2 3 3Z'), [[1, 0, 100], [0, -1, 50]]);

    expect(segments).toEqual([
      { command: 'move-to', params: { x: 100, y: 50 } },
      { command: 'line-to', params: { x: 110, y: 48 } },
      { command: 'curve-to', params: { c1x: 101, c1y: 49, c2x: 102, c2y: 48, x: 103, y: 47 } },
      { command: 'close-path', params: null },
    ]);
  });
});

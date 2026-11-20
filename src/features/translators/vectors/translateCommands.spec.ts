import svgPathParser from 'svg-path-parser';

import { hasLinearTransform, translateCommands, translateTransformedCommands } from '@figpot/src/features/translators/vectors/translateCommands';

describe('hasLinearTransform()', () => {
  it('detects transforms doing more than a translation', () => {
    expect(
      hasLinearTransform([
        [1, 0, 7.5],
        [0, -1, 18.5],
      ])
    ).toBe(true);
    expect(
      hasLinearTransform([
        [1, 0.5, 0],
        [0, 1, 0],
      ])
    ).toBe(true);
    expect(
      hasLinearTransform([
        [1, 0, 12],
        [0, 1, 34],
      ])
    ).toBe(false);
  });
});

describe('translateTransformedCommands()', () => {
  it('mirrors every point with the node transform', () => {
    const segments = translateTransformedCommands(svgPathParser.parseSVG('M0 0L10 2C1 1 2 2 3 3Z'), [
      [1, 0, 100],
      [0, -1, 50],
    ]);

    expect(segments).toEqual([
      { command: 'move-to', params: { x: 100, y: 50 } },
      { command: 'line-to', params: { x: 110, y: 48 } },
      { command: 'curve-to', params: { c1x: 101, c1y: 49, c2x: 102, c2y: 48, x: 103, y: 47 } },
      { command: 'close-path', params: null },
    ]);
  });

  it('mirrors and rotates every point', () => {
    const segments = translateTransformedCommands(svgPathParser.parseSVG('M0 0L10 2'), [
      [0, 1, 100],
      [1, 0, 50],
    ]);

    expect(segments).toEqual([
      { command: 'move-to', params: { x: 100, y: 50 } },
      { command: 'line-to', params: { x: 102, y: 60 } },
    ]);
  });
});

describe('translateCommands()', () => {
  it('mirrors a node flipped vertically, which looks unrotated', () => {
    const node = { absoluteBoundingBox: { x: 0, y: 40, width: 10, height: 10 } } as Parameters<typeof translateCommands>[0];
    const segments = translateCommands(
      node,
      [
        [1, 0, 0],
        [0, -1, 50],
      ],
      svgPathParser.parseSVG('M0 0L10 2')
    );

    expect(segments).toEqual([
      { command: 'move-to', params: { x: 0, y: 50 } },
      { command: 'line-to', params: { x: 10, y: 48 } },
    ]);
  });
});

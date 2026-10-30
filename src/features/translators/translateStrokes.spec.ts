import { HasGeometryTrait, IndividualStrokesTrait } from '@figpot/src/clients/figma';
import { translateStrokes } from '@figpot/src/features/translators/translateStrokes';
import { AbstractRegistry } from '@figpot/src/models/entities/registry';

describe('translateStrokes', () => {
  const registry = {} as AbstractRegistry;
  const node = (individualStrokeWeights?: IndividualStrokesTrait['individualStrokeWeights']) =>
    ({
      strokes: [{ type: 'SOLID', color: { r: 0, g: 0, b: 0, a: 1 } }],
      strokeWeight: 1,
      strokeAlign: 'INSIDE',
      individualStrokeWeights,
    }) as unknown as HasGeometryTrait & IndividualStrokesTrait;

  it('should give the width of each side when they differ, keeping the widest as the global one', () => {
    const [stroke] = translateStrokes(registry, node({ top: 0, right: 0, bottom: 2, left: 0 }));

    expect(stroke).toMatchObject({ strokeWidth: 2, strokeWidthTop: 0, strokeWidthRight: 0, strokeWidthBottom: 2, strokeWidthLeft: 0 });
  });

  it('should only give the global width when all sides are the same', () => {
    for (const individualStrokeWeights of [undefined, { top: 1, right: 1, bottom: 1, left: 1 }]) {
      const [stroke] = translateStrokes(registry, node(individualStrokeWeights));

      expect(stroke.strokeWidth).toBe(1);
      expect(stroke).not.toHaveProperty('strokeWidthTop');
    }
  });
});

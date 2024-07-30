import { Transform } from '@figpot/src/clients/figma';
import { cumulateNodeTransforms, neutralTransform } from '@figpot/src/utils/matrix';

describe('cumulateNodeTransforms()', () => {
  it('should chain correctly with 2 levels', () => {
    const initialTransform = neutralTransform;
    const transformToApply: Transform = [
      [1, 5.551115123125783e-17, 101],
      [-5.551115123125783e-17, 1, -20],
    ];

    const result = cumulateNodeTransforms(initialTransform, transformToApply);

    expect(result).toEqual([
      [1, 5.551115123125783e-17, 101],
      [-5.551115123125783e-17, 1, -20],
    ]);
  });

  it('should chain correctly with 3 levels', () => {
    const initialTransform = neutralTransform;

    const intermediateResult = cumulateNodeTransforms(initialTransform, [
      [1, 0, 101],
      [0, 1, -20],
    ]);

    const result = cumulateNodeTransforms(intermediateResult, [
      [1, 5.551115123125783e-17, 0],
      [-5.551115123125783e-17, 1, 3.552713678800501e-15],
    ]);

    expect(result).toEqual([
      [1, 5.551115123125783e-17, 101],
      [-5.551115123125783e-17, 1, -19.999999999999996],
    ]);
  });
});

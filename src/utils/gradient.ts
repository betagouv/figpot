import { Vector } from '@figpot/src/clients/figma';
import { workaroundAssert as assert } from '@figpot/src/utils/assert';

export function calculateLinearGradient(handlePositions: Vector[]): { start: number[]; end: number[] } {
  assert(handlePositions.length === 3);

  return {
    start: [handlePositions[0].x, handlePositions[0].y],
    end: [handlePositions[1].x, handlePositions[1].y],
  };
}

export function calculateRadialGradient(handlePositions: Vector[]): { start: number[]; end: number[] } {
  assert(handlePositions.length === 3);

  // `start` is the radial center, `end` the primary-axis edge — the distance between them is the radius
  return {
    start: [handlePositions[0].x, handlePositions[0].y],
    end: [handlePositions[1].x, handlePositions[1].y],
  };
}

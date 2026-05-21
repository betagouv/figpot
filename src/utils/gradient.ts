import { Transform, Vector } from '@figpot/src/clients/figma';
import { workaroundAssert as assert } from '@figpot/src/utils/assert';
import { applyMatrixToPoint, matrixInvert } from '@figpot/src/utils/matrix';

// Legitimate gradient coordinates stay close to the 0..1 range (the Figma gradient handles are
// normalized to the shape). When the Figma gradient transform is (near-)singular — a gradient
// collapsed to a point or a line — inverting it yields finite but astronomically large numbers.
// Penpot then rejects the whole file because its number schema is capped to the int32 range, so any
// result beyond this very generous bound is considered degenerate.
const GRADIENT_COORDINATE_LIMIT = 1_000_000;

function isSaneGradient(start: number[], end: number[]): boolean {
  return [...start, ...end].every((coordinate) => Number.isFinite(coordinate) && Math.abs(coordinate) <= GRADIENT_COORDINATE_LIMIT);
}

function calculateRadialGradientEndPoint(rotation: number, center: number[], radius: number[]): [number, number] {
  const angle = rotation * (Math.PI / 180);
  const x = center[0] + radius[0] * Math.cos(angle);
  const y = center[1] + radius[1] * Math.sin(angle);

  return [x, y];
}

function transformVectorsObjectsToTransform(t: Vector[]): Transform {
  assert(t.length === 3);

  const transform: Transform = [
    [t[0].x, t[1].x, t[2].x],
    [t[0].y, t[1].y, t[2].y],
  ];

  return transform;
}

export function calculateRadialGradient(t: Vector[]): { start: number[]; end: number[] } {
  const transform2D = transformVectorsObjectsToTransform(t);
  const transform = transform2D.length === 2 ? [...transform2D, [0, 0, 1]] : [...transform2D];
  const mxInv = matrixInvert(transform);

  if (!mxInv) {
    return {
      start: [0, 0],
      end: [0, 0],
    };
  }

  const centerPoint = applyMatrixToPoint(mxInv, [0.5, 0.5]);
  const rxPoint = applyMatrixToPoint(mxInv, [1, 0.5]);
  const ryPoint = applyMatrixToPoint(mxInv, [0.5, 1]);

  const rx = Math.sqrt(Math.pow(rxPoint[0] - centerPoint[0], 2) + Math.pow(rxPoint[1] - centerPoint[1], 2));
  const ry = Math.sqrt(Math.pow(ryPoint[0] - centerPoint[0], 2) + Math.pow(ryPoint[1] - centerPoint[1], 2));
  const angle = Math.atan((rxPoint[1] - centerPoint[1]) / (rxPoint[0] - centerPoint[0])) * (180 / Math.PI);

  const start = centerPoint;
  const end = calculateRadialGradientEndPoint(angle, centerPoint, [rx, ry]);

  // A near-singular transform inverts into out-of-range coordinates Penpot would reject (see `isSaneGradient`)
  if (!isSaneGradient(start, end)) {
    return {
      start: [0, 0],
      end: [0, 0],
    };
  }

  return {
    start: start,
    end: end,
  };
}

export function calculateLinearGradient(t: Vector[]): { start: number[]; end: number[] } {
  const transform2D = transformVectorsObjectsToTransform(t);
  const transform = transform2D.length === 2 ? [...transform2D, [0, 0, 1]] : [...transform2D];
  const mxInv = matrixInvert(transform);

  if (!mxInv) {
    return {
      start: [0, 0],
      end: [0, 0],
    };
  }

  const startEnd = [
    [0, 0.5],
    [1, 0.5],
  ].map((p) => applyMatrixToPoint(mxInv, p));

  const start = [startEnd[0][0], startEnd[0][1]];
  const end = [startEnd[1][0], startEnd[1][1]];

  // A near-singular transform inverts into out-of-range coordinates Penpot would reject (see `isSaneGradient`)
  if (!isSaneGradient(start, end)) {
    return {
      start: [0, 0],
      end: [0, 0],
    };
  }

  return {
    start: start,
    end: end,
  };
}

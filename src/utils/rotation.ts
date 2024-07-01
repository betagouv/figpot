import { Rectangle, Transform } from '@figpot/src/clients/figma';
import { ClosePath, CurveTo, Segment } from '@figpot/src/models/entities/penpot/shapes/path';
import { Point } from '@figpot/src/models/entities/penpot/traits/point';

const ROTATION_TOLERANCE = 0.000001;

export function applyInverseRotation(point: Point, transform: Transform, boundingBox: Rectangle): Point {
  return applyRotation(point, inverseMatrix(transform), boundingBox);
}

export function inverseMatrix(matrix: Transform): Transform {
  return [
    [matrix[0][0], matrix[1][0], matrix[0][2]],
    [matrix[0][1], matrix[1][1], matrix[1][2]],
  ];
}

export function applyMatrix(matrix: Transform, point: Point): Point {
  return {
    x: point.x * matrix[0][0] + point.y * matrix[0][1],
    y: point.x * matrix[1][0] + point.y * matrix[1][1],
  };
}

export function calculateCenter(boundingBox: Rectangle): Point {
  return {
    x: boundingBox.x + boundingBox.width / 2,
    y: boundingBox.y + boundingBox.height / 2,
  };
}

export function getRotation(transform: Transform): number {
  return Math.acos(transform[0][0]) * (180 / Math.PI);
}

export function hasRotation(rotation: number): boolean {
  return rotation > ROTATION_TOLERANCE;
}

function isCurveTo(segment: Segment): segment is CurveTo {
  return segment.command === 'curve-to';
}

export function applyRotation(point: Point, transform: Transform, boundingBox: Rectangle): Point {
  const centerPoint = calculateCenter(boundingBox);

  const rotatedPoint = applyMatrix(transform, {
    x: point.x - centerPoint.x,
    y: point.y - centerPoint.y,
  });

  return {
    x: centerPoint.x + rotatedPoint.x,
    y: centerPoint.y + rotatedPoint.y,
  };
}

export function applyRotationToSegment(segment: Exclude<Segment, ClosePath>, transform: Transform, boundingBox: Rectangle): Segment {
  const rotated = applyRotation({ x: segment.params.x, y: segment.params.y }, transform, boundingBox);

  if (isCurveTo(segment)) {
    const curve1 = applyRotation({ x: segment.params.c1x, y: segment.params.c1y }, transform, boundingBox);
    const curve2 = applyRotation({ x: segment.params.c2x, y: segment.params.c2y }, transform, boundingBox);

    segment.params.c1x = curve1.x;
    segment.params.c1y = curve1.y;
    segment.params.c2x = curve2.x;
    segment.params.c2y = curve2.y;
  }

  segment.params.x = rotated.x;
  segment.params.y = rotated.y;

  return segment;
}

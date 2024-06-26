import { Rectangle, Transform } from '@figpot/src/clients/figma';
import { Point } from '@figpot/src/models/entities/penpot/traits/point';

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

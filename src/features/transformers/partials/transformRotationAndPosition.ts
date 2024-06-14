import assert from 'assert';

import { HasLayoutTrait, Rectangle, Transform } from '@figpot/src/clients/figma';
import { ShapeBaseAttributes, ShapeGeomAttributes } from '@figpot/src/models/entities/penpot/shape';
import { Matrix } from '@figpot/src/models/entities/penpot/traits/matrix';
import { Point } from '@figpot/src/models/entities/penpot/traits/point';

function getRotationAngle(transform: Transform) {
  const cosAngle = transform[0][0];
  const sinAngle = -transform[1][0];

  const angle = Math.atan2(sinAngle, cosAngle);
  const angleInDegrees = angle * (180 / Math.PI);

  return angleInDegrees;
}

export const neutralTransforMatrix: Matrix = {
  a: 1,
  b: 0,
  c: 0,
  d: 1,
  e: 0,
  f: 0,
};

export function transformRotationAndPosition(
  node: HasLayoutTrait,
  baseX: number,
  baseY: number
): Pick<ShapeBaseAttributes, 'transform' | 'transformInverse' | 'rotation'> & Pick<ShapeGeomAttributes, 'x' | 'y'> {
  assert(node.absoluteBoundingBox);

  const x = node.absoluteBoundingBox.x + baseX;
  const y = node.absoluteBoundingBox.y + baseY;

  if (!node.relativeTransform) {
    return {
      x,
      y,
      rotation: 0,
      transform: neutralTransforMatrix,
      transformInverse: neutralTransforMatrix,
    };
  }

  const rotation = getRotationAngle(node.relativeTransform);

  if (rotation === 0) {
    return {
      x,
      y,
      rotation,
      transform: neutralTransforMatrix,
      transformInverse: neutralTransforMatrix,
    };
  }

  const point = getRotatedPoint({ x, y }, node.relativeTransform, node.absoluteBoundingBox);

  return {
    ...point,
    rotation: -rotation < 0 ? -rotation + 360 : -rotation,
    transform: {
      a: node.relativeTransform[0][0],
      b: node.relativeTransform[1][0],
      c: node.relativeTransform[0][1],
      d: node.relativeTransform[1][1],
      e: 0,
      f: 0,
    },
    transformInverse: {
      a: node.relativeTransform[0][0],
      b: node.relativeTransform[0][1],
      c: node.relativeTransform[1][0],
      d: node.relativeTransform[1][1],
      e: 0,
      f: 0,
    },
  };
}

function getRotatedPoint(point: Point, transform: Transform, boundingBox: Rectangle): Point {
  const centerPoint = {
    x: boundingBox.x + boundingBox.width / 2,
    y: boundingBox.y + boundingBox.height / 2,
  };

  const relativePoint = {
    x: point.x - centerPoint.x,
    y: point.y - centerPoint.y,
  };

  const rotatedPoint = {
    x: relativePoint.x * transform[0][0] + relativePoint.y * transform[1][0],
    y: relativePoint.x * transform[0][1] + relativePoint.y * transform[1][1],
  };

  return {
    x: centerPoint.x + rotatedPoint.x,
    y: centerPoint.y + rotatedPoint.y,
  };
}

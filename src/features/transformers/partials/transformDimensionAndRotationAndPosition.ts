import assert from 'assert';

import { HasLayoutTrait, Rectangle, Transform } from '@figpot/src/clients/figma';
import { ShapeBaseAttributes, ShapeGeomAttributes } from '@figpot/src/models/entities/penpot/shape';
import { Matrix } from '@figpot/src/models/entities/penpot/traits/matrix';
import { Point } from '@figpot/src/models/entities/penpot/traits/point';
import { Selrect } from '@figpot/src/models/entities/penpot/traits/selrect';
import { applyMatrixToPoint } from '@figpot/src/utils/matrix';
import { applyInverseRotation, calculateCenter } from '@figpot/src/utils/rotation';

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

export function transformDimensionAndRotationAndPosition(
  node: HasLayoutTrait,
  nodeTransform: Transform
): Pick<ShapeBaseAttributes, 'selrect' | 'points' | 'transform' | 'transformInverse' | 'rotation' | 'flipX' | 'flipY'> &
  Pick<ShapeGeomAttributes, 'x' | 'y' | 'width' | 'height'> {
  assert(node.absoluteBoundingBox);
  assert(node.size);

  // [WORKAROUND] For some obscure reasons the API may return the size object with `x` and `y` as null
  // whereas it's not an allowed type according to their API. So we default to 0 to not break our whole logic
  const nodeSize: typeof node.size = {
    x: node.size.x ?? 0,
    y: node.size.y ?? 0,
  };

  const rotation = getRotationAngle(nodeTransform);

  if (rotation === 0) {
    const x = node.absoluteBoundingBox.x;
    const y = node.absoluteBoundingBox.y;

    const selrectWithNoRotation: Selrect = {
      x: x,
      y: y,
      width: nodeSize.x,
      height: nodeSize.y,
      x1: x,
      y1: y,
      x2: x + nodeSize.x,
      y2: y + nodeSize.y,
    };

    const pointsWithNoRotation: Point[] = [
      { x: selrectWithNoRotation.x1, y: selrectWithNoRotation.y1 },
      { x: selrectWithNoRotation.x2, y: selrectWithNoRotation.y1 },
      { x: selrectWithNoRotation.x2, y: selrectWithNoRotation.y2 },
      { x: selrectWithNoRotation.x1, y: selrectWithNoRotation.y2 },
    ];

    return {
      x,
      y,
      width: selrectWithNoRotation.width,
      height: selrectWithNoRotation.height,
      selrect: selrectWithNoRotation,
      points: pointsWithNoRotation,
      rotation: 0,
      transform: neutralTransforMatrix,
      transformInverse: neutralTransforMatrix,
      // TODO: implement (here just to avoid useless diff for now)
      flipX: null,
      flipY: null,
    };
  }

  // TODO: this is working for rectangle (we describe 4 points here)
  // but it was to move on, there are probably multiple adjustements to take into account other shapes
  // to both describe the dimension/position/selectionRectangle
  const pointsOnZero: Point[] = [
    { x: -nodeSize.x / 2, y: -nodeSize.y / 2 },
    { x: nodeSize.x - nodeSize.x / 2, y: -nodeSize.y / 2 },
    { x: nodeSize.x - nodeSize.x / 2, y: nodeSize.y - nodeSize.y / 2 },
    { x: -nodeSize.x / 2, y: nodeSize.y - nodeSize.y / 2 },
  ];

  const boundingBoxCenter = calculateCenter(node.absoluteBoundingBox);

  // Since the selection area will only have the rotation during the rendering, we have to position the original shape center at the rotation Z-axis
  const initialPoints = pointsOnZero.map((p) => {
    return { x: p.x + boundingBoxCenter.x, y: p.y + boundingBoxCenter.y };
  });

  const selrect: Selrect = {
    x: initialPoints[0].x,
    y: initialPoints[0].y,
    width: nodeSize.x,
    height: nodeSize.y,
    x1: initialPoints[0].x,
    y1: initialPoints[0].y,
    x2: initialPoints[0].x + nodeSize.x,
    y2: initialPoints[0].y + nodeSize.y,
  };

  const transformedPoints = pointsOnZero.map((p) => {
    // Transform
    const rotatedPoint: Point = {
      x: p.x * nodeTransform[0][0] + p.y * nodeTransform[0][1],
      y: p.x * nodeTransform[1][0] + p.y * nodeTransform[1][1],
    };

    // Center correctly
    return { x: rotatedPoint.x + boundingBoxCenter.x, y: rotatedPoint.y + boundingBoxCenter.y };
  });

  return {
    width: nodeSize.x,
    height: nodeSize.y,
    x: selrect.x,
    y: selrect.y,
    points: transformedPoints,
    selrect: selrect,
    rotation: -rotation < 0 ? -rotation + 360 : -rotation,
    transform: {
      a: nodeTransform[0][0],
      b: nodeTransform[1][0],
      c: nodeTransform[0][1],
      d: nodeTransform[1][1],
      e: 0,
      f: 0,
    },
    transformInverse: {
      a: nodeTransform[0][0],
      b: nodeTransform[0][1],
      c: nodeTransform[1][0],
      d: nodeTransform[1][1],
      e: 0,
      f: 0,
    },
    // TODO: implement (here just to avoid useless diff for now)
    flipX: null,
    flipY: null,
  };
}

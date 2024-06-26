import assert from 'assert';

import { HasLayoutTrait } from '@figpot/src/clients/figma';
import { ShapeBaseAttributes, ShapeGeomAttributes } from '@figpot/src/models/entities/penpot/shape';
import { Point } from '@figpot/src/models/entities/penpot/traits/point';
import { Selrect } from '@figpot/src/models/entities/penpot/traits/selrect';

export function transformDimension(
  node: HasLayoutTrait,
  baseX: number,
  baseY: number
): Pick<ShapeGeomAttributes, 'width' | 'height'> & Pick<ShapeBaseAttributes, 'selrect' | 'points'> {
  // Even if the node has a rotation it does not change `selrect` and `points` that describe the shape with no rotation

  assert(node.size);
  assert(node.absoluteBoundingBox);

  const x = node.absoluteBoundingBox.x + baseX;
  const y = node.absoluteBoundingBox.y + baseY;

  const selrect: Selrect = {
    // TODO: x/y must be the initial position of the shape without translation
    x: x,
    y: y,
    width: node.size.x,
    height: node.size.y,
    x1: x,
    y1: y,
    x2: x + node.size.x,
    y2: y + node.size.y,
  };

  return {
    width: selrect.width,
    height: selrect.height,
    selrect: selrect,
    points: [
      // TODO: must represented the rotated rectangle points in case of rotation...
      { x: selrect.x1, y: selrect.y1 },
      { x: selrect.x2, y: selrect.y1 },
      { x: selrect.x2, y: selrect.y2 },
      { x: selrect.x1, y: selrect.y2 },
    ],
  };
}

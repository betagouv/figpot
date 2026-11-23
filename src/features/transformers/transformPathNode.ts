import svgPathParser from 'svg-path-parser';

import { RegularPolygonNode, StarNode, Transform } from '@figpot/src/clients/figma';
import { transformBlend } from '@figpot/src/features/transformers/partials/transformBlend';
import { transformConstraints } from '@figpot/src/features/transformers/partials/transformConstraints';
import { transformDimensionAndRotationAndPosition } from '@figpot/src/features/transformers/partials/transformDimensionAndRotationAndPosition';
import { transformEffects } from '@figpot/src/features/transformers/partials/transformEffects';
import { transformFills } from '@figpot/src/features/transformers/partials/transformFills';
import { transformInheritance } from '@figpot/src/features/transformers/partials/transformInheritance';
import { transformLayoutAttributes } from '@figpot/src/features/transformers/partials/transformLayout';
import { transformProportion } from '@figpot/src/features/transformers/partials/transformProportion';
import { transformSceneNode } from '@figpot/src/features/transformers/partials/transformSceneNode';
import { transformStrokes } from '@figpot/src/features/transformers/partials/transformStrokes';
import { translateCommands } from '@figpot/src/features/translators/vectors/translateCommands';
import { PathShape, Segment } from '@figpot/src/models/entities/penpot/shapes/path';
import { AbstractRegistry } from '@figpot/src/models/entities/registry';
import { workaroundAssert as assert } from '@figpot/src/utils/assert';

const { parseSVG } = svgPathParser;

/**
 * The outline of a regular polygon or a star in its own coordinates, used when Figma gives no `fillGeometry` (a shape
 * without fill, or some layers of instances): like Figma the first point is at the top center and the points are spread
 * on the ellipse of the node size (a star alternates with the inner ones)
 */
export function getPolygonPath(
  node: Pick<StarNode | RegularPolygonNode, 'type' | 'size'> & { count?: number; starInnerScale?: number }
): string | null {
  const count = node.count ?? (node.type === 'STAR' ? 5 : 3);
  if (!node.size || count < 3) {
    return null;
  }

  const radiusX = node.size.x / 2;
  const radiusY = node.size.y / 2;
  const innerScale = node.type === 'STAR' ? node.starInnerScale ?? 0.382 : 1;
  const steps = node.type === 'STAR' ? count * 2 : count;
  const points: string[] = [];

  for (let i = 0; i < steps; i++) {
    const scale = node.type === 'STAR' && i % 2 === 1 ? innerScale : 1;
    const angle = -Math.PI / 2 + (i * 2 * Math.PI) / steps;

    points.push(`${radiusX + Math.cos(angle) * radiusX * scale} ${radiusY + Math.sin(angle) * radiusY * scale}`);
  }

  return `M ${points.join(' L ')} Z`;
}

function translatePathNode(node: StarNode | RegularPolygonNode, figmaNodeTransform: Transform): Segment[] {
  assert(node.fillGeometry);

  if (node.fillGeometry.length > 0) {
    return translateCommands(node, figmaNodeTransform, parseSVG(node.fillGeometry[0].path));
  }

  const polygonPath = getPolygonPath(node);

  return polygonPath ? translateCommands(node, figmaNodeTransform, parseSVG(polygonPath)) : [];
}

export function transformPathNode(
  registry: AbstractRegistry,
  node: StarNode | RegularPolygonNode,
  figmaNodeTransform: Transform
): Omit<PathShape, 'id'> {
  return {
    type: 'path',
    name: node.name,
    content: translatePathNode(node, figmaNodeTransform),
    ...transformFills(registry, node),
    ...transformStrokes(registry, node),
    ...transformEffects(registry, node),
    ...transformSceneNode(node),
    ...transformBlend(node),
    ...transformProportion(node),
    ...transformDimensionAndRotationAndPosition(node, figmaNodeTransform),
    ...transformLayoutAttributes(node),
    ...transformConstraints(node),
    ...transformInheritance(registry, node),
  };
}

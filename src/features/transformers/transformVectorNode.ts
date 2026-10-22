import { Transform, VectorNode } from '@figpot/src/clients/figma';
import { transformConstraints } from '@figpot/src/features/transformers/partials/transformConstraints';
import {
  transformAxisAlignedDimensionAndPosition,
  transformDimensionAndRotationAndPosition,
} from '@figpot/src/features/transformers/partials/transformDimensionAndRotationAndPosition';
import { transformInheritance } from '@figpot/src/features/transformers/partials/transformInheritance';
import { transformVectorPaths } from '@figpot/src/features/transformers/partials/transformVectorPaths';
import { transformGroupNodeLike } from '@figpot/src/features/transformers/transformGroupNode';
import { translateId } from '@figpot/src/features/translators/translateId';
import { Bounds, getPathContentBounds } from '@figpot/src/features/translators/vectors/getPathContentBounds';
import { GroupShape } from '@figpot/src/models/entities/penpot/shapes/group';
import { PathShape } from '@figpot/src/models/entities/penpot/shapes/path';
import { AbstractRegistry } from '@figpot/src/models/entities/registry';

export function transformVectorNode(
  registry: AbstractRegistry,
  node: VectorNode,
  closestFigmaFrameId: string,
  figmaNodeTransform: Transform
): Omit<GroupShape | PathShape, 'id'> {
  const children = transformVectorPaths(registry, node, figmaNodeTransform);

  // Without fill (like a line) the drawn content is the stroke outline, which goes beyond the Figma dimensions (a line
  // has a height of 0), and Penpot does not render a shape outside of its dimensions. So in this case the geometry is
  // the one of the drawn content
  const contentBounds = node.fillGeometry && node.fillGeometry.length === 0 ? children.map((child) => getPathContentBounds(child.content)) : [];
  const unionBounds = contentBounds.reduce<Bounds | null>((union, bounds) => {
    if (!bounds || !union) {
      return bounds ?? union;
    }

    const x = Math.min(union.x, bounds.x);
    const y = Math.min(union.y, bounds.y);

    return {
      x,
      y,
      width: Math.max(union.x + union.width, bounds.x + bounds.width) - x,
      height: Math.max(union.y + union.height, bounds.y + bounds.height) - y,
    };
  }, null);

  const dimensionRotationPosition = unionBounds
    ? transformAxisAlignedDimensionAndPosition(unionBounds.x, unionBounds.y, unionBounds.width, unionBounds.height)
    : transformDimensionAndRotationAndPosition(node, figmaNodeTransform);

  if (children.length === 1) {
    return {
      ...children[0],
      name: node.name,
      ...dimensionRotationPosition,
      ...transformConstraints(node),
      ...transformInheritance(registry, node),
    };
  }

  // The group ID will be set by an upper `transformChildren` call, but we need to set to the group children
  // We cannot directly reuse `transformChildren/translateChildren` for this specific case, so duplicating a bit the logic
  const shapes: string[] = [];

  for (const [penpotChildIndex, penpotChild] of Object.entries(children)) {
    penpotChild.name = `Shape ${parseInt(penpotChildIndex, 10) + 1}`;

    // To keep things simple, we reuse the position of the unique shape of Figma (otherwise we should analyze each part whereas here is just a workaround to have strokes and fills linked)
    const childBounds = contentBounds[parseInt(penpotChildIndex, 10)];
    const penpotChildInSpace = {
      ...penpotChild,
      ...(childBounds
        ? transformAxisAlignedDimensionAndPosition(childBounds.x, childBounds.y, childBounds.width, childBounds.height)
        : dimensionRotationPosition),
      id: translateId(`${node.id}_path_${penpotChildIndex}`, registry.getMapping()), // We use the index since we have no other indentifiable metadata
      parentId: translateId(node.id, registry.getMapping()),
      frameId: translateId(closestFigmaFrameId, registry.getMapping()),
    };

    registry.addNode(penpotChildInSpace);

    shapes.push(penpotChildInSpace.id);
  }

  return {
    shapes: shapes,
    ...transformGroupNodeLike(registry, node, figmaNodeTransform),
    ...(unionBounds ? dimensionRotationPosition : {}),
    ...transformConstraints(node),
  };
}

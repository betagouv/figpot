import { Transform, VectorNode } from '@figpot/src/clients/figma';
import { transformConstraints } from '@figpot/src/features/transformers/partials/transformConstraints';
import { transformDimensionAndRotationAndPosition } from '@figpot/src/features/transformers/partials/transformDimensionAndRotationAndPosition';
import { transformInheritance } from '@figpot/src/features/transformers/partials/transformInheritance';
import { transformVectorPaths } from '@figpot/src/features/transformers/partials/transformVectorPaths';
import { transformGroupNodeLike } from '@figpot/src/features/transformers/transformGroupNode';
import { translateId } from '@figpot/src/features/translators/translateId';
import { GroupShape } from '@figpot/src/models/entities/penpot/shapes/group';
import { PathShape } from '@figpot/src/models/entities/penpot/shapes/path';
import { AbstractRegistry } from '@figpot/src/models/entities/registry';

export function transformVectorNode(
  registry: AbstractRegistry,
  node: VectorNode,
  closestFigmaFrameId: string,
  figmaNodeTransform: Transform
): Omit<GroupShape | PathShape, 'id'> {
  const dimensionRotationPosition = transformDimensionAndRotationAndPosition(node, figmaNodeTransform);
  const children = transformVectorPaths(registry, node, figmaNodeTransform);

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
    const penpotChildInSpace = {
      ...penpotChild,
      ...dimensionRotationPosition,
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
    ...transformConstraints(node),
  };
}

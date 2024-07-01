import { Transform, VectorNode } from '@figpot/src/clients/figma';
import { MappingType } from '@figpot/src/features/document';
import { transformConstraints } from '@figpot/src/features/transformers/partials/transformConstraints';
import { transformDimensionAndRotationAndPosition } from '@figpot/src/features/transformers/partials/transformDimensionAndRotationAndPosition';
import { transformVectorPaths } from '@figpot/src/features/transformers/partials/transformVectorPaths';
import { transformGroupNodeLike } from '@figpot/src/features/transformers/transformGroupNode';
import { translateId } from '@figpot/src/features/translators/translateId';
import { PenpotNode } from '@figpot/src/models/entities/penpot/node';
import { GroupShape } from '@figpot/src/models/entities/penpot/shapes/group';
import { PathShape } from '@figpot/src/models/entities/penpot/shapes/path';

export function transformVectorNode(
  registeredPageNodes: PenpotNode[],
  node: VectorNode,
  closestFigmaFrameId: string,
  figmaNodeTransform: Transform,
  mapping: MappingType
): GroupShape | PathShape {
  const dimensionRotationPosition = transformDimensionAndRotationAndPosition(node, figmaNodeTransform);
  const children = transformVectorPaths(node, figmaNodeTransform, mapping);

  if (children.length === 1) {
    return {
      ...children[0],
      name: node.name,
      ...dimensionRotationPosition,
      ...transformConstraints(node),
    };
  }

  // The group ID will be set by an upper `transformChildren` call, but we need to set to the group children
  // We cannot directly reuse `transformChildren/translateChildren` for this specific case, so duplicating a bit the logic
  for (const [penpotChildIndex, penpotChild] of Object.entries(children)) {
    penpotChild.name = `Shape ${parseInt(penpotChildIndex, 10) + 1}`;

    penpotChild.id = translateId(`${node.id}_path_${penpotChildIndex}`, mapping); // We use the index since we have no other indentifiable metadata
    penpotChild.parentId = translateId(node.id, mapping);
    penpotChild.frameId = translateId(closestFigmaFrameId, mapping);

    // To keep things simple, we reuse the position of the unique shape of Figma (otherwise we should analyze each part whereas here is just a workaround to have strokes and fills linked)
    const penpotChildInSpace = { ...penpotChild, ...dimensionRotationPosition };

    registeredPageNodes.push(penpotChildInSpace);
  }

  return {
    shapes: children.map((penpotChild) => penpotChild.id as string),
    ...transformGroupNodeLike(node, figmaNodeTransform),
    ...transformConstraints(node),
  };
}

import { GroupNode, HasLayoutTrait, IsLayerTrait, Transform } from '@figpot/src/clients/figma';
import { MappingType } from '@figpot/src/features/document';
import { transformBlend } from '@figpot/src/features/transformers/partials/transformBlend';
import { transformChildren } from '@figpot/src/features/transformers/partials/transformChildren';
import { transformDimensionAndRotationAndPosition } from '@figpot/src/features/transformers/partials/transformDimensionAndRotationAndPosition';
import { transformEffects } from '@figpot/src/features/transformers/partials/transformEffects';
import { transformSceneNode } from '@figpot/src/features/transformers/partials/transformSceneNode';
import { translateId } from '@figpot/src/features/translators/translateId';
import { PenpotNode } from '@figpot/src/models/entities/penpot/node';
import { GroupShape } from '@figpot/src/models/entities/penpot/shapes/group';

export function transformGroupNode(
  registeredPageNodes: PenpotNode[],
  node: GroupNode,
  closestFigmaFrameId: string,
  figmaNodeTransform: Transform,
  mapping: MappingType
): GroupShape {
  transformChildren(registeredPageNodes, node, closestFigmaFrameId, figmaNodeTransform, mapping);

  return {
    shapes: node.children.map((figmaChild) => translateId(figmaChild.id, mapping)),
    ...transformGroupNodeLike(node, figmaNodeTransform),
    ...transformEffects(node, mapping),
    ...transformBlend(node),
  };
}

export function transformGroupNodeLike(node: HasLayoutTrait & IsLayerTrait, figmaNodeTransform: Transform): GroupShape {
  return {
    type: 'group',
    name: node.name,
    ...transformDimensionAndRotationAndPosition(node, figmaNodeTransform),
    ...transformSceneNode(node),
  };
}

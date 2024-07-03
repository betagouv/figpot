import { GroupNode, HasLayoutTrait, IsLayerTrait, Transform } from '@figpot/src/clients/figma';
import { transformBlend } from '@figpot/src/features/transformers/partials/transformBlend';
import { transformChildren } from '@figpot/src/features/transformers/partials/transformChildren';
import { transformDimensionAndRotationAndPosition } from '@figpot/src/features/transformers/partials/transformDimensionAndRotationAndPosition';
import { transformEffects } from '@figpot/src/features/transformers/partials/transformEffects';
import { transformSceneNode } from '@figpot/src/features/transformers/partials/transformSceneNode';
import { translateId } from '@figpot/src/features/translators/translateId';
import { GroupShape } from '@figpot/src/models/entities/penpot/shapes/group';
import { PageRegistry } from '@figpot/src/models/entities/registry';

export function transformGroupNode(registry: PageRegistry, node: GroupNode, closestFigmaFrameId: string, figmaNodeTransform: Transform): GroupShape {
  transformChildren(registry, node, closestFigmaFrameId, figmaNodeTransform);

  return {
    shapes: node.children.map((figmaChild) => translateId(figmaChild.id, registry.getMapping())),
    ...transformGroupNodeLike(node, figmaNodeTransform),
    ...transformEffects(registry, node),
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

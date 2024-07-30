import { GroupNode, HasLayoutTrait, IsLayerTrait, Transform } from '@figpot/src/clients/figma';
import { transformBlend } from '@figpot/src/features/transformers/partials/transformBlend';
import { transformChildren } from '@figpot/src/features/transformers/partials/transformChildren';
import { transformDimensionAndRotationAndPosition } from '@figpot/src/features/transformers/partials/transformDimensionAndRotationAndPosition';
import { transformEffects } from '@figpot/src/features/transformers/partials/transformEffects';
import { transformInheritance } from '@figpot/src/features/transformers/partials/transformInheritance';
import { transformSceneNode } from '@figpot/src/features/transformers/partials/transformSceneNode';
import { GroupShape } from '@figpot/src/models/entities/penpot/shapes/group';
import { AbstractRegistry } from '@figpot/src/models/entities/registry';

export function transformGroupNode(
  registry: AbstractRegistry,
  node: GroupNode,
  closestFigmaFrameId: string,
  figmaNodeTransform: Transform
): GroupShape {
  const childrenShapes = transformChildren(registry, node, closestFigmaFrameId, figmaNodeTransform);

  return {
    shapes: childrenShapes,
    ...transformGroupNodeLike(registry, node, figmaNodeTransform),
    ...transformEffects(registry, node),
    ...transformBlend(node),
  };
}

export function transformGroupNodeLike(registry: AbstractRegistry, node: HasLayoutTrait & IsLayerTrait, figmaNodeTransform: Transform): GroupShape {
  return {
    type: 'group',
    name: node.name,
    ...transformDimensionAndRotationAndPosition(node, figmaNodeTransform),
    ...transformSceneNode(node),
    ...transformInheritance(registry, node),
  };
}

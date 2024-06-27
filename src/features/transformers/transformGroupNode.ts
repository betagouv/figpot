import { GroupNode, HasLayoutTrait, IsLayerTrait } from '@figpot/src/clients/figma';
import { MappingType } from '@figpot/src/features/document';
import { transformBlend } from '@figpot/src/features/transformers/partials/transformBlend';
import { transformChildren } from '@figpot/src/features/transformers/partials/transformChildren';
import { transformDimensionAndRotationAndPosition } from '@figpot/src/features/transformers/partials/transformDimensionAndRotationAndPosition';
import { transformEffects } from '@figpot/src/features/transformers/partials/transformEffects';
import { transformSceneNode } from '@figpot/src/features/transformers/partials/transformSceneNode';
import { PenpotNode } from '@figpot/src/models/entities/penpot/node';
import { GroupShape } from '@figpot/src/models/entities/penpot/shapes/group';

export function transformGroupNode(registeredPageNodes: PenpotNode[], node: GroupNode, mapping: MappingType): GroupShape {
  transformChildren(registeredPageNodes, node, mapping);

  return {
    ...transformGroupNodeLike(node),
    ...transformEffects(node, mapping),
    ...transformBlend(node),
  };
}

export function transformGroupNodeLike(node: HasLayoutTrait & IsLayerTrait): GroupShape {
  return {
    type: 'group',
    name: node.name,
    ...transformDimensionAndRotationAndPosition(node),
    ...transformSceneNode(node),
  };
}

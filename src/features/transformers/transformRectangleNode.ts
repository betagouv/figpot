import { RectangleNode, SubcanvasNode, Transform } from '@figpot/src/clients/figma';
import { transformBlend } from '@figpot/src/features/transformers/partials/transformBlend';
import { transformConstraints } from '@figpot/src/features/transformers/partials/transformConstraints';
import { transformCornerRadius } from '@figpot/src/features/transformers/partials/transformCornerRadius';
import { transformDimensionAndRotationAndPosition } from '@figpot/src/features/transformers/partials/transformDimensionAndRotationAndPosition';
import { transformEffects } from '@figpot/src/features/transformers/partials/transformEffects';
import { transformFills } from '@figpot/src/features/transformers/partials/transformFills';
import { transformFlip } from '@figpot/src/features/transformers/partials/transformFlip';
import { transformLayoutAttributes } from '@figpot/src/features/transformers/partials/transformLayout';
import { transformProportion } from '@figpot/src/features/transformers/partials/transformProportion';
import { transformSceneNode } from '@figpot/src/features/transformers/partials/transformSceneNode';
import { transformStrokes } from '@figpot/src/features/transformers/partials/transformStrokes';
import { RectShape } from '@figpot/src/models/entities/penpot/shapes/rect';
import { PageRegistry } from '@figpot/src/models/entities/registry';

export function transformRectangleNode(
  registry: PageRegistry,
  node: RectangleNode & Pick<SubcanvasNode, 'id'>,
  figmaNodeTransform: Transform
): RectShape {
  return {
    type: 'rect',
    name: node.name,
    ...transformFills(registry, node),
    ...transformFlip(node),
    ...transformEffects(registry, node),
    ...transformStrokes(registry, node),
    ...transformDimensionAndRotationAndPosition(node, figmaNodeTransform),
    ...transformSceneNode(node),
    ...transformBlend(node),
    ...transformProportion(node),
    ...transformLayoutAttributes(node),
    ...transformCornerRadius(node),
    ...transformConstraints(node),
  };
}

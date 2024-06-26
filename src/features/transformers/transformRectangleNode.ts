import { RectangleNode, SubcanvasNode } from '@figpot/src/clients/figma';
import { MappingType } from '@figpot/src/features/document';
import { transformBlend } from '@figpot/src/features/transformers/partials/transformBlend';
import { transformConstraints } from '@figpot/src/features/transformers/partials/transformConstraints';
import { transformCornerRadius } from '@figpot/src/features/transformers/partials/transformCornerRadius';
import { transformDimensionAndRotationAndPosition } from '@figpot/src/features/transformers/partials/transformDimensionAndRotationAndPosition';
import { transformEffects } from '@figpot/src/features/transformers/partials/transformEffects';
import { transformFills } from '@figpot/src/features/transformers/partials/transformFills';
import { transformFlip } from '@figpot/src/features/transformers/partials/transformFlip';
import { transformProportion } from '@figpot/src/features/transformers/partials/transformProportion';
import { transformSceneNode } from '@figpot/src/features/transformers/partials/transformSceneNode';
import { transformStrokes } from '@figpot/src/features/transformers/partials/transformStrokes';
import { RectShape } from '@figpot/src/models/entities/penpot/shapes/rect';

export function transformRectangleNode(
  node: RectangleNode & Pick<SubcanvasNode, 'id'>,
  mapping: MappingType,
  baseX: number,
  baseY: number
): RectShape {
  return {
    type: 'rect',
    name: node.name,
    ...transformFills(node),
    ...transformFlip(node),
    ...transformEffects(node, mapping),
    ...transformStrokes(node),
    ...transformDimensionAndRotationAndPosition(node, baseX, baseY),
    ...transformSceneNode(node),
    ...transformBlend(node),
    ...transformProportion(node),
    ...transformCornerRadius(node),
    ...transformConstraints(node),
  };
}

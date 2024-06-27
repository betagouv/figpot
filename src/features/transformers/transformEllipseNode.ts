import { EllipseNode, SubcanvasNode, Transform } from '@figpot/src/clients/figma';
import { MappingType } from '@figpot/src/features/document';
import { transformBlend } from '@figpot/src/features/transformers/partials/transformBlend';
import { transformConstraints } from '@figpot/src/features/transformers/partials/transformConstraints';
import { transformDimensionAndRotationAndPosition } from '@figpot/src/features/transformers/partials/transformDimensionAndRotationAndPosition';
import { transformEffects } from '@figpot/src/features/transformers/partials/transformEffects';
import { transformFills } from '@figpot/src/features/transformers/partials/transformFills';
import { transformLayoutAttributes } from '@figpot/src/features/transformers/partials/transformLayout';
import { transformProportion } from '@figpot/src/features/transformers/partials/transformProportion';
import { transformSceneNode } from '@figpot/src/features/transformers/partials/transformSceneNode';
import { transformStrokes } from '@figpot/src/features/transformers/partials/transformStrokes';
import { CircleShape } from '@figpot/src/models/entities/penpot/shapes/circle';

export function transformEllipseNode(
  node: EllipseNode & Pick<SubcanvasNode, 'id'>,
  figmaNodeTransform: Transform,
  mapping: MappingType
): CircleShape {
  return {
    type: 'circle',
    name: node.name,
    ...transformFills(node),
    ...transformEffects(node, mapping),
    ...transformStrokes(node),
    ...transformDimensionAndRotationAndPosition(node, figmaNodeTransform),
    ...transformSceneNode(node),
    ...transformBlend(node),
    ...transformProportion(node),
    ...transformLayoutAttributes(node),
    ...transformConstraints(node),
  };
}

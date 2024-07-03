import { TextNode, Transform } from '@figpot/src/clients/figma';
import { MappingType } from '@figpot/src/features/document';
import { transformBlend } from '@figpot/src/features/transformers/partials/transformBlend';
import { transformConstraints } from '@figpot/src/features/transformers/partials/transformConstraints';
import { transformDimensionAndRotationAndPosition } from '@figpot/src/features/transformers/partials/transformDimensionAndRotationAndPosition';
import { transformEffects } from '@figpot/src/features/transformers/partials/transformEffects';
import { transformFlip } from '@figpot/src/features/transformers/partials/transformFlip';
import { transformLayoutAttributes } from '@figpot/src/features/transformers/partials/transformLayout';
import { transformProportion } from '@figpot/src/features/transformers/partials/transformProportion';
import { transformSceneNode } from '@figpot/src/features/transformers/partials/transformSceneNode';
import { transformStrokes } from '@figpot/src/features/transformers/partials/transformStrokes';
import { transformText } from '@figpot/src/features/transformers/partials/transformText';
import { TextShape } from '@figpot/src/models/entities/penpot/shapes/text';

export function transformTextNode(node: TextNode, figmaNodeTransform: Transform, mapping: MappingType): TextShape {
  return {
    type: 'text',
    name: node.name,
    ...transformText(node, mapping),
    ...transformFlip(node),
    ...transformDimensionAndRotationAndPosition(node, figmaNodeTransform),
    ...transformEffects(node, mapping),
    ...transformSceneNode(node),
    ...transformBlend(node),
    ...transformProportion(node),
    ...transformLayoutAttributes(node),
    ...transformStrokes(node, mapping),
    ...transformConstraints(node),
  };
}

import { TextNode, Transform } from '@figpot/src/clients/figma';
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
import { PageRegistry } from '@figpot/src/models/entities/registry';

export function transformTextNode(registry: PageRegistry, node: TextNode, figmaNodeTransform: Transform): TextShape {
  return {
    type: 'text',
    name: node.name,
    ...transformText(registry, node),
    ...transformFlip(node),
    ...transformDimensionAndRotationAndPosition(node, figmaNodeTransform),
    ...transformEffects(registry, node),
    ...transformSceneNode(node),
    ...transformBlend(node),
    ...transformProportion(node),
    ...transformLayoutAttributes(node),
    ...transformStrokes(registry, node),
    ...transformConstraints(node),
  };
}

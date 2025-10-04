import { TextNode, Transform } from '@figpot/src/clients/figma';
import { transformBlend } from '@figpot/src/features/transformers/partials/transformBlend';
import { transformConstraints } from '@figpot/src/features/transformers/partials/transformConstraints';
import { transformDimensionAndRotationAndPosition } from '@figpot/src/features/transformers/partials/transformDimensionAndRotationAndPosition';
import { transformEffects } from '@figpot/src/features/transformers/partials/transformEffects';
import { transformFlip } from '@figpot/src/features/transformers/partials/transformFlip';
import { transformInheritance } from '@figpot/src/features/transformers/partials/transformInheritance';
import { transformLayoutAttributes } from '@figpot/src/features/transformers/partials/transformLayout';
import { transformProportion } from '@figpot/src/features/transformers/partials/transformProportion';
import { transformSceneNode } from '@figpot/src/features/transformers/partials/transformSceneNode';
import { transformStrokes } from '@figpot/src/features/transformers/partials/transformStrokes';
import { transformText } from '@figpot/src/features/transformers/partials/transformText';
import { TextShape } from '@figpot/src/models/entities/penpot/shapes/text';
import { AbstractRegistry } from '@figpot/src/models/entities/registry';

export function transformTextNode(registry: AbstractRegistry, node: TextNode, figmaNodeTransform: Transform): Omit<TextShape, 'id'> {
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
    ...transformInheritance(registry, node),
  };
}

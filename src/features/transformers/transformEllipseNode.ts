import { EllipseNode, SubcanvasNode, Transform } from '@figpot/src/clients/figma';
import { transformBlend } from '@figpot/src/features/transformers/partials/transformBlend';
import { transformConstraints } from '@figpot/src/features/transformers/partials/transformConstraints';
import { transformDimensionAndRotationAndPosition } from '@figpot/src/features/transformers/partials/transformDimensionAndRotationAndPosition';
import { transformEffects } from '@figpot/src/features/transformers/partials/transformEffects';
import { transformFills } from '@figpot/src/features/transformers/partials/transformFills';
import { transformInheritance } from '@figpot/src/features/transformers/partials/transformInheritance';
import { transformLayoutAttributes } from '@figpot/src/features/transformers/partials/transformLayout';
import { transformProportion } from '@figpot/src/features/transformers/partials/transformProportion';
import { transformSceneNode } from '@figpot/src/features/transformers/partials/transformSceneNode';
import { transformStrokes } from '@figpot/src/features/transformers/partials/transformStrokes';
import { CircleShape } from '@figpot/src/models/entities/penpot/shapes/circle';
import { AbstractRegistry } from '@figpot/src/models/entities/registry';

export function transformEllipseNode(
  registry: AbstractRegistry,
  node: EllipseNode & Pick<SubcanvasNode, 'id'>,
  figmaNodeTransform: Transform
): Omit<CircleShape, 'id'> {
  return {
    type: 'circle',
    name: node.name,
    ...transformFills(registry, node),
    ...transformEffects(registry, node),
    ...transformStrokes(registry, node),
    ...transformDimensionAndRotationAndPosition(node, figmaNodeTransform),
    ...transformSceneNode(node),
    ...transformBlend(node),
    ...transformProportion(node),
    ...transformLayoutAttributes(node),
    ...transformConstraints(node),
    ...transformInheritance(registry, node),
  };
}

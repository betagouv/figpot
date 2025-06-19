import { LineNode, Transform } from '@figpot/src/clients/figma';
import { transformBlend } from '@figpot/src/features/transformers/partials/transformBlend';
import { transformConstraints } from '@figpot/src/features/transformers/partials/transformConstraints';
import { transformDimensionAndRotationAndPosition } from '@figpot/src/features/transformers/partials/transformDimensionAndRotationAndPosition';
import { transformEffects } from '@figpot/src/features/transformers/partials/transformEffects';
import { transformInheritance } from '@figpot/src/features/transformers/partials/transformInheritance';
import { transformLayoutAttributes } from '@figpot/src/features/transformers/partials/transformLayout';
import { transformProportion } from '@figpot/src/features/transformers/partials/transformProportion';
import { transformSceneNode } from '@figpot/src/features/transformers/partials/transformSceneNode';
import { transformStrokes } from '@figpot/src/features/transformers/partials/transformStrokes';
import { translateCommands } from '@figpot/src/features/translators/vectors/translateCommands';
import { PathShape, Segment } from '@figpot/src/models/entities/penpot/shapes/path';
import { AbstractRegistry } from '@figpot/src/models/entities/registry';
import { workaroundAssert as assert } from '@figpot/src/utils/assert';

function translateLineNode(node: LineNode, figmaNodeTransform: Transform): Segment[] {
  assert(node.size);

  return translateCommands(node, figmaNodeTransform, [
    {
      x: 0,
      y: 0,
      command: 'moveto',
      code: 'M',
    },
    {
      x: node.size.x,
      y: 0,
      command: 'lineto',
      code: 'L',
    },
  ]);
}

/**
 * In order to match the normal representation of a line in Penpot, we will assume that
 * the line is never rotated, so we calculate its normal position.
 *
 * To represent the line rotated we do take into account the rotation of the line, but only in its content.
 */
export function transformLineNode(registry: AbstractRegistry, node: LineNode, figmaNodeTransform: Transform): PathShape {
  return {
    type: 'path',
    name: node.name,
    content: translateLineNode(node, figmaNodeTransform),
    ...transformStrokes(registry, node),
    ...transformEffects(registry, node),
    ...transformSceneNode(node),
    ...transformBlend(node),
    ...transformProportion(node),
    ...transformDimensionAndRotationAndPosition(node, figmaNodeTransform),
    ...transformLayoutAttributes(node),
    ...transformConstraints(node),
    ...transformInheritance(registry, node),
  };
}

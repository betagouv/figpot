import assert from 'assert';

import { LineNode, Transform } from '@figpot/src/clients/figma';
import { MappingType } from '@figpot/src/features/document';
import { transformBlend } from '@figpot/src/features/transformers/partials/transformBlend';
import { transformConstraints } from '@figpot/src/features/transformers/partials/transformConstraints';
import { transformDimensionAndRotationAndPosition } from '@figpot/src/features/transformers/partials/transformDimensionAndRotationAndPosition';
import { transformEffects } from '@figpot/src/features/transformers/partials/transformEffects';
import { transformLayoutAttributes } from '@figpot/src/features/transformers/partials/transformLayout';
import { transformProportion } from '@figpot/src/features/transformers/partials/transformProportion';
import { transformSceneNode } from '@figpot/src/features/transformers/partials/transformSceneNode';
import { transformStrokes } from '@figpot/src/features/transformers/partials/transformStrokes';
import { translateCommands } from '@figpot/src/features/translators/vectors/translateCommands';
import { PathShape, Segment } from '@figpot/src/models/entities/penpot/shapes/path';

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
export function transformLineNode(node: LineNode, figmaNodeTransform: Transform, mapping: MappingType): PathShape {
  return {
    type: 'path',
    name: node.name,
    content: translateLineNode(node, figmaNodeTransform),
    ...transformStrokes(node),
    ...transformEffects(node, mapping),
    ...transformSceneNode(node),
    ...transformBlend(node),
    ...transformProportion(node),
    ...transformDimensionAndRotationAndPosition(node, figmaNodeTransform),
    ...transformLayoutAttributes(node),
    ...transformConstraints(node),
  };
}

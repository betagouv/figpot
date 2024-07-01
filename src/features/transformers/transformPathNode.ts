import assert from 'assert';
import { parseSVG } from 'svg-path-parser';

import { RegularPolygonNode, StarNode, Transform } from '@figpot/src/clients/figma';
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
import { translateCommands } from '@figpot/src/features/translators/vectors/translateCommands';
import { PathShape, Segment } from '@figpot/src/models/entities/penpot/shapes/path';

function translatePathNode(node: StarNode | RegularPolygonNode, figmaNodeTransform: Transform): Segment[] {
  assert(node.fillGeometry);

  return translateCommands(node, figmaNodeTransform, parseSVG(node.fillGeometry[0].path));
}

export function transformPathNode(node: StarNode | RegularPolygonNode, figmaNodeTransform: Transform, mapping: MappingType): PathShape {
  return {
    type: 'path',
    name: node.name,
    content: translatePathNode(node, figmaNodeTransform),
    ...transformFills(node),
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

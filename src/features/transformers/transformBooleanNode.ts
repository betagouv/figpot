import assert from 'assert';
import { parseSVG } from 'svg-path-parser';

import { BooleanOperationNode, Transform } from '@figpot/src/clients/figma';
import { MappingType } from '@figpot/src/features/document';
import { transformBlend } from '@figpot/src/features/transformers/partials/transformBlend';
import { transformChildren } from '@figpot/src/features/transformers/partials/transformChildren';
import { transformDimensionAndRotationAndPosition } from '@figpot/src/features/transformers/partials/transformDimensionAndRotationAndPosition';
import { transformEffects } from '@figpot/src/features/transformers/partials/transformEffects';
import { transformFills } from '@figpot/src/features/transformers/partials/transformFills';
import { transformLayoutAttributes } from '@figpot/src/features/transformers/partials/transformLayout';
import { transformProportion } from '@figpot/src/features/transformers/partials/transformProportion';
import { transformSceneNode } from '@figpot/src/features/transformers/partials/transformSceneNode';
import { transformStrokes } from '@figpot/src/features/transformers/partials/transformStrokes';
import { translateBoolType } from '@figpot/src/features/translators/translateBoolType';
import { translateId } from '@figpot/src/features/translators/translateId';
import { translateCommands } from '@figpot/src/features/translators/vectors/translateCommands';
import { PenpotNode } from '@figpot/src/models/entities/penpot/node';
import { BoolShape } from '@figpot/src/models/entities/penpot/shapes/bool';
import { BoolContent } from '@figpot/src/models/entities/penpot/shapes/bool';

function translatePathNode(node: BooleanOperationNode, figmaNodeTransform: Transform): BoolContent[] {
  assert(node.fillGeometry);

  // TODO: this won't work for `exclude`, the Figma path of the bool operation does seems to not involves the exclusion
  // Meaning within the UI the preview will be a `difference` operation, if moving position or switching back and forth to another bool mode it will adjust correctly
  return translateCommands(node, figmaNodeTransform, parseSVG(node.fillGeometry[0].path));
}

export function transformBooleanNode(
  registeredPageNodes: PenpotNode[],
  node: BooleanOperationNode,
  closestFigmaFrameId: string,
  figmaNodeTransform: Transform,
  mapping: MappingType
): BoolShape {
  transformChildren(registeredPageNodes, node, closestFigmaFrameId, figmaNodeTransform, mapping);

  return {
    type: 'bool',
    name: node.name,
    shapes: node.children.map((figmaChild) => translateId(figmaChild.id, mapping)),
    boolContent: translatePathNode(node, figmaNodeTransform),
    boolType: translateBoolType(node.booleanOperation),
    ...transformFills(node, mapping),
    ...transformEffects(node, mapping),
    ...transformStrokes(node, mapping),
    ...transformDimensionAndRotationAndPosition(node, figmaNodeTransform),
    ...transformSceneNode(node),
    ...transformBlend(node),
    ...transformProportion(node),
    ...transformLayoutAttributes(node),
  };
}

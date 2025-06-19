import svgPathParser from 'svg-path-parser';

import { BooleanOperationNode, Transform } from '@figpot/src/clients/figma';
import { transformBlend } from '@figpot/src/features/transformers/partials/transformBlend';
import { transformChildren } from '@figpot/src/features/transformers/partials/transformChildren';
import { transformDimensionAndRotationAndPosition } from '@figpot/src/features/transformers/partials/transformDimensionAndRotationAndPosition';
import { transformEffects } from '@figpot/src/features/transformers/partials/transformEffects';
import { transformFills } from '@figpot/src/features/transformers/partials/transformFills';
import { transformInheritance } from '@figpot/src/features/transformers/partials/transformInheritance';
import { transformLayoutAttributes } from '@figpot/src/features/transformers/partials/transformLayout';
import { transformProportion } from '@figpot/src/features/transformers/partials/transformProportion';
import { transformSceneNode } from '@figpot/src/features/transformers/partials/transformSceneNode';
import { transformStrokes } from '@figpot/src/features/transformers/partials/transformStrokes';
import { translateBoolType } from '@figpot/src/features/translators/translateBoolType';
import { translateId } from '@figpot/src/features/translators/translateId';
import { translateCommands } from '@figpot/src/features/translators/vectors/translateCommands';
import { BoolContent, BoolShape } from '@figpot/src/models/entities/penpot/shapes/bool';
import { AbstractRegistry } from '@figpot/src/models/entities/registry';
import { workaroundAssert as assert } from '@figpot/src/utils/assert';

const { parseSVG } = svgPathParser;

function translatePathNode(node: BooleanOperationNode, figmaNodeTransform: Transform): BoolContent[] {
  assert(node.fillGeometry);

  // With real data some nodes have their `fillGeometry` empty
  if (node.fillGeometry.length > 0) {
    // TODO: this won't work for `exclude`, the Figma path of the bool operation does seems to not involves the exclusion
    // Meaning within the UI the preview will be a `difference` operation, if moving position or switching back and forth to another bool mode it will adjust correctly
    return translateCommands(node, figmaNodeTransform, parseSVG(node.fillGeometry[0].path));
  } else {
    return [];
  }
}

export function transformBooleanNode(
  registry: AbstractRegistry,
  node: BooleanOperationNode,
  closestFigmaFrameId: string,
  figmaNodeTransform: Transform
): BoolShape {
  const childrenShapes = transformChildren(registry, node, closestFigmaFrameId, figmaNodeTransform);

  return {
    type: 'bool',
    name: node.name,
    shapes: childrenShapes,
    boolContent: translatePathNode(node, figmaNodeTransform),
    boolType: translateBoolType(node.booleanOperation),
    ...transformFills(registry, node),
    ...transformEffects(registry, node),
    ...transformStrokes(registry, node),
    ...transformDimensionAndRotationAndPosition(node, figmaNodeTransform),
    ...transformSceneNode(node),
    ...transformBlend(node),
    ...transformProportion(node),
    ...transformLayoutAttributes(node),
    ...transformInheritance(registry, node),
  };
}

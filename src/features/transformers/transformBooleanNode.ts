import svgPathParser from 'svg-path-parser';

import { BooleanOperationNode, Transform } from '@figpot/src/clients/figma';
import { transformBlend } from '@figpot/src/features/transformers/partials/transformBlend';
import { transformChildren } from '@figpot/src/features/transformers/partials/transformChildren';
import { transformConstraints } from '@figpot/src/features/transformers/partials/transformConstraints';
import { transformDimensionAndRotationAndPosition } from '@figpot/src/features/transformers/partials/transformDimensionAndRotationAndPosition';
import { transformEffects } from '@figpot/src/features/transformers/partials/transformEffects';
import { transformFills } from '@figpot/src/features/transformers/partials/transformFills';
import { transformInheritance } from '@figpot/src/features/transformers/partials/transformInheritance';
import { transformLayoutAttributes } from '@figpot/src/features/transformers/partials/transformLayout';
import { transformProportion } from '@figpot/src/features/transformers/partials/transformProportion';
import { transformSceneNode } from '@figpot/src/features/transformers/partials/transformSceneNode';
import { transformStrokes } from '@figpot/src/features/transformers/partials/transformStrokes';
import { BooleanOperand } from '@figpot/src/features/transformers/partials/transformVectorPaths';
import { translateBoolType } from '@figpot/src/features/translators/translateBoolType';
import { translateId } from '@figpot/src/features/translators/translateId';
import { computeBoolContent } from '@figpot/src/features/translators/vectors/computeBoolContent';
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

// Penpot computes a boolean from the paths of its operands, ignoring their strokes, so an operand must keep the outline Figma
// gives (see `canStrokeNatively()`)
function markBooleanOperands(node: { children?: object[] }): void {
  for (const child of node.children ?? []) {
    (child as BooleanOperand).insideBooleanOperation = true;

    markBooleanOperands(child);
  }
}

export function transformBooleanNode(
  registry: AbstractRegistry,
  node: BooleanOperationNode,
  closestFigmaFrameId: string,
  figmaNodeTransform: Transform
): Omit<BoolShape, 'id'> {
  markBooleanOperands(node);

  const childrenShapes = transformChildren(registry, node, closestFigmaFrameId, figmaNodeTransform);
  const boolType = translateBoolType(node.booleanOperation);

  // Without the geometry from Figma, Penpot would render the boolean empty (and hide everything as a mask): its content is
  // computed from its operands, already transformed, as Penpot does
  let content = translatePathNode(node, figmaNodeTransform);
  if (content.length === 0 && childrenShapes.length > 0) {
    let computedContent: BoolContent[] | undefined;
    let reason = 'one of its layers is not a shape the boolean can combine';

    try {
      computedContent = computeBoolContent(boolType, childrenShapes, (nodeId) => registry.getNode(nodeId));
    } catch (error) {
      reason = `the Penpot library rejected its layers (${error instanceof Error ? error.message : String(error)})`;
    }

    if (computedContent !== undefined) {
      content = computedContent;
    } else {
      console.warn(
        `the boolean "${node.name}" (id "${node.id}") has no geometry from Figma and its content cannot be computed because ${reason}, it will look empty in Penpot until one of its layers is edited`
      );
    }
  }

  return {
    type: 'bool',
    name: node.name,
    shapes: childrenShapes,
    content: content,
    boolType: boolType,
    ...transformFills(registry, node),
    ...transformEffects(registry, node),
    ...transformStrokes(registry, node),
    ...transformDimensionAndRotationAndPosition(node, figmaNodeTransform),
    ...transformConstraints(node),
    ...transformSceneNode(node),
    ...transformBlend(node),
    ...transformProportion(node),
    ...transformLayoutAttributes(node),
    ...transformInheritance(registry, node),
  };
}

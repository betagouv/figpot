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

/**
 * Check if a text node has valid geometry data required for Penpot.
 * Returns false if absoluteBoundingBox or size is missing/invalid.
 */
function hasValidGeometry(node: TextNode): boolean {
  // Check if absoluteBoundingBox exists and has valid values
  if (!node.absoluteBoundingBox) {
    return false;
  }

  const { x, y, width, height } = node.absoluteBoundingBox;
  if (x == null || y == null || width == null || height == null) {
    return false;
  }

  // Check for NaN values
  if (Number.isNaN(x) || Number.isNaN(y) || Number.isNaN(width) || Number.isNaN(height)) {
    return false;
  }

  // Check if size exists and has valid values
  if (!node.size) {
    return false;
  }

  const { x: sizeX, y: sizeY } = node.size;
  if (sizeX == null || sizeY == null || Number.isNaN(sizeX) || Number.isNaN(sizeY)) {
    return false;
  }

  return true;
}

export function transformTextNode(registry: AbstractRegistry, node: TextNode, figmaNodeTransform: Transform): Omit<TextShape, 'id'> | undefined {
  // Validate geometry before processing
  if (!hasValidGeometry(node)) {
    console.warn(`Skipping text node "${node.name}" (id: ${node.id}) due to invalid geometry (missing or NaN dimensions)`);
    return undefined;
  }

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

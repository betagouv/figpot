import { TextNode, Transform, TypeStyle } from '@figpot/src/clients/figma';
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

// Figma's `CAP_HEIGHT` leading trim shrinks the box to hug the glyph caps; Penpot has no leading trim. So we
// grow the box back to the natural line height (centered on Figma's trimmed box) so the rendering matches
// Figma as if the trim were off — an acceptable conversion, and the box can still be re-adjusted in Penpot.
// A sub-pixel vertical shift may remain: the exact font metrics (ascent/cap-height) are not exposed by the
// Figma API and would need to be read from the font file to be perfect
function applyCapHeightTrimHeight(
  dimension: ReturnType<typeof transformDimensionAndRotationAndPosition>,
  node: TextNode,
  figmaNodeTransform: Transform
): void {
  if ((node.style as TypeStyle & { leadingTrim?: string }).leadingTrim !== 'CAP_HEIGHT') {
    return;
  }
  if (node.style.lineHeightPx === undefined || dimension.height === undefined || !dimension.selrect || !dimension.points) {
    return;
  }

  const lineCount = node.characters.split('\n').length;
  const delta = node.style.lineHeightPx * lineCount - dimension.height;
  if (delta <= 0) {
    return; // the box already fits the untrimmed text
  }

  // Grow symmetrically so the text keeps the same center as Figma's trimmed box
  const half = delta / 2;
  const selrect = dimension.selrect;
  dimension.height = selrect.height + delta;
  dimension.y = selrect.y - half;
  dimension.selrect = { ...selrect, y: selrect.y - half, y1: selrect.y1 - half, y2: selrect.y2 + half, height: selrect.height + delta };

  // `points` are in document space, so move the top edge up and the bottom edge down along the local y-axis
  const axisLength = Math.hypot(figmaNodeTransform[0][1], figmaNodeTransform[1][1]) || 1;
  const documentShiftX = (figmaNodeTransform[0][1] / axisLength) * half;
  const documentShiftY = (figmaNodeTransform[1][1] / axisLength) * half;
  dimension.points = dimension.points.map((point, index) =>
    index <= 1 ? { x: point.x - documentShiftX, y: point.y - documentShiftY } : { x: point.x + documentShiftX, y: point.y + documentShiftY }
  );
}

export function transformTextNode(registry: AbstractRegistry, node: TextNode, figmaNodeTransform: Transform): Omit<TextShape, 'id'> {
  const dimension = transformDimensionAndRotationAndPosition(node, figmaNodeTransform);
  applyCapHeightTrimHeight(dimension, node, figmaNodeTransform);

  return {
    type: 'text',
    name: node.name,
    ...transformText(registry, node),
    ...transformFlip(node),
    ...dimension,
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

import { ComponentNode, ComponentSetNode, FrameNode, InstanceNode, SectionNode, SubcanvasNode, Transform } from '@figpot/src/clients/figma';
import { transformBlend } from '@figpot/src/features/transformers/partials/transformBlend';
import { transformChildren } from '@figpot/src/features/transformers/partials/transformChildren';
import { transformConstraints } from '@figpot/src/features/transformers/partials/transformConstraints';
import { transformCornerRadius } from '@figpot/src/features/transformers/partials/transformCornerRadius';
import { transformDimensionAndRotationAndPosition } from '@figpot/src/features/transformers/partials/transformDimensionAndRotationAndPosition';
import { transformEffects } from '@figpot/src/features/transformers/partials/transformEffects';
import { transformFills } from '@figpot/src/features/transformers/partials/transformFills';
import { transformInheritance } from '@figpot/src/features/transformers/partials/transformInheritance';
import {
  adaptFillingOnlyChild,
  buildLayoutGridCells,
  freezeHuggingFrameWithoutLaidOutChildren,
  transformAutoLayout,
  transformLayoutAttributes,
} from '@figpot/src/features/transformers/partials/transformLayout';
import { transformProportion } from '@figpot/src/features/transformers/partials/transformProportion';
import { transformSceneNode } from '@figpot/src/features/transformers/partials/transformSceneNode';
import { transformStrokes } from '@figpot/src/features/transformers/partials/transformStrokes';
import { translateGrids } from '@figpot/src/features/translators/translateGrids';
import { SlotNode } from '@figpot/src/models/entities/figma/slot';
import { FrameShape } from '@figpot/src/models/entities/penpot/shapes/frame';
import { Point } from '@figpot/src/models/entities/penpot/traits/point';
import { AbstractRegistry } from '@figpot/src/models/entities/registry';

// Penpot cannot truncate a text (Figma cuts it with an ellipsis), the overflowing lines would be displayed over the next elements, so
// the frame holding a truncated text clips its content instead (groups cannot clip, so texts inside them are concerned too)
// Note: the rule only depends on the node itself, so a main component and its copies get the same value (no override)
function hasTruncatedText(node: SubcanvasNode): boolean {
  if (!('children' in node)) {
    return false;
  }

  return node.children.some((child) => {
    if (child.visible === false) {
      return false;
    } else if (child.type === 'TEXT') {
      return child.style.textTruncation === 'ENDING' || child.style.textAutoResize === 'TRUNCATE';
    }

    return child.type === 'GROUP' && hasTruncatedText(child);
  });
}

function isSectionNode(node: FrameNode | SectionNode | ComponentNode | ComponentSetNode | InstanceNode | SlotNode): node is SectionNode {
  return node.type === 'SECTION';
}

export function transformFrameNode(
  registry: AbstractRegistry,
  node: (FrameNode | SectionNode | ComponentNode | ComponentSetNode | InstanceNode | SlotNode) & Pick<SubcanvasNode, 'id'>,
  figmaNodeTransform: Transform
): Omit<FrameShape, 'id'> {
  let frameSpecificAttributes: Partial<FrameShape> = {};

  if (!isSectionNode(node)) {
    // Before translating the frame sizing and its children since they adjust them
    adaptFillingOnlyChild(node);
    freezeHuggingFrameWithoutLaidOutChildren(node);

    // TODO: Figma API does not expose strokes, blend modes, corner radius, or constraint proportions for sections,
    // they plan to add it in the future. Refactor this when available.
    frameSpecificAttributes = {
      // @see: https://forum.figma.com/t/why-are-strokes-not-available-on-section-nodes/41658
      ...transformStrokes(registry, node),
      // @see: https://forum.figma.com/t/add-a-blendmode-property-for-sectionnode/58560
      ...transformBlend(node),
      ...transformProportion(node),
      ...transformLayoutAttributes(node),
      ...transformCornerRadius(node),
      ...transformEffects(registry, node),
      ...transformConstraints(node),
      ...transformAutoLayout(node),
      ...transformInheritance(registry, node),
    };
  }

  const childrenShapes = transformChildren(registry, node, node.id, figmaNodeTransform);

  // Grid cells are built AFTER children are transformed because they reference the Penpot-mapped child ids
  const layoutGridCells = !isSectionNode(node) ? buildLayoutGridCells(registry, node, childrenShapes) : undefined;
  const grids = !isSectionNode(node) ? translateGrids(node.layoutGrids) : undefined;

  return {
    type: 'frame',
    name: node.name,
    shapes: childrenShapes,
    showContent: isSectionNode(node) ? true : !(node.clipsContent || hasTruncatedText(node as SubcanvasNode)),
    ...transformFills(registry, node),
    ...frameSpecificAttributes,
    ...(layoutGridCells ? { layoutGridCells } : {}),
    ...(grids ? { grids } : {}),
    ...transformDimensionAndRotationAndPosition(node, figmaNodeTransform),
    ...transformSceneNode(node),
  };
}

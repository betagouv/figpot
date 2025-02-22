import { ComponentNode, ComponentSetNode, FrameNode, InstanceNode, SectionNode, SubcanvasNode, Transform } from '@figpot/src/clients/figma';
import { transformBlend } from '@figpot/src/features/transformers/partials/transformBlend';
import { transformChildren } from '@figpot/src/features/transformers/partials/transformChildren';
import { transformConstraints } from '@figpot/src/features/transformers/partials/transformConstraints';
import { transformCornerRadius } from '@figpot/src/features/transformers/partials/transformCornerRadius';
import { transformDimensionAndRotationAndPosition } from '@figpot/src/features/transformers/partials/transformDimensionAndRotationAndPosition';
import { transformEffects } from '@figpot/src/features/transformers/partials/transformEffects';
import { transformFills } from '@figpot/src/features/transformers/partials/transformFills';
import { transformInheritance } from '@figpot/src/features/transformers/partials/transformInheritance';
import { transformAutoLayout, transformLayoutAttributes } from '@figpot/src/features/transformers/partials/transformLayout';
import { transformProportion } from '@figpot/src/features/transformers/partials/transformProportion';
import { transformSceneNode } from '@figpot/src/features/transformers/partials/transformSceneNode';
import { transformStrokes } from '@figpot/src/features/transformers/partials/transformStrokes';
import { FrameShape } from '@figpot/src/models/entities/penpot/shapes/frame';
import { Point } from '@figpot/src/models/entities/penpot/traits/point';
import { AbstractRegistry } from '@figpot/src/models/entities/registry';

function isSectionNode(node: FrameNode | SectionNode | ComponentNode | ComponentSetNode | InstanceNode): node is SectionNode {
  return node.type === 'SECTION';
}

export function transformFrameNode(
  registry: AbstractRegistry,
  node: (FrameNode | SectionNode | ComponentNode | ComponentSetNode | InstanceNode) & Pick<SubcanvasNode, 'id'>,
  figmaNodeTransform: Transform
): FrameShape {
  let frameSpecificAttributes: Partial<FrameShape> = {};

  if (!isSectionNode(node)) {
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

  return {
    type: 'frame',
    name: node.name,
    shapes: childrenShapes,
    showContent: isSectionNode(node) ? true : !node.clipsContent,
    ...transformFills(registry, node),
    ...frameSpecificAttributes,
    ...transformDimensionAndRotationAndPosition(node, figmaNodeTransform),
    ...transformSceneNode(node),
  };
}

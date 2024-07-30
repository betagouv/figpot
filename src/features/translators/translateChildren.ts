import assert from 'assert';

import { HasLayoutTrait, SubcanvasNode, Transform } from '@figpot/src/clients/figma';
import { transformGroupNodeLike } from '@figpot/src/features/transformers/transformGroupNode';
import { transformSceneNode } from '@figpot/src/features/transformers/transformSceneNode';
import { translateId } from '@figpot/src/features/translators/translateId';
import { PenpotNode } from '@figpot/src/models/entities/penpot/node';
import { Uuid } from '@figpot/src/models/entities/penpot/traits/uuid';
import { AbstractRegistry } from '@figpot/src/models/entities/registry';
import { cumulateNodeTransforms, isTransformedNode } from '@figpot/src/utils/matrix';

export function translateChild(
  registry: AbstractRegistry,
  figmaChild: SubcanvasNode,
  figmaParentId: string,
  closestFigmaFrameId: string,
  parentCumulativeTransform: Transform
): PenpotNode {
  // Cumulate the parent transform with the child one (we do this here to not polluting each subcall)
  const childNodeTransform: Transform = isTransformedNode(figmaChild as HasLayoutTrait)
    ? cumulateNodeTransforms(parentCumulativeTransform, (figmaChild as HasLayoutTrait).relativeTransform as Transform)
    : parentCumulativeTransform;

  const penpotNode = transformSceneNode(registry, figmaChild, closestFigmaFrameId, childNodeTransform);
  const penpotNodeId = translateId(figmaChild.id, registry.getMapping());

  penpotNode.id = penpotNodeId;
  penpotNode.parentId = translateId(figmaParentId, registry.getMapping());
  penpotNode.frameId = translateId(closestFigmaFrameId, registry.getMapping());

  return penpotNode;
}

export function translateChildren(
  registry: AbstractRegistry,
  figmaChildren: SubcanvasNode[],
  figmaParentId: string,
  closestFigmaFrameId: string,
  parentCumulativeTransform: Transform
): Uuid[] {
  for (const figmaChild of figmaChildren) {
    const penpotNode = translateChild(registry, figmaChild, figmaParentId, closestFigmaFrameId, parentCumulativeTransform);

    registry.addNode(penpotNode);
  }

  return figmaChildren.map((figmaChild) => translateId(figmaChild.id, registry.getMapping()));
}

/**
 * Translates the children of a node that acts as a mask.
 * We need to split the children into two groups: the ones that are masked and the ones that are not.
 *
 * The masked children will be grouped together in a mask group.
 * The unmasked children will be returned as they are.
 *
 * @maskIndex The index of the mask node in the children array
 */
export function translateMaskChildren(
  registry: AbstractRegistry,
  figmaChildren: SubcanvasNode[],
  maskIndex: number,
  figmaParentId: string,
  closestFigmaFrameId: string,
  parentCumulativeTransform: Transform
): Uuid[] {
  const maskChild = figmaChildren[maskIndex];

  // Some types have no effect as mask so we can process them as normal children
  if (
    maskChild.type === 'STICKY' ||
    maskChild.type === 'CONNECTOR' ||
    maskChild.type === 'WIDGET' ||
    maskChild.type === 'EMBED' ||
    maskChild.type === 'LINK_UNFURL' ||
    maskChild.type === 'SECTION' ||
    maskChild.type === 'TABLE' ||
    maskChild.type === 'SHAPE_WITH_TEXT'
  ) {
    return translateChildren(registry, figmaChildren, figmaParentId, closestFigmaFrameId, parentCumulativeTransform);
  }

  // On Figma a mask property is applied to a node (not to a group, so it applies even if no group):
  // - a specific child is the mask (can be a group itself)
  // - what's above in the UI has the mask applied
  // - what's below in the UI are normally visible (no mask apply)
  //
  // Due to this we have to tweak a bit the logic depending on the composition because for Penpot the mask will always be the first one declared into `shapes`:
  // - if no "below child" it can be directly the mask group
  // - otherwise they must be nested to let the visible nodes
  const visibleChildren = figmaChildren.slice(0, maskIndex);
  const concernedByMaskChildren = figmaChildren.slice(maskIndex);

  // Visible children can be treated as normal children
  const visibileShapes = translateChildren(registry, visibleChildren, figmaParentId, closestFigmaFrameId, parentCumulativeTransform);

  // Since we cannot rely on having a parent group due to Figma mask logic, we always create one for the nodes concerned by the mask
  assert('absoluteBoundingBox' in maskChild); // Needed to check it has a layout... should be true

  const figmaMaskGroupId = `${maskChild.id}_maskGroup`;
  const maskShapes = translateChildren(registry, concernedByMaskChildren, figmaMaskGroupId, closestFigmaFrameId, parentCumulativeTransform);

  const penpotMaskGroup = {
    id: translateId(figmaMaskGroupId, registry.getMapping()),
    parentId: translateId(figmaParentId, registry.getMapping()),
    frameId: translateId(closestFigmaFrameId, registry.getMapping()),
    ...transformGroupNodeLike(registry, maskChild, parentCumulativeTransform),
    name: `${maskChild.name} - Mask group`,
    maskedGroup: true,
    shapes: maskShapes,
  };

  registry.addNode(penpotMaskGroup);

  return [...visibileShapes, penpotMaskGroup.id];
}

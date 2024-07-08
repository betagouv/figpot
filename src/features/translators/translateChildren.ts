import { HasLayoutTrait, SubcanvasNode, Transform } from '@figpot/src/clients/figma';
import { transformGroupNodeLike } from '@figpot/src/features/transformers/transformGroupNode';
import { transformSceneNode } from '@figpot/src/features/transformers/transformSceneNode';
import { translateId } from '@figpot/src/features/translators/translateId';
import { PenpotNode } from '@figpot/src/models/entities/penpot/node';
import { AbstractRegistry } from '@figpot/src/models/entities/registry';
import { cumulateNodeTransforms, isTransformedNode } from '@figpot/src/utils/matrix';

export function translateChildren(
  registry: AbstractRegistry,
  figmaChildren: SubcanvasNode[],
  figmaParentId: string,
  closestFigmaFrameId: string,
  parentCumulativeTransform: Transform
) {
  for (const figmaChild of figmaChildren) {
    // Cumulate the parent transform with the child one (we do this here to not polluting each subcall)
    const childNodeTransform: Transform = isTransformedNode(figmaChild as HasLayoutTrait)
      ? cumulateNodeTransforms(parentCumulativeTransform, (figmaChild as HasLayoutTrait).relativeTransform as Transform)
      : parentCumulativeTransform;

    const penpotNode = transformSceneNode(registry, figmaChild, closestFigmaFrameId, childNodeTransform);
    const penpotNodeId = translateId(figmaChild.id, registry.getMapping());

    penpotNode.id = penpotNodeId;
    penpotNode.parentId = translateId(figmaParentId, registry.getMapping());
    penpotNode.frameId = translateId(closestFigmaFrameId, registry.getMapping());

    registry.addNode(penpotNode);
  }
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
): PenpotNode[] {
  const maskChild = figmaChildren[maskIndex];

  return [];

  // TODO: mask not implemented yet

  // const unmaskedChildren = translateChildren(
  //   registry,
  //   figmaChildren.slice(0, maskIndex),
  //   figmaParentId,
  //   closestFigmaFrameId,
  //   parentCumulativeTransform,
  // );
  // const maskedChildren = translateChildren(
  //   registry,
  //   figmaChildren.slice(maskIndex),
  //   figmaParentId,
  //   closestFigmaFrameId,
  //   parentCumulativeTransform,
  // );

  // if (
  //   maskChild.type === 'STICKY' ||
  //   maskChild.type === 'CONNECTOR' ||
  //   maskChild.type === 'WIDGET' ||
  //   maskChild.type === 'EMBED' ||
  //   maskChild.type === 'LINK_UNFURL' ||
  //   maskChild.type === 'SECTION' ||
  //   maskChild.type === 'TABLE' ||
  //   maskChild.type === 'SHAPE_WITH_TEXT'
  // ) {
  //   return [...unmaskedChildren, ...maskedChildren];
  // }

  // const maskGroup = {
  //   ...transformGroupNodeLike(registry, maskChild, parentCumulativeTransform),
  //   children: maskedChildren,
  //   maskedGroup: true,
  // };

  // return [...unmaskedChildren, maskGroup];
}

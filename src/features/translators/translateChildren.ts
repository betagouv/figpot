import { SubcanvasNode } from '@figpot/src/clients/figma';
import { MappingType } from '@figpot/src/features/document';
import { transformGroupNodeLike } from '@figpot/src/features/transformers/transformGroupNode';
import { transformSceneNode } from '@figpot/src/features/transformers/transformSceneNode';
import { translateId } from '@figpot/src/features/translators/translateId';
import { PenpotNode } from '@figpot/src/models/entities/penpot/node';

export function translateChildren(
  registeredPageNodes: PenpotNode[],
  figmaChildren: SubcanvasNode[],
  figmaParentId: string,
  closestFigmaFrameId: string,
  mapping: MappingType
) {
  for (const figmaChild of figmaChildren) {
    const penpotNode = transformSceneNode(registeredPageNodes, figmaChild, mapping);
    const penpotNodeId = translateId(figmaChild.id, mapping);

    penpotNode.id = penpotNodeId;
    penpotNode.parentId = translateId(figmaParentId, mapping);
    penpotNode.frameId = translateId(closestFigmaFrameId, mapping);

    registeredPageNodes.push(penpotNode);
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
  registeredPageNodes: PenpotNode[],
  figmaChildren: SubcanvasNode[],
  maskIndex: number,
  figmaParentId: string,
  closestFigmaFrameId: string,
  mapping: MappingType
): PenpotNode[] {
  const maskChild = figmaChildren[maskIndex];

  throw 'mask not implemented yet';

  const unmaskedChildren = translateChildren(registeredPageNodes, figmaChildren.slice(0, maskIndex), figmaParentId, closestFigmaFrameId, mapping);
  const maskedChildren = translateChildren(registeredPageNodes, figmaChildren.slice(maskIndex), figmaParentId, closestFigmaFrameId, mapping);

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
    return [...unmaskedChildren, ...maskedChildren];
  }

  const maskGroup = {
    ...transformGroupNodeLike(maskChild),
    children: maskedChildren,
    maskedGroup: true,
  };

  return [...unmaskedChildren, maskGroup];
}

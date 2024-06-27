import { HasChildrenTrait, HasMaskTrait, SubcanvasNode, Transform } from '@figpot/src/clients/figma';
import { MappingType } from '@figpot/src/features/document';
import { translateChildren, translateMaskChildren } from '@figpot/src/features/translators/translateChildren';
import { PenpotNode } from '@figpot/src/models/entities/penpot/node';

function hasMaskTrait(node: SubcanvasNode): node is SubcanvasNode & HasMaskTrait {
  return 'isMask' in node;
}

export function transformChildren(
  registeredPageNodes: PenpotNode[],
  node: HasChildrenTrait & Pick<SubcanvasNode, 'id'>,
  closestFigmaFrameId: string,
  parentCumulativeTransform: Transform,
  mapping: MappingType
) {
  const maskIndex = node.children.findIndex((childNode) => {
    if (hasMaskTrait(childNode)) {
      return childNode.isMask === true;
    }

    return false;
  });
  const containsMask = maskIndex !== -1;

  if (containsMask) {
    translateMaskChildren(registeredPageNodes, node.children, maskIndex, node.id, closestFigmaFrameId, parentCumulativeTransform, mapping);
  } else {
    translateChildren(registeredPageNodes, node.children, node.id, closestFigmaFrameId, parentCumulativeTransform, mapping);
  }
}

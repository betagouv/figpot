import { HasChildrenTrait, HasMaskTrait, SubcanvasNode } from '@figpot/src/clients/figma';
import { MappingType } from '@figpot/src/features/document';
import { translateChildren, translateMaskChildren } from '@figpot/src/features/translators/translateChildren';
import { PenpotNode } from '@figpot/src/models/entities/penpot/node';

function hasMaskTrait(node: SubcanvasNode): node is SubcanvasNode & HasMaskTrait {
  return 'isMask' in node;
}

export function transformChildren(registeredPageNodes: PenpotNode[], node: HasChildrenTrait & Pick<SubcanvasNode, 'id'>, mapping: MappingType) {
  const maskIndex = node.children.findIndex((childNode) => {
    if (hasMaskTrait(childNode)) {
      return childNode.isMask === true;
    }

    return false;
  });
  const containsMask = maskIndex !== -1;

  if (containsMask) {
    translateMaskChildren(registeredPageNodes, node.children, maskIndex, node.id, node.id, mapping);
  } else {
    translateChildren(registeredPageNodes, node.children, node.id, node.id, mapping);
  }
}

import { HasChildrenTrait, HasMaskTrait, SubcanvasNode, Transform } from '@figpot/src/clients/figma';
import { translateChildren, translateMaskChildren } from '@figpot/src/features/translators/translateChildren';
import { PageRegistry } from '@figpot/src/models/entities/registry';

function hasMaskTrait(node: SubcanvasNode): node is SubcanvasNode & HasMaskTrait {
  return 'isMask' in node;
}

export function transformChildren(
  registry: PageRegistry,
  node: HasChildrenTrait & Pick<SubcanvasNode, 'id'>,
  closestFigmaFrameId: string,
  parentCumulativeTransform: Transform
) {
  const maskIndex = node.children.findIndex((childNode) => {
    if (hasMaskTrait(childNode)) {
      return childNode.isMask === true;
    }

    return false;
  });
  const containsMask = maskIndex !== -1;

  if (containsMask) {
    translateMaskChildren(registry, node.children, maskIndex, node.id, closestFigmaFrameId, parentCumulativeTransform);
  } else {
    translateChildren(registry, node.children, node.id, closestFigmaFrameId, parentCumulativeTransform);
  }
}

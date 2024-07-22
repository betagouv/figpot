import { HasChildrenTrait, HasMaskTrait, SubcanvasNode, Transform } from '@figpot/src/clients/figma';
import { translateChildren, translateMaskChildren } from '@figpot/src/features/translators/translateChildren';
import { AbstractRegistry } from '@figpot/src/models/entities/registry';

export function hasMaskTrait(node: SubcanvasNode): node is SubcanvasNode & HasMaskTrait {
  return 'isMask' in node;
}

export function getMaskChildIndex(node: HasChildrenTrait): number {
  return node.children.findIndex((childNode) => {
    if (hasMaskTrait(childNode)) {
      return childNode.isMask === true;
    }

    return false;
  });
}

export function hasMaskChild(node: HasChildrenTrait): boolean {
  return getMaskChildIndex(node) !== -1;
}

export function transformChildren(
  registry: AbstractRegistry,
  node: HasChildrenTrait & Pick<SubcanvasNode, 'id'>,
  closestFigmaFrameId: string,
  parentCumulativeTransform: Transform
): string[] {
  return transformChildrenWithParentId(registry, node, node.id, closestFigmaFrameId, parentCumulativeTransform);
}

export function transformChildrenWithParentId(
  registry: AbstractRegistry,
  node: HasChildrenTrait & Pick<SubcanvasNode, 'id'>,
  figmaParentId: string,
  closestFigmaFrameId: string,
  parentCumulativeTransform: Transform
): string[] {
  const maskIndex = getMaskChildIndex(node);
  const containsMask = maskIndex !== -1;

  if (containsMask) {
    return translateMaskChildren(registry, node.children, maskIndex, figmaParentId, closestFigmaFrameId, parentCumulativeTransform);
  } else {
    return translateChildren(registry, node.children, figmaParentId, closestFigmaFrameId, parentCumulativeTransform);
  }
}

import { SubcanvasNode } from '@figpot/src/clients/figma';
import { MappingType } from '@figpot/src/features/document';
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

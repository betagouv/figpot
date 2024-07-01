import { SubcanvasNode, Transform } from '@figpot/src/clients/figma';
import { MappingType } from '@figpot/src/features/document';
import { transformBooleanNode } from '@figpot/src/features/transformers/transformBooleanNode';
import { transformEllipseNode } from '@figpot/src/features/transformers/transformEllipseNode';
import { transformFrameNode } from '@figpot/src/features/transformers/transformFrameNode';
import { transformGroupNode } from '@figpot/src/features/transformers/transformGroupNode';
import { transformLineNode } from '@figpot/src/features/transformers/transformLineNode';
import { transformPathNode } from '@figpot/src/features/transformers/transformPathNode';
import { transformRectangleNode } from '@figpot/src/features/transformers/transformRectangleNode';
import { transformTextNode } from '@figpot/src/features/transformers/transformTextNode';
import { transformVectorNode } from '@figpot/src/features/transformers/transformVectorNode';
import { PenpotNode } from '@figpot/src/models/entities/penpot/node';

// TODO:
// import {
//   transformComponentNode,
//   transformInstanceNode,
// } from '.';

export function transformSceneNode(
  registeredPageNodes: PenpotNode[],
  figmaNode: SubcanvasNode,
  closestFigmaFrameId: string,
  figmaNodeTransform: Transform,
  mapping: MappingType
): PenpotNode {
  let penpotNode: PenpotNode | undefined;

  switch (figmaNode.type) {
    case 'RECTANGLE':
      penpotNode = transformRectangleNode(figmaNode, figmaNodeTransform, mapping);
      break;
    case 'ELLIPSE':
      penpotNode = transformEllipseNode(figmaNode, figmaNodeTransform, mapping);
      break;
    case 'SECTION':
    case 'FRAME':
    case 'COMPONENT_SET':
      penpotNode = transformFrameNode(registeredPageNodes, figmaNode, figmaNodeTransform, mapping);
      break;
    case 'GROUP':
      penpotNode = transformGroupNode(registeredPageNodes, figmaNode, closestFigmaFrameId, figmaNodeTransform, mapping);
      break;
    case 'TEXT':
      penpotNode = transformTextNode(figmaNode, figmaNodeTransform, mapping);
      break;
    case 'VECTOR':
      penpotNode = transformVectorNode(registeredPageNodes, figmaNode, closestFigmaFrameId, figmaNodeTransform, mapping);
      break;
    case 'LINE':
      penpotNode = transformLineNode(figmaNode, figmaNodeTransform, mapping);
      break;
    case 'STAR':
    case 'REGULAR_POLYGON':
      penpotNode = transformPathNode(figmaNode, figmaNodeTransform, mapping);
      break;
    case 'BOOLEAN_OPERATION':
      penpotNode = transformBooleanNode(registeredPageNodes, figmaNode, closestFigmaFrameId, figmaNodeTransform, mapping);
      break;
    // case 'CONNECTOR':
    //   // TODO: implement it?
    //   penpotNode = await transformConnectorNode(figmaNode, baseX, baseY);
    //   break;
    // case 'COMPONENT':
    //   penpotNode = await transformComponentNode(figmaNode, baseX, baseY);
    //   break;
    // case 'INSTANCE':
    //   penpotNode = await transformInstanceNode(figmaNode, baseX, baseY);
    //   break;
  }

  if (penpotNode === undefined) {
    throw new Error(`Unsupported Figma node type: ${figmaNode.type}`);
  }

  return penpotNode;
}

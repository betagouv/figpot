import { SubcanvasNode } from '@figpot/src/clients/figma';
import { transformRectangleNode } from '@figpot/src/features/transformers/transformRectangleNode';
import { PenpotNode } from '@figpot/src/models/entities/penpot/node';

// TODO:
// import {
//   transformBooleanNode,
//   transformComponentNode,
//   transformEllipseNode,
//   transformFrameNode,
//   transformGroupNode,
//   transformInstanceNode,
//   transformPathNode,
//   transformTextNode,
//   transformVectorNode,
// } from '.';

export function transformSceneNode(registeredPageNodes: PenpotNode[], figmaNode: SubcanvasNode, baseX: number = 0, baseY: number = 0): PenpotNode {
  let penpotNode: PenpotNode | undefined;

  switch (figmaNode.type) {
    case 'RECTANGLE':
      penpotNode = transformRectangleNode(figmaNode, baseX, baseY);
      break;
    // case 'ELLIPSE':
    //   penpotNode = transformEllipseNode(figmaNode, baseX, baseY);
    //   break;
    // case 'SECTION':
    // case 'FRAME':
    // case 'COMPONENT_SET':
    //   penpotNode = await transformFrameNode(figmaNode, baseX, baseY);
    //   break;
    // case 'GROUP':
    //   penpotNode = await transformGroupNode(figmaNode, baseX, baseY);
    //   break;
    // case 'TEXT':
    //   penpotNode = transformTextNode(figmaNode, baseX, baseY);
    //   break;
    // case 'VECTOR':
    //   penpotNode = transformVectorNode(figmaNode, baseX, baseY);
    //   break;
    // case 'STAR':
    // // case 'POLYGON':
    // case 'REGULAR_POLYGON':
    // case 'LINE':
    //   penpotNode = transformPathNode(figmaNode, baseX, baseY);
    //   break;
    // case 'BOOLEAN_OPERATION':
    //   penpotNode = await transformBooleanNode(figmaNode, baseX, baseY);
    //   break;
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

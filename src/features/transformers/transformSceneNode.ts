import { SubcanvasNode, Transform } from '@figpot/src/clients/figma';
import { transformBooleanNode } from '@figpot/src/features/transformers/transformBooleanNode';
import { transformComponentNode } from '@figpot/src/features/transformers/transformComponentNode';
import { transformComponentSetNode } from '@figpot/src/features/transformers/transformComponentSetNode';
import { transformEllipseNode } from '@figpot/src/features/transformers/transformEllipseNode';
import { transformFrameNode } from '@figpot/src/features/transformers/transformFrameNode';
import { transformGroupNode } from '@figpot/src/features/transformers/transformGroupNode';
import { transformInstanceNode } from '@figpot/src/features/transformers/transformInstanceNode';
import { transformLineNode } from '@figpot/src/features/transformers/transformLineNode';
import { transformPathNode } from '@figpot/src/features/transformers/transformPathNode';
import { transformRectangleNode } from '@figpot/src/features/transformers/transformRectangleNode';
import { transformTextNode } from '@figpot/src/features/transformers/transformTextNode';
import { transformVectorNode } from '@figpot/src/features/transformers/transformVectorNode';
import { PenpotNode } from '@figpot/src/models/entities/penpot/node';
import { AbstractRegistry } from '@figpot/src/models/entities/registry';

export function transformSceneNode(
  registry: AbstractRegistry,
  figmaNode: SubcanvasNode,
  closestFigmaFrameId: string,
  figmaNodeTransform: Transform
): Omit<PenpotNode, 'id'> {
  let penpotNode: Omit<PenpotNode, 'id'> | undefined;

  switch (figmaNode.type) {
    case 'RECTANGLE':
      penpotNode = transformRectangleNode(registry, figmaNode, figmaNodeTransform);
      break;
    case 'ELLIPSE':
      penpotNode = transformEllipseNode(registry, figmaNode, figmaNodeTransform);
      break;
    case 'SECTION':
    case 'FRAME':
      penpotNode = transformFrameNode(registry, figmaNode, figmaNodeTransform);
      break;
    case 'GROUP':
      penpotNode = transformGroupNode(registry, figmaNode, closestFigmaFrameId, figmaNodeTransform);
      break;
    case 'TEXT':
      penpotNode = transformTextNode(registry, figmaNode, figmaNodeTransform);
      break;
    case 'VECTOR':
      penpotNode = transformVectorNode(registry, figmaNode, closestFigmaFrameId, figmaNodeTransform);
      break;
    case 'LINE':
      penpotNode = transformLineNode(registry, figmaNode, figmaNodeTransform);
      break;
    case 'STAR':
    case 'REGULAR_POLYGON':
      penpotNode = transformPathNode(registry, figmaNode, figmaNodeTransform);
      break;
    case 'BOOLEAN_OPERATION':
      penpotNode = transformBooleanNode(registry, figmaNode, closestFigmaFrameId, figmaNodeTransform);
      break;
    case 'COMPONENT_SET':
      penpotNode = transformComponentSetNode(registry, figmaNode, figmaNodeTransform);
      break;
    case 'COMPONENT':
      penpotNode = transformComponentNode(registry, figmaNode, figmaNodeTransform);
      break;
    case 'INSTANCE':
      penpotNode = transformInstanceNode(registry, figmaNode, figmaNodeTransform);
      break;
    // case 'CONNECTOR':
    //   // TODO: implement it?
    //   penpotNode = await transformConnectorNode(figmaNode, baseX, baseY);
    //   break;
  }

  if (penpotNode === undefined) {
    throw new Error(`Unsupported Figma node type: ${figmaNode.type}`);
  }

  return penpotNode;
}

import { EllipseNode, SubcanvasNode, Transform, VectorNode } from '@figpot/src/clients/figma';
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
import { transformTextPathNode } from '@figpot/src/features/transformers/transformTextPathNode';
import { transformVectorNode } from '@figpot/src/features/transformers/transformVectorNode';
import { PenpotNode } from '@figpot/src/models/entities/penpot/node';
import { AbstractRegistry } from '@figpot/src/models/entities/registry';

function isArcEllipse(node: EllipseNode): boolean {
  return node.arcData.innerRadius > 0 || node.arcData.endingAngle - node.arcData.startingAngle < 2 * Math.PI - 0.001;
}

export function transformSceneNode(
  registry: AbstractRegistry,
  figmaNode: SubcanvasNode,
  closestFigmaFrameId: string,
  figmaNodeTransform: Transform
): Omit<PenpotNode, 'id'> | undefined {
  let penpotNode: Omit<PenpotNode, 'id'> | undefined;

  switch (figmaNode.type) {
    case 'RECTANGLE':
      penpotNode = transformRectangleNode(registry, figmaNode, figmaNodeTransform);
      break;
    case 'ELLIPSE':
      // A partial sweep or a hole (arc / pie / donut) has no Penpot `circle` equivalent, so ending with pure vector
      penpotNode = isArcEllipse(figmaNode)
        ? transformVectorNode(registry, figmaNode as unknown as VectorNode, closestFigmaFrameId, figmaNodeTransform)
        : transformEllipseNode(registry, figmaNode, figmaNodeTransform);
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
    case 'TEXT_PATH':
      // `transformTextPathNode` emits its own specific warning when it skips a corrupted node, so we return
      // straight away to avoid the generic "type not supported" warning below
      return transformTextPathNode(registry, figmaNode, figmaNodeTransform);
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
  }

  if (penpotNode === undefined) {
    // any other type is not yet implemented (`SLOT`, `SLIDE`, `TABLE, `SHAPE_WITH_TEXT`)
    // so instead of aborting the whole migration, just notify the user it will be skipped
    // note: some have just for now no equivalent in Penpot (`TEXT_PATH`, `CONNECTOR`)
    console.warn(
      `skipping the Figma node "${figmaNode.name ?? '(unnamed)'}" (id "${figmaNode.id ?? 'unknown'}", type "${figmaNode.type ?? 'unknown'}") because its type is not supported by figpot`
    );

    return undefined;
  }

  return penpotNode;
}

import { SubcanvasNode } from '@figpot/src/clients/figma';
import { ShapeBaseAttributes } from '@figpot/src/models/entities/penpot/shape';

// export function transformFigmaIds(node: SubcanvasNode): Pick<ShapeBaseAttributes, 'figmaId' | 'figmaRelatedId'> {
//   return {
//     figmaId: normalizeNodeId(node.id),
//     figmaRelatedId: getRelatedNodeId(node.id),
//   };
// }

// export function transformMaskFigmaIds(node: SubcanvasNode): Pick<ShapeBaseAttributes, 'figmaId' | 'figmaRelatedId'> {
//   const transformedIds = transformFigmaIds(node);

//   return {
//     figmaId: `M${transformedIds.figmaId}`,
//     figmaRelatedId: transformedIds.figmaRelatedId ? `M${transformedIds.figmaRelatedId}` : undefined,
//   };
// }

// function getRelatedNodeId(nodeId: string): string | undefined {
//   const ids = nodeId.split(';');

//   if (ids.length > 1) {
//     return ids.slice(1).join(';');
//   }
// }

// function normalizeNodeId(nodeId: string): string {
//   return nodeId.replace('I', '');
// }

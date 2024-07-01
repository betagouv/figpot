import { v7 as uuidv7 } from 'uuid';

import { MappingType } from '@figpot/src/features/document';
import { PenpotNode } from '@figpot/src/models/entities/penpot/node';

export const rootFrameId = '00000000-0000-0000-0000-000000000000';
export const rootFrameIdSuffix = '_rootFrame';

export function translateId(figmaNodeId: string, mapping: MappingType): string {
  const penpotMappedNodeId = mapping.nodes.get(figmaNodeId);
  if (penpotMappedNodeId) {
    return penpotMappedNodeId;
  }

  // Otherwise we create a new one, adding it to the mapping object
  // Note: we use UUID v7 because Penpot seems to have one with timestamp at the beginning (even if they call if "v8", but this is to be free-form apparently)
  const penpotNodeId = uuidv7();
  mapping.nodes.set(figmaNodeId, penpotNodeId);

  return penpotNodeId;
}

export function registerId(figmaNodeId: string, penpotNodeId: string, mapping: MappingType) {
  mapping.nodes.set(figmaNodeId, penpotNodeId);
}

export function translateMediaId(figmaMediaId: string, mapping: MappingType): string {
  const penpotMappedMediaId = mapping.assets.get(figmaMediaId);
  if (penpotMappedMediaId) {
    return penpotMappedMediaId;
  }

  // Otherwise we create a new one, adding it to the mapping object
  // Note: we use UUID v7 because Penpot seems to have one with timestamp at the beginning (even if they call if "v8", but this is to be free-form apparently)
  const penpotMediaId = uuidv7();
  mapping.assets.set(figmaMediaId, penpotMediaId);

  return penpotMediaId;
}

export function translateUuidAsObjectKey(uuid: string): string {
  return uuid.replaceAll('-', '_');
}

export function formatPageRootFrameId(pageId: string) {
  return `${pageId}${rootFrameIdSuffix}`;
}

export function isPageRootFrame(partialNode: Pick<PenpotNode, 'id' | 'parentId'>): boolean {
  return partialNode.id === partialNode.parentId;
}

export function isPageRootFrameFromId(nodeId: string): boolean {
  return nodeId.endsWith(rootFrameIdSuffix);
}

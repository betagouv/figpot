import { ComponentSetNode, Transform } from '@figpot/src/clients/figma';
import { transformFrameNode } from '@figpot/src/features/transformers/transformFrameNode';
import { FrameShape } from '@figpot/src/models/entities/penpot/shapes/frame';
import { AbstractRegistry } from '@figpot/src/models/entities/registry';

export function transformComponentSetNode(registry: AbstractRegistry, node: ComponentSetNode, figmaNodeTransform: Transform): FrameShape {
  // The component sets (and components) are registered at the document node level
  // But still, we use the current one as a frame so it can inherit from Figma style (stroke, radius, auto layout...)
  return {
    ...transformFrameNode(registry, node, figmaNodeTransform),
    isVariantContainer: true,
  };
}

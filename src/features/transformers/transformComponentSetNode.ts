import { ComponentSetNode, Transform } from '@figpot/src/clients/figma';
import { transformFrameNode } from '@figpot/src/features/transformers/transformFrameNode';
import { FrameShape } from '@figpot/src/models/entities/penpot/shapes/frame';
import { AbstractRegistry } from '@figpot/src/models/entities/registry';

export function transformComponentSetNode(registry: AbstractRegistry, node: ComponentSetNode, figmaNodeTransform: Transform): FrameShape {
  // Penpot does not support variant so we consider children as independant components
  // But still, we use it as a frame so it can inherit from Figma style (stroke, radius, auto layout...)
  return transformFrameNode(registry, node, figmaNodeTransform);
}

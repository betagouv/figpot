import { ComponentNode, Transform } from '@figpot/src/clients/figma';
import { transformFrameNode } from '@figpot/src/features/transformers/transformFrameNode';
import { translateComponentId, translateDocumentId } from '@figpot/src/features/translators/translateId';
import { FrameShape } from '@figpot/src/models/entities/penpot/shapes/frame';
import { PageRegistry } from '@figpot/src/models/entities/registry';

export function transformComponentNode(registry: PageRegistry, node: ComponentNode, figmaNodeTransform: Transform): FrameShape {
  // A Figma component must be registered into the Penpot page tree, but also into the Penpot dedicated component tree
  // Note: inside the page tree the component type is a frame, so reusing the frame logic and transform
  const componentFrame = transformFrameNode(registry, node, figmaNodeTransform);

  componentFrame.componentFile = translateDocumentId('current', registry.getMapping());
  componentFrame.componentId = translateComponentId(`${node.id}_component`, registry.getMapping()); // The component definition has a different ID than the representation in the normal tree
  componentFrame.componentRoot = true;
  componentFrame.mainInstance = true;

  return componentFrame;
}

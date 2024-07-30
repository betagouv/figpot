import { ComponentNode, Transform } from '@figpot/src/clients/figma';
import { transformFrameNode } from '@figpot/src/features/transformers/transformFrameNode';
import { translateComponentId, translateDocumentId } from '@figpot/src/features/translators/translateId';
import { FrameShape } from '@figpot/src/models/entities/penpot/shapes/frame';
import { AbstractRegistry, ComponentRegistry } from '@figpot/src/models/entities/registry';

export function transformComponentNode(registry: AbstractRegistry, node: ComponentNode, figmaNodeTransform: Transform): FrameShape {
  let componentRoot: true | undefined = undefined;
  if (!(registry instanceof ComponentRegistry)) {
    // That's the root if not already into a component
    // Note: in Figma a component definition cannot be inside a component instance
    componentRoot = true;
  }

  // We change the registry scope
  registry = registry.newComponentScope();

  // A Figma component must be registered into the Penpot page tree, but also into the Penpot dedicated component tree
  // Note: inside the page tree the component type is a frame, so reusing the frame logic and transform
  const componentFrame = transformFrameNode(registry, node, figmaNodeTransform);

  componentFrame.componentFile = translateDocumentId('current', registry.getMapping());
  componentFrame.componentId = translateComponentId(`${node.id}_component`, registry.getMapping()); // The component definition has a different ID than the representation in the normal tree
  componentFrame.componentRoot = componentRoot;
  componentFrame.mainInstance = true;

  return componentFrame;
}

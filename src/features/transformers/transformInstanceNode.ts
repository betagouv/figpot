import assert from 'assert';

import { InstanceNode, Transform } from '@figpot/src/clients/figma';
import { transformFrameNode } from '@figpot/src/features/transformers/transformFrameNode';
import { nullId, translateComponentId, translateDocumentId } from '@figpot/src/features/translators/translateId';
import { FrameShape } from '@figpot/src/models/entities/penpot/shapes/frame';
import { AbstractRegistry, PageRegistry } from '@figpot/src/models/entities/registry';

export function transformInstanceNode(registry: AbstractRegistry, node: InstanceNode, figmaNodeTransform: Transform): FrameShape {
  let componentRoot: true | undefined = undefined;
  if (registry instanceof PageRegistry) {
    componentRoot = true;

    // Help the children knowing their are part of a component
    registry = registry.newComponentScope();
  }

  // Note: inside the page tree the component instance type is a frame, so reusing the frame logic and transform
  const instanceFrame = transformFrameNode(registry, node, figmaNodeTransform);
  instanceFrame.componentRoot = componentRoot;

  const potentialComponentId = translateComponentId(`${node.componentId}_component`, registry.getMapping()); // The component definition has a different ID than the representation in the normal tree

  const isLocalComponent = registry.getComponents().has(potentialComponentId);

  if (isLocalComponent) {
    instanceFrame.componentFile = translateDocumentId('current', registry.getMapping());
    instanceFrame.componentId = potentialComponentId;

    // The `transformInheritance` is working in all cases except for instance node
    // since Figma may set them a node ID without the original shape, so as fallback we use the main instance node ID
    // to match the Penpot expectations
    if (!instanceFrame.shapeRef) {
      const component = registry.getComponents().get(potentialComponentId);

      assert(component);

      instanceFrame.shapeRef = component.mainInstanceId;
    }
  } else {
    // An instance of a remote component should require information not available here to be bound to the remote component
    // They are usable without the link but it may help, and would be great to reproduce the Figma logic
    // So for now we just specify null values to distinguish them inside the backend. Having true IDs would require Penpot to implement a "swap feature" based on an identifiable thing, or us to manage this across all Figma documents linked
    instanceFrame.componentFile = nullId;
    instanceFrame.componentId = nullId;
    instanceFrame.shapeRef = nullId;
  }

  return instanceFrame;
}

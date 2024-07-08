import assert from 'assert';

import { InstanceNode, Transform } from '@figpot/src/clients/figma';
import { transformFrameNode } from '@figpot/src/features/transformers/transformFrameNode';
import { translateComponentId, translateDocumentId } from '@figpot/src/features/translators/translateId';
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
  const componentId = translateComponentId(`${node.componentId}_component`, registry.getMapping()); // The component definition has a different ID than the representation in the normal tree

  instanceFrame.componentFile = translateDocumentId('current', registry.getMapping());
  instanceFrame.componentId = componentId;
  instanceFrame.componentRoot = componentRoot;

  // The `transformInheritance` is working in all cases except for instance node
  // since Figma may set them a node ID without the original shape, so as fallback we use the main instance node ID
  // to match the Penpot expectations
  if (!instanceFrame.shapeRef) {
    const component = registry.getComponents().get(componentId);

    assert(component);

    instanceFrame.shapeRef = component.mainInstanceId;
  }

  return instanceFrame;
}

import { InstanceNode, Transform } from '@figpot/src/clients/figma';
import { transformFrameNode } from '@figpot/src/features/transformers/transformFrameNode';
import { nullId, translateComponentId, translateDocumentId } from '@figpot/src/features/translators/translateId';
import { syncAttributes } from '@figpot/src/features/translators/translateTouched';
import { FrameShape } from '@figpot/src/models/entities/penpot/shapes/frame';
import { AbstractRegistry, PageRegistry } from '@figpot/src/models/entities/registry';

export function transformInstanceNode(registry: AbstractRegistry, node: InstanceNode, figmaNodeTransform: Transform): Omit<FrameShape, 'id'> {
  let componentRoot: true | undefined = undefined;
  if (registry instanceof PageRegistry) {
    // If the first instance from a page registry it means that's the root
    componentRoot = true;
  }

  // Help the children knowing their are part of an instance to manage overrides for example
  registry = registry.newComponentInstanceScope(node.overrides);

  // Note: inside the page tree the component instance type is a frame, so reusing the frame logic and transform
  const instanceFrame = transformFrameNode(registry, node, figmaNodeTransform);
  instanceFrame.componentRoot = componentRoot;

  const potentialComponentId = translateComponentId(`${node.componentId}_component`, registry.getMapping()); // The component definition has a different ID than the representation in the normal tree

  const boundLocalComponent = registry.getComponents().get(potentialComponentId);

  if (boundLocalComponent) {
    // If no override Penpot expects by default the instance node to have the same name than the component defition
    // so due to Figma having variants and not Penpot, we have to force the name
    const instanceOverrides = registry.getOverrides(node.id);
    const overrideNameField: keyof typeof syncAttributes = 'name';
    if (instanceOverrides && !instanceOverrides.includes(overrideNameField)) {
      instanceFrame.name = boundLocalComponent.name; // In case of a variant
    }

    instanceFrame.componentFile = translateDocumentId('current', registry.getMapping());
    instanceFrame.componentId = potentialComponentId;

    // The `transformInheritance` is working in all cases except for instance node
    // since Figma may set them a node ID without the original shape, so as fallback we use the main instance node ID
    // to match the Penpot expectations
    if (!instanceFrame.shapeRef) {
      instanceFrame.shapeRef = boundLocalComponent.mainInstanceId;
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

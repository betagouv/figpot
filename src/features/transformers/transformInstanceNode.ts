import { InstanceNode, Transform } from '@figpot/src/clients/figma';
import { transformFrameNode } from '@figpot/src/features/transformers/transformFrameNode';
import { nullId } from '@figpot/src/features/translators/translateId';
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

  // Three cases on resolution:
  //  - Local component (`isRemote === false`): bind to the same Penpot file we are syncing into
  //  - Remote component with a known library (`isRemote === true, file !== undefined`): bind to
  //    the user-declared Penpot library file via `componentFile` / `componentId`. Penpot resolves
  //    the definition through `postLinkFileToLibrary` (called at the end of synchronize)
  //  - Remote component with no library mapping, OR unknown component: leave all fields nulled so
  //    Penpot keeps the instance shape but does not try to resolve a definition that does not
  //    exist on its side
  const binding = registry.resolveComponent(node.componentId);

  if (binding && !binding.isRemote && binding.file !== undefined) {
    const boundLocalComponent = registry.getComponents().get(binding.id);

    if (boundLocalComponent) {
      // If no override Penpot expects by default the instance node to have the same name than the component defition
      // so due to Figma having variants and not Penpot, we have to force the name
      const instanceOverrides = registry.getOverrides(node.id);
      const overrideNameField: keyof typeof syncAttributes = 'name';
      if (instanceOverrides && !instanceOverrides.includes(overrideNameField)) {
        instanceFrame.name = boundLocalComponent.name;
      }

      instanceFrame.componentFile = binding.file;
      instanceFrame.componentId = binding.id;

      // `transformInheritance` works in all cases except for instance nodes since Figma may set
      // them a node ID without the original shape, so as a fallback we use the main instance
      // node ID to match Penpot's expectations
      if (!instanceFrame.shapeRef) {
        instanceFrame.shapeRef = boundLocalComponent.mainInstanceId;
      }

      return instanceFrame;
    } else {
      // Local binding but no matching component on the registry (should not happen in practice), will fall back to no reference
    }
  } else if (binding && binding.isRemote && binding.file !== undefined) {
    instanceFrame.componentFile = binding.file;
    instanceFrame.componentId = binding.id;

    // If `transformInheritance()` has considered it's the main instance, this value is already set
    if (!instanceFrame.shapeRef) {
      instanceFrame.shapeRef = binding.mainShapeId;
    }

    return instanceFrame;
  }

  instanceFrame.componentFile = nullId;
  instanceFrame.componentId = nullId;
  instanceFrame.shapeRef = nullId;

  return instanceFrame;
}

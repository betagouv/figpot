import { SubcanvasNode } from '@figpot/src/clients/figma';
import { transformOverrides } from '@figpot/src/features/transformers/partials/transformOverrides';
import { translateId } from '@figpot/src/features/translators/translateId';
import { ShapeAttributes } from '@figpot/src/models/entities/penpot/shape';
import { AbstractRegistry } from '@figpot/src/models/entities/registry';

export function transformInheritance(registry: AbstractRegistry, node: Pick<SubcanvasNode, 'id'>): Pick<ShapeAttributes, 'shapeRef'> {
  // The Penpot `componentId` property refers to the component definition ID linked to a main instance
  // But when instanciating a component, all children needs to refer to their original shape via the `shapeRef` (even if not a component instance)
  // There is no trivial property for this but Figma makes this pattern visible through the node ID by removing the first part
  //
  // Note: by using a valid `shapeRef` the frontend will automatically override instance properties with those from the main component
  // so it's important the `touched` property is specified to keep those changes
  const parts = node.id.split(';');

  const mainInstanceFound = parts.length > 1;

  if (mainInstanceFound) {
    return {
      shapeRef: translateId(parts.splice(1).join(';'), registry.getMapping()),
      ...transformOverrides(registry, node), // The overrides have sense only if we have linked a `shapeRef`
    };
  } else {
    return {};
  }
}

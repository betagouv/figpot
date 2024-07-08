import { SubcanvasNode } from '@figpot/src/clients/figma';
import { translateId } from '@figpot/src/features/translators/translateId';
import { ShapeAttributes } from '@figpot/src/models/entities/penpot/shape';
import { AbstractRegistry } from '@figpot/src/models/entities/registry';

export function transformInheritance(registry: AbstractRegistry, node: Pick<SubcanvasNode, 'id'>): Pick<ShapeAttributes, 'shapeRef'> {
  // The Penpot `componentId` property refers to the component definition ID linked to a main instance
  // But when instanciating a component, all children needs to refer to their original shape via the `shapeRef` (even if not a component instance)
  // There is no trivial property for this but Figma makes this pattern visible through the node ID by removing the first part
  //
  // Note: by using a valid `shapeRef` the backend will automatically fill the `touched` property which contains
  // some metadata about overrides compared to the original shape. So no need to use `translateTouched()` at all
  const parts = node.id.split(';');

  return {
    shapeRef: parts.length > 1 ? translateId(parts.splice(1).join(';'), registry.getMapping()) : undefined,
  };
}

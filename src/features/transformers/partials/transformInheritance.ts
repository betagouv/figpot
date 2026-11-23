import { SubcanvasNode } from '@figpot/src/clients/figma';
import { getRelatedNodeId } from '@figpot/src/features/transformers/partials/transformInstanceSwaps';
import { transformOverrides } from '@figpot/src/features/transformers/partials/transformOverrides';
import { translateComponentShapeId } from '@figpot/src/features/translators/translateId';
import { ShapeAttributes } from '@figpot/src/models/entities/penpot/shape';
import { AbstractRegistry } from '@figpot/src/models/entities/registry';

export function transformInheritance(registry: AbstractRegistry, node: Pick<SubcanvasNode, 'id'>): Pick<ShapeAttributes, 'shapeRef'> {
  // The Penpot `componentId` property refers to the component definition ID linked to a main instance
  // But when instanciating a component, all children needs to refer to their original shape via the `shapeRef` (even if not a component instance)
  // There is no trivial property for this but Figma makes this pattern visible through the node ID by removing the first part
  //
  // Note: by using a valid `shapeRef` the frontend will automatically override instance properties with those from the main component
  // so it's important the `touched` property is specified to keep those changes
  // Note: inside a swapped instance, the reference is relative to the new component (see `transformInstanceSwaps`)
  const relatedNodeId = getRelatedNodeId(node.id);

  if (relatedNodeId) {
    // It must target the component definition equivalent, so it's deterministic
    return {
      shapeRef: translateComponentShapeId(relatedNodeId),
      ...transformOverrides(registry, node), // The overrides have sense only if we have linked a `shapeRef`
    };
  } else {
    return {};
  }
}

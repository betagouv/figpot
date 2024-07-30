import { SubcanvasNode } from '@figpot/src/clients/figma';
import { translateTouched } from '@figpot/src/features/translators/translateTouched';
import { ShapeAttributes } from '@figpot/src/models/entities/penpot/shape';
import { AbstractRegistry } from '@figpot/src/models/entities/registry';

export function transformOverrides(
  registry: AbstractRegistry,
  node: Pick<SubcanvasNode, 'id' | 'componentPropertyReferences'>
): Pick<ShapeAttributes, 'touched'> {
  // Get overrides from the closest parent component instance
  // But some are not specified inside so patching these overrides with the ones specified at the component level
  let overrides = registry.getOverrides(node.id);

  if (node.componentPropertyReferences) {
    if (!overrides) {
      overrides = [];
    }

    const overridenProperties = Object.keys(node.componentPropertyReferences);

    for (const property of overridenProperties) {
      // They are specified the same way than for instance `overriddenFields` so just merging the value
      // Note: there is no typing directly, we could add them checking again `node.type` to be sure it can be overriden but it would make no sense
      if (overrides.indexOf(property) === -1) {
        overrides.push(property);
      }
    }
  }

  return {
    touched: translateTouched(overrides),
  };
}

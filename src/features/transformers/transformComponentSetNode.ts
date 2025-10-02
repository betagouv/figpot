import { ComponentSetNode, Transform } from '@figpot/src/clients/figma';
import { transformFrameNode } from '@figpot/src/features/transformers/transformFrameNode';
import { FrameShape } from '@figpot/src/models/entities/penpot/shapes/frame';
import { AbstractRegistry } from '@figpot/src/models/entities/registry';

export function transformComponentSetNode(registry: AbstractRegistry, node: ComponentSetNode, figmaNodeTransform: Transform): Omit<FrameShape, 'id'> {
  // The component sets (and components) are registered at the document node level
  // But still, we use the current one as a frame so it can inherit from Figma style (stroke, radius, auto layout...)

  // Wee have to weak the children order since on Figma the default variant will be the one at the most left (and then at the most top)
  // whereas on Penpot it's the one first in the list of layers
  //
  // If multiple variants are on the same exact position, Figma does not trigger a change of default (so there is no easy way to know from positions the default one)
  // The best is to analyze literal default values and try to find the right one in variants to put it at the end of children (will end at first in layers view)
  if (node.componentPropertyDefinitions) {
    const definitions = Object.entries(node.componentPropertyDefinitions);
    const defaultProperties = new Map<string, string | boolean>();

    for (const [definitionName, definition] of definitions) {
      // Only those typed as "variant" mean properties
      if (definition.type === 'VARIANT') {
        // There is no ID to retrieve the right component with those information so we have to keep track of visible properties names and values
        defaultProperties.set(definitionName, definition.defaultValue);
      }
    }

    // Now look for the default child
    childrenLoop: for (let i = 0; i < node.children.length; i++) {
      const propertiesPairs = node.children[i].name.split(',');

      let defaultPropertiesFound = 0;

      for (const propertyPair of propertiesPairs) {
        const parts = propertyPair.split('=').map(
          (part) => part.trim() // We trim the input since the separation are not strict (can be ` = ` or  `=` or ` =`, same for `,`)
        );

        // In case the parsing gives a weird result, just skip the property
        if (parts.length !== 2) {
          continue;
        }

        const [name, value] = parts;

        // Check the pair is a default one
        if (defaultProperties.get(name) === value) {
          defaultPropertiesFound++;

          // If we find the expected amount of default properties, it means this variant is the default one
          if (defaultPropertiesFound === defaultProperties.size) {
            const current = node.children.splice(i, 1)[0]; // Remove and get the removed value

            node.children.push(current);

            break childrenLoop;
          }
        }
      }
    }
  }

  return {
    ...transformFrameNode(registry, node, figmaNodeTransform),
    isVariantContainer: true,
  };
}

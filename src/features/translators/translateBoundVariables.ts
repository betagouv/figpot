import { RGBA, VariableAlias } from '@figpot/src/clients/figma';
import { translateColorId, translateDocumentId } from '@figpot/src/features/translators/translateId';
import { Color } from '@figpot/src/models/entities/penpot/traits/color';
import { BoundVariableRegistry } from '@figpot/src/models/entities/registry';
import { rgbToHex } from '@figpot/src/utils/color';

export function translateBoundVariables(
  registry: BoundVariableRegistry,
  initialColor: RGBA,
  boundVariables?: { color?: VariableAlias }
): Pick<Color, 'refId' | 'refFile'> {
  if (boundVariables?.color && boundVariables.color.type === 'VARIABLE_ALIAS') {
    // TODO: check with the Figma color getter endpoint if the value `VariableID:88:53` must be converted to `88:53` or not for the `id` property
    const registryColors = registry.getColors();
    const boundPenpotColorId = translateColorId(boundVariables.color.id, registry.getMapping());

    // If due to Figma plan we were not able to retrieve variables, we hack a bit
    const boundPenpotColor = registryColors.get(boundPenpotColorId);
    if (!boundPenpotColor) {
      registryColors.set(boundPenpotColorId, {
        id: boundPenpotColorId,
        path: 'No name',
        name: `Color ${boundVariables.color.id.replace('VariableID:', '')}`, // Give a constant name so it does not change everytime
        color: rgbToHex(initialColor),
        opacity: initialColor.a,
      });
    } else if (!boundPenpotColor.color) {
      // If existing and since they are multiple possible mode inside Figma, we override the value to be sure using the right current mode
      // Note: it's hacky but we are fine until having a proper way of managing variable modes
      boundPenpotColor.color = rgbToHex(initialColor);
      boundPenpotColor.opacity = initialColor.a;
    }

    return {
      refId: boundPenpotColorId,
      refFile: translateDocumentId('current', registry.getMapping()),
    };
  }

  return {
    refId: undefined,
    refFile: undefined,
  };
}

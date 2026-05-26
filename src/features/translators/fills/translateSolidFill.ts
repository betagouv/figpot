import { SolidPaint } from '@figpot/src/clients/figma';
import { translateOpacityWithVisibility } from '@figpot/src/features/translators/fills/translateOpacity';
import { Fill } from '@figpot/src/models/entities/penpot/traits/fill';
import { BoundVariableRegistry } from '@figpot/src/models/entities/registry';
import { rgbToHex } from '@figpot/src/utils/color';

export function translateSolidFill(registry: BoundVariableRegistry, fill: SolidPaint): Fill {
  // When the paint is bound to a colour variable, ask the registry for the variable's default-mode
  // value (an already-Penpot-shape hex string). The static fill then matches whatever the active
  // token theme would resolve to on load, instead of freezing on the per-frame-overridden value
  // Figma sent us. Unconditional override is a no-op for variables not affected by a per-frame
  // override (their Figma value already equals the default mode)
  const colorAliasId = fill.boundVariables?.color?.id;
  const defaultColorHex = colorAliasId !== undefined ? registry.getVariableDefaultValueForBinding(colorAliasId, 'color') : undefined;
  const fillColor = typeof defaultColorHex === 'string' ? defaultColorHex : rgbToHex(fill.color);

  return {
    fillColor: fillColor,
    fillOpacity: translateOpacityWithVisibility(fill),
  };
}

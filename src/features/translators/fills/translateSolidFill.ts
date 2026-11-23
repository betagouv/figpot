import { SolidPaint } from '@figpot/src/clients/figma';
import { translateOpacityWithVisibility } from '@figpot/src/features/translators/fills/translateOpacity';
import { Fill } from '@figpot/src/models/entities/penpot/traits/fill';
import { BoundVariableRegistry } from '@figpot/src/models/entities/registry';
import { rgbToHex } from '@figpot/src/utils/color';

export function translateSolidFill(_registry: BoundVariableRegistry, fill: SolidPaint): Fill {
  // We deliberately do NOT rewrite the colour to a variable's default-mode value at sync time:
  // Penpot opens with no theme active so the canvas should mirror whatever Figma rendered for this
  // node, including any per-frame `explicitVariableModes` override. Toggling a theme in Penpot
  // later drives the rebind globally via `appliedTokens.fill`
  return {
    fillColor: rgbToHex(fill.color),
    fillOpacity: translateOpacityWithVisibility(fill),
  };
}

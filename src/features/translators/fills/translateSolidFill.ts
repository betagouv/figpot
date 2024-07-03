import { SolidPaint } from '@figpot/src/clients/figma';
import { translateOpacityWithVisibility } from '@figpot/src/features/translators/fills/translateOpacity';
import { translateBoundVariables } from '@figpot/src/features/translators/translateBoundVariables';
import { Fill } from '@figpot/src/models/entities/penpot/traits/fill';
import { PageRegistry } from '@figpot/src/models/entities/registry';
import { rgbToHex } from '@figpot/src/utils/color';

export function translateSolidFill(registry: PageRegistry, fill: SolidPaint): Fill {
  const colorRef = translateBoundVariables(registry, fill.color, fill.boundVariables);

  return {
    fillColor: rgbToHex(fill.color),
    fillOpacity: translateOpacityWithVisibility(fill),
    fillColorRefId: colorRef.refId,
    fillColorRefFile: colorRef.refFile,
  };
}

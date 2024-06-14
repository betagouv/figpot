import { SolidPaint } from '@figpot/src/clients/figma';
import { translateOpacity } from '@figpot/src/features/translators/fills/translateOpacity';
import { Fill } from '@figpot/src/models/entities/penpot/traits/fill';
import { rgbToHex } from '@figpot/src/utils/color';

export function translateSolidFill(fill: SolidPaint): Fill {
  return {
    fillColor: rgbToHex(fill.color),
    fillOpacity: translateOpacity(fill),
  };
}

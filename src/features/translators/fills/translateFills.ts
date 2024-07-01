import { Paint } from '@figpot/src/clients/figma';
import { MappingType } from '@figpot/src/features/document';
import { translateGradientLinearFill } from '@figpot/src/features/translators/fills/gradients/translateGradientLinearFill';
import { translateGradientRadialFill } from '@figpot/src/features/translators/fills/gradients/translateGradientRadialFill';
import { translateImageFill } from '@figpot/src/features/translators/fills/translateImageFill';
import { translateSolidFill } from '@figpot/src/features/translators/fills/translateSolidFill';
import { Fill } from '@figpot/src/models/entities/penpot/traits/fill';
import { rgbToHex } from '@figpot/src/utils/color';

export function translateFill(fill: Paint, mapping: MappingType): Fill | undefined {
  switch (fill.type) {
    case 'SOLID':
      return translateSolidFill(fill);
    case 'GRADIENT_LINEAR':
      return translateGradientLinearFill(fill);
    case 'GRADIENT_RADIAL':
      return translateGradientRadialFill(fill);
    case 'IMAGE':
      return translateImageFill(fill, mapping);
  }

  console.error(`Unsupported fill type: ${fill.type}`);
}

export function translateFills(fills: readonly Paint[] | undefined, mapping: MappingType): Fill[] {
  if (fills === undefined) return [];

  const penpotFills: Fill[] = [];

  for (const fill of fills) {
    const penpotFill = translateFill(fill, mapping);

    if (penpotFill) {
      // fills are applied in reverse order in Figma, that's why we unshift
      penpotFills.unshift(penpotFill);
    }
  }

  return penpotFills;
}

export function translatePageFill(fill: Paint): string | undefined {
  switch (fill.type) {
    case 'SOLID':
      return rgbToHex(fill.color);
  }

  console.error(`Unsupported page fill type: ${fill.type}`);
}

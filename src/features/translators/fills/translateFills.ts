import { Paint } from '@figpot/src/clients/figma';
import { translateGradientLinearFill } from '@figpot/src/features/translators/fills/gradients/translateGradientLinearFill';
import { translateGradientRadialFill } from '@figpot/src/features/translators/fills/gradients/translateGradientRadialFill';
import { translateImageFill } from '@figpot/src/features/translators/fills/translateImageFill';
import { translateSolidFill } from '@figpot/src/features/translators/fills/translateSolidFill';
import { Fill } from '@figpot/src/models/entities/penpot/traits/fill';
import { BoundVariableRegistry } from '@figpot/src/models/entities/registry';
import { rgbToHex } from '@figpot/src/utils/color';

export function translateFill(registry: BoundVariableRegistry, fill: Paint): Fill | undefined {
  switch (fill.type) {
    case 'SOLID':
      return translateSolidFill(registry, fill);
    case 'GRADIENT_LINEAR':
      return translateGradientLinearFill(registry, fill);
    case 'GRADIENT_RADIAL':
      return translateGradientRadialFill(registry, fill);
    case 'IMAGE':
      return translateImageFill(registry, fill);
  }

  console.error(`Unsupported fill type: ${fill.type}`);
}

export function translateFills(registry: BoundVariableRegistry, fills: readonly Paint[] | undefined): Fill[] {
  if (fills === undefined) return [];

  const penpotFills: Fill[] = [];

  for (const fill of fills) {
    const penpotFill = translateFill(registry, fill);

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

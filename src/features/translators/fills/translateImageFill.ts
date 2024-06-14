import { ImagePaint } from '@figpot/src/clients/figma';
import { translateOpacity } from '@figpot/src/features/translators/fills/translateOpacity';
import { Fill } from '@figpot/src/models/entities/penpot/traits/fill';

export function translateImageFill(fill: ImagePaint): Fill | undefined {
  return {
    fillOpacity: translateOpacity(fill),
  };
}

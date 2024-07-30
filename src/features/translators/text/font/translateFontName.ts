import { TypeStyle } from '@figpot/src/clients/figma';
import { translateCustomFont } from '@figpot/src/features/translators/text/font/custom/translateCustomFont';
import { translateGoogleFont } from '@figpot/src/features/translators/text/font/gfonts/translateGoogleFont';
import { translateLocalFont } from '@figpot/src/features/translators/text/font/local/translateLocalFont';
import { translateFontWeight } from '@figpot/src/features/translators/text/properties/translateFontWeight';
import { TextTypography } from '@figpot/src/models/entities/penpot/shapes/text';
import { BoundVariableRegistry } from '@figpot/src/models/entities/registry';

export function translateFontName(
  registry: BoundVariableRegistry,
  fontName: TypeStyle
): Pick<TextTypography, 'fontId' | 'fontVariantId' | 'fontWeight'> | undefined {
  const fontWeight = translateFontWeight(fontName);

  return translateGoogleFont(fontName, fontWeight) ?? translateLocalFont(fontName, fontWeight) ?? translateCustomFont(registry, fontName, fontWeight);
}

import { TypeStyle } from '@figpot/src/clients/figma';
import { MappingType } from '@figpot/src/features/document';
import { translateCustomFont } from '@figpot/src/features/translators/text/font/custom/translateCustomFont';
import { translateGoogleFont } from '@figpot/src/features/translators/text/font/gfonts/translateGoogleFont';
import { translateLocalFont } from '@figpot/src/features/translators/text/font/local/translateLocalFont';
import { translateFontWeight } from '@figpot/src/features/translators/text/properties/translateFontWeight';
import { TextTypography } from '@figpot/src/models/entities/penpot/shapes/text';

export function translateFontName(
  fontName: TypeStyle,
  mapping: MappingType
): Pick<TextTypography, 'fontId' | 'fontVariantId' | 'fontWeight'> | undefined {
  const fontWeight = translateFontWeight(fontName);

  return translateGoogleFont(fontName, fontWeight) ?? translateLocalFont(fontName, fontWeight) ?? translateCustomFont(fontName, fontWeight, mapping);
}

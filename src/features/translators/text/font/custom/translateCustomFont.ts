import { TypeStyle } from '@figpot/src/clients/figma';
import { getCustomFontId } from '@figpot/src/features/translators/text/font/custom/customFontIds';
import { translateFontVariantId } from '@figpot/src/features/translators/text/font/custom/translateFontVariantId';
import { TextTypography } from '@figpot/src/models/entities/penpot/shapes/text';

export function translateCustomFont(
  fontName: TypeStyle,
  fontWeight: string
): Pick<TextTypography, 'fontId' | 'fontVariantId' | 'fontWeight'> | undefined {
  const customFontId = getCustomFontId(fontName);

  return {
    fontId: customFontId ? `custom-${customFontId}` : '',
    fontVariantId: translateFontVariantId(fontName, fontWeight),
    fontWeight,
  };
}

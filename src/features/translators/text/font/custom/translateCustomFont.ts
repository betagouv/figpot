import { TypeStyle } from '@figpot/src/clients/figma';
import { MappingType } from '@figpot/src/features/document';
import { translateFontVariantId } from '@figpot/src/features/translators/text/font/custom/translateFontVariantId';
import { translateFontId } from '@figpot/src/features/translators/translateId';
import { TextTypography } from '@figpot/src/models/entities/penpot/shapes/text';

export function translateCustomFont(
  fontName: TypeStyle,
  fontWeight: string,
  mapping: MappingType
): Pick<TextTypography, 'fontId' | 'fontVariantId' | 'fontWeight'> | undefined {
  const penpotFontVariantId = translateFontVariantId(fontName, fontWeight);
  const simulatedFigmaFontVariantId = `${fontName.fontFamily}-${penpotFontVariantId}`; // Use to be consistent across synchronizations

  return {
    fontId: translateFontId(simulatedFigmaFontVariantId, fontName, mapping),
    fontVariantId: translateFontVariantId(fontName, fontWeight),
    fontWeight: fontWeight,
  };
}

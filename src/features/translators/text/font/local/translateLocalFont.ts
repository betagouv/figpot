import { TypeStyle } from '@figpot/src/clients/figma';
import { LocalFont } from '@figpot/src/features/translators/text/font/local/localFont';
import localFontsFile from '@figpot/src/features/translators/text/font/local/localFonts.json';
import { translateFontVariantId } from '@figpot/src/features/translators/text/font/local/translateFontVariantId';
import { TextTypography } from '@figpot/src/models/entities/penpot/shapes/text';
import { workaroundAssert as assert } from '@figpot/src/utils/assert';

const localFonts = localFontsFile.items;

function getLocalFont(fontFamily: string): LocalFont | undefined {
  return localFonts.find((localFont) => localFont.name === fontFamily);
}

export function isLocalFont(fontName: TypeStyle): boolean {
  return fontName.fontFamily ? getLocalFont(fontName.fontFamily) !== undefined : false;
}

export function translateLocalFont(
  fontName: TypeStyle,
  fontWeight: string
): Pick<TextTypography, 'fontId' | 'fontVariantId' | 'fontWeight'> | undefined {
  assert(fontName.fontFamily);

  const localFont = getLocalFont(fontName.fontFamily);

  if (localFont === undefined) {
    return;
  }

  return {
    fontId: localFont.id,
    fontVariantId: translateFontVariantId(localFont, fontName, fontWeight),
    fontWeight,
  };
}

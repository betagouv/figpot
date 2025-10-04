import slugify from 'slugify';

import { TypeStyle } from '@figpot/src/clients/figma';
import gfontsFile from '@figpot/src/features/translators/text/font/gfonts/gfonts.json';
import { GoogleFont } from '@figpot/src/features/translators/text/font/gfonts/googleFont';
import { translateFontVariantId } from '@figpot/src/features/translators/text/font/gfonts/translateFontVariantId';
import { TextTypography } from '@figpot/src/models/entities/penpot/shapes/text';
import { workaroundAssert as assert } from '@figpot/src/utils/assert';
import { Cache } from '@figpot/src/utils/cache';

const gfonts = gfontsFile.items;
const fontsCache = new Cache<string, GoogleFont>({ max: 30 });

function getGoogleFont(fontFamily: string): GoogleFont | undefined {
  return fontsCache.get(fontFamily, () => gfonts.find((font) => font.family === fontFamily));
}

export function isGoogleFont(fontName: TypeStyle): boolean {
  return fontName.fontFamily ? getGoogleFont(fontName.fontFamily) !== undefined : false;
}

export function translateGoogleFont(
  fontName: TypeStyle,
  fontWeight: string
): Pick<TextTypography, 'fontId' | 'fontVariantId' | 'fontWeight'> | undefined {
  assert(fontName.fontFamily);

  const googleFont = getGoogleFont(fontName.fontFamily);

  if (googleFont === undefined) {
    return;
  }

  return {
    fontId: `gfont-${slugify(fontName.fontFamily.toLowerCase())}`,
    fontVariantId: translateFontVariantId(googleFont, fontName, fontWeight),
    fontWeight: fontWeight,
  };
}

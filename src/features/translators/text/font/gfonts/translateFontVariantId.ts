import { TypeStyle } from '@figpot/src/clients/figma';
import { GoogleFont } from '@figpot/src/features/translators/text/font/gfonts/googleFont';

export function translateFontVariantId(googleFont: GoogleFont, fontName: TypeStyle, fontWeight: string) {
  // check match by style and weight
  const suffix = fontName.italic ? 'italic' : '';
  const styleWithWeight = `${fontWeight}${suffix}`;
  const variantWithWeight = googleFont.variants?.find((variant) => variant === styleWithWeight);

  if (variantWithWeight !== undefined) {
    return variantWithWeight;
  }

  // check match directly by style
  const style = fontName.italic ? 'italic' : 'regular';
  const variant = googleFont.variants?.find((variant) => variant === style);

  return variant ?? 'regular'; // Seems this default would be acceptable
}

import { TypeStyle } from '@figpot/src/clients/figma';
import { LocalFont } from '@figpot/src/features/translators/text/font/local/localFont';
import { extractFontFamilySuffix } from '@figpot/src/features/translators/text/properties/translateFontFamily';

export function translateFontVariantId(localFont: LocalFont, fontName: TypeStyle, fontWeight: string): string | undefined {
  // check match by style and weight
  const style = fontName.italic ? 'italic' : 'normal';
  const variantWithStyleWeight = localFont.variants?.find((variant) => variant.weight === fontWeight && style);

  if (variantWithStyleWeight !== undefined) {
    return variantWithStyleWeight.id;
  }

  const potentialSuffix = extractFontFamilySuffix(fontName);

  // check match directly by suffix if exists
  const variant = localFont.variants?.find((variant) => variant.suffix === potentialSuffix);

  if (variant !== undefined) {
    return variant.id;
  }

  // check match directly by id
  const variantById = localFont.variants?.find((variant) => variant.id === potentialSuffix);

  if (variantById !== undefined) {
    return variantById.id;
  }
}

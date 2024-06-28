import { TypeStyle } from '@figpot/src/clients/figma';
import { extractFontFamilySuffix } from '@figpot/src/features/translators/text/properties/translateFontFamily';

export function translateFontWeight(fontName: TypeStyle): string {
  const potentialSuffix = extractFontFamilySuffix(fontName);

  switch (potentialSuffix) {
    case 'Thin':
    case 'ThinItalic':
      return '100';
    case 'ExtraLight':
    case 'ExtraLightItalic':
      return '200';
    case 'Light':
    case 'LightItalic':
      return '300';
    case 'Regular':
    case 'Italic':
      return '400';
    case 'Medium':
    case 'MediumItalic':
      return '500';
    case 'SemiBold':
    case 'SemiBoldItalic':
      return '600';
    case 'Bold':
    case 'BoldItalic':
      return '700';
    case 'ExtraBold':
    case 'ExtraBoldItalic':
      return '800';
    case 'Black':
    case 'BlackItalic':
      return '900';
    default:
      return '400';
  }
}

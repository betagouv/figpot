import { TypeStyle } from '@figpot/src/clients/figma';
import { workaroundAssert as assert } from '@figpot/src/utils/assert';

export function translateLineHeight(segment: Pick<TypeStyle, 'lineHeightPx' | 'lineHeightPercentFontSize' | 'lineHeightUnit' | 'fontSize'>): string {
  assert(segment.fontSize);
  assert(segment.lineHeightPx);

  switch (segment.lineHeightUnit) {
    case 'FONT_SIZE_%':
      return ((segment.fontSize / 100) * (segment.lineHeightPercentFontSize ?? 100)).toString();
    case 'INTRINSIC_%': // This one seems to fit automatically the font size
      return '1';
    case 'PIXELS':
    default:
      return (segment.lineHeightPx / segment.fontSize).toString();
  }
}

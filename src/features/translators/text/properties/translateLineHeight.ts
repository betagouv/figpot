import { TypeStyle } from '@figpot/src/clients/figma';
import { workaroundAssert as assert } from '@figpot/src/utils/assert';

export function translateLineHeight(segment: Pick<TypeStyle, 'lineHeightPx' | 'lineHeightPercentFontSize' | 'lineHeightUnit' | 'fontSize'>): string {
  assert(segment.fontSize !== undefined && segment.fontSize > 0); // If setting 0 in Figma is automatically goes to 1px
  assert(segment.lineHeightPx !== undefined);

  // Penpot's line height is a unitless ratio of the font size. Figma always exposes the resolved line height
  // in pixels (`lineHeightPx`), whatever unit it was authored with (`PIXELS`, `FONT_SIZE_%`, `INTRINSIC_%`),
  // so dividing it by the font size always yields the correct ratio
  return (segment.lineHeightPx / segment.fontSize).toString();
}

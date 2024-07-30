import assert from 'assert';

import { TypeStyle } from '@figpot/src/clients/figma';

// Extract `ExtraLight` from `OpenSans-ExtraLight` or `Open Sans-Extra Light` for example
export function extractFontFamilySuffix(fontName: Pick<TypeStyle, 'fontPostScriptName' | 'fontFamily'>): string {
  assert(fontName.fontFamily);

  if (fontName.fontPostScriptName) {
    // Remove spaces and split
    const parts = fontName.fontPostScriptName.replace(/\s/g, '').split('-');

    return parts[parts.length - 1];
  } else {
    return '';
  }
}

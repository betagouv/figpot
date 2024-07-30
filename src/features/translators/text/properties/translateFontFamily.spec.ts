import { extractFontFamilySuffix } from '@figpot/src/features/translators/text/properties/translateFontFamily';

describe('transformTextNode()', () => {
  it('should be equivalent', () => {
    const suffix = extractFontFamilySuffix({
      fontFamily: 'Open Sans',
      fontPostScriptName: 'OpenSans-ExtraBoldItalic',
    });

    expect(suffix).toBe('ExtraBoldItalic');

    const suffix2 = extractFontFamilySuffix({
      fontFamily: 'Open Sans',
      fontPostScriptName: 'Open Sans - Extra Bold Italic',
    });

    expect(suffix2).toBe('ExtraBoldItalic');
  });
});

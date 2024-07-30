import { TypeStyle } from '@figpot/src/clients/figma';

export function translateFontVariantId(fontName: TypeStyle, fontWeight: string) {
  const style = fontName.italic === true ? 'italic' : 'normal';

  return `${style}-${fontWeight}`;
}

import { TypeStyle } from '@figpot/src/clients/figma';

const customFontIds = new Map<string, string>();

export function getCustomFontId(fontName: TypeStyle) {
  return fontName.fontFamily ? customFontIds.get(fontName.fontFamily) : undefined;
}

export function setCustomFontId(fontFamily: string, fontId: string) {
  customFontIds.set(fontFamily, fontId);
}

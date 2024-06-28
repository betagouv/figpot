import { TypeStyle } from '@figpot/src/clients/figma';
import { TextFontStyle } from '@figpot/src/models/entities/penpot/shapes/text';

export function translateFontStyle(node: Pick<TypeStyle, 'italic'>): TextFontStyle {
  return node.italic ? 'italic' : 'normal';
}

import { BaseTypeStyle } from '@figpot/src/clients/figma';
import { TextHorizontalAlign } from '@figpot/src/models/entities/penpot/shapes/text';

export function translateHorizontalAlign(align: BaseTypeStyle['textAlignHorizontal']): TextHorizontalAlign {
  switch (align) {
    case 'RIGHT':
      return 'right';
    case 'CENTER':
      return 'center';
    case 'JUSTIFIED':
      return 'justify';
    default:
      return 'left';
  }
}

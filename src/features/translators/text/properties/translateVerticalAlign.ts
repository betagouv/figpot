import { BaseTypeStyle } from '@figpot/src/clients/figma';
import { TextVerticalAlign } from '@figpot/src/models/entities/penpot/shapes/text';

export function translateVerticalAlign(align: BaseTypeStyle['textAlignVertical']): TextVerticalAlign {
  switch (align) {
    case 'BOTTOM':
      return 'bottom';
    case 'CENTER':
      return 'center';
    default:
      return 'top';
  }
}

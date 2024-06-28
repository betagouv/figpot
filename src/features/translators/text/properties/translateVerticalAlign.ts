import { textAlignVertical } from '@figpot/src/clients/figma';
import { TextVerticalAlign } from '@figpot/src/models/entities/penpot/shapes/text';

export function translateVerticalAlign(align: textAlignVertical | undefined): TextVerticalAlign {
  switch (align) {
    case 'BOTTOM':
      return 'bottom';
    case 'CENTER':
      return 'center';
    default:
      return 'top';
  }
}

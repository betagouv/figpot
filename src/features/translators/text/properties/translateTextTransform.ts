import { TypeStyle } from '@figpot/src/clients/figma';

export function translateTextTransform(segment: Pick<TypeStyle, 'textCase'>): string {
  switch (segment.textCase) {
    case 'UPPER':
      return 'uppercase';
    case 'LOWER':
      return 'lowercase';
    case 'TITLE':
      return 'capitalize';
    case 'SMALL_CAPS':
    case 'SMALL_CAPS_FORCED':
    default:
      return 'none';
  }
}

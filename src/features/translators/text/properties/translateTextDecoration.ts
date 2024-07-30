import { TypeStyle } from '@figpot/src/clients/figma';

export function translateTextDecoration(segment: Pick<TypeStyle, 'textDecoration'>) {
  switch (segment.textDecoration) {
    case 'STRIKETHROUGH':
      return 'line-through';
    case 'UNDERLINE':
      return 'underline';
    default:
      return 'none';
  }
}

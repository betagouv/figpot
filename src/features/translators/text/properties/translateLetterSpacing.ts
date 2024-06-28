import { TypeStyle } from '@figpot/src/clients/figma';

export function translateLetterSpacing(segment: Pick<TypeStyle, 'letterSpacing'>): string {
  return segment.letterSpacing ? segment.letterSpacing.toString() : '0';
}

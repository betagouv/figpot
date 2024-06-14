import { Paint } from '@figpot/src/clients/figma';

export function translateOpacity(fill: Pick<Paint, 'visible' | 'opacity'>): number {
  if (fill.visible === false) {
    return 0;
  } else if (fill.opacity !== undefined) {
    return fill.opacity;
  } else {
    return 1;
  }
}

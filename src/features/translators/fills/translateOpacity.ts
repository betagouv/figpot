import { Paint } from '@figpot/src/clients/figma';

export function translateOpacity(fill: Pick<Paint, 'opacity'>): number {
  if (fill.opacity !== undefined) {
    return fill.opacity;
  } else {
    return 1;
  }
}

export function translateOpacityWithVisibility(fill: Pick<Paint, 'visible' | 'opacity'>): number {
  if (fill.visible === false) {
    return 0;
  } else {
    return translateOpacity(fill);
  }
}

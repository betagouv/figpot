import { Effect } from '@figpot/src/clients/figma';
import { Blur } from '@figpot/src/models/entities/penpot/traits/blur';

export function translateBlurEffects(effect: readonly Effect[]): Blur | undefined {
  const blur = effect.find((effect) => effect.type === 'BACKGROUND_BLUR');

  if (!blur) {
    return;
  }

  return {
    type: 'layer-blur',
    value: blur.radius,
    hidden: !blur.visible,
  };
}

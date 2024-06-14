import assert from 'assert';

import { DropShadowEffect, Effect, InnerShadowEffect } from '@figpot/src/clients/figma';
import { Shadow, ShadowStyle } from '@figpot/src/models/entities/penpot/traits/shadow';
import { rgbToHex } from '@figpot/src/utils/color';

export function translateShadowEffect(effect: Effect): Shadow | undefined {
  if (effect.type !== 'DROP_SHADOW' && effect.type !== 'INNER_SHADOW') {
    return;
  }

  return {
    style: translateShadowType(effect),
    offsetX: effect.offset.x,
    offsetY: effect.offset.y,
    blur: effect.radius,
    spread: effect.spread ?? 0,
    hidden: !effect.visible,
    color: {
      color: rgbToHex(effect.color),
      opacity: effect.color.a,
    },
  };
}

export function translateShadowEffects(effects: readonly Effect[]): Shadow[] {
  const shadows: Shadow[] = [];

  for (const effect of effects) {
    const shadow = translateShadowEffect(effect);
    if (shadow) {
      // effects are applied in reverse order in Figma, that's why we unshift
      shadows.unshift(shadow);
    }
  }

  return shadows;
}

function translateShadowType(effect: DropShadowEffect | InnerShadowEffect): ShadowStyle {
  assert(effect.type);

  switch (effect.type) {
    case 'DROP_SHADOW':
      return 'drop-shadow';
    case 'INNER_SHADOW':
      return 'inner-shadow';
  }
}

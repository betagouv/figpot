import assert from 'assert';

import { DropShadowEffect, Effect, InnerShadowEffect } from '@figpot/src/clients/figma';
import { translateBoundVariables } from '@figpot/src/features/translators/translateBoundVariables';
import { translateId } from '@figpot/src/features/translators/translateId';
import { Shadow, ShadowStyle } from '@figpot/src/models/entities/penpot/traits/shadow';
import { PageRegistry } from '@figpot/src/models/entities/registry';
import { rgbToHex } from '@figpot/src/utils/color';

export function translateShadowEffect(registry: PageRegistry, effect: Effect): Shadow | undefined {
  if (effect.type !== 'DROP_SHADOW' && effect.type !== 'INNER_SHADOW') {
    return;
  }

  return {
    style: translateShadowType(effect),
    offsetX: effect.offset.x,
    offsetY: effect.offset.y,
    blur: effect.radius,
    spread: effect.spread ?? 0,
    hidden: effect.visible === false,
    color: {
      color: rgbToHex(effect.color),
      opacity: effect.color.a,
      ...translateBoundVariables(registry, effect.color, effect.boundVariables),
    },
  };
}

export function translateShadowEffects(registry: PageRegistry, effects: readonly Effect[], figmaNodeId: string): Shadow[] {
  const shadows: Shadow[] = [];

  for (const [effectIndex, effect] of Object.entries(effects)) {
    const shadow = translateShadowEffect(registry, effect);

    if (shadow) {
      // The backend is expecting the ID to set effects
      // Note: we use the array index to differenciate them as we have nothing else
      shadow.id = translateId(`${figmaNodeId}_shadowEffect_${effectIndex}`, registry.getMapping());

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

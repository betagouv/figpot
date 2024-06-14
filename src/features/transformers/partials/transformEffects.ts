import { HasEffectsTrait } from '@figpot/src/clients/figma';
import { translateBlurEffects } from '@figpot/src/features/translators/translateBlurEffects';
import { translateShadowEffects } from '@figpot/src/features/translators/translateShadowEffects';
import { ShapeAttributes } from '@figpot/src/models/entities/penpot/shape';

export function transformEffects(node: HasEffectsTrait): Pick<ShapeAttributes, 'shadow' | 'blur'> {
  return {
    shadow: translateShadowEffects(node.effects),
    blur: translateBlurEffects(node.effects),
  };
}

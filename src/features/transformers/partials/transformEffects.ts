import { HasEffectsTrait, SubcanvasNode } from '@figpot/src/clients/figma';
import { translateBlurEffects } from '@figpot/src/features/translators/translateBlurEffects';
import { translateShadowEffects } from '@figpot/src/features/translators/translateShadowEffects';
import { ShapeAttributes } from '@figpot/src/models/entities/penpot/shape';
import { AbstractRegistry } from '@figpot/src/models/entities/registry';

export function transformEffects(
  registry: AbstractRegistry,
  node: HasEffectsTrait & Pick<SubcanvasNode, 'id'>
): Pick<ShapeAttributes, 'shadow' | 'blur'> {
  return {
    shadow: translateShadowEffects(registry, node.effects, node.id),
    blur: translateBlurEffects(registry, node.effects, node.id),
  };
}

import { HasEffectsTrait, SubcanvasNode } from '@figpot/src/clients/figma';
import { MappingType } from '@figpot/src/features/document';
import { translateBlurEffects } from '@figpot/src/features/translators/translateBlurEffects';
import { translateShadowEffects } from '@figpot/src/features/translators/translateShadowEffects';
import { ShapeAttributes } from '@figpot/src/models/entities/penpot/shape';

export function transformEffects(node: HasEffectsTrait & Pick<SubcanvasNode, 'id'>, mapping: MappingType): Pick<ShapeAttributes, 'shadow' | 'blur'> {
  return {
    shadow: translateShadowEffects(node.effects, node.id, mapping),
    blur: translateBlurEffects(node.effects, node.id, mapping),
  };
}

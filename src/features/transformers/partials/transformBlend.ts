import { BasePaint } from '@figpot/src/clients/figma';
import { translateOpacity } from '@figpot/src/features/translators/fills/translateOpacity';
import { translateBlendMode } from '@figpot/src/features/translators/translateBlendMode';
import { ShapeAttributes } from '@figpot/src/models/entities/penpot/shape';

export function transformBlend(node: BasePaint): Pick<ShapeAttributes, 'blendMode' | 'hidden' | 'opacity'> {
  return {
    blendMode: translateBlendMode(node.blendMode),
    hidden: node.visible === false,
    opacity: translateOpacity(node),
  };
}

import { Effect } from '@figpot/src/clients/figma';
import { MappingType } from '@figpot/src/features/document';
import { translateId } from '@figpot/src/features/translators/translateId';
import { Blur } from '@figpot/src/models/entities/penpot/traits/blur';

export function translateBlurEffects(effect: readonly Effect[], figmaNodeId: string, mapping: MappingType): Blur | undefined {
  // TODO: for whatever reason the Figma API tells it has `BACKGROUND_BLUR` as possible value for blue
  // whereas it transfers the value `LAYER_BLUR`, so forcing this one
  const blur = effect.find((effect) => effect.type === 'BACKGROUND_BLUR' || effect.type === ('LAYER_BLUR' as any));

  if (!blur) {
    return;
  }

  return {
    id: translateId(`${figmaNodeId}_blurEffect`, mapping),
    type: 'layer-blur',
    // TODO: the visual aspect have more "blur" into Penpot, maybe it requires a transformation formula?
    value: blur.radius,
    hidden: blur.visible === false,
  };
}

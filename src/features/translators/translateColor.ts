import assert from 'assert';

import { FigmaDefinedColor } from '@figpot/src/features/figma';
import { translateColorId } from '@figpot/src/features/translators/translateId';
import { Color } from '@figpot/src/models/entities/penpot/traits/color';
import { PageRegistry, Registry } from '@figpot/src/models/entities/registry';
import { rgbToHex } from '@figpot/src/utils/color';

export function translateColor(registry: Registry | PageRegistry, color: FigmaDefinedColor): Color {
  // Clean each group level if any
  const pathLevels = color.name.split('/').map((pathLevel) => pathLevel.trim());

  assert(color.value);

  return {
    id: translateColorId(color.id, registry.getMapping()),
    path: pathLevels.splice(-1).join(' / '), // We add spaces as normalized by Penpot
    name: pathLevels[pathLevels.length - 1],
    ...(true
      ? {
          color: rgbToHex(color.value),
          opacity: color.value.a,
        }
      : {
          // TODO: Figma color variables cannot handle gradient so passing it (until style implementation?)
          // gradient: {
          //   startX: 0.5,
          //   startY: 0,
          //   endX: 0.5,
          //   endY: 1,
          //   width: 1,
          //   type: 'linear',
          //   stops: [
          //     {
          //       color: '#085497',
          //       fileId: '4bf0e9f6-08c8-809c-8004-85445179c2a9',
          //       offset: 0,
          //       opacity: 1,
          //       id: 'e7a2c040-5d77-8065-8004-99119a46fdc9',
          //     },
          //     {
          //       color: '#085497',
          //       fileId: '4bf0e9f6-08c8-809c-8004-85445179c2a9',
          //       offset: 1,
          //       opacity: 0,
          //       id: 'e7a2c040-5d77-8065-8004-99119a46fdc9',
          //     },
          //   ],
          // },
        }),
  };
}

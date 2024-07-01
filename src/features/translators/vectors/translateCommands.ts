import { Command } from 'svg-path-parser';

import { HasLayoutTrait, Transform } from '@figpot/src/clients/figma';
import { translateNonRotatedCommands } from '@figpot/src/features/translators/vectors/translateNonRotatedCommands';
import { translateRotatedCommands } from '@figpot/src/features/translators/vectors/translateRotatedCommands';
import { getRotation, hasRotation } from '@figpot/src/utils/rotation';

export function translateCommands(node: HasLayoutTrait, figmaNodeTransform: Transform, commands: Command[]) {
  const rotation = getRotation(figmaNodeTransform);

  if (hasRotation(rotation) && node.absoluteBoundingBox) {
    return translateRotatedCommands(commands, figmaNodeTransform, node.absoluteBoundingBox);
  }

  return translateNonRotatedCommands(commands, figmaNodeTransform[0][2], figmaNodeTransform[1][2]);
}

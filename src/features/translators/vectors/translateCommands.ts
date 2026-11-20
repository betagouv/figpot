import type { Command } from 'svg-path-parser';

import { HasLayoutTrait, Transform } from '@figpot/src/clients/figma';
import { translateNonRotatedCommands } from '@figpot/src/features/translators/vectors/translateNonRotatedCommands';
import { translateRotatedCommands } from '@figpot/src/features/translators/vectors/translateRotatedCommands';
import { Segment } from '@figpot/src/models/entities/penpot/shapes/path';
import { getRotation, hasRotation } from '@figpot/src/utils/rotation';

const FLIP_TOLERANCE = 0.000001;

/**
 * A mirrored node without rotation (`[[±1, 0, x], [0, ±1, y]]` with a negative scale), which the rotation logic cannot
 * handle since the rotation is deduced from the first coefficient only (a vertical flip looks unrotated, an horizontal one
 * looks rotated by 180°)
 */
export function isFlipOnly(transform: Transform): boolean {
  const [[a, b], [c, d]] = transform;

  return Math.abs(b) < FLIP_TOLERANCE && Math.abs(c) < FLIP_TOLERANCE && (a < 0 || d < 0);
}

export function translateFlippedCommands(commands: Command[], transform: Transform): Segment[] {
  const [[a, , e], [, d, f]] = transform;
  const x = (value: number) => a * value + e;
  const y = (value: number) => d * value + f;

  return commands.map((command): Segment => {
    switch (command.command) {
      case 'moveto':
        return { command: 'move-to', params: { x: x(command.x), y: y(command.y) } };
      case 'lineto':
        return { command: 'line-to', params: { x: x(command.x), y: y(command.y) } };
      case 'curveto':
        return {
          command: 'curve-to',
          params: { c1x: x(command.x1), c1y: y(command.y1), c2x: x(command.x2), c2y: y(command.y2), x: x(command.x), y: y(command.y) },
        };
      default:
        return { command: 'close-path', params: null };
    }
  });
}

export function translateCommands(node: HasLayoutTrait, figmaNodeTransform: Transform, commands: Command[]) {
  if (isFlipOnly(figmaNodeTransform)) {
    return translateFlippedCommands(commands, figmaNodeTransform);
  }

  const rotation = getRotation(figmaNodeTransform);

  if (hasRotation(rotation) && node.absoluteBoundingBox) {
    return translateRotatedCommands(commands, figmaNodeTransform, node.absoluteBoundingBox);
  }

  return translateNonRotatedCommands(commands, figmaNodeTransform[0][2], figmaNodeTransform[1][2]);
}

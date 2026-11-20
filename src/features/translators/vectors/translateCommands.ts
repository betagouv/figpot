import type { Command } from 'svg-path-parser';

import { HasLayoutTrait, Transform } from '@figpot/src/clients/figma';
import { translateNonRotatedCommands } from '@figpot/src/features/translators/vectors/translateNonRotatedCommands';
import { translateRotatedCommands } from '@figpot/src/features/translators/vectors/translateRotatedCommands';
import { Segment } from '@figpot/src/models/entities/penpot/shapes/path';
import { applyMatrixToPoint } from '@figpot/src/utils/matrix';
import { getRotation, hasRotation } from '@figpot/src/utils/rotation';

const IDENTITY_TOLERANCE = 0.000001;

/**
 * Whether the transform does more than a translation. The rotation is deduced from the first coefficient only, so a node
 * flipped vertically (`[[1, 0, x], [0, -1, y]]`) looks unrotated whereas it is not (a skew would too)
 */
export function hasLinearTransform(transform: Transform): boolean {
  const [[a, b], [c, d]] = transform;

  return (
    Math.abs(a - 1) > IDENTITY_TOLERANCE ||
    Math.abs(b) > IDENTITY_TOLERANCE ||
    Math.abs(c) > IDENTITY_TOLERANCE ||
    Math.abs(d - 1) > IDENTITY_TOLERANCE
  );
}

/**
 * Applies the whole transform to every point, which works for any transform since Penpot paths are in absolute coordinates
 */
export function translateTransformedCommands(commands: Command[], transform: Transform): Segment[] {
  const point = (x: number, y: number) => {
    const [transformedX, transformedY] = applyMatrixToPoint(transform, [x, y]);

    return { x: transformedX, y: transformedY };
  };

  return commands.map((command): Segment => {
    switch (command.command) {
      case 'moveto':
        return { command: 'move-to', params: point(command.x, command.y) };
      case 'lineto':
        return { command: 'line-to', params: point(command.x, command.y) };
      case 'curveto': {
        const control1 = point(command.x1, command.y1);
        const control2 = point(command.x2, command.y2);

        return {
          command: 'curve-to',
          params: { c1x: control1.x, c1y: control1.y, c2x: control2.x, c2y: control2.y, ...point(command.x, command.y) },
        };
      }
      case 'closepath':
      default:
        return { command: 'close-path', params: null };
    }
  });
}

export function translateCommands(node: HasLayoutTrait, figmaNodeTransform: Transform, commands: Command[]) {
  const rotation = getRotation(figmaNodeTransform);

  if (hasRotation(rotation) && node.absoluteBoundingBox) {
    return translateRotatedCommands(commands, figmaNodeTransform, node.absoluteBoundingBox);
  } else if (hasLinearTransform(figmaNodeTransform)) {
    return translateTransformedCommands(commands, figmaNodeTransform);
  }

  return translateNonRotatedCommands(commands, figmaNodeTransform[0][2], figmaNodeTransform[1][2]);
}

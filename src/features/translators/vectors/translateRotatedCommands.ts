import { Command } from 'svg-path-parser';

import { Rectangle, Transform } from '@figpot/src/clients/figma';
import { translateNonRotatedCommand } from '@figpot/src/features/translators/vectors/translateNonRotatedCommands';
import { ClosePath, Segment } from '@figpot/src/models/entities/penpot/shapes/path';
import { applyInverseRotation, applyRotationToSegment } from '@figpot/src/utils/rotation';

function isClosePath(segment: Segment): segment is ClosePath {
  return segment.command === 'close-path';
}

export function translateRotatedCommands(commands: Command[], transform: Transform, boundingBox: Rectangle): Segment[] {
  const referencePoint = applyInverseRotation({ x: transform[0][2], y: transform[1][2] }, transform, boundingBox);

  return commands.map((command) => {
    const segment = translateNonRotatedCommand(command, referencePoint.x, referencePoint.y);

    if (isClosePath(segment)) {
      return segment;
    }

    return applyRotationToSegment(segment, transform, boundingBox);
  });
}

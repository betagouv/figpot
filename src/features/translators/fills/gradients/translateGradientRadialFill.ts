import { GradientPaint } from '@figpot/src/clients/figma';
import { translateOpacity } from '@figpot/src/features/translators/fills/translateOpacity';
import { Fill } from '@figpot/src/models/entities/penpot/traits/fill';
import { rgbToHex } from '@figpot/src/utils/color';
import { calculateRadialGradient } from '@figpot/src/utils/gradient';

export function translateGradientRadialFill(fill: GradientPaint): Fill {
  const points = calculateRadialGradient(fill.gradientHandlePositions);

  return {
    fillColorGradient: {
      type: 'radial',
      startX: points.start[0],
      startY: points.start[1],
      endX: points.end[0],
      endY: points.end[1],
      width: 1,
      stops: fill.gradientStops.map((stop) => ({
        color: rgbToHex(stop.color),
        offset: stop.position,
        opacity: stop.color.a * (fill.opacity ?? 1),
      })),
    },
    fillOpacity: translateOpacity(fill),
  };
}

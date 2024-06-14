import { GradientPaint } from '@figpot/src/clients/figma';
import { translateOpacity } from '@figpot/src/features/translators/fills/translateOpacity';
import { Fill } from '@figpot/src/models/entities/penpot/traits/fill';
import { rgbToHex } from '@figpot/src/utils/color';
import { calculateLinearGradient } from '@figpot/src/utils/gradient';

export function translateGradientLinearFill(fill: GradientPaint): Fill {
  const points = calculateLinearGradient(fill.gradientHandlePositions);

  return {
    fillColorGradient: {
      type: 'linear',
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

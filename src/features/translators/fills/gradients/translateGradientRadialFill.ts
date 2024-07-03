import { GradientPaint } from '@figpot/src/clients/figma';
import { translateOpacityWithVisibility } from '@figpot/src/features/translators/fills/translateOpacity';
import { translateBoundVariables } from '@figpot/src/features/translators/translateBoundVariables';
import { Fill } from '@figpot/src/models/entities/penpot/traits/fill';
import { PageRegistry } from '@figpot/src/models/entities/registry';
import { rgbToHex } from '@figpot/src/utils/color';
import { calculateRadialGradient } from '@figpot/src/utils/gradient';

export function translateGradientRadialFill(registry: PageRegistry, fill: GradientPaint): Fill {
  const points = calculateRadialGradient(fill.gradientHandlePositions);

  return {
    fillColorGradient: {
      type: 'radial',
      startX: points.start[0],
      startY: points.start[1],
      endX: points.end[0],
      endY: points.end[1],
      width: 1,
      stops: fill.gradientStops.map((stop) => {
        const colorRef = translateBoundVariables(registry, stop.color, stop.boundVariables);

        return {
          color: rgbToHex(stop.color),
          offset: stop.position,
          opacity: stop.color.a * (fill.opacity ?? 1),
          id: colorRef.refId,
          fileId: colorRef.refFile,
        };
      }),
    },
    fillOpacity: translateOpacityWithVisibility(fill),
  };
}

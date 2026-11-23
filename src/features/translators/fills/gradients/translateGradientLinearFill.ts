import { GradientPaint } from '@figpot/src/clients/figma';
import { translateOpacityWithVisibility } from '@figpot/src/features/translators/fills/translateOpacity';
import { Fill } from '@figpot/src/models/entities/penpot/traits/fill';
import { BoundVariableRegistry } from '@figpot/src/models/entities/registry';
import { rgbToHex } from '@figpot/src/utils/color';
import { calculateLinearGradient } from '@figpot/src/utils/gradient';

let hasWarnedGradientStopVariable = false;

export function translateGradientLinearFill(registry: BoundVariableRegistry, fill: GradientPaint): Fill {
  if (!hasWarnedGradientStopVariable && fill.gradientStops.some((stop) => stop.boundVariables?.color)) {
    hasWarnedGradientStopVariable = true;

    console.warn(
      `at least one Figma gradient stop has its colour bound to a variable, which Penpot cannot honour (no token slot on gradient stops). Stop colours are exported as plain values and will not react to token theme switches in Penpot`
    );
  }

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
    fillOpacity: translateOpacityWithVisibility(fill),
  };
}

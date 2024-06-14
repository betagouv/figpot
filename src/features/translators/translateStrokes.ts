import { HasGeometryTrait, IndividualStrokesTrait, Paint, strokeAlign as StrokeAlign } from '@figpot/src/clients/figma';
import { Stroke, StrokeAlignment, StrokeCaps } from '@figpot/src/models/entities/penpot/traits/stroke';

import { translateFill } from './fills/translateFills';

export function translateStrokes(
  node: HasGeometryTrait | (HasGeometryTrait & IndividualStrokesTrait),
  strokeCaps: (stroke: Stroke) => Stroke = (stroke) => stroke
): Stroke[] {
  if (node.strokes === undefined) {
    return [];
  }

  const sharedStrokeProperties: Stroke = {
    strokeWidth: translateStrokeWeight(node),
    strokeAlignment: node.strokeAlign ? translateStrokeAlignment(node.strokeAlign) : undefined,
    strokeStyle: !!node.strokeDashes && node.strokeDashes.length > 0 ? 'dashed' : 'solid',
  };

  return node.strokes.map((paint, index) => translateStroke(paint, sharedStrokeProperties, strokeCaps, index === 0));
}

export function translateStroke(paint: Paint, sharedStrokeProperties: Stroke, strokeCaps: (stroke: Stroke) => Stroke, firstStroke: boolean): Stroke {
  const fill = translateFill(paint);

  let stroke: Stroke = {
    strokeColor: fill?.fillColor,
    strokeOpacity: fill?.fillOpacity,
    strokeImage: fill?.fillImage,
    ...sharedStrokeProperties,
  };

  if (firstStroke) {
    stroke = strokeCaps(stroke);
  }

  return stroke;
}

export function translateStrokeCap(vertex: HasGeometryTrait): StrokeCaps | undefined {
  switch (vertex.strokeCap) {
    case 'ROUND':
      return 'round';
    case 'TRIANGLE_ARROW':
    case 'TRIANGLE_FILLED':
      return 'triangle-arrow';
    case 'SQUARE':
      return 'square';
    case 'CIRCLE_FILLED':
      return 'circle-marker';
    case 'DIAMOND_FILLED':
      return 'diamond-marker';
    case 'LINE_ARROW':
      return 'line-arrow';
    case 'NONE':
    case 'WASHI_TAPE_1':
    case 'WASHI_TAPE_2':
    case 'WASHI_TAPE_3':
    case 'WASHI_TAPE_4':
    case 'WASHI_TAPE_5':
    case 'WASHI_TAPE_6':
    default:
      return;
  }
}

function translateStrokeWeight(node: HasGeometryTrait | (HasGeometryTrait & IndividualStrokesTrait)): number {
  if (!isIndividualStrokes(node) || node.individualStrokeWeights === undefined) {
    return node.strokeWeight !== undefined ? node.strokeWeight : 1;
  }

  return Math.max(
    node.individualStrokeWeights.top,
    node.individualStrokeWeights.right,
    node.individualStrokeWeights.bottom,
    node.individualStrokeWeights.left
  );
}

function isIndividualStrokes(node: HasGeometryTrait | IndividualStrokesTrait): node is IndividualStrokesTrait {
  return 'individualStrokeWeights' in node;
}

function translateStrokeAlignment(strokeAlign: StrokeAlign): StrokeAlignment {
  switch (strokeAlign) {
    case 'CENTER':
      return 'center';
    case 'INSIDE':
      return 'inner';
    case 'OUTSIDE':
      return 'outer';
  }
}

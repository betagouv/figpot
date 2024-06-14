import { HasGeometryTrait, IndividualStrokesTrait } from '@figpot/src/clients/figma';
import { translateStrokeCap, translateStrokes } from '@figpot/src/features/translators/translateStrokes';
import { ShapeAttributes } from '@figpot/src/models/entities/penpot/shape';
import { Stroke } from '@figpot/src/models/entities/penpot/traits/stroke';

function hasFillGeometry(node: HasGeometryTrait): boolean {
  return !!node.fillGeometry && node.fillGeometry.length > 0;
}

export function transformStrokes(node: HasGeometryTrait | (HasGeometryTrait & IndividualStrokesTrait)): Pick<ShapeAttributes, 'strokes'> {
  const vectorNetwork = node.strokeGeometry;

  const strokeCaps = (stroke: Stroke) => {
    // TODO: don't know what to do with that, there is no distinction from Figma except into "COMPONENT" nodes (leaving commented for now)
    // if (!hasFillGeometry(node) && vectorNetwork && vectorNetwork.vertices.length > 0) {
    //   stroke.strokeCapStart = translateStrokeCap(vectorNetwork.vertices[0]);
    //   stroke.strokeCapEnd = translateStrokeCap(vectorNetwork.vertices[vectorNetwork.vertices.length - 1]);
    // }

    return stroke;
  };

  return {
    strokes: translateStrokes(node, strokeCaps),
  };
}

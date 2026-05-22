import { HasGeometryTrait, IndividualStrokesTrait } from '@figpot/src/clients/figma';
import { translateColorId, translateDocumentId } from '@figpot/src/features/translators/translateId';
import { translateStrokeCap, translateStrokes } from '@figpot/src/features/translators/translateStrokes';
import { ShapeAttributes } from '@figpot/src/models/entities/penpot/shape';
import { Stroke } from '@figpot/src/models/entities/penpot/traits/stroke';
import { AbstractRegistry } from '@figpot/src/models/entities/registry';

function hasFillGeometry(node: HasGeometryTrait): boolean {
  return !!node.fillGeometry && node.fillGeometry.length > 0;
}

export function transformStrokes(
  registry: AbstractRegistry,
  node: HasGeometryTrait | (HasGeometryTrait & IndividualStrokesTrait)
): Pick<ShapeAttributes, 'strokes'> {
  const vectorNetwork = node.strokeGeometry;
  const strokeStyleId = getStrokeStyleId(node);

  const strokeCaps = (stroke: Stroke) => {
    // TODO: don't know what to do with that, there is no distinction from Figma except into "COMPONENT" nodes (leaving commented for now)
    // if (!hasFillGeometry(node) && vectorNetwork && vectorNetwork.vertices.length > 0) {
    //   stroke.strokeCapStart = translateStrokeCap(vectorNetwork.vertices[0]);
    //   stroke.strokeCapEnd = translateStrokeCap(vectorNetwork.vertices[vectorNetwork.vertices.length - 1]);
    // }

    return stroke;
  };

  const strokes = translateStrokes(registry, node, strokeCaps);

  return {
    strokes: strokeStyleId
      ? strokes.map((stroke, i) => {
          const uniqueColorId = strokes.length > 1 ? `${strokeStyleId}_${i}` : strokeStyleId;

          return {
            ...stroke,
            strokeColorRefId: translateColorId(uniqueColorId, registry.getMapping()),
            strokeColorRefFile: translateDocumentId('current', registry.getMapping()),
          };
        })
      : strokes,
  };
}

function getStrokeStyleId(node: HasGeometryTrait | (HasGeometryTrait & IndividualStrokesTrait)): string | null {
  return node.styles !== undefined ? node.styles['stroke'] : null;
}

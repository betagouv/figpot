import { HasGeometryTrait, IndividualStrokesTrait } from '@figpot/src/clients/figma';
import { nullId, translateColorId, translateDocumentId } from '@figpot/src/features/translators/translateId';
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

  if (!strokeStyleId) {
    return { strokes };
  }

  return {
    strokes: strokes.map((stroke, i) => {
      // Multi-paint published styles produce one Penpot color per paint
      const paintIndex = strokes.length > 1 ? i : undefined;
      const binding = registry.resolveStyle(strokeStyleId, paintIndex);

      let strokeColorRefId: string;
      let strokeColorRefFile: string;

      if (binding) {
        strokeColorRefId = binding.file !== undefined ? binding.id : nullId;
        strokeColorRefFile = binding.file ?? nullId;
      } else {
        const localUniqueColorId = strokes.length > 1 ? `${strokeStyleId}_${i}` : strokeStyleId;

        strokeColorRefId = translateColorId(localUniqueColorId, registry.getMapping());
        strokeColorRefFile = translateDocumentId('current', registry.getMapping());
      }

      return {
        ...stroke,
        strokeColorRefId,
        strokeColorRefFile,
      };
    }),
  };
}

function getStrokeStyleId(node: HasGeometryTrait | (HasGeometryTrait & IndividualStrokesTrait)): string | null {
  return node.styles !== undefined ? node.styles['stroke'] : null;
}

import { MinimalFillsTrait, Paint, Path, VectorNode } from '@figpot/src/clients/figma';
import { translateFills } from '@figpot/src/features/translators/fills/translateFills';
import { nullId, translateColorId, translateDocumentId } from '@figpot/src/features/translators/translateId';
import { ShapeAttributes } from '@figpot/src/models/entities/penpot/shape';
import { BoundVariableRegistry } from '@figpot/src/models/entities/registry';

export function transformFills(registry: BoundVariableRegistry, node: MinimalFillsTrait): Pick<ShapeAttributes, 'fills'> {
  const fillStyleId = getFillStyleId(node);

  const fills = translateFills(registry, node.fills);

  if (!fillStyleId) {
    return { fills };
  }

  return {
    fills: fills.map((fill, i) => {
      // Multi-paint published styles produce one Penpot color per paint
      const paintIndex = fills.length > 1 ? i : undefined;
      const binding = registry.resolveStyle(fillStyleId, paintIndex);

      // Binding with file ID being unknown is making the font section in the UI empty and buggy,
      // for example clicking "edit library style" is crashing the whole... so better avoid the link (unlike for components)
      if (binding && binding.file === undefined) {
        return fill;
      }

      let fillColorRefId: string;
      let fillColorRefFile: string;

      if (binding) {
        fillColorRefId = binding.id;
        fillColorRefFile = binding.file as string;
      } else {
        const localUniqueColorId = fills.length > 1 ? `${fillStyleId}_${i}` : fillStyleId;

        fillColorRefId = translateColorId(localUniqueColorId, registry.getMapping());
        fillColorRefFile = translateDocumentId('current', registry.getMapping());
      }

      return {
        ...fill,
        fillColorRefId,
        fillColorRefFile,
      };
    }),
  };
}

export function transformVectorFills(
  registry: BoundVariableRegistry,
  node: VectorNode,
  vectorPath: Path,
  shapeFills: Paint[] | null
): Pick<ShapeAttributes, 'fills'> {
  return shapeFills
    ? transformFills(registry, { fills: shapeFills })
    : {
        fills: [],
      };
}

function getFillStyleId(node: MinimalFillsTrait): string | null {
  return node.styles !== undefined ? node.styles['fill'] : null;
}

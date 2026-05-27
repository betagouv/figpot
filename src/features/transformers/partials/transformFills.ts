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

      let fillColorRefId: string;
      let fillColorRefFile: string;

      if (binding) {
        fillColorRefId = binding.file !== undefined ? binding.id : nullId;
        fillColorRefFile = binding.file ?? nullId;
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

import { MinimalFillsTrait, Paint, Path, VectorNode } from '@figpot/src/clients/figma';
import { translateFills } from '@figpot/src/features/translators/fills/translateFills';
import { translateColorId, translateDocumentId } from '@figpot/src/features/translators/translateId';
import { ShapeAttributes } from '@figpot/src/models/entities/penpot/shape';
import { BoundVariableRegistry } from '@figpot/src/models/entities/registry';

export function transformFills(registry: BoundVariableRegistry, node: MinimalFillsTrait): Pick<ShapeAttributes, 'fills'> {
  const fillStyleId = getFillStyleId(node);

  const fills = translateFills(registry, node.fills);

  return {
    fills: fillStyleId
      ? fills.map((fill, i) => {
          const uniqueColorId = fills.length > 1 ? `${fillStyleId}_${i}` : fillStyleId;

          return {
            ...fill,
            fillColorRefId: translateColorId(uniqueColorId, registry.getMapping()),
            fillColorRefFile: translateDocumentId('current', registry.getMapping()),
          };
        })
      : fills,
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

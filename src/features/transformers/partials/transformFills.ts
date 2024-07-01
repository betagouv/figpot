import { MinimalFillsTrait, Paint, Path, VectorNode } from '@figpot/src/clients/figma';
import { MappingType } from '@figpot/src/features/document';
import { translateFills } from '@figpot/src/features/translators/fills/translateFills';
import { ShapeAttributes } from '@figpot/src/models/entities/penpot/shape';

export function transformFills(node: MinimalFillsTrait, mapping: MappingType): Pick<ShapeAttributes, 'fills'> {
  // TODO: once we dig into how the REST API manages it
  // if (hasFillStyle(node)) {
  //   return {
  //     fills: [],
  //     fillStyleId: translateFillStyleId(node.fillStyleId)
  //   };
  // }

  return {
    fills: translateFills(node.fills, mapping),
  };
}

export function transformVectorFills(
  node: VectorNode,
  vectorPath: Path,
  shapeFills: Paint[] | null,
  mapping: MappingType
): Pick<ShapeAttributes, 'fills'> {
  return shapeFills
    ? transformFills({ fills: shapeFills }, mapping)
    : {
        fills: [],
      };
}

// function hasFillStyle(node: MinimalFillsTrait): boolean {
//   return node.fillStyleId !== undefined && node.fillStyleId.length > 0;
// }

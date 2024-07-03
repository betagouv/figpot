import { MinimalFillsTrait, Paint, Path, VectorNode } from '@figpot/src/clients/figma';
import { translateFills } from '@figpot/src/features/translators/fills/translateFills';
import { ShapeAttributes } from '@figpot/src/models/entities/penpot/shape';
import { PageRegistry } from '@figpot/src/models/entities/registry';

export function transformFills(registry: PageRegistry, node: MinimalFillsTrait): Pick<ShapeAttributes, 'fills'> {
  // TODO: once we dig into how the REST API manages it
  // if (hasFillStyle(node)) {
  //   return {
  //     fills: [],
  //     fillStyleId: translateFillStyleId(node.fillStyleId)
  //   };
  // }

  return {
    fills: translateFills(registry, node.fills),
  };
}

export function transformVectorFills(
  registry: PageRegistry,
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

// function hasFillStyle(node: MinimalFillsTrait): boolean {
//   return node.fillStyleId !== undefined && node.fillStyleId.length > 0;
// }

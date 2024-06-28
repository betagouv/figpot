import { MinimalFillsTrait } from '@figpot/src/clients/figma';
import { translateFills } from '@figpot/src/features/translators/fills/translateFills';
import { ShapeAttributes } from '@figpot/src/models/entities/penpot/shape';

export function transformFills(node: MinimalFillsTrait): Pick<ShapeAttributes, 'fills'> {
  return {
    fills: translateFills(node.fills),
  };
}

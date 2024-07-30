import { HasLayoutTrait } from '@figpot/src/clients/figma';
import { ShapeAttributes } from '@figpot/src/models/entities/penpot/shape';

export function transformProportion(node: HasLayoutTrait): Pick<ShapeAttributes, 'proportionLock'> {
  return {
    proportionLock: node.preserveRatio,
  };
}

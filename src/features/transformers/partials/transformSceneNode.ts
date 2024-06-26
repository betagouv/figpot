import { IsLayerTrait } from '@figpot/src/clients/figma';
import { ShapeAttributes } from '@figpot/src/models/entities/penpot/shape';

export function transformSceneNode(node: IsLayerTrait): Pick<ShapeAttributes, 'blocked' | 'hidden'> {
  return {
    blocked: node.locked,
    hidden: node.visible === false,
  };
}

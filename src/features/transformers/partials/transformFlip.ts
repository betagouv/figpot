import { HasLayoutTrait } from '@figpot/src/clients/figma';
import { ShapeBaseAttributes } from '@figpot/src/models/entities/penpot/shape';

export function transformFlip(node: HasLayoutTrait): Pick<ShapeBaseAttributes, 'flipX' | 'flipY'> {
  return {
    flipX: null, // TODO: find if equivalent into Figma
    flipY: null, // TODO: find if equivalent into Figma
  };
}

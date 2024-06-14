import { CornerTrait } from '@figpot/src/clients/figma';
import { ShapeAttributes } from '@figpot/src/models/entities/penpot/shape';

export function transformCornerRadius(node: CornerTrait): Pick<ShapeAttributes, 'r1' | 'r2' | 'r3' | 'r4'> | Pick<ShapeAttributes, 'rx'> | undefined {
  if (node.rectangleCornerRadii) {
    return {
      r1: node.rectangleCornerRadii[0],
      r2: node.rectangleCornerRadii[1],
      r3: node.rectangleCornerRadii[2],
      r4: node.rectangleCornerRadii[3],
    };
  } else if (node.cornerRadius !== undefined) {
    return {
      rx: node.cornerRadius,
    };
  } else {
    return undefined;
  }
}

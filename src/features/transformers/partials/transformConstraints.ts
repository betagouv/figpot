import { HasLayoutTrait } from '@figpot/src/clients/figma';
import { translateConstraintH, translateConstraintV } from '@figpot/src/features/translators/translateConstraints';
import { ShapeAttributes } from '@figpot/src/models/entities/penpot/shape';

export function transformConstraints(node: HasLayoutTrait): Pick<ShapeAttributes, 'constraintsH' | 'constraintsV'> {
  return {
    constraintsH: node.constraints ? translateConstraintH(node.constraints.horizontal) : undefined,
    constraintsV: node.constraints ? translateConstraintV(node.constraints.vertical) : undefined,
  };
}

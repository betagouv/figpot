import { LayoutConstraint } from '@figpot/src/clients/figma';
import { ConstraintH, ConstraintV } from '@figpot/src/models/entities/penpot/shape';

export const translateConstraintH = (constraint: LayoutConstraint['horizontal']): ConstraintH => {
  switch (constraint) {
    // case 'MAX':
    //   return 'right';
    // case 'MIN':
    //   return 'left';
    case 'CENTER':
      return 'center';
    case 'SCALE':
      return 'scale';
    // case 'STRETCH':
    //   return 'leftright';
    default:
      throw new Error('constraint enum not taken into account');
  }
};

export const translateConstraintV = (constraint: LayoutConstraint['vertical']): ConstraintV => {
  switch (constraint) {
    // case 'MAX':
    //   return 'bottom';
    // case 'MIN':
    //   return 'top';
    case 'CENTER':
      return 'center';
    case 'SCALE':
      return 'scale';
    // case 'STRETCH':
    //   return 'topbottom';
    default:
      throw new Error('constraint enum not taken into account');
  }
};

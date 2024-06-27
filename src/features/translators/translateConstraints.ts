import { LayoutConstraint } from '@figpot/src/clients/figma';
import { ConstraintH, ConstraintV } from '@figpot/src/models/entities/penpot/shape';

// Note:
// On Figma, when expanding a group all shapes despites their constraints will by default expand (constraints `top` and `left`)
// Whereas on Penpot they won't. It more about internal machinery and we cannot handle this properly (except removing constraints, which risky if originally set by the user)

export const translateConstraintH = (constraint: LayoutConstraint['horizontal']): ConstraintH => {
  switch (constraint) {
    case 'RIGHT':
      return 'right';
    case 'LEFT':
      return 'left';
    case 'CENTER':
      return 'center';
    case 'SCALE':
      return 'scale';
    case 'LEFT_RIGHT':
      return 'leftright';
    default:
      throw new Error('constraint enum not taken into account');
  }
};

export const translateConstraintV = (constraint: LayoutConstraint['vertical']): ConstraintV => {
  switch (constraint) {
    case 'BOTTOM':
      return 'bottom';
    case 'TOP':
      return 'top';
    case 'CENTER':
      return 'center';
    case 'SCALE':
      return 'scale';
    case 'TOP_BOTTOM':
      return 'topbottom';
    default:
      throw new Error('constraint enum not taken into account');
  }
};

import { ShapeAttributes } from '@figpot/src/features/penpot';

// TODO: must be tested to implement and find correct typings...

// function isRectangleCornerMixin(node: CornerMixin | (CornerMixin & RectangleCornerMixin)): node is CornerMixin & RectangleCornerMixin {
//   return 'topLeftRadius' in node && node.cornerRadius === figma.mixed;
// }

// export async function transformCornerRadius(
//   node: CornerMixin | (CornerMixin & RectangleCornerMixin)
// ): Pick<ShapeAttributes, 'r1' | 'r2' | 'r3' | 'r4'> | Pick<ShapeAttributes, 'rx'> | undefined {
//   if (isRectangleCornerMixin(node)) {
//     return {
//       r1: node.topLeftRadius,
//       r2: node.topRightRadius,
//       r3: node.bottomRightRadius,
//       r4: node.bottomLeftRadius,
//     };
//   }

//   if (node.cornerRadius !== figma.mixed) {
//     return {
//       rx: node.cornerRadius,
//     };
//   }
// }

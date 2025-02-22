import * as math from 'mathjs';

import { HasLayoutTrait, Transform } from '@figpot/src/clients/figma';

export const neutralTransform: Transform = [
  [1, 0, 0],
  [0, 1, 0],
];

export function isTransformedNode(node: HasLayoutTrait): boolean {
  return (
    node.relativeTransform !== undefined &&
    // [WORKAROUND] It appears for some nodes the transform is returned but all values are `null`
    // This may be a defect from previous Figma versions, so we take it into account
    node.relativeTransform.length === 2 &&
    node.relativeTransform[0].indexOf(null as unknown as number) === -1 &&
    node.relativeTransform[1].indexOf(null as unknown as number) === -1
  );
}

export function cumulateNodeTransforms(t1: Transform, t2: Transform): Transform {
  const matrix = math.multiply(math.matrix([t1[0], t1[1], [0, 0, 1]]), math.matrix([t2[0], t2[1], [0, 0, 1]])).toArray() as any;

  return [matrix[0], matrix[1]];
}

export function applyMatrixToPoint(matrix: number[][], point: number[]) {
  return [point[0] * matrix[0][0] + point[1] * matrix[0][1] + matrix[0][2], point[0] * matrix[1][0] + point[1] * matrix[1][1] + matrix[1][2]];
}

export function matrixInvert(M: number[][]): number[][] | undefined {
  // if the matrix isn't square: exit (error)
  if (M.length !== M[0].length) {
    return;
  }

  // create the identity matrix (I), and a copy (C) of the original
  const dim = M.length;
  let i = 0,
    ii = 0,
    j = 0,
    e = 0;
  const I: number[][] = [],
    C: number[][] = [];
  for (i = 0; i < dim; i += 1) {
    // Create the row
    I[i] = [];
    C[i] = [];
    for (j = 0; j < dim; j += 1) {
      // if we're on the diagonal, put a 1 (for identity)
      if (i === j) {
        I[i][j] = 1;
      } else {
        I[i][j] = 0;
      }

      // Also, make the copy of the original
      C[i][j] = M[i][j];
    }
  }

  // Perform elementary row operations
  for (i = 0; i < dim; i += 1) {
    // get the element e on the diagonal
    e = C[i][i];

    // if we have a 0 on the diagonal (we'll need to swap with a lower row)
    if (e === 0) {
      // look through every row below the i'th row
      for (ii = i + 1; ii < dim; ii += 1) {
        // if the ii'th row has a non-0 in the i'th col
        if (C[ii][i] !== 0) {
          // it would make the diagonal have a non-0 so swap it
          for (j = 0; j < dim; j++) {
            e = C[i][j]; // temp store i'th row
            C[i][j] = C[ii][j]; // replace i'th row by ii'th
            C[ii][j] = e; // replace ii'th by temp
            e = I[i][j]; // temp store i'th row
            I[i][j] = I[ii][j]; // replace i'th row by ii'th
            I[ii][j] = e; // replace ii'th by temp
          }
          // don't bother checking other rows since we've swapped
          break;
        }
      }
      // get the new diagonal
      e = C[i][i];
      // if it's still 0, not invertable (error)
      if (e === 0) {
        return;
      }
    }

    // Scale this row down by e (so we have a 1 on the diagonal)
    for (j = 0; j < dim; j++) {
      C[i][j] = C[i][j] / e; // apply to original matrix
      I[i][j] = I[i][j] / e; // apply to identity
    }

    // Subtract this row (scaled appropriately for each row) from ALL of
    // the other rows so that there will be 0's in this column in the
    // rows above and below this one
    for (ii = 0; ii < dim; ii++) {
      // Only apply to other rows (we want a 1 on the diagonal)
      if (ii === i) {
        continue;
      }

      // We want to change this element to 0
      e = C[ii][i];

      // Subtract (the row above(or below) scaled by e) from (the
      // current row) but start at the i'th column and assume all the
      // stuff left of diagonal is 0 (which it should be if we made this
      // algorithm correctly)
      for (j = 0; j < dim; j++) {
        C[ii][j] -= e * C[i][j]; // apply to original matrix
        I[ii][j] -= e * I[i][j]; // apply to identity
      }
    }
  }

  // we've done all operations, C should be the identity
  // matrix I should be the inverse:
  return I;
}

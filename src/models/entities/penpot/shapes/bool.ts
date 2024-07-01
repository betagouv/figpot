import { LayoutChildAttributes } from '@figpot/src/models/entities/penpot/layout';
import { ShapeAttributes, ShapeBaseAttributes } from '@figpot/src/models/entities/penpot/shape';
import { Segment } from '@figpot/src/models/entities/penpot/shapes/path';
import { Point } from '@figpot/src/models/entities/penpot/traits/point';
import { Uuid } from '@figpot/src/models/entities/penpot/traits/uuid';

export const BOOL_DIFFERENCE: unique symbol = Symbol.for('difference');
export const BOOL_UNION: unique symbol = Symbol.for('union');
export const BOOL_INTERSECTION: unique symbol = Symbol.for('intersection');
export const BOOL_EXCLUDE: unique symbol = Symbol.for('exclude');

export type BoolOperations =
  | 'difference'
  | 'union'
  | 'intersection'
  | 'exclude'
  | typeof BOOL_DIFFERENCE
  | typeof BOOL_UNION
  | typeof BOOL_INTERSECTION
  | typeof BOOL_EXCLUDE;

export type BoolShape = ShapeBaseAttributes & ShapeAttributes & BoolAttributes & LayoutChildAttributes;

export type BoolAttributes = {
  type?: 'bool';
  shapes?: Uuid[];
  boolType: BoolOperations;
  boolContent?: BoolContent[];
};

export type BoolContent = {
  relative?: boolean;
  prevPos?: Point;
} & Segment;

import { LayoutChildAttributes } from '@figpot/src/models/entities/penpot/layout';
import { ShapeAttributes, ShapeBaseAttributes } from '@figpot/src/models/entities/penpot/shape';

export const VECTOR_LINE_TO: unique symbol = Symbol.for('line-to');
export const VECTOR_CLOSE_PATH: unique symbol = Symbol.for('close-path');
export const VECTOR_MOVE_TO: unique symbol = Symbol.for('move-to');
export const VECTOR_CURVE_TO: unique symbol = Symbol.for('curve-to');

export type PathContent = Segment[];
export type Segment = LineTo | ClosePath | MoveTo | CurveTo;
export type Command =
  | 'line-to'
  | 'close-path'
  | 'move-to'
  | 'curve-to'
  | typeof VECTOR_LINE_TO
  | typeof VECTOR_CLOSE_PATH
  | typeof VECTOR_MOVE_TO
  | typeof VECTOR_CURVE_TO;

export type FillRules = 'evenodd' | 'nonzero';

type LineTo = {
  command: 'line-to' | typeof VECTOR_LINE_TO;
  params: {
    x: number;
    y: number;
  };
};

export type ClosePath = {
  command: 'close-path' | typeof VECTOR_CLOSE_PATH;
  params: null;
};

type MoveTo = {
  command: 'move-to' | typeof VECTOR_MOVE_TO;
  params: {
    x: number;
    y: number;
  };
};

export type CurveTo = {
  command: 'curve-to' | typeof VECTOR_CURVE_TO;
  params: {
    x: number;
    y: number;
    c1x: number;
    c1y: number;
    c2x: number;
    c2y: number;
  };
};

export type PathAttributes = {
  type?: 'path';
  content: PathContent;
  svgAttrs?: {
    fillRule?: FillRules;
  };
};

export type PathShape = ShapeBaseAttributes & ShapeAttributes & PathAttributes & LayoutChildAttributes;

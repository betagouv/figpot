import { LayoutChildAttributes } from '@figpot/src/models/entities/penpot/layout';
import { ShapeAttributes, ShapeBaseAttributes, ShapeGeomAttributes } from '@figpot/src/models/entities/penpot/shape';

export type RectShape = ShapeBaseAttributes & ShapeGeomAttributes & ShapeAttributes & RectAttributes & LayoutChildAttributes;

type RectAttributes = {
  type?: 'rect';
};

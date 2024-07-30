import { LayoutChildAttributes } from '@figpot/src/models/entities/penpot/layout';
import { ShapeAttributes, ShapeBaseAttributes, ShapeGeomAttributes } from '@figpot/src/models/entities/penpot/shape';

export type CircleShape = ShapeBaseAttributes & ShapeGeomAttributes & ShapeAttributes & CircleAttributes & LayoutChildAttributes;

type CircleAttributes = {
  type?: 'circle';
};

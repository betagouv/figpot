import { ShapeAttributes, ShapeBaseAttributes, ShapeGeomAttributes } from '@figpot/src/models/entities/penpot/shape';
import { Uuid } from '@figpot/src/models/entities/penpot/traits/uuid';

type GroupAttributes = {
  type?: 'group';
  shapes?: Uuid[];
};

export type GroupShape = ShapeBaseAttributes & ShapeGeomAttributes & ShapeAttributes & GroupAttributes;

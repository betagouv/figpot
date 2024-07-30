import { LayoutAttributes, LayoutChildAttributes } from '@figpot/src/models/entities/penpot/layout';
import { ShapeAttributes, ShapeBaseAttributes, ShapeGeomAttributes } from '@figpot/src/models/entities/penpot/shape';
import { Uuid } from '@figpot/src/models/entities/penpot/traits/uuid';

type FrameAttributes = {
  type?: 'frame';
  shapes?: Uuid[];
  hideFillOnExport?: boolean;
  showContent?: boolean;
  hideInViewer?: boolean;
};

export type FrameShape = ShapeBaseAttributes & ShapeAttributes & ShapeGeomAttributes & FrameAttributes & LayoutAttributes & LayoutChildAttributes;

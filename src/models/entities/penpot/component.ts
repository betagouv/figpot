import { LayoutAttributes, LayoutChildAttributes } from '@figpot/src/models/entities/penpot/layout';
import { ShapeAttributes, ShapeGeomAttributes } from '@figpot/src/models/entities/penpot/shape';
import { Uuid } from '@figpot/src/models/entities/penpot/traits/uuid';

export type ComponentInstance = ShapeGeomAttributes &
  ShapeAttributes &
  LayoutAttributes &
  LayoutChildAttributes & {
    mainComponentFigmaId: string;
    isComponentRoot: boolean;
    showContent?: boolean;
    isOrphan: boolean;
    type: 'instance';
  };

export type LibraryComponent = {
  id: string;
  path: string;
  name: string;
  modifiedAt?: string;
  mainInstancePage: Uuid | null;
  mainInstanceId: Uuid;
  variantId?: string;
  variantProperties?: {
    name: string;
    value: string;
  }[];
  deleted?: boolean;
};

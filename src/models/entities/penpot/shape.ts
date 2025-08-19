import { BlendMode } from '@figpot/src/models/entities/penpot/traits/blendModes';
import { Blur } from '@figpot/src/models/entities/penpot/traits/blur';
import { Export } from '@figpot/src/models/entities/penpot/traits/export';
import { Fill } from '@figpot/src/models/entities/penpot/traits/fill';
import { Grid } from '@figpot/src/models/entities/penpot/traits/grid';
import { Interaction } from '@figpot/src/models/entities/penpot/traits/interaction';
import { Matrix } from '@figpot/src/models/entities/penpot/traits/matrix';
import { Point } from '@figpot/src/models/entities/penpot/traits/point';
import { Selrect } from '@figpot/src/models/entities/penpot/traits/selrect';
import { Shadow } from '@figpot/src/models/entities/penpot/traits/shadow';
import { Stroke } from '@figpot/src/models/entities/penpot/traits/stroke';
import { SyncGroups } from '@figpot/src/models/entities/penpot/traits/syncGroups';
import { Uuid } from '@figpot/src/models/entities/penpot/traits/uuid';

export type GrowType = 'auto-width' | 'auto-height' | 'fixed';

export type ConstraintH = 'left' | 'right' | 'leftright' | 'center' | 'scale';
export type ConstraintV = 'top' | 'bottom' | 'topbottom' | 'center' | 'scale';

export type ShapeGeomAttributes = {
  x: number;
  y: number;
  width: number;
  height: number;
};

export type ShapeBaseAttributes = {
  id?: Uuid;
  name?: string;
  type?: 'frame' | 'group' | 'bool' | 'rect' | 'path' | 'text' | 'circle' | 'svg-raw' | 'image' | 'component' | 'instance';
  selrect?: Selrect;
  points?: Point[];
  transform?: Matrix;
  transformInverse?: Matrix;
  parentId?: Uuid;
  frameId?: Uuid;
  flipX?: boolean | null;
  flipY?: boolean | null;
  rotation?: number;
};

export type ShapeAttributes = {
  name?: string;
  componentId?: string;
  componentFile?: string;
  componentRoot?: boolean;
  mainInstance?: boolean;
  isVariantContainer?: boolean;
  variantId?: string;
  variantName?: string;
  remoteSynced?: boolean;
  shapeRef?: string;
  selrect?: Selrect;
  points?: Point[];
  blocked?: boolean;
  collapsed?: boolean;
  locked?: boolean;
  hidden?: boolean;
  maskedGroup?: boolean;
  fills?: Fill[];
  hideFillOnExport?: boolean;
  proportion?: number;
  proportionLock?: boolean;
  constraintsH?: ConstraintH;
  constraintsV?: ConstraintV;
  fixedScroll?: boolean;
  r1?: number;
  r2?: number;
  r3?: number;
  r4?: number;
  opacity?: number;
  grids?: Grid[];
  exports?: Export[];
  strokes?: Stroke[];
  blendMode?: BlendMode;
  interactions?: Interaction[];
  shadow?: Shadow[];
  blur?: Blur;
  growType?: GrowType;
  touched?: SyncGroups[];
};

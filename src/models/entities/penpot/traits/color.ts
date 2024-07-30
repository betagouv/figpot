import { Gradient } from '@figpot/src/models/entities/penpot/traits/gradient';
import { ImageColor } from '@figpot/src/models/entities/penpot/traits/imageColor';
import { Uuid } from '@figpot/src/models/entities/penpot/traits/uuid';

export type Color = {
  id?: Uuid;
  name?: string;
  path?: string;
  value?: string;
  color?: string; // hex color
  opacity?: number;
  modifiedAt?: string;
  refId?: Uuid;
  refFile?: Uuid;
  gradient?: Gradient;
  image?: ImageColor;
};

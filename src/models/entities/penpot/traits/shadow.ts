import { Color } from '@figpot/src/models/entities/penpot/traits/color';
import { Uuid } from '@figpot/src/models/entities/penpot/traits/uuid';

export type ShadowStyle = 'drop-shadow' | 'inner-shadow';

export type Shadow = {
  id?: Uuid;
  style: ShadowStyle;
  offsetX: number;
  offsetY: number;
  blur: number;
  spread: number;
  hidden: boolean;
  color: Pick<Color, 'color' | 'opacity' | 'refId' | 'refFile'>;
};

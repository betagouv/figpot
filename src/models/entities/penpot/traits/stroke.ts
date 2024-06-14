import { Gradient } from '@figpot/src/models/entities/penpot/traits/gradient';
import { ImageColor } from '@figpot/src/models/entities/penpot/traits/imageColor';
import { Uuid } from '@figpot/src/models/entities/penpot/traits/uuid';

export type StrokeAlignment = 'center' | 'inner' | 'outer';

type StrokeCapLine = 'round' | 'square';
type StrokeCapMarker = 'line-arrow' | 'triangle-arrow' | 'square-marker' | 'circle-marker' | 'diamond-marker';

export type StrokeCaps = StrokeCapLine | StrokeCapMarker;

export type Stroke = {
  strokeColor?: string;
  strokeColorRefFile?: Uuid;
  strokeColorRefId?: Uuid;
  strokeOpacity?: number;
  strokeStyle?: 'solid' | 'dotted' | 'dashed' | 'mixed' | 'none' | 'svg';
  strokeWidth?: number;
  strokeAlignment?: StrokeAlignment;
  strokeCapStart?: StrokeCaps;
  strokeCapEnd?: StrokeCaps;
  strokeColorGradient?: Gradient;
  strokeImage?: ImageColor;
};

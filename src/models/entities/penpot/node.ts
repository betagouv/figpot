import { BoolShape } from '@figpot/src/models/entities/penpot/shapes/bool';
import { CircleShape } from '@figpot/src/models/entities/penpot/shapes/circle';
import { FrameShape } from '@figpot/src/models/entities/penpot/shapes/frame';
import { GroupShape } from '@figpot/src/models/entities/penpot/shapes/group';
import { PathShape } from '@figpot/src/models/entities/penpot/shapes/path';
import { RectShape } from '@figpot/src/models/entities/penpot/shapes/rect';
import { TextShape } from '@figpot/src/models/entities/penpot/shapes/text';

export type PenpotNode = FrameShape | GroupShape | PathShape | RectShape | CircleShape | TextShape | BoolShape;

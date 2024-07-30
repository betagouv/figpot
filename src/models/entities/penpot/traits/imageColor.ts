import { Uuid } from '@figpot/src/models/entities/penpot/traits/uuid';

export type ImageColor = {
  name?: string;
  width: number;
  height: number;
  mtype?: string;
  id?: Uuid;
  keepAspectRatio?: boolean;
  dataUri?: string;
};

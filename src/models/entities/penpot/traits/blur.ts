import { Uuid } from '@figpot/src/models/entities/penpot/traits/uuid';

export type Blur = {
  id?: Uuid;
  type: 'layer-blur';
  value: number;
  hidden: boolean;
};

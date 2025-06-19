import { PenpotNode } from '@figpot/src/models/entities/penpot/node';

export type PenpotPage = {
  id: string;
  name: string;
  background?: string;
  objects: Record<string, PenpotNode>;
};

import { PenpotNode } from '@figpot/src/models/entities/penpot/node';

export type PenpotPageOptions = {};

export type PenpotPage = {
  id: string;
  name: string;
  options: PenpotPageOptions;
  objects: Record<string, PenpotNode>;
};

import { PenpotPage } from '@figpot/src/models/entities/penpot/page';

export type PenpotDocument = {
  name: string;
  data: {
    pagesIndex: Record<string, PenpotPage>;
  };
};

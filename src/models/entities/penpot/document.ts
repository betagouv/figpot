import { PenpotPage } from '@figpot/src/models/entities/penpot/page';
import { Color } from '@figpot/src/models/entities/penpot/traits/color';

export type PenpotDocument = {
  name: string;
  data: {
    pagesIndex: Record<string, PenpotPage>;
    colors: Record<string, Color>;
  };
};
